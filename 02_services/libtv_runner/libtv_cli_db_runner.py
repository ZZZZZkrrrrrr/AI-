#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import locale
import os
import re
import sqlite3
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent
WORKFLOW_DIR = SCRIPT_DIR.parent.parent
DEFAULT_DB_PATH = WORKFLOW_DIR / "03_database" / "ai_database" / "ai_product.sqlite"
LEGACY_DB_PATH = DEFAULT_DB_PATH
DEFAULT_OUTPUT_DIR = WORKFLOW_DIR / "04_runtime" / "outputs" / "libtv"
DEFAULT_LIBTV = SCRIPT_DIR / "bin" / "libtv.exe"
DEFAULT_CONFIG_DIR = SCRIPT_DIR / ".libtv_config"
DEFAULT_MODEL = os.environ.get("LIBTV_VIDEO_MODEL") or "Seedance 2.0 Fast VIP"
READY_STATUSES = ("prompt_ready", "ready", "prompt_review", "compliance_required")
PROJECT_UUID_RE = re.compile(
    r"^(?:[0-9a-fA-F]{32}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$"
)
MEDIA_URL_RE = re.compile(
    r"""https?://[^\s"'<>]+\.(?:png|jpg|jpeg|webp|mp4|mov|webm|m3u8)(?:\?[^\s"'<>]*)?""",
    re.IGNORECASE,
)
COMPLIANCE_REQUIRED_RE = re.compile(r"(合规校验|真人形象|参考图可能包含真人|Seedance)", re.IGNORECASE)
VIDEO_EXTS = (".mp4", ".mov", ".webm", ".m3u8")
IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".webp")


class RunnerError(Exception):
    pass


class CLIError(RunnerError):
    def __init__(self, message: str, returncode: int, stdout: str, stderr: str) -> None:
        super().__init__(message)
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def decode_process_output(data: bytes | str | None) -> str:
    if data is None:
        return ""
    if isinstance(data, str):
        return data

    encodings = [
        "utf-8",
        "utf-8-sig",
        locale.getpreferredencoding(False),
        "gb18030",
        "cp936",
    ]
    seen: set[str] = set()
    candidates: list[tuple[int, str]] = []
    for encoding in encodings:
        if not encoding:
            continue
        normalized = encoding.lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        try:
            text = data.decode(encoding)
            penalty = 0
        except UnicodeDecodeError:
            text = data.decode(encoding, errors="replace")
            penalty = 100
        penalty += text.count("\ufffd") * 10
        penalty += sum(1 for char in text if ord(char) < 32 and char not in "\r\n\t")
        candidates.append((penalty, text))

    if not candidates:
        return data.decode("utf-8", errors="replace")
    return min(candidates, key=lambda item: item[0])[1]


def read_json_text(value: str | None, fallback: Any = None) -> Any:
    if not value:
        return fallback if fallback is not None else {}
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback if fallback is not None else {}


def resolve_db_path(path: str | None) -> Path:
    configured = path or os.environ.get("AI_UGC_SQLITE_PATH")
    if configured:
        return Path(configured).expanduser().resolve()
    return DEFAULT_DB_PATH if DEFAULT_DB_PATH.exists() else LEGACY_DB_PATH


def resolve_libtv_path(path: str | None) -> Path:
    configured = path or os.environ.get("LIBTV_CLI_PATH") or str(DEFAULT_LIBTV)
    libtv = Path(configured).expanduser().resolve()
    if not libtv.exists():
        raise RunnerError(f"LibTV CLI not found: {libtv}")
    return libtv


def connect(db_path: Path) -> sqlite3.Connection:
    if not db_path.exists():
        raise RunnerError(f"SQLite database not found: {db_path}")
    con = sqlite3.connect(str(db_path), timeout=180)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA busy_timeout=180000")
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA foreign_keys=ON")
    return con


def row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {key: row[key] for key in row.keys()}


def parse_json_output(stdout: str) -> Any:
    text = stdout.strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    values: list[Any] = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            values.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    if len(values) == 1:
        return values[0]
    if values:
        return values
    return {"raw": text}


def is_compliance_required_message(text: str) -> bool:
    return bool(COMPLIANCE_REQUIRED_RE.search(text or ""))


