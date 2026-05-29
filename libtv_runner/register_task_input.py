#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import uuid
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent
WORKFLOW_DIR = SCRIPT_DIR.parent
DEFAULT_DB = WORKFLOW_DIR / "ai_ugc_database" / "ai_ugc_product.sqlite"
LEGACY_DB = DEFAULT_DB


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def json_text(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def table_columns(con: sqlite3.Connection, table: str) -> set[str]:
    return {row[1] for row in con.execute(f"PRAGMA table_info({table})")}


def ensure_operational_columns(con: sqlite3.Connection) -> None:
    columns = table_columns(con, "video_tasks")
    extra_columns = {
        "task_date": "TEXT",
        "category_code": "TEXT",
        "daily_serial": "INTEGER",
        "libtv_node_name": "TEXT",
        "source_channel": "TEXT",
    }
    for name, ddl_type in extra_columns.items():
        if name not in columns:
            con.execute(f"ALTER TABLE video_tasks ADD COLUMN {name} {ddl_type}")


def resolve_db(path: str) -> Path:
    if path:
        return Path(path).expanduser().resolve()
    return DEFAULT_DB if DEFAULT_DB.exists() else LEGACY_DB


def read_text_file(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in {".txt", ".md", ".markdown", ".csv"}:
        for enc in ("utf-8-sig", "utf-8", "gb18030"):
            try:
                return path.read_text(encoding=enc).strip()
            except UnicodeDecodeError:
                continue
        return path.read_text(errors="replace").strip()
    if suffix == ".docx":
        with zipfile.ZipFile(path) as zf:
            xml = zf.read("word/document.xml")
        root = ET.fromstring(xml)
        ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        paragraphs: list[str] = []
        for para in root.findall(".//w:p", ns):
            texts = [node.text or "" for node in para.findall(".//w:t", ns)]
            line = "".join(texts).strip()
            if line:
                paragraphs.append(line)
        return "\n".join(paragraphs).strip()
    raise ValueError(f"Unsupported prompt document type: {path.suffix}. Use .txt, .md, or .docx.")


def get_active_sop_id(con: sqlite3.Connection) -> str:
    row = con.execute(
        """
        SELECT id
        FROM sop_templates
        WHERE is_active = 1
        ORDER BY updated_at DESC
        LIMIT 1
        """
    ).fetchone()
    if row:
        return row[0]
    sop_id = new_id()
    ts = now_iso()
    con.execute(
        """
        INSERT INTO sop_templates (
          id, template_code, category, version, title, source_doc_name,
          document_text, read_instruction, step_instructions_json,
          final_prompt_extraction_rule, quality_rules_json, is_active,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        """,
        (
            sop_id,
            "generic_product_image_prompt_v1",
            "generic",
            "1.0",
            "Generic product image + prompt document workflow",
            None,
            "Use product image plus prompt document to generate a LibTV video.",
            "Read the prompt document and product image before video generation.",
            "[]",
            "Use the prompt document as final_product_prompts.prompt_text.",
            "[]",
            ts,
            ts,
        ),
    )
    return sop_id


def upsert_asset(
    con: sqlite3.Connection,
    product_id: str,
    task_id: str,
    asset_type: str,
    sort_order: int,
    file_path: str | None,
    file_url: str | None,
    metadata: dict[str, Any],
) -> None:
    existing = con.execute(
        """
        SELECT id
        FROM product_assets
        WHERE product_id = ?
          AND task_id = ?
          AND asset_type = ?
          AND sort_order = ?
        """,
        (product_id, task_id, asset_type, sort_order),
    ).fetchone()
    ts = now_iso()
    size = None
    fmt = None
    if file_path:
        p = Path(file_path)
        fmt = p.suffix.lstrip(".").lower() or None
        if p.exists():
            size = p.stat().st_size
    if existing:
        con.execute(
            """
            UPDATE product_assets
            SET file_path = ?,
                file_url = ?,
                format = ?,
                size_bytes = COALESCE(?, size_bytes),
                metadata_json = ?
            WHERE id = ?
            """,
            (file_path, file_url, fmt, size, json_text(metadata), existing[0]),
        )
    else:
        con.execute(
            """
            INSERT INTO product_assets (
              id, product_id, task_id, asset_type, sort_order,
              file_url, file_path, format, size_bytes, metadata_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (new_id(), product_id, task_id, asset_type, sort_order, file_url, file_path, fmt, size, json_text(metadata), ts),
        )


def register(args: argparse.Namespace) -> dict[str, Any]:
    db = resolve_db(args.db)
    if not db.exists():
        raise FileNotFoundError(f"Database not found: {db}")

    image_path = str(Path(args.image_path).expanduser().resolve()) if args.image_path else None
    prompt_doc = str(Path(args.prompt_doc).expanduser().resolve()) if args.prompt_doc else None
    prompt_text = args.prompt_text.strip() if args.prompt_text else ""
    if not prompt_text and prompt_doc:
        prompt_text = read_text_file(Path(prompt_doc))
    if not prompt_text:
        raise ValueError("Provide --prompt-text or --prompt-doc.")
    if image_path and not Path(image_path).exists():
        raise FileNotFoundError(f"Product image not found: {image_path}")

    ts = now_iso()
    con = sqlite3.connect(str(db))
    con.execute("PRAGMA foreign_keys=ON")
    ensure_operational_columns(con)
    sop_id = get_active_sop_id(con)

    existing = con.execute(
        """
        SELECT vt.id, vt.product_id
        FROM video_tasks vt
        WHERE vt.task_code = ?
        """,
        (args.task_code,),
    ).fetchone()
    if existing:
        task_id, product_id = existing
    else:
        task_id = new_id()
        product_id = new_id()

    con.execute(
        """
        INSERT INTO products (
          id, category, product_name, product_description, selling_points,
          target_audience, market, metadata_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          category = excluded.category,
          product_name = excluded.product_name,
          product_description = excluded.product_description,
          metadata_json = excluded.metadata_json,
          updated_at = excluded.updated_at
        """,
        (
            product_id,
            args.category,
            args.product_name,
            args.product_description,
            args.selling_points,
            args.target_audience,
            args.market,
            json_text({"input_source": "register_task_input.py"}),
            ts,
            ts,
        ),
    )

    con.execute(
        """
        INSERT INTO video_tasks (
          id, task_code, product_id, sop_template_id, category, status,
          priority, ai_provider, libtv_api_mode, output_mode, input_payload_json,
          task_date, category_code, daily_serial, libtv_node_name, source_channel,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(task_code) DO UPDATE SET
          product_id = excluded.product_id,
          sop_template_id = excluded.sop_template_id,
          category = excluded.category,
          status = excluded.status,
          priority = excluded.priority,
          input_payload_json = excluded.input_payload_json,
          task_date = excluded.task_date,
          category_code = excluded.category_code,
          daily_serial = excluded.daily_serial,
          libtv_node_name = excluded.libtv_node_name,
          source_channel = excluded.source_channel,
          updated_at = excluded.updated_at
        """,
        (
            task_id,
            args.task_code,
            product_id,
            sop_id,
            args.category,
            "prompt_ready",
            args.priority,
            "prompt_doc",
            "cli",
            args.output_mode,
            json_text(
                {
                    "product_image_path": image_path,
                    "prompt_document_path": prompt_doc,
                    "task_date": args.task_date or None,
                    "category_code": args.category_code or None,
                    "daily_serial": args.daily_serial or None,
                    "libtv_node_name": args.libtv_node_name or None,
                    "source_channel": args.source_channel,
                }
            ),
            args.task_date or None,
            args.category_code or None,
            args.daily_serial or None,
            args.libtv_node_name or None,
            args.source_channel,
            ts,
            ts,
        ),
    )

    con.execute(
        """
        INSERT INTO final_product_prompts (
          id, task_id, prompt_version, source_step_no, prompt_text,
          prompt_json, validation_status, validation_report_json,
          created_at, updated_at
        ) VALUES (?, ?, 'v1', 10, ?, ?, 'pass', ?, ?, ?)
        ON CONFLICT(task_id) DO UPDATE SET
          prompt_text = excluded.prompt_text,
          prompt_json = excluded.prompt_json,
          validation_status = excluded.validation_status,
          validation_report_json = excluded.validation_report_json,
          updated_at = excluded.updated_at
        """,
        (
            new_id(),
            task_id,
            prompt_text,
            json_text({"source_prompt_doc": prompt_doc, "product_image_path": image_path}),
            json_text({"source": "register_task_input.py"}),
            ts,
            ts,
        ),
    )

    if image_path or args.image_url:
        upsert_asset(
            con,
            product_id,
            task_id,
            "product_image",
            1,
            image_path,
            args.image_url or None,
            {"role": "primary_product_reference"},
        )
    if prompt_doc:
        upsert_asset(
            con,
            product_id,
            task_id,
            "prompt_document",
            1,
            prompt_doc,
            None,
            {"role": "source_prompt_document"},
        )

    con.commit()
    con.close()
    return {
        "database": str(db),
        "task_code": args.task_code,
        "task_id": task_id,
        "product_id": product_id,
        "status": "prompt_ready",
        "product_image_path": image_path,
        "prompt_document_path": prompt_doc,
        "prompt_length": len(prompt_text),
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Register product image + prompt document into the local AI UGC workflow database.")
    parser.add_argument("--db", default="", help="SQLite path.")
    parser.add_argument("--task-code", required=True, help="Unique task code.")
    parser.add_argument("--product-name", required=True, help="Product name.")
    parser.add_argument("--category", default="product_video", help="Product category.")
    parser.add_argument("--product-description", default="", help="Optional product description.")
    parser.add_argument("--selling-points", default="", help="Optional selling points.")
    parser.add_argument("--target-audience", default="", help="Optional target audience.")
    parser.add_argument("--market", default="CN", help="Market code.")
    parser.add_argument("--image-path", default="", help="Local product image path.")
    parser.add_argument("--image-url", default="", help="Optional remote product image URL.")
    parser.add_argument("--prompt-doc", default="", help="Prompt document path: .txt, .md, or .docx.")
    parser.add_argument("--prompt-text", default="", help="Prompt text. Overrides --prompt-doc content when provided.")
    parser.add_argument("--priority", type=int, default=20, help="Task priority.")
    parser.add_argument("--output-mode", default="15s_vertical_no_voiceover", help="Output mode label.")
    parser.add_argument("--task-date", default="", help="Business task date, e.g. 20260529.")
    parser.add_argument("--category-code", default="", help="Short category code used in task code.")
    parser.add_argument("--daily-serial", type=int, default=0, help="Daily serial number within category.")
    parser.add_argument("--libtv-node-name", default="", help="Final LibTV video node name.")
    parser.add_argument("--source-channel", default="html", help="Task source channel.")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    result = register(args)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
