#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import mimetypes
import os
import re
import sqlite3
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent
WORKFLOW_DIR = SCRIPT_DIR.parent.parent
DEFAULT_DB_PATH = WORKFLOW_DIR / "03_database" / "ai_ugc_database" / "ai_ugc_product.sqlite"
DEFAULT_OUTPUT_DIR = WORKFLOW_DIR / "04_runtime" / "outputs" / "libtv"
DEFAULT_IM_BASE = "https://im.liblib.tv"
PROJECT_CANVAS_BASE = "https://www.liblib.tv/canvas?projectId="
READY_STATUSES = ("prompt_ready", "ready", "prompt_review")
VIDEO_EXTS = (".mp4", ".mov", ".webm", ".m3u8")
IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".webp")
MEDIA_URL_RE = re.compile(
    r"""https?://[^\s"'<>]+\.(?:png|jpg|jpeg|webp|mp4|mov|webm|m3u8)(?:\?[^\s"'<>]*)?""",
    re.IGNORECASE,
)


class RunnerError(Exception):
    pass


class LibTVAPIError(RunnerError):
    def __init__(self, message: str, status_code: int | None = None, response_body: str = "") -> None:
        super().__init__(message)
        self.status_code = status_code
        self.response_body = response_body


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def load_env(explicit_env_file: str | None = None) -> None:
    if explicit_env_file:
        load_env_file(Path(explicit_env_file).expanduser().resolve())
        return
    for candidate in (Path.cwd() / ".env", SCRIPT_DIR / ".env", SCRIPT_DIR.parent / ".env"):
        load_env_file(candidate)


def resolve_db_path(arg_path: str | None) -> Path:
    configured = arg_path or os.environ.get("AI_UGC_SQLITE_PATH") or str(DEFAULT_DB_PATH)
    return Path(configured).expanduser().resolve()


def get_libtv_access_key() -> str:
    access_key = os.environ.get("LIBTV_ACCESS_KEY", "").strip()
    if not access_key:
        raise RunnerError("Missing LIBTV_ACCESS_KEY. Copy libtv_runner/.env.example to .env and fill it locally.")
    return access_key


def connect(db_path: Path) -> sqlite3.Connection:
    if not db_path.exists():
        raise RunnerError(f"SQLite database not found: {db_path}")
    con = sqlite3.connect(str(db_path))
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys=ON")
    return con


def row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {key: row[key] for key in row.keys()}


def read_json_text(value: str | None, fallback: Any = None) -> Any:
    if not value:
        return fallback if fallback is not None else {}
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback if fallback is not None else {}


def build_project_url(project_uuid: str | None) -> str:
    if not project_uuid:
        return ""
    return PROJECT_CANVAS_BASE + project_uuid.strip()