def iter_json_objects_from_text(text: str):
    decoder = json.JSONDecoder()
    index = 0
    text = text or ""
    while index < len(text):
        start = text.find("{", index)
        if start < 0:
            break
        try:
            value, consumed = decoder.raw_decode(text[start:])
        except json.JSONDecodeError:
            index = start + 1
            continue
        yield value
        index = start + consumed


def extract_failed_libtv_snapshot(stdout: str, stderr: str, project_uuid: str = "", node_name: str = "") -> dict[str, Any]:
    snapshot: dict[str, Any] = {}
    if project_uuid:
        snapshot["projectUuid"] = project_uuid
    if node_name:
        snapshot["nodeName"] = node_name

    for value in iter_json_objects_from_text("\n".join([stdout or "", stderr or ""])):
        if not isinstance(value, dict):
            continue
        if value.get("projectUuid"):
            snapshot["projectUuid"] = value.get("projectUuid")
        if value.get("newNodeKey"):
            snapshot["nodeKey"] = value.get("newNodeKey")
        if value.get("nodeKey"):
            snapshot["nodeKey"] = value.get("nodeKey")

        react_flow_node = value.get("reactFlowNode")
        if isinstance(react_flow_node, dict):
            if react_flow_node.get("id"):
                snapshot["nodeKey"] = react_flow_node.get("id")
            data = react_flow_node.get("data")
            if isinstance(data, dict):
                if data.get("name"):
                    snapshot["nodeName"] = data.get("name")
                task_info = data.get("taskInfo")
                if isinstance(task_info, dict):
                    if task_info.get("taskId"):
                        snapshot["taskId"] = task_info.get("taskId")
                    if task_info.get("failedReason"):
                        snapshot["failedReason"] = task_info.get("failedReason")

        data = value.get("data")
        if isinstance(data, dict):
            if data.get("name"):
                snapshot["nodeName"] = data.get("name")
            task_info = data.get("taskInfo")
            if isinstance(task_info, dict):
                if task_info.get("taskId"):
                    snapshot["taskId"] = task_info.get("taskId")
                if task_info.get("failedReason"):
                    snapshot["failedReason"] = task_info.get("failedReason")

    combined_text = "\n".join([stdout or "", stderr or "", str(snapshot.get("failedReason") or "")])
    if is_compliance_required_message(combined_text):
        snapshot["complianceRequired"] = True
    return {key: value for key, value in snapshot.items() if value not in ("", None)}


def clean_cli_error_message(exc: CLIError, snapshot: dict[str, Any]) -> str:
    failed_reason = str(snapshot.get("failedReason") or "").strip()
    if failed_reason:
        return failed_reason
    stderr = (exc.stderr or "").strip()
    if stderr:
        return stderr
    stdout = (exc.stdout or "").strip()
    if stdout and len(stdout) <= 800:
        return stdout
    if snapshot.get("complianceRequired"):
        return "libTV 合规校验未通过：参考图可能包含真人形象，请先到 libTV 角色库完成人物资产录入或合规校验后再重试。"
    return str(exc)


