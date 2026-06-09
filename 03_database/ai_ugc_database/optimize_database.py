from __future__ import annotations

import argparse
import json
import re
import sqlite3
from pathlib import Path
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_DB = SCRIPT_DIR / "ai_ugc_product.sqlite"


EXTRA_VIDEO_TASK_COLUMNS = {
    "task_date": "TEXT",
    "category_code": "TEXT",
    "daily_serial": "INTEGER",
    "libtv_node_name": "TEXT",
    "source_channel": "TEXT",
}


CATEGORY_CODES = [
    (re.compile(r"女装|服装|衣服|上衣|裙|裤|穿搭"), "FUZHUANG"),
    (re.compile(r"男装"), "NANZHUANG"),
    (re.compile(r"美妆|护肤|彩妆|口红|面膜|香水"), "MEIZHUANG"),
    (re.compile(r"家居|家具|家装|收纳|厨具|餐具"), "JIAJU"),
    (re.compile(r"数码|电子|手机|电脑|耳机|相机|智能"), "SHUMA"),
    (re.compile(r"食品|零食|饮料|茶|咖啡"), "SHIPIN"),
    (re.compile(r"饰品|首饰|珠宝|项链|耳环|戒指"), "SHOUSHI"),
    (re.compile(r"鞋|包|箱包|手袋|背包"), "XIEBAO"),
    (re.compile(r"运动|健身|户外|瑜伽|跑步"), "YUNDONG"),
    (re.compile(r"母婴|儿童|宝宝|婴儿"), "MUYING"),
    (re.compile(r"宠物|猫|狗"), "CHONGWU"),
    (re.compile(r"玩具|礼品|积木|手办"), "WANJU"),
]


def table_columns(con: sqlite3.Connection, table: str) -> set[str]:
    return {row[1] for row in con.execute(f"PRAGMA table_info({table})")}


def safe_json_loads(value: str | None) -> dict[str, Any]:
    if not value:
        return {}
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def category_code(category: str | None) -> str:
    value = (category or "").strip()
    for pattern, code in CATEGORY_CODES:
        if pattern.search(value):
            return code
    direct = re.sub(r"[^0-9A-Za-z]+", "-", value).strip("-").upper()
    return direct[:32] if direct else "WEIFENLEI"


def parse_task_code(task_code: str, created_at: str | None, category: str | None) -> tuple[str, str, int | None]:
    match = re.match(r"^(\d{8})-([0-9A-Z]+)-(\d{3,})$", task_code or "")
    if match:
        return match.group(1), match.group(2), int(match.group(3))
    date = ""
    if created_at:
        digits = re.sub(r"\D", "", created_at)
        if len(digits) >= 8:
            date = digits[:8]
    return date, category_code(category), None


def ensure_columns(con: sqlite3.Connection) -> None:
    existing = table_columns(con, "video_tasks")
    for name, ddl_type in EXTRA_VIDEO_TASK_COLUMNS.items():
        if name not in existing:
            con.execute(f"ALTER TABLE video_tasks ADD COLUMN {name} {ddl_type}")


def backfill_video_task_fields(con: sqlite3.Connection) -> None:
    con.row_factory = sqlite3.Row
    rows = con.execute(
        """
        SELECT
          vt.id,
          vt.task_code,
          vt.category,
          vt.created_at,
          vt.input_payload_json,
          vt.task_date,
          vt.category_code,
          vt.daily_serial,
          vt.libtv_node_name
        FROM video_tasks vt
        """
    ).fetchall()
    for row in rows:
        payload = safe_json_loads(row["input_payload_json"])
        parsed_date, parsed_code, parsed_serial = parse_task_code(row["task_code"], row["created_at"], row["category"])
        task_date = row["task_date"] or payload.get("task_date") or parsed_date
        cat_code = row["category_code"] or payload.get("category_code") or parsed_code
        serial = row["daily_serial"] or payload.get("daily_serial") or parsed_serial
        node_name = (
            row["libtv_node_name"]
            or payload.get("libtv_node_name")
            or payload.get("node_name")
            or f"AIUGC-{re.sub(r'[^0-9A-Za-z_.-]+', '-', row['task_code']).strip('-')}-video"
        )
        source = payload.get("source_channel") or payload.get("input_source") or "unknown"
        con.execute(
            """
            UPDATE video_tasks
            SET task_date = COALESCE(?, task_date),
                category_code = COALESCE(?, category_code),
                daily_serial = COALESCE(?, daily_serial),
                libtv_node_name = COALESCE(?, libtv_node_name),
                source_channel = COALESCE(?, source_channel)
            WHERE id = ?
            """,
            (task_date, cat_code, serial, node_name, source, row["id"]),
        )