class LibTVClient:
    def __init__(self, access_key: str, im_base: str = DEFAULT_IM_BASE, timeout: int = 60) -> None:
        if not access_key:
            raise RunnerError("LibTV AccessKey is not set.")
        self.access_key = access_key
        self.im_base = im_base.rstrip("/")
        self.timeout = timeout

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.access_key}",
            "Content-Type": "application/json",
            "User-Agent": "ai-ugc-libtv-runner/1.0",
        }

    def _json_request(self, method: str, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
        url = f"{self.im_base}{path}"
        data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(url, data=data, method=method, headers=self._headers())
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as exc:
            response_body = exc.read().decode("utf-8", errors="replace")
            raise LibTVAPIError(
                f"LibTV API returned HTTP {exc.code}",
                status_code=exc.code,
                response_body=response_body,
            ) from exc
        except urllib.error.URLError as exc:
            raise LibTVAPIError(f"LibTV network error: {exc.reason}") from exc
        except json.JSONDecodeError as exc:
            raise LibTVAPIError(f"LibTV returned non-JSON response from {url}") from exc

    def create_session(self, message: str, session_id: str = "") -> dict[str, Any]:
        body: dict[str, Any] = {}
        if session_id:
            body["sessionId"] = session_id
        if message:
            body["message"] = message
        resp = self._json_request("POST", "/openapi/session", body)
        return resp.get("data", {})

    def query_session(self, session_id: str, after_seq: int = 0) -> dict[str, Any]:
        encoded_session_id = urllib.parse.quote(session_id, safe="")
        path = f"/openapi/session/{encoded_session_id}"
        if after_seq > 0:
            path += f"?afterSeq={after_seq}"
        resp = self._json_request("GET", path)
        return resp.get("data", {})

    def upload_file(self, file_path: Path) -> dict[str, Any]:
        if not file_path.exists() or not file_path.is_file():
            raise RunnerError(f"Asset file not found: {file_path}")
        boundary = "----ai-ugc-libtv-" + uuid.uuid4().hex
        mime_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
        filename = file_path.name
        file_bytes = file_path.read_bytes()
        body = b"".join(
            [
                f"--{boundary}\r\n".encode("utf-8"),
                f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode("utf-8"),
                f"Content-Type: {mime_type}\r\n\r\n".encode("utf-8"),
                file_bytes,
                b"\r\n",
                f"--{boundary}--\r\n".encode("utf-8"),
            ]
        )
        headers = {
            "Authorization": f"Bearer {self.access_key}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "User-Agent": "ai-ugc-libtv-runner/1.0",
        }
        req = urllib.request.Request(
            f"{self.im_base}/openapi/file/upload",
            data=body,
            method="POST",
            headers=headers,
        )
        try:
            with urllib.request.urlopen(req, timeout=max(self.timeout, 120)) as resp:
                raw = resp.read().decode("utf-8")
                parsed = json.loads(raw) if raw else {}
                return parsed.get("data", {})
        except urllib.error.HTTPError as exc:
            response_body = exc.read().decode("utf-8", errors="replace")
            raise LibTVAPIError(
                f"LibTV upload returned HTTP {exc.code}",
                status_code=exc.code,
                response_body=response_body,
            ) from exc
        except urllib.error.URLError as exc:
            raise LibTVAPIError(f"LibTV upload network error: {exc.reason}") from exc


def fetch_ready_tasks(con: sqlite3.Connection, statuses: tuple[str, ...]) -> list[dict[str, Any]]:
    placeholders = ",".join("?" for _ in statuses)
    rows = con.execute(
        f"""
        SELECT
          vt.id AS task_id,
          vt.task_code,
          vt.status AS task_status,
          vt.priority,
          vt.category,
          vt.output_mode,
          vt.libtv_project_id,
          p.product_name,
          fp.id AS prompt_id,
          fp.validation_status,
          length(fp.prompt_text) AS prompt_length,
          lj.status AS libtv_status,
          lj.external_job_id,
          lj.video_url,
          lj.cover_url
        FROM video_tasks vt
        JOIN products p ON p.id = vt.product_id
        JOIN final_product_prompts fp ON fp.task_id = vt.id
        LEFT JOIN libtv_jobs lj ON lj.task_id = vt.id
        WHERE vt.status IN ({placeholders})
        ORDER BY vt.priority ASC, vt.created_at ASC
        """,
        statuses,
    ).fetchall()
    return [dict(row) for row in rows]


def fetch_task(
    con: sqlite3.Connection,
    task_id: str | None = None,
    task_code: str | None = None,
    statuses: tuple[str, ...] = READY_STATUSES,
    include_existing_job: bool = False,
) -> dict[str, Any]:
    where: list[str] = ["fp.prompt_text IS NOT NULL"]
    params: list[Any] = []
    if task_id:
        where.append("vt.id = ?")
        params.append(task_id)
    elif task_code:
        where.append("vt.task_code = ?")
        params.append(task_code)
    elif not include_existing_job:
        placeholders = ",".join("?" for _ in statuses)
        where.append(f"vt.status IN ({placeholders})")
        params.extend(statuses)

    row = con.execute(
        f"""
        SELECT
          vt.id AS task_id,
          vt.task_code,
          vt.product_id,
          vt.status AS task_status,
          vt.priority,
          vt.category,
          vt.output_mode,
          vt.input_payload_json,
          vt.libtv_project_id,
          p.product_name,
          p.product_description,
          p.selling_points,
          fp.id AS prompt_id,
          fp.prompt_text,
          fp.prompt_json,
          fp.validation_status,
          lj.id AS libtv_job_id,
          lj.status AS libtv_status,
          lj.external_job_id,
          lj.submit_payload_json,
          lj.raw_response_json,
          lj.video_url,
          lj.cover_url,
          lj.error_message
        FROM video_tasks vt
        JOIN products p ON p.id = vt.product_id
        JOIN final_product_prompts fp ON fp.task_id = vt.id
        LEFT JOIN libtv_jobs lj ON lj.task_id = vt.id
        WHERE {" AND ".join(where)}
        ORDER BY vt.priority ASC, vt.created_at ASC
        LIMIT 1
        """,
        params,
    ).fetchone()
    task = row_to_dict(row)
    if not task:
        raise RunnerError("No matching task found in the local database.")
    return task


def fetch_task_by_session(con: sqlite3.Connection, session_id: str) -> dict[str, Any] | None:
    row = con.execute(
        """
        SELECT
          vt.id AS task_id,
          vt.task_code,
          vt.product_id,
          vt.status AS task_status,
          vt.libtv_project_id,
          p.product_name,
          fp.id AS prompt_id,
          fp.prompt_text,
          lj.id AS libtv_job_id,
          lj.status AS libtv_status,
          lj.external_job_id,
          lj.video_url,
          lj.cover_url
        FROM libtv_jobs lj
        JOIN video_tasks vt ON vt.id = lj.task_id
        JOIN products p ON p.id = vt.product_id
        LEFT JOIN final_product_prompts fp ON fp.task_id = vt.id
        WHERE lj.external_job_id = ?
        LIMIT 1
        """,
        (session_id,),
    ).fetchone()
    return row_to_dict(row)


def fetch_assets(con: sqlite3.Connection, task: dict[str, Any]) -> list[dict[str, Any]]:
    rows = con.execute(
        """
        SELECT *
        FROM product_assets
        WHERE product_id = ?
          AND (task_id IS NULL OR task_id = ?)
        ORDER BY sort_order ASC, created_at ASC
        """,
        (task["product_id"], task["task_id"]),
    ).fetchall()
    return [dict(row) for row in rows]


def upload_assets_if_requested(
    con: sqlite3.Connection,
    client: LibTVClient,
    assets: list[dict[str, Any]],
    upload_assets: bool,
) -> list[dict[str, Any]]:
    if not upload_assets:
        return assets
    updated: list[dict[str, Any]] = []
    for asset in assets:
        if asset.get("file_url"):
            updated.append(asset)
            continue
        file_path = asset.get("file_path")
        if not file_path:
            updated.append(asset)
            continue
        local_path = Path(file_path).expanduser()
        if not local_path.is_absolute():
            local_path = (SCRIPT_DIR.parent / local_path).resolve()
        data = client.upload_file(local_path)
        url = data.get("url")
        if not url:
            raise RunnerError(f"LibTV upload did not return url for asset {asset.get('id')}")
        con.execute(
            """
            UPDATE product_assets
            SET file_url = ?,
                metadata_json = ?,
                size_bytes = COALESCE(size_bytes, ?)
            WHERE id = ?
            """,
            (
                url,
                json_dumps({**read_json_text(asset.get("metadata_json"), {}), "libtv_upload": data}),
                local_path.stat().st_size,
                asset["id"],
            ),
        )
        asset = {**asset, "file_url": url}
        updated.append(asset)
    con.commit()
    return updated


def compose_libtv_message(task: dict[str, Any], assets: list[dict[str, Any]]) -> str:
    prompt = (task.get("prompt_text") or "").strip()
    if not prompt:
        raise RunnerError(f"Task {task.get('task_code')} has empty final prompt.")
    asset_lines = []
    for asset in assets:
        file_url = asset.get("file_url")
        if file_url:
            label = asset.get("asset_type") or "reference"
            asset_lines.append(f"- {label}: {file_url}")
    if asset_lines:
        prompt += (
            "\n\n参考素材URL：\n"
            + "\n".join(asset_lines)
            + "\n请优先保持参考素材中的商品外观、颜色、材质和比例。"
        )
    return prompt


def add_event(
    con: sqlite3.Connection,
    task_id: str | None,
    event_type: str,
    message: str,
    payload: dict[str, Any] | None = None,
) -> None:
    con.execute(
        """
        INSERT INTO task_events (id, task_id, event_type, message, payload_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (new_id(), task_id, event_type, message, json_dumps(payload or {}), now_iso()),
    )


def record_error(
    con: sqlite3.Connection,
    task_id: str | None,
    source: str,
    error_message: str,
    error_code: str | None = None,
    payload: dict[str, Any] | None = None,
    mark_task_failed: bool = False,
) -> None:
    con.execute(
        """
        INSERT INTO error_reports (
          id, task_id, source, error_code, error_message, raw_payload_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (new_id(), task_id, source, error_code, error_message, json_dumps(payload or {}), now_iso()),
    )
    if mark_task_failed and task_id:
        con.execute(
            """
            UPDATE video_tasks
            SET status = 'failed',
                updated_at = ?
            WHERE id = ?
            """,
            (now_iso(), task_id),
        )
        con.execute(
            """
            UPDATE libtv_jobs
            SET status = 'failed',
                error_message = ?
            WHERE task_id = ?
            """,
            (error_message, task_id),
        )


def save_submit_result(
    con: sqlite3.Connection,
    task: dict[str, Any],
    message: str,
    response_data: dict[str, Any],
) -> dict[str, Any]:
    session_id = response_data.get("sessionId")
    project_uuid = response_data.get("projectUuid") or task.get("libtv_project_id") or ""
    if not session_id:
        raise RunnerError("LibTV submit response did not include sessionId.")
    ts = now_iso()
    payload = {
        "task_code": task["task_code"],
        "prompt_id": task.get("prompt_id"),
        "message": message,
        "message_length": len(message),
    }
    job_id = task.get("libtv_job_id") or new_id()
    con.execute(
        """
        INSERT INTO libtv_jobs (
          id, task_id, external_job_id, status, submit_payload_json,
          raw_response_json, submitted_at, created_at
        ) VALUES (?, ?, ?, 'submitted', ?, ?, ?, ?)
        ON CONFLICT(task_id) DO UPDATE SET
          external_job_id = excluded.external_job_id,
          status = 'submitted',
          submit_payload_json = excluded.submit_payload_json,
          raw_response_json = excluded.raw_response_json,
          submitted_at = excluded.submitted_at,
          error_message = NULL
        """,
        (job_id, task["task_id"], session_id, json_dumps(payload), json_dumps(response_data), ts, ts),
    )
    con.execute(
        """
        UPDATE video_tasks
        SET status = 'video_generating',
            libtv_project_id = COALESCE(NULLIF(?, ''), libtv_project_id),
            libtv_api_mode = 'openapi_session',
            started_at = COALESCE(started_at, ?),
            updated_at = ?
        WHERE id = ?
        """,
        (project_uuid, ts, ts, task["task_id"]),
    )
    add_event(
        con,
        task["task_id"],
        "libtv_submitted",
        "Submitted final product prompt to LibTV OpenAPI.",
        {
            "sessionId": session_id,
            "projectUuid": project_uuid,
            "projectUrl": build_project_url(project_uuid),
        },
    )
    con.commit()
    return {
        "task_code": task["task_code"],
        "sessionId": session_id,
        "projectUuid": project_uuid,
        "projectUrl": build_project_url(project_uuid),
        "status": "submitted",
    }


def save_poll_result(
    con: sqlite3.Connection,
    task: dict[str, Any],
    session_id: str,
    session_data: dict[str, Any],
    video_url: str | None,
    cover_url: str | None,
) -> dict[str, Any]:
    ts = now_iso()
    if video_url:
        con.execute(
            """
            UPDATE libtv_jobs
            SET status = 'succeeded',
                raw_response_json = ?,
                video_url = ?,
                cover_url = COALESCE(?, cover_url),
                completed_at = ?,
                error_message = NULL
            WHERE task_id = ?
            """,
            (json_dumps(session_data), video_url, cover_url, ts, task["task_id"]),
        )
        con.execute(
            """
            UPDATE video_tasks
            SET status = 'video_ready',
                finished_at = COALESCE(finished_at, ?),
                updated_at = ?
            WHERE id = ?
            """,
            (ts, ts, task["task_id"]),
        )
        add_event(
            con,
            task["task_id"],
            "libtv_video_ready",
            "LibTV video URL saved to local database.",
            {"sessionId": session_id, "video_url": video_url, "cover_url": cover_url},
        )
        status = "succeeded"
    else:
        con.execute(
            """
            UPDATE libtv_jobs
            SET status = 'running',
                raw_response_json = ?
            WHERE task_id = ?
            """,
            (json_dumps(session_data), task["task_id"]),
        )
        con.execute(
            """
            UPDATE video_tasks
            SET status = 'video_generating',
                updated_at = ?
            WHERE id = ?
            """,
            (ts, task["task_id"]),
        )
        status = "running"
    con.commit()
    return {
        "task_code": task.get("task_code"),
        "sessionId": session_id,
        "status": status,
        "video_url": video_url,
        "cover_url": cover_url,
    }


def collect_media_urls(value: Any, urls: list[str]) -> None:
    if isinstance(value, str):
        urls.extend(MEDIA_URL_RE.findall(value))
        return
    if isinstance(value, list):
        for item in value:
            collect_media_urls(item, urls)
        return
    if isinstance(value, dict):
        for key in ("previewPath", "url", "videoUrl", "video_url", "coverUrl", "cover_url", "imageUrl", "image_url"):
            item = value.get(key)
            if isinstance(item, str):
                urls.extend(MEDIA_URL_RE.findall(item))
        for item in value.values():
            collect_media_urls(item, urls)


def extract_urls_from_messages(messages: list[dict[str, Any]]) -> list[str]:
    urls: list[str] = []
    for msg in messages:
        content = msg.get("content")
        if isinstance(content, str):
            stripped = content.strip()
            if stripped.startswith("{") or stripped.startswith("["):
                try:
                    collect_media_urls(json.loads(stripped), urls)
                except json.JSONDecodeError:
                    collect_media_urls(content, urls)
            else:
                collect_media_urls(content, urls)
        elif content is not None:
            collect_media_urls(content, urls)
        collect_media_urls({k: v for k, v in msg.items() if k != "content"}, urls)
    unique: list[str] = []
    seen: set[str] = set()
    for url in urls:
        cleaned = url.rstrip(").,，。；;")
        if cleaned not in seen:
            seen.add(cleaned)
            unique.append(cleaned)
    return unique


def split_cover_and_video(urls: list[str]) -> tuple[str | None, str | None]:
    video_url = None
    cover_url = None
    for url in urls:
        clean_path = urllib.parse.urlparse(url).path.lower()
        if video_url is None and clean_path.endswith(VIDEO_EXTS):
            video_url = url
        if cover_url is None and clean_path.endswith(IMAGE_EXTS):
            cover_url = url
    return video_url, cover_url


def download_url(url: str, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "ai-ugc-libtv-runner/1.0"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        with output_path.open("wb") as fh:
            while True:
                chunk = resp.read(1024 * 1024)
                if not chunk:
                    break
                fh.write(chunk)


def save_downloaded_asset(
    con: sqlite3.Connection,
    task: dict[str, Any],
    asset_type: str,
    url: str,
    file_path: Path,
    sort_order: int,
) -> None:
    con.execute(
        """
        INSERT INTO product_assets (
          id, product_id, task_id, asset_type, sort_order, file_url,
          file_path, format, size_bytes, metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            new_id(),
            task["product_id"],
            task["task_id"],
            asset_type,
            sort_order,
            url,
            str(file_path),
            file_path.suffix.lstrip(".").lower(),
            file_path.stat().st_size if file_path.exists() else None,
            json_dumps({"source": "libtv_download"}),
            now_iso(),
        ),
    )


def download_results(
    con: sqlite3.Connection,
    task: dict[str, Any],
    urls: list[str],
    output_dir: Path,
) -> list[str]:
    task_dir = output_dir / task["task_code"]
    downloaded: list[str] = []
    for index, url in enumerate(urls, start=1):
        suffix = Path(urllib.parse.urlparse(url).path).suffix or ".bin"
        clean_suffix = suffix.lower()
        asset_type = "libtv_output_video" if clean_suffix in VIDEO_EXTS else "libtv_output_cover"
        output_path = task_dir / f"{index:02d}{clean_suffix}"
        download_url(url, output_path)
        save_downloaded_asset(con, task, asset_type, url, output_path, index)
        downloaded.append(str(output_path))
    con.commit()
    return downloaded


def command_list(args: argparse.Namespace) -> dict[str, Any]:
    db_path = resolve_db_path(args.db)
    with connect(db_path) as con:
        tasks = fetch_ready_tasks(con, tuple(args.status))
    return {"database": str(db_path), "tasks": tasks, "count": len(tasks)}


def command_submit(args: argparse.Namespace) -> dict[str, Any]:
    load_env(args.env_file)
    db_path = resolve_db_path(args.db)
    with connect(db_path) as con:
        task = fetch_task(con, args.task_id, args.task_code, tuple(args.status))
        assets = fetch_assets(con, task)
        if args.dry_run:
            message = compose_libtv_message(task, assets)
            return {
                "dry_run": True,
                "database": str(db_path),
                "task_code": task["task_code"],
                "task_status": task["task_status"],
                "product_name": task["product_name"],
                "prompt_length": len(task["prompt_text"]),
                "message_length": len(message),
                "asset_count": len(assets),
                "would_call": {
                    "method": "POST",
                    "base": os.environ.get("OPENAPI_IM_BASE") or os.environ.get("IM_BASE_URL") or DEFAULT_IM_BASE,
                    "path": "/openapi/session",
                    "body_keys": ["message"],
                },
            }
        client = LibTVClient(
            access_key=get_libtv_access_key(),
            im_base=os.environ.get("OPENAPI_IM_BASE") or os.environ.get("IM_BASE_URL") or DEFAULT_IM_BASE,
            timeout=args.timeout,
        )
        assets = upload_assets_if_requested(con, client, assets, args.upload_assets)
        message = compose_libtv_message(task, assets)
        try:
            response_data = client.create_session(message=message, session_id=args.session_id or "")
            return save_submit_result(con, task, message, response_data)
        except LibTVAPIError as exc:
            payload = {"status_code": exc.status_code, "response_body": exc.response_body}
            record_error(con, task["task_id"], "libtv_submit", str(exc), "LIBTV_API_ERROR", payload, True)
            con.commit()
            raise


def resolve_poll_target(args: argparse.Namespace, con: sqlite3.Connection) -> tuple[dict[str, Any], str]:
    if args.session_id:
        task = fetch_task_by_session(con, args.session_id)
        if not task:
            if not args.task_id and not args.task_code:
                raise RunnerError("Session id is not linked to a local task. Provide --task-code or --task-id.")
            task = fetch_task(con, args.task_id, args.task_code, include_existing_job=True)
        return task, args.session_id
    task = fetch_task(con, args.task_id, args.task_code, include_existing_job=True)
    session_id = task.get("external_job_id")
    if not session_id:
        raise RunnerError(f"Task {task.get('task_code')} has no LibTV session id yet.")
    return task, session_id


def command_poll(args: argparse.Namespace) -> dict[str, Any]:
    load_env(args.env_file)
    db_path = resolve_db_path(args.db)
    client = LibTVClient(
        access_key=get_libtv_access_key(),
        im_base=os.environ.get("OPENAPI_IM_BASE") or os.environ.get("IM_BASE_URL") or DEFAULT_IM_BASE,
        timeout=args.timeout,
    )
    with connect(db_path) as con:
        task, session_id = resolve_poll_target(args, con)
        try:
            session_data = client.query_session(session_id, after_seq=args.after_seq)
            messages = session_data.get("messages", [])
            urls = extract_urls_from_messages(messages)
            video_url, cover_url = split_cover_and_video(urls)
            result = save_poll_result(con, task, session_id, session_data, video_url, cover_url)
            result["media_urls"] = urls
            if args.download and urls:
                result["downloaded"] = download_results(con, task, urls, Path(args.output_dir).expanduser().resolve())
            return result
        except LibTVAPIError as exc:
            payload = {"status_code": exc.status_code, "response_body": exc.response_body}
            record_error(con, task["task_id"], "libtv_poll", str(exc), "LIBTV_API_ERROR", payload, False)
            con.commit()
            raise


def command_run(args: argparse.Namespace) -> dict[str, Any]:
    submit_args = argparse.Namespace(**vars(args))
    submit_args.dry_run = False
    submit_args.session_id = args.session_id if args.resubmit else ""

    db_path = resolve_db_path(args.db)
    with connect(db_path) as con:
        task = fetch_task(con, args.task_id, args.task_code, include_existing_job=True)
        existing_session_id = task.get("external_job_id")

    if existing_session_id and not args.resubmit:
        session_id = existing_session_id
        submit_result = {
            "task_code": task["task_code"],
            "sessionId": session_id,
            "status": "existing_session",
        }
    else:
        submit_result = command_submit(submit_args)
        session_id = submit_result["sessionId"]

    deadline = time.monotonic() + args.max_wait_seconds
    poll_result: dict[str, Any] = {}
    while time.monotonic() <= deadline:
        poll_args = argparse.Namespace(**vars(args))
        poll_args.session_id = session_id
        poll_args.after_seq = 0
        poll_result = command_poll(poll_args)
        if poll_result.get("status") == "succeeded":
            return {"submit": submit_result, "poll": poll_result}
        time.sleep(args.poll_interval)
    return {
        "submit": submit_result,
        "poll": poll_result,
        "status": "timeout",
        "message": f"No final video URL before timeout ({args.max_wait_seconds}s). Poll again later.",
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Submit AI UGC database prompts to LibTV and write results back to SQLite.",
    )
    parser.add_argument("--db", default="", help="SQLite path. Default: ai_ugc_product.sqlite beside this project.")
    parser.add_argument("--env-file", default="", help="Optional .env file containing LIBTV_ACCESS_KEY.")
    parser.add_argument("--timeout", type=int, default=60, help="HTTP timeout seconds.")
    sub = parser.add_subparsers(dest="command", required=True)

    list_parser = sub.add_parser("list", help="List local tasks ready for LibTV.")
    list_parser.add_argument("--status", action="append", default=list(READY_STATUSES), help="Task status to include.")
    list_parser.set_defaults(func=command_list)

    submit_parser = sub.add_parser("submit", help="Submit one prompt to LibTV.")
    add_task_args(submit_parser)
    submit_parser.add_argument("--status", action="append", default=list(READY_STATUSES), help="Task status to include.")
    submit_parser.add_argument("--session-id", default="", help="Append message to an existing LibTV session.")
    submit_parser.add_argument("--upload-assets", action="store_true", help="Upload product_assets file_path values first.")
    submit_parser.add_argument("--dry-run", action="store_true", help="Do not call LibTV or modify the database.")
    submit_parser.set_defaults(func=command_submit)

    poll_parser = sub.add_parser("poll", help="Poll a LibTV session and save video URL if ready.")
    add_task_args(poll_parser)
    poll_parser.add_argument("--session-id", default="", help="LibTV session id. If omitted, read it from libtv_jobs.")
    poll_parser.add_argument("--after-seq", type=int, default=0, help="Only fetch messages with seq greater than this.")
    poll_parser.add_argument("--download", action="store_true", help="Download returned media into local output directory.")
    poll_parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Download output directory.")
    poll_parser.set_defaults(func=command_poll)

    run_parser = sub.add_parser("run", help="Submit, poll until ready, and optionally download results.")
    add_task_args(run_parser)
    run_parser.add_argument("--status", action="append", default=list(READY_STATUSES), help="Task status to include.")
    run_parser.add_argument("--session-id", default="", help="Append to this LibTV session when --resubmit is used.")
    run_parser.add_argument("--upload-assets", action="store_true", help="Upload product_assets file_path values first.")
    run_parser.add_argument("--resubmit", action="store_true", help="Create/send a new LibTV request even if a session exists.")
    run_parser.add_argument("--poll-interval", type=int, default=30, help="Seconds between polls.")
    run_parser.add_argument("--max-wait-seconds", type=int, default=1800, help="Maximum wait time for final video URL.")
    run_parser.add_argument("--download", action="store_true", help="Download returned media into local output directory.")
    run_parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Download output directory.")
    run_parser.set_defaults(func=command_run)

    return parser


def add_task_args(parser: argparse.ArgumentParser) -> None:
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--task-id", default="", help="video_tasks.id")
    group.add_argument("--task-code", default="", help="video_tasks.task_code")


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        result = args.func(args)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except RunnerError as exc:
        payload: dict[str, Any] = {"error": str(exc)}
        if isinstance(exc, LibTVAPIError):
            payload["status_code"] = exc.status_code
            if exc.response_body:
                payload["response_body"] = exc.response_body
        print(json.dumps(payload, ensure_ascii=False, indent=2), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