def run_libtv(args: list[str], cli_path: Path, timeout: int, cwd: Path = WORKFLOW_DIR) -> dict[str, Any]:
    env = os.environ.copy()
    env.setdefault("LIBTV_CONFIG_DIR", str(DEFAULT_CONFIG_DIR))
    DEFAULT_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    try:
        proc = subprocess.run(
            [str(cli_path), *args],
            cwd=str(cwd),
            env=env,
            capture_output=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        stdout = decode_process_output(exc.stdout).strip()
        stderr = decode_process_output(exc.stderr).strip()
        raise CLIError(
            f"libtv command timed out after {timeout}s: libtv {' '.join(args)}",
            124,
            stdout,
            stderr,
        ) from exc
    stdout = decode_process_output(proc.stdout)
    stderr = decode_process_output(proc.stderr)
    parsed = parse_json_output(stdout)
    result = {
        "args": args,
        "returncode": proc.returncode,
        "stdout": stdout.strip(),
        "stderr": stderr.strip(),
        "json": parsed,
    }
    if proc.returncode != 0:
        raise CLIError(
            f"libtv command failed: libtv {' '.join(args)}",
            proc.returncode,
            stdout,
            stderr,
        )
    return result


def find_uuid(value: Any) -> str | None:
    if isinstance(value, str):
        return value if PROJECT_UUID_RE.match(value) else None
    if isinstance(value, list):
        for item in value:
            found = find_uuid(item)
            if found:
                return found
    if isinstance(value, dict):
        for key in ("uuid", "projectUuid", "project_uuid", "id"):
            found = find_uuid(value.get(key))
            if found:
                return found
        for item in value.values():
            found = find_uuid(item)
            if found:
                return found
    return None


def find_node_key(value: Any) -> str | None:
    if isinstance(value, list):
        for item in value:
            found = find_node_key(item)
            if found:
                return found
    if isinstance(value, dict):
        for key in ("nodeKey", "newNodeKey", "key", "id"):
            item = value.get(key)
            if isinstance(item, str) and item:
                return item
        for item in value.values():
            found = find_node_key(item)
            if found:
                return found
    return None


def collect_media_urls(value: Any, urls: list[str]) -> None:
    if isinstance(value, str):
        urls.extend(MEDIA_URL_RE.findall(value))
        return
    if isinstance(value, list):
        for item in value:
            collect_media_urls(item, urls)
        return
    if isinstance(value, dict):
        for item in value.values():
            collect_media_urls(item, urls)


def extract_media_urls(value: Any) -> list[str]:
    urls: list[str] = []
    collect_media_urls(value, urls)
    unique: list[str] = []
    seen: set[str] = set()
    for url in urls:
        cleaned = url.rstrip(").,，。；;")
        if cleaned not in seen:
            seen.add(cleaned)
            unique.append(cleaned)
    return unique


def split_video_cover(urls: list[str]) -> tuple[str | None, str | None]:
    video_url = None
    cover_url = None
    for url in urls:
        path = re.sub(r"\?.*$", "", url).lower()
        if video_url is None and path.endswith(VIDEO_EXTS):
            video_url = url
        if cover_url is None and path.endswith(IMAGE_EXTS):
            cover_url = url
    return video_url, cover_url


def task_node_name(task_code: str, explicit: str = "") -> str:
    if explicit:
        return explicit
    clean = re.sub(r"[^0-9A-Za-z_.-]+", "-", task_code).strip("-")
    return f"AIUGC-{clean}-video"


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
    task_id: str = "",
    task_code: str = "",
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


def add_event(con: sqlite3.Connection, task_id: str | None, event_type: str, message: str, payload: dict[str, Any] | None = None) -> None:
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
    mark_failed: bool = False,
) -> None:
    con.execute(
        """
        INSERT INTO error_reports (
          id, task_id, source, error_code, error_message, raw_payload_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (new_id(), task_id, source, error_code, error_message, json_dumps(payload or {}), now_iso()),
    )
    if mark_failed and task_id:
        con.execute(
            "UPDATE video_tasks SET status = 'failed', updated_at = ? WHERE id = ?",
            (now_iso(), task_id),
        )
        con.execute(
            "UPDATE libtv_jobs SET status = 'failed', error_message = ? WHERE task_id = ?",
            (error_message, task_id),
        )


def ensure_project(task: dict[str, Any], cli_path: Path, timeout: int, team_id: str = "") -> tuple[str, dict[str, Any] | None]:
    existing = task.get("libtv_project_id") or ""
    if PROJECT_UUID_RE.match(existing):
        return existing, None
    project_name = f"AIUGC-{task['task_code']}"
    listed = run_libtv(["project", "list", "--name", project_name, "-s", "20"], cli_path, timeout)
    projects = (listed.get("json") or {}).get("projectMetaList") if isinstance(listed.get("json"), dict) else None
    if isinstance(projects, list):
        for project in projects:
            if isinstance(project, dict) and project.get("name") == project_name and find_uuid(project):
                return find_uuid(project) or "", {"project_list": listed, "reused": True}
    args = ["project", "create", project_name, "-d", f"AI UGC generated from local database task {task['task_code']}"]
    if team_id:
        args.extend(["--team-id", team_id])
    created = run_libtv(args, cli_path, timeout)
    project_uuid = find_uuid(created["json"])
    if not project_uuid:
        raise RunnerError("LibTV project create did not return a project UUID.")
    return project_uuid, created


def fetch_product_image_assets(con: sqlite3.Connection, task: dict[str, Any]) -> list[dict[str, Any]]:
    rows = con.execute(
        """
        SELECT *
        FROM product_assets
        WHERE product_id = ?
          AND (task_id IS NULL OR task_id = ?)
          AND asset_type IN ('product_image', 'reference_image')
        ORDER BY sort_order ASC, created_at ASC
        """,
        (task["product_id"], task["task_id"]),
    ).fetchall()
    return [dict(row) for row in rows]


def append_remote_reference_urls(prompt: str, assets: list[dict[str, Any]]) -> str:
    urls = [asset.get("file_url") for asset in assets if asset.get("file_url") and not asset.get("file_path")]
    if not urls:
        return prompt
    lines = "\n".join(f"- {url}" for url in urls)
    return f"{prompt}\n\n产品参考图链接：\n{lines}\n请保持参考图里的产品外观、材质、颜色和比例。"


def upload_reference_images(
    con: sqlite3.Connection,
    task: dict[str, Any],
    assets: list[dict[str, Any]],
    project_uuid: str,
    cli_path: Path,
    args: argparse.Namespace,
) -> list[dict[str, Any]]:
    if args.no_product_image:
        return []
    uploaded: list[dict[str, Any]] = []
    for index, asset in enumerate(assets, start=1):
        metadata = read_json_text(asset.get("metadata_json"), {})
        existing = metadata.get("libtv_cli") if isinstance(metadata, dict) else None
        if (
            isinstance(existing, dict)
            and existing.get("projectUuid") == project_uuid
            and existing.get("nodeKey")
            and not args.reupload_assets
        ):
            uploaded.append({"asset_id": asset["id"], "nodeKey": existing["nodeKey"], "nodeName": existing.get("nodeName")})
            continue

        file_path = asset.get("file_path")
        if not file_path:
            continue
        local_path = Path(file_path).expanduser()
        if not local_path.is_absolute():
            local_path = (WORKFLOW_DIR / local_path).resolve()
        if not local_path.exists():
            raise RunnerError(f"Product image file not found: {local_path}")

        node_name = f"{task['task_code']}-product-image-{index}"
        upload_result = run_libtv(
            ["upload", node_name, "-p", project_uuid, "-t", "image", "--resource", str(local_path)],
            cli_path,
            args.timeout,
        )
        node_key = find_node_key(upload_result["json"]) or node_name
        libtv_cli = {
            "projectUuid": project_uuid,
            "nodeName": node_name,
            "nodeKey": node_key,
            "upload_result": upload_result,
        }
        merged_metadata = metadata if isinstance(metadata, dict) else {}
        merged_metadata["libtv_cli"] = libtv_cli
        con.execute(
            """
            UPDATE product_assets
            SET metadata_json = ?,
                size_bytes = COALESCE(size_bytes, ?)
            WHERE id = ?
            """,
            (json_dumps(merged_metadata), local_path.stat().st_size, asset["id"]),
        )
        uploaded.append({"asset_id": asset["id"], "nodeKey": node_key, "nodeName": node_name})
    return uploaded


def build_node_args(
    project_uuid: str,
    node_name: str,
    prompt: str,
    args: argparse.Namespace,
    create: bool,
    left_nodes: list[str] | None = None,
    mode_type: str = "text2video",
) -> list[str]:
    params = [
        "node",
    ]
    if create:
        params.extend(["create", node_name, "-p", project_uuid, "-t", "video"])
    else:
        params.extend([node_name, "-p", project_uuid])
    params.extend(
        [
            "--prompt",
            prompt,
            "-s",
            f"model={args.model}",
            "-s",
            f"modeType={mode_type}",
            "-s",
            f"ratio={args.ratio}",
            "-s",
            f"duration={args.duration}",
            "-s",
            f"resolution={args.resolution}",
            "-s",
            f"enableSound={args.enable_sound}",
            "-s",
            f"count={args.count}",
            "-s",
            f"autoCompliance={args.auto_compliance}",
            "-s",
            f"searchEnabled={args.search_enabled}",
        ]
    )
    for node in left_nodes or []:
        params.extend(["--left", node])
    params.append("-r")
    return params


def record_libtv_submit_failure(
    con: sqlite3.Connection,
    task: dict[str, Any],
    args: argparse.Namespace,
    project_uuid: str,
    node_name: str,
    mode_type: str,
    image_assets: list[dict[str, Any]],
    uploaded_images: list[dict[str, Any]],
    exc: CLIError,
) -> None:
    snapshot = extract_failed_libtv_snapshot(exc.stdout, exc.stderr, project_uuid, node_name)
    compliance_required = bool(snapshot.get("complianceRequired"))
    task_status = "compliance_required" if compliance_required else "failed"
    job_status = "compliance_required" if compliance_required else "failed"
    error_code = "LIBTV_COMPLIANCE_REQUIRED" if compliance_required else "LIBTV_CLI_ERROR"
    error_message = clean_cli_error_message(exc, snapshot)
    node_key = snapshot.get("nodeKey") or node_name
    ts = now_iso()
    submit_payload = {
        "transport": "cli",
        "projectUuid": snapshot.get("projectUuid") or project_uuid,
        "nodeName": snapshot.get("nodeName") or node_name,
        "nodeKey": node_key,
        "model": args.model,
        "modeType": mode_type,
        "ratio": args.ratio,
        "duration": args.duration,
        "resolution": args.resolution,
        "enableSound": args.enable_sound,
        "count": args.count,
        "autoCompliance": args.auto_compliance,
        "searchEnabled": args.search_enabled,
        "prompt_id": task.get("prompt_id"),
        "image_assets": image_assets,
        "uploaded_images": uploaded_images,
        "errorCode": error_code,
    }
    raw_response = {
        "transport": "cli",
        "returncode": exc.returncode,
        "stdout": exc.stdout,
        "stderr": exc.stderr,
        "snapshot": snapshot,
    }
    job_id = task.get("libtv_job_id") or new_id()
    con.execute(
        """
        INSERT INTO libtv_jobs (
          id, task_id, external_job_id, status, submit_payload_json,
          raw_response_json, error_message, submitted_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(task_id) DO UPDATE SET
          external_job_id = excluded.external_job_id,
          status = excluded.status,
          submit_payload_json = excluded.submit_payload_json,
          raw_response_json = excluded.raw_response_json,
          error_message = excluded.error_message,
          submitted_at = excluded.submitted_at
        """,
        (job_id, task["task_id"], node_key, job_status, json_dumps(submit_payload), json_dumps(raw_response), error_message, ts, ts),
    )
    con.execute(
        """
        UPDATE video_tasks
        SET status = ?,
            libtv_project_id = COALESCE(?, libtv_project_id),
            libtv_api_mode = 'cli',
            started_at = COALESCE(started_at, ?),
            updated_at = ?
        WHERE id = ?
        """,
        (task_status, snapshot.get("projectUuid") or project_uuid, ts, ts, task["task_id"]),
    )
    add_event(
        con,
        task["task_id"],
        "libtv_cli_compliance_required" if compliance_required else "libtv_cli_submit_failed",
        error_message,
        {
            "projectUuid": snapshot.get("projectUuid") or project_uuid,
            "nodeName": snapshot.get("nodeName") or node_name,
            "nodeKey": node_key,
            "errorCode": error_code,
            "complianceRequired": compliance_required,
        },
    )


def submit_task(con: sqlite3.Connection, task: dict[str, Any], cli_path: Path, args: argparse.Namespace) -> dict[str, Any]:
    prompt = (task.get("prompt_text") or "").strip()
    if not prompt:
        raise RunnerError(f"Task {task.get('task_code')} has empty final prompt.")

    node_name = task_node_name(task["task_code"], args.node_name)
    project_uuid, project_create = ensure_project(task, cli_path, args.timeout, args.team_id)
    image_assets = fetch_product_image_assets(con, task)
    prompt = append_remote_reference_urls(prompt, image_assets)
    uploaded_images = upload_reference_images(con, task, image_assets, project_uuid, cli_path, args)
    left_nodes = [item["nodeKey"] for item in uploaded_images if item.get("nodeKey")]
    mode_type = args.image_mode if left_nodes else args.mode_type

    create_args = build_node_args(project_uuid, node_name, prompt, args, create=True, left_nodes=left_nodes, mode_type=mode_type)
    try:
        node_run = run_libtv(create_args, cli_path, args.timeout)
    except CLIError as exc:
        if exc.returncode == 124:
            node_run = run_libtv(["node", node_name, "-p", project_uuid], cli_path, args.timeout)
            node_run["trigger_timeout"] = {"returncode": exc.returncode, "stdout": exc.stdout, "stderr": exc.stderr}
        else:
            duplicate_hint = (exc.stdout + "\n" + exc.stderr).lower()
            if "already" not in duplicate_hint and "存在" not in duplicate_hint and "duplicate" not in duplicate_hint:
                record_libtv_submit_failure(con, task, args, project_uuid, node_name, mode_type, image_assets, uploaded_images, exc)
                raise
            try:
                node_run = run_libtv(
                    build_node_args(project_uuid, node_name, prompt, args, create=False, left_nodes=left_nodes, mode_type=mode_type),
                    cli_path,
                    args.timeout,
                )
            except CLIError as update_exc:
                if update_exc.returncode != 124:
                    record_libtv_submit_failure(con, task, args, project_uuid, node_name, mode_type, image_assets, uploaded_images, update_exc)
                    raise
                node_run = run_libtv(["node", node_name, "-p", project_uuid], cli_path, args.timeout)
                node_run["trigger_timeout"] = {
                    "returncode": update_exc.returncode,
                    "stdout": update_exc.stdout,
                    "stderr": update_exc.stderr,
                }

    node_key = find_node_key(node_run["json"]) or node_name
    raw_response = {
        "transport": "cli",
        "project_create": project_create,
        "node_run": node_run,
        "uploaded_images": uploaded_images,
    }
    submit_payload = {
        "transport": "cli",
        "projectUuid": project_uuid,
        "nodeName": node_name,
        "nodeKey": node_key,
        "model": args.model,
        "modeType": mode_type,
        "ratio": args.ratio,
        "duration": args.duration,
        "resolution": args.resolution,
        "enableSound": args.enable_sound,
        "count": args.count,
        "autoCompliance": args.auto_compliance,
        "searchEnabled": args.search_enabled,
        "prompt_id": task.get("prompt_id"),
        "prompt_length": len(prompt),
        "image_assets": image_assets,
        "uploaded_images": uploaded_images,
    }
    ts = now_iso()
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
        (job_id, task["task_id"], node_key, json_dumps(submit_payload), json_dumps(raw_response), ts, ts),
    )
    con.execute(
        """
        UPDATE video_tasks
        SET status = 'video_generating',
            libtv_project_id = ?,
            libtv_api_mode = 'cli',
            started_at = COALESCE(started_at, ?),
            updated_at = ?
        WHERE id = ?
        """,
        (project_uuid, ts, ts, task["task_id"]),
    )
    add_event(
        con,
        task["task_id"],
        "libtv_cli_submitted",
        "Submitted final product prompt to LibTV CLI video node.",
        {"projectUuid": project_uuid, "nodeName": node_name, "nodeKey": node_key},
    )
    con.commit()
    return {
        "task_code": task["task_code"],
        "projectUuid": project_uuid,
        "nodeName": node_name,
        "nodeKey": node_key,
        "status": "submitted",
    }


def poll_task(con: sqlite3.Connection, task: dict[str, Any], cli_path: Path, args: argparse.Namespace) -> dict[str, Any]:
    project_uuid = task.get("libtv_project_id") or ""
    if not PROJECT_UUID_RE.match(project_uuid):
        raise RunnerError(f"Task {task.get('task_code')} has no valid LibTV project UUID.")
    submit_payload = read_json_text(task.get("submit_payload_json"), {})
    node_ref = args.node_name or submit_payload.get("nodeKey") or submit_payload.get("nodeName") or task.get("external_job_id")
    if not node_ref:
        raise RunnerError(f"Task {task.get('task_code')} has no LibTV node reference yet.")

    node_result = run_libtv(["node", str(node_ref), "-p", project_uuid], cli_path, args.timeout)
    urls = extract_media_urls(node_result["json"])
    video_url, cover_url = split_video_cover(urls)
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
            (json_dumps({"transport": "cli", "node": node_result}), video_url, cover_url, ts, task["task_id"]),
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
            "libtv_cli_video_ready",
            "LibTV CLI video URL saved to local database.",
            {"projectUuid": project_uuid, "nodeRef": node_ref, "video_url": video_url, "cover_url": cover_url},
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
            (json_dumps({"transport": "cli", "node": node_result}), task["task_id"]),
        )
        con.execute(
            "UPDATE video_tasks SET status = 'video_generating', updated_at = ? WHERE id = ?",
            (ts, task["task_id"]),
        )
        status = "running"
    con.commit()
    result = {
        "task_code": task["task_code"],
        "projectUuid": project_uuid,
        "nodeRef": node_ref,
        "status": status,
        "video_url": video_url,
        "cover_url": cover_url,
        "media_urls": urls,
    }
    if args.download and video_url:
        download = run_libtv(
            ["download", "-p", project_uuid, "-n", str(node_ref), "-o", str(Path(args.output_dir).expanduser().resolve())],
            cli_path,
            max(args.timeout, 180),
        )
        result["download"] = download
    return result


def command_list(args: argparse.Namespace) -> dict[str, Any]:
    db_path = resolve_db_path(args.db)
    with connect(db_path) as con:
        tasks = fetch_ready_tasks(con, tuple(args.status))
    return {"database": str(db_path), "tasks": tasks, "count": len(tasks)}


def command_submit(args: argparse.Namespace) -> dict[str, Any]:
    db_path = resolve_db_path(args.db)
    cli_path = resolve_libtv_path(args.libtv)
    with connect(db_path) as con:
        task = fetch_task(con, args.task_id, args.task_code, tuple(args.status))
        if getattr(args, "dry_run", False):
            image_assets = fetch_product_image_assets(con, task)
            return {
                "dry_run": True,
                "database": str(db_path),
                "cli": str(cli_path),
                "task_code": task["task_code"],
                "project": task.get("libtv_project_id"),
                "nodeName": task_node_name(task["task_code"], args.node_name),
                "model": args.model,
                "modeType": args.image_mode if image_assets and not args.no_product_image else args.mode_type,
                "ratio": args.ratio,
                "duration": args.duration,
                "resolution": args.resolution,
                "enableSound": args.enable_sound,
                "autoCompliance": args.auto_compliance,
                "searchEnabled": args.search_enabled,
                "product_image_count": len(image_assets),
                "product_images": [
                    {"asset_id": asset.get("id"), "file_path": asset.get("file_path"), "file_url": asset.get("file_url")}
                    for asset in image_assets
                ],
                "prompt_length": len(task["prompt_text"]),
            }
        try:
            return submit_task(con, task, cli_path, args)
        except CLIError as exc:
            snapshot = extract_failed_libtv_snapshot(exc.stdout, exc.stderr, task.get("libtv_project_id") or "", task_node_name(task["task_code"], args.node_name))
            error_code = "LIBTV_COMPLIANCE_REQUIRED" if snapshot.get("complianceRequired") else "LIBTV_CLI_ERROR"
            record_error(
                con,
                task["task_id"],
                "libtv_cli_submit",
                snapshot.get("failedReason") or str(exc),
                error_code,
                {"returncode": exc.returncode, "stdout": exc.stdout, "stderr": exc.stderr, "snapshot": snapshot},
                mark_failed=False,
            )
            con.commit()
            raise


def command_poll(args: argparse.Namespace) -> dict[str, Any]:
    db_path = resolve_db_path(args.db)
    cli_path = resolve_libtv_path(args.libtv)
    with connect(db_path) as con:
        task = fetch_task(con, args.task_id, args.task_code, include_existing_job=True)
        try:
            return poll_task(con, task, cli_path, args)
        except CLIError as exc:
            record_error(
                con,
                task["task_id"],
                "libtv_cli_poll",
                str(exc),
                "LIBTV_CLI_ERROR",
                {"returncode": exc.returncode, "stdout": exc.stdout, "stderr": exc.stderr},
                mark_failed=False,
            )
            con.commit()
            raise


def command_run(args: argparse.Namespace) -> dict[str, Any]:
    submit_result = command_submit(args)
    deadline = time.monotonic() + args.max_wait_seconds
    poll_result: dict[str, Any] = {}
    while time.monotonic() <= deadline:
        poll_result = command_poll(args)
        if poll_result.get("status") == "succeeded":
            return {"submit": submit_result, "poll": poll_result}
        time.sleep(args.poll_interval)
    return {
        "submit": submit_result,
        "poll": poll_result,
        "status": "timeout",
        "message": f"No final video URL before timeout ({args.max_wait_seconds}s). Poll again later.",
    }


def command_account(args: argparse.Namespace) -> dict[str, Any]:
    cli_path = resolve_libtv_path(args.libtv)
    return run_libtv(["account", "info"], cli_path, args.timeout)


def add_task_args(parser: argparse.ArgumentParser) -> None:
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--task-id", default="", help="video_tasks.id")
    group.add_argument("--task-code", default="", help="video_tasks.task_code")


def add_cli_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--libtv", default="", help="Path to libtv.exe.")
    parser.add_argument("--timeout", type=int, default=600, help="CLI command timeout seconds.")


def add_generation_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--model", default=DEFAULT_MODEL, help="LibTV video model key.")
    parser.add_argument("--mode-type", default="text2video", help="ModeType when no product image is attached.")
    parser.add_argument("--image-mode", default="mixed2video", help="ModeType when product image assets are attached.")
    parser.add_argument("--ratio", default="9:16", help="Video ratio.")
    parser.add_argument("--duration", default="15", help="Video duration seconds.")
    parser.add_argument("--resolution", default="720p", help="Video resolution.")
    parser.add_argument("--enable-sound", default="off", help="LibTV enableSound value: on/off.")
    parser.add_argument("--count", default="1", help="Video count.")
    parser.add_argument("--auto-compliance", default="1", help="Set Seedance autoCompliance. Use 1 for human reference images.")
    parser.add_argument("--search-enabled", default="1", help="Set Seedance searchEnabled.")
    parser.add_argument("--team-id", default="", help="Optional LibTV team id for new projects.")
    parser.add_argument("--node-name", default="", help="Override generated node name.")
    parser.add_argument("--no-product-image", action="store_true", help="Ignore product_image/reference_image assets.")
    parser.add_argument("--reupload-assets", action="store_true", help="Upload product image assets again even if node metadata exists.")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Generate LibTV videos from the local AI UGC SQLite database via official LibTV CLI.")
    parser.add_argument("--db", default="", help="SQLite path.")
    add_cli_args(parser)
    sub = parser.add_subparsers(dest="command", required=True)

    list_parser = sub.add_parser("list", help="List local tasks ready for LibTV.")
    list_parser.add_argument("--status", action="append", default=list(READY_STATUSES), help="Task status to include.")
    list_parser.set_defaults(func=command_list)

    account_parser = sub.add_parser("account", help="Check LibTV CLI login/account state.")
    account_parser.set_defaults(func=command_account)

    submit_parser = sub.add_parser("submit", help="Create/update a LibTV video node and trigger generation.")
    add_task_args(submit_parser)
    add_generation_args(submit_parser)
    submit_parser.add_argument("--status", action="append", default=list(READY_STATUSES), help="Task status to include.")
    submit_parser.add_argument("--dry-run", action="store_true", help="Do not call LibTV or modify the database.")
    submit_parser.set_defaults(func=command_submit)

    poll_parser = sub.add_parser("poll", help="Poll a LibTV video node and save final URLs.")
    add_task_args(poll_parser)
    poll_parser.add_argument("--node-name", default="", help="Override node name/reference.")
    poll_parser.add_argument("--download", action="store_true", help="Download generated resource through LibTV CLI.")
    poll_parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Download output directory.")
    poll_parser.set_defaults(func=command_poll)

    run_parser = sub.add_parser("run", help="Submit and poll until final video URL is available.")
    add_task_args(run_parser)
    add_generation_args(run_parser)
    run_parser.add_argument("--status", action="append", default=list(READY_STATUSES), help="Task status to include.")
    run_parser.add_argument("--poll-interval", type=int, default=30, help="Seconds between polls.")
    run_parser.add_argument("--max-wait-seconds", type=int, default=1800, help="Maximum wait time.")
    run_parser.add_argument("--download", action="store_true", help="Download generated resource through LibTV CLI.")
    run_parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Download output directory.")
    run_parser.set_defaults(func=command_run)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        result = args.func(args)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except RunnerError as exc:
        payload: dict[str, Any] = {"error": str(exc)}
        if isinstance(exc, CLIError):
            payload.update({"returncode": exc.returncode, "stdout": exc.stdout, "stderr": exc.stderr})
        print(json.dumps(payload, ensure_ascii=False, indent=2), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