def create_indexes_and_views(con: sqlite3.Connection) -> None:
    con.executescript(
        """
        CREATE INDEX IF NOT EXISTS idx_video_tasks_task_date ON video_tasks(task_date);
        CREATE INDEX IF NOT EXISTS idx_video_tasks_category_serial ON video_tasks(category_code, daily_serial);
        CREATE INDEX IF NOT EXISTS idx_video_tasks_updated_at ON video_tasks(updated_at);
        CREATE INDEX IF NOT EXISTS idx_product_assets_task_type ON product_assets(task_id, asset_type);

        DROP VIEW IF EXISTS v_video_task_dashboard;
        CREATE VIEW v_video_task_dashboard AS
        SELECT
          vt.task_code AS "任务编号",
          vt.task_date AS "日期",
          vt.category AS "类别",
          vt.category_code AS "类别代码",
          vt.daily_serial AS "序号",
          COALESCE(vt.libtv_node_name, 'AIUGC-' || vt.task_code || '-video') AS "最终视频名称",
          vt.libtv_node_name AS "libTV节点名",
          p.product_name AS "商品名称",
          vt.status AS "任务状态",
          COALESCE(lj.status, '未提交') AS "libTV状态",
          vt.output_mode AS "视频规格",
          length(fp.prompt_text) AS "提示词字数",
          (
            SELECT count(*)
            FROM product_assets pa
            WHERE pa.task_id = vt.id AND pa.asset_type = 'product_image'
          ) AS "产品图片数",
          (
            SELECT pa.file_path
            FROM product_assets pa
            WHERE pa.task_id = vt.id AND pa.asset_type = 'product_image'
            ORDER BY pa.sort_order, pa.created_at
            LIMIT 1
          ) AS "主图路径",
          (
            SELECT pa.file_path
            FROM product_assets pa
            WHERE pa.task_id = vt.id AND pa.asset_type = 'prompt_document'
            ORDER BY pa.sort_order, pa.created_at
            LIMIT 1
          ) AS "提示词文件路径",
          lj.video_url AS "视频链接",
          lj.cover_url AS "封面链接",
          lj.error_message AS "错误信息",
          vt.created_at AS "创建时间",
          vt.updated_at AS "更新时间"
        FROM video_tasks vt
        LEFT JOIN products p ON p.id = vt.product_id
        LEFT JOIN final_product_prompts fp ON fp.task_id = vt.id
        LEFT JOIN libtv_jobs lj ON lj.task_id = vt.id
        ORDER BY vt.updated_at DESC;

        DROP VIEW IF EXISTS v_final_prompt_detail;
        CREATE VIEW v_final_prompt_detail AS
        SELECT
          vt.task_code AS "任务编号",
          vt.task_date AS "日期",
          vt.category AS "类别",
          p.product_name AS "商品名称",
          COALESCE(vt.libtv_node_name, 'AIUGC-' || vt.task_code || '-video') AS "最终视频名称",
          vt.libtv_node_name AS "libTV节点名",
          fp.validation_status AS "校验状态",
          length(fp.prompt_text) AS "提示词字数",
          fp.prompt_text AS "最终完整提示词",
          fp.created_at AS "创建时间",
          fp.updated_at AS "更新时间"
        FROM final_product_prompts fp
        JOIN video_tasks vt ON vt.id = fp.task_id
        LEFT JOIN products p ON p.id = vt.product_id
        ORDER BY fp.updated_at DESC;

        DROP VIEW IF EXISTS v_product_asset_detail;
        CREATE VIEW v_product_asset_detail AS
        SELECT
          vt.task_code AS "任务编号",
          vt.category AS "类别",
          p.product_name AS "商品名称",
          pa.asset_type AS "素材类型",
          pa.sort_order AS "排序",
          pa.file_path AS "本地路径",
          pa.file_url AS "远程链接",
          pa.format AS "格式",
          pa.size_bytes AS "大小字节",
          pa.created_at AS "创建时间"
        FROM product_assets pa
        LEFT JOIN video_tasks vt ON vt.id = pa.task_id
        LEFT JOIN products p ON p.id = pa.product_id
        ORDER BY pa.created_at DESC;

        DROP VIEW IF EXISTS v_libtv_job_detail;
        CREATE VIEW v_libtv_job_detail AS
        SELECT
          vt.task_code AS "任务编号",
          COALESCE(vt.libtv_node_name, 'AIUGC-' || vt.task_code || '-video') AS "最终视频名称",
          vt.libtv_node_name AS "libTV节点名",
          p.product_name AS "商品名称",
          lj.status AS "libTV状态",
          lj.external_job_id AS "外部任务ID",
          lj.video_url AS "视频链接",
          lj.cover_url AS "封面链接",
          lj.error_message AS "错误信息",
          lj.created_at AS "创建时间",
          lj.submitted_at AS "提交时间",
          lj.completed_at AS "完成时间",
          lj.submit_payload_json AS "提交参数JSON",
          lj.raw_response_json AS "原始返回JSON"
        FROM libtv_jobs lj
        JOIN video_tasks vt ON vt.id = lj.task_id
        LEFT JOIN products p ON p.id = vt.product_id
        ORDER BY lj.created_at DESC;
        """
    )


def optimize(db_path: Path) -> None:
    con = sqlite3.connect(str(db_path))
    try:
      ensure_columns(con)
      backfill_video_task_fields(con)
      create_indexes_and_views(con)
      con.commit()
    finally:
      con.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Optimize AI UGC SQLite database for Navicat inspection.")
    parser.add_argument("--db", default=str(DEFAULT_DB), help="SQLite database path.")
    args = parser.parse_args()

    db = Path(args.db).expanduser().resolve()
    if not db.exists():
        raise FileNotFoundError(db)
    optimize(db)
    print(json.dumps({"ok": True, "database": str(db)}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
