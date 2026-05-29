#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse


SCRIPT_DIR = Path(__file__).resolve().parent
WORKFLOW_DIR = SCRIPT_DIR.parent
RUNNER = SCRIPT_DIR / "libtv_cli_db_runner.py"
DEFAULT_DB_PATH = WORKFLOW_DIR / "ai_ugc_database" / "ai_ugc_product.sqlite"
DEFAULT_LIBTV = SCRIPT_DIR / "bin" / "libtv.exe"
DEFAULT_OUTPUT_DIR = WORKFLOW_DIR / "outputs" / "libtv"
DEFAULT_ENV = SCRIPT_DIR / ".env"
ALLOWED_ACTIONS = {"list", "account", "submit", "poll", "run"}
GENERATION_KEYS = ("model", "ratio", "duration", "resolution", "enable_sound", "count", "team_id", "node_name")


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on"}


def as_int(value: Any, fallback: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def list_value(value: Any) -> list[str]:
    if value is None or value == "":
        return []
    if isinstance(value, list):
        return [clean_text(item) for item in value if clean_text(item)]
    return [item.strip() for item in str(value).split(",") if item.strip()]


def parse_json_text(text: str) -> Any:
    if not text.strip():
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def add_global_args(command: list[str], payload: dict[str, Any]) -> None:
    db_path = clean_text(payload.get("db")) or str(DEFAULT_DB_PATH)
    libtv_path = clean_text(payload.get("libtv")) or str(DEFAULT_LIBTV)
    timeout = as_int(payload.get("timeout"), 600)
    command.extend(["--db", db_path, "--libtv", libtv_path, "--timeout", str(timeout)])


def add_task_args(command: list[str], payload: dict[str, Any]) -> None:
    task_id = clean_text(payload.get("task_id"))
    task_code = clean_text(payload.get("task_code"))
    if task_id:
        command.extend(["--task-id", task_id])
    elif task_code:
        command.extend(["--task-code", task_code])


def add_status_args(command: list[str], payload: dict[str, Any]) -> None:
    for status in list_value(payload.get("status") or payload.get("statuses")):
        command.extend(["--status", status])


def add_generation_args(command: list[str], payload: dict[str, Any]) -> None:
    for key in GENERATION_KEYS:
        value = clean_text(payload.get(key))
        if value:
            command.extend([f"--{key.replace('_', '-')}", value])


def build_runner_command(payload: dict[str, Any]) -> tuple[str, list[str], int]:
    action = clean_text(payload.get("action") or payload.get("command") or "list").lower()
    if action not in ALLOWED_ACTIONS:
        raise ValueError(f"Unsupported libTV action: {action}")

    command = [sys.executable, str(RUNNER)]
    add_global_args(command, payload)
    command.append(action)

    if action == "list":
        add_status_args(command, payload)
    elif action == "submit":
        add_task_args(command, payload)
        add_generation_args(command, payload)
        add_status_args(command, payload)
        if as_bool(payload.get("dry_run")):
            command.append("--dry-run")
    elif action == "poll":
        add_task_args(command, payload)
        node_name = clean_text(payload.get("node_name"))
        if node_name:
            command.extend(["--node-name", node_name])
        if as_bool(payload.get("download")):
            command.append("--download")
        output_dir = clean_text(payload.get("output_dir"))
        if output_dir:
            command.extend(["--output-dir", output_dir])
    elif action == "run":
        add_task_args(command, payload)
        add_generation_args(command, payload)
        add_status_args(command, payload)
        poll_interval = as_int(payload.get("poll_interval"), 30)
        max_wait = as_int(payload.get("max_wait_seconds"), 1800)
        command.extend(["--poll-interval", str(poll_interval), "--max-wait-seconds", str(max_wait)])
        if as_bool(payload.get("download")):
            command.append("--download")
        output_dir = clean_text(payload.get("output_dir"))
        if output_dir:
            command.extend(["--output-dir", output_dir])

    timeout = as_int(payload.get("bridge_timeout_seconds"), 0)
    if timeout <= 0:
        runner_timeout = as_int(payload.get("timeout"), 600)
        timeout = runner_timeout + 120
        if action == "run":
            timeout += as_int(payload.get("max_wait_seconds"), 1800)
    return action, command, timeout


def invoke_runner(payload: dict[str, Any]) -> dict[str, Any]:
    started = time.monotonic()
    action, command, timeout = build_runner_command(payload)
    env = os.environ.copy()
    env.setdefault("AI_UGC_SQLITE_PATH", str(DEFAULT_DB_PATH))
    env.setdefault("LIBTV_CLI_PATH", str(DEFAULT_LIBTV))
    env.setdefault("LIBTV_CONFIG_DIR", str(SCRIPT_DIR / ".libtv_config"))

    try:
        proc = subprocess.run(
            command,
            cwd=str(WORKFLOW_DIR),
            env=env,
            text=True,
            encoding="utf-8",
            errors="replace",
            capture_output=True,
            timeout=timeout,
        )
        stdout = proc.stdout.strip()
        stderr = proc.stderr.strip()
        parsed_stdout = parse_json_text(stdout)
        parsed_stderr = parse_json_text(stderr)
        ok = proc.returncode == 0
        return {
            "ok": ok,
            "action": action,
            "returncode": proc.returncode,
            "duration_seconds": round(time.monotonic() - started, 3),
            "result": parsed_stdout if parsed_stdout is not None else stdout,
            "error": None if ok else (parsed_stderr if parsed_stderr is not None else stderr),
            "stderr": "" if ok else stderr,
        }
    except subprocess.TimeoutExpired as exc:
        return {
            "ok": False,
            "action": action,
            "returncode": 124,
            "duration_seconds": round(time.monotonic() - started, 3),
            "result": None,
            "error": f"libTV bridge timed out after {timeout}s",
            "stdout": (exc.stdout or "").strip() if isinstance(exc.stdout, str) else "",
            "stderr": (exc.stderr or "").strip() if isinstance(exc.stderr, str) else "",
        }


def health_payload() -> dict[str, Any]:
    return {
        "ok": True,
        "service": "libtv-n8n-bridge",
        "workflow_dir": str(WORKFLOW_DIR),
        "runner": str(RUNNER),
        "database": str(DEFAULT_DB_PATH),
        "libtv": str(DEFAULT_LIBTV),
        "output_dir": str(DEFAULT_OUTPUT_DIR),
        "runner_exists": RUNNER.exists(),
        "database_exists": DEFAULT_DB_PATH.exists(),
        "libtv_exists": DEFAULT_LIBTV.exists(),
    }


class BridgeHandler(BaseHTTPRequestHandler):
    server_version = "LibTVN8NBridge/1.0"

    def log_message(self, format: str, *args: Any) -> None:
        return

    def send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8", errors="replace")
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON body: {exc}") from exc
        if not isinstance(data, dict):
            raise ValueError("JSON body must be an object.")
        return data

    def do_OPTIONS(self) -> None:
        self.send_json(200, {"ok": True})

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path in {"/", "/health"}:
            self.send_json(200, health_payload())
            return
        if parsed.path == "/invoke":
            payload = {key: values[-1] for key, values in parse_qs(parsed.query).items()}
            self.send_json(200, invoke_runner(payload))
            return
        self.send_json(404, {"ok": False, "error": f"Unknown path: {parsed.path}"})

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self.send_json(200, health_payload())
            return
        if parsed.path != "/invoke":
            self.send_json(404, {"ok": False, "error": f"Unknown path: {parsed.path}"})
            return
        try:
            payload = self.read_json_body()
            self.send_json(200, invoke_runner(payload))
        except ValueError as exc:
            self.send_json(400, {"ok": False, "error": str(exc)})
        except Exception as exc:
            self.send_json(500, {"ok": False, "error": str(exc)})


def main() -> int:
    parser = argparse.ArgumentParser(description="HTTP bridge for n8n to reuse the local LibTV CLI database runner.")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8799)
    args = parser.parse_args()

    load_env_file(DEFAULT_ENV)
    DEFAULT_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    server = ThreadingHTTPServer((args.host, args.port), BridgeHandler)
    print(f"LibTV n8n bridge listening on http://{args.host}:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
