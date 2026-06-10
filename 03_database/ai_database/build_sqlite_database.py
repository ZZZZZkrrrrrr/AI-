import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path


SOP_ID = "00000000-0000-0000-0000-000000000101"
PRODUCT_ID = "00000000-0000-0000-0000-000000000201"
TASK_ID = "00000000-0000-0000-0000-000000000301"
PROMPT_ID = "00000000-0000-0000-0000-000000000401"
THREAD_ID = "019e6c6d-6a8d-7280-9cbd-846be63756b8"


STEP_INSTRUCTIONS = [
    {"step_no": 0, "step_name": "完整阅读 SOP 文档", "instruction": "完整阅读我给你的文档，并准备开始工作"},
    {"step_no": 1, "step_name": "风格包初始化", "instruction": "执行第一步"},
    {"step_no": 2, "step_name": "读图建档", "instruction": "执行第二步"},
    {"step_no": 3, "step_name": "女装造型师判断", "instruction": "执行第三步"},
    {"step_no": 4, "step_name": "完整造型方案", "instruction": "执行第四步"},
    {"step_no": 5, "step_name": "风格标签", "instruction": "执行第五步"},
    {"step_no": 6, "step_name": "女性气质主题", "instruction": "执行第六步"},
    {"step_no": 7, "step_name": "场景空间道具动作", "instruction": "执行第七步"},
    {"step_no": 8, "step_name": "9:16 摄影光影运镜", "instruction": "执行第八步"},
    {"step_no": 9, "step_name": "15 秒时间轴", "instruction": "执行第九步"},
    {"step_no": 10, "step_name": "最终完整视频提示词", "instruction": "执行第十步"},
]


FINAL_PROMPT = """生成一条 15 秒 9:16 竖屏女装场景氛围感视频，无口播、无字幕、无电商贴纸、无价格促销信息、无水印。主推单品是蓝灰色无袖扭结针织上衣，搭配白色高腰垂坠 A 字长裙，整体造型配珍珠项链和草编包，突出韩系干净风、温柔约会风、轻通勤风。画面风格是夏日窗边韩系清冷温柔通勤感，真实自然、干净高级、不过度商业化。

人物为 25-32 岁亚洲女性，妆容清透，发型自然，姿态放松，情绪温柔自信。场景可在咖啡店窗边、安静街角、展览入口或周末约会路线中切换，使用咖啡杯、花束、书、草编包作为自然道具。重点展示上衣的无袖肩线、胸前扭结细节、针织质感、蓝灰色柔和色调，以及白色高腰长裙的垂坠感和显高比例。

镜头时间轴：0-3 秒，半身近景从窗边自然光切入，人物整理珍珠项链或轻扶草编包，突出上衣扭结细节；3-6 秒，中景展示完整穿搭，人物从咖啡店窗边站起或转身，裙摆自然垂落；6-9 秒，低角度轻推镜头拍摄步行动作，表现高腰长裙的线条和轻盈感；9-12 秒，侧逆光或街角场景，人物回头微笑，手拿咖啡杯或花束，氛围清爽；12-15 秒，定格在干净完整的全身造型，画面稳定，服装版型清晰，适合直接作为女装带货素材。

摄影要求：自然日光、柔和阴影、浅景深、真实布料纹理、轻微手持感或稳定滑轨运镜，色彩保持蓝灰、白色、浅木色和植物绿的清爽组合。不要出现夸张滤镜、赛博风、浓重商业广告感、变形肢体、错误手指、衣服结构错乱、文字乱码、品牌 logo、水印、字幕条、促销贴纸或低清画质。最终视频应像真实生活方式短片，重点让观众一眼看清单品搭配、气质和适用场景。"""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def json_text(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def build_database(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(path)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA foreign_keys=ON")
    cur = con.cursor()

    cur.executescript(
        """
        CREATE TABLE IF NOT EXISTS sop_templates (
          id TEXT PRIMARY KEY,
          template_code TEXT NOT NULL UNIQUE,
          category TEXT NOT NULL,
          version TEXT NOT NULL,
          title TEXT NOT NULL,
          source_doc_name TEXT,
          document_text TEXT NOT NULL,
          read_instruction TEXT NOT NULL,
          step_instructions_json TEXT NOT NULL,
          final_prompt_extraction_rule TEXT NOT NULL,
          quality_rules_json TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          category TEXT NOT NULL,
          product_name TEXT NOT NULL,
          product_description TEXT,
          selling_points TEXT,
          target_audience TEXT,
          market TEXT,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS video_tasks (
          id TEXT PRIMARY KEY,
          task_code TEXT NOT NULL UNIQUE,
          product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          sop_template_id TEXT NOT NULL REFERENCES sop_templates(id),
          category TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft',
          priority INTEGER NOT NULL DEFAULT 100,
          ai_provider TEXT NOT NULL DEFAULT 'doubao',
          ai_session_id TEXT,
          libtv_template_id TEXT,
          libtv_project_id TEXT,
          libtv_api_mode TEXT NOT NULL DEFAULT 'manual_until_api_ready',
          output_mode TEXT NOT NULL DEFAULT '15s_vertical_no_voiceover',
          input_payload_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          started_at TEXT,
          finished_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_video_tasks_status_priority
          ON video_tasks(status, priority, created_at);

        CREATE TABLE IF NOT EXISTS product_assets (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          task_id TEXT REFERENCES video_tasks(id) ON DELETE CASCADE,
          asset_type TEXT NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0,
          file_url TEXT,
          file_path TEXT,
          width INTEGER,
          height INTEGER,
          format TEXT,
          size_bytes INTEGER,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ai_step_runs (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL REFERENCES video_tasks(id) ON DELETE CASCADE,
          step_no INTEGER NOT NULL CHECK (step_no BETWEEN 0 AND 10),
          step_name TEXT NOT NULL,
          instruction TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          response_text TEXT,
          raw_response_json TEXT NOT NULL DEFAULT '{}',
          started_at TEXT,
          completed_at TEXT,
          error_message TEXT,
          created_at TEXT NOT NULL,
          UNIQUE(task_id, step_no)
        );

        CREATE TABLE IF NOT EXISTS final_product_prompts (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL UNIQUE REFERENCES video_tasks(id) ON DELETE CASCADE,
          prompt_version TEXT NOT NULL DEFAULT 'v1',
          source_step_no INTEGER NOT NULL DEFAULT 10,
          prompt_text TEXT NOT NULL,
          prompt_json TEXT NOT NULL DEFAULT '{}',
          validation_status TEXT NOT NULL DEFAULT 'pending',
          validation_report_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS prompt_quality_checks (
          id TEXT PRIMARY KEY,
          prompt_id TEXT NOT NULL REFERENCES final_product_prompts(id) ON DELETE CASCADE,
          check_name TEXT NOT NULL,
          check_status TEXT NOT NULL,
          details TEXT,
          created_at TEXT NOT NULL,
          UNIQUE(prompt_id, check_name)
        );

        CREATE TABLE IF NOT EXISTS libtv_jobs (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL UNIQUE REFERENCES video_tasks(id) ON DELETE CASCADE,
          external_job_id TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          submit_payload_json TEXT NOT NULL DEFAULT '{}',
          raw_response_json TEXT NOT NULL DEFAULT '{}',
          video_url TEXT,
          cover_url TEXT,
          created_at TEXT NOT NULL,
          submitted_at TEXT,
          completed_at TEXT,
          error_message TEXT
        );

        CREATE TABLE IF NOT EXISTS task_events (
          id TEXT PRIMARY KEY,
          task_id TEXT REFERENCES video_tasks(id) ON DELETE CASCADE,
          event_type TEXT NOT NULL,
          message TEXT NOT NULL,
          payload_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS error_reports (
          id TEXT PRIMARY KEY,
          task_id TEXT REFERENCES video_tasks(id) ON DELETE CASCADE,
          source TEXT NOT NULL,
          error_code TEXT,
          error_message TEXT NOT NULL,
          raw_payload_json TEXT NOT NULL DEFAULT '{}',
          resolved INTEGER NOT NULL DEFAULT 0,
          resolution_note TEXT,
          created_at TEXT NOT NULL,
          resolved_at TEXT
        );

        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value_json TEXT NOT NULL,
          description TEXT,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS batch_jobs (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft',
          total_count INTEGER NOT NULL DEFAULT 0,
          pending_count INTEGER NOT NULL DEFAULT 0,
          running_count INTEGER NOT NULL DEFAULT 0,
          success_count INTEGER NOT NULL DEFAULT 0,
          failed_count INTEGER NOT NULL DEFAULT 0,
          cancelled_count INTEGER NOT NULL DEFAULT 0,
          concurrency INTEGER NOT NULL DEFAULT 2,
          input_payload_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          started_at TEXT,
          finished_at TEXT,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS batch_items (
          id TEXT PRIMARY KEY,
          batch_id TEXT NOT NULL REFERENCES batch_jobs(id) ON DELETE CASCADE,
          row_no INTEGER NOT NULL,
          task_no TEXT,
          prompt_file_name TEXT,
          image_file_name TEXT,
          product_name TEXT,
          product_category TEXT,
          product_brief TEXT,
          target_duration INTEGER NOT NULL DEFAULT 15,
          aspect_ratio TEXT NOT NULL DEFAULT '9:16',
          video_mode TEXT NOT NULL DEFAULT 'dry_run',
          auto_submit INTEGER NOT NULL DEFAULT 1,
          status TEXT NOT NULL DEFAULT 'draft',
          current_step TEXT,
          progress INTEGER NOT NULL DEFAULT 0,
          payload_json TEXT NOT NULL DEFAULT '{}',
          image_analysis TEXT,
          suggested_category TEXT,
          final_prompt TEXT,
          prompt_package_json TEXT,
          token_usage_json TEXT,
          libtv_task_code TEXT,
          libtv_node_name TEXT,
          video_url TEXT,
          error_message TEXT,
          attempts INTEGER NOT NULL DEFAULT 0,
          max_retries INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          started_at TEXT,
          finished_at TEXT,
          updated_at TEXT NOT NULL,
          UNIQUE(batch_id, row_no)
        );

        CREATE INDEX IF NOT EXISTS idx_batch_items_batch_status
          ON batch_items(batch_id, status, row_no);

        CREATE INDEX IF NOT EXISTS idx_batch_items_status
          ON batch_items(status, updated_at);

        CREATE TABLE IF NOT EXISTS batch_events (
          id TEXT PRIMARY KEY,
          batch_id TEXT NOT NULL REFERENCES batch_jobs(id) ON DELETE CASCADE,
          item_id TEXT REFERENCES batch_items(id) ON DELETE CASCADE,
          event_type TEXT NOT NULL,
          phase TEXT,
          message TEXT,
          payload_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_batch_events_batch_time
          ON batch_events(batch_id, created_at);

        CREATE INDEX IF NOT EXISTS idx_batch_events_item_time
          ON batch_events(item_id, created_at);

        CREATE VIEW IF NOT EXISTS v_ready_tasks AS
        SELECT
          vt.id AS task_id,
          vt.task_code,
          vt.status,
          vt.priority,
          vt.category,
          p.product_name,
          p.product_description,
          p.selling_points,
          st.template_code,
          st.read_instruction,
          st.step_instructions_json,
          vt.libtv_template_id,
          vt.libtv_project_id,
          vt.created_at
        FROM video_tasks vt
        JOIN products p ON p.id = vt.product_id
        JOIN sop_templates st ON st.id = vt.sop_template_id
        WHERE vt.status IN ('ready', 'prompt_review', 'prompt_ready')
        ORDER BY vt.priority ASC, vt.created_at ASC;
        """
    )

    ts = now_iso()
    cur.execute(
        """
        INSERT INTO sop_templates (
          id, template_code, category, version, title, source_doc_name,
          document_text, read_instruction, step_instructions_json,
          final_prompt_extraction_rule, quality_rules_json, is_active,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT(template_code) DO UPDATE SET
          category=excluded.category,
          version=excluded.version,
          title=excluded.title,
          source_doc_name=excluded.source_doc_name,
          document_text=excluded.document_text,
          read_instruction=excluded.read_instruction,
          step_instructions_json=excluded.step_instructions_json,
          final_prompt_extraction_rule=excluded.final_prompt_extraction_rule,
          quality_rules_json=excluded.quality_rules_json,
          updated_at=excluded.updated_at
        """,
        (
            SOP_ID,
            "women_outfit_scene_15s_v1",
            "女装服装带货",
            "1.0",
            "女装服装带货 15秒场景氛围感视频提示词规范",
            "女装服装带货_15秒场景氛围感视频提示词规范.docx",
            "本 SOP 用于女装单品图到 LibTV 15 秒竖屏场景氛围感视频的自动化演算。必须先完整阅读文档，再在同一 AI 会话里按“执行第一步”到“执行第十步”逐步运行。禁止一次性合并多步。第十步输出必须是可直接复制到 LibTV 的完整视频提示词。",
            "完整阅读我给你的文档，并准备开始工作",
            json_text(STEP_INSTRUCTIONS),
            "读取第十步输出，提取可直接复制到 LibTV 的完整视频提示词。必须保留产品、风格、人物、场景、道具、动作、镜头、光影、时间轴、负面约束、输出规格。",
            json_text(
                [
                    {"name": "contains_product", "description": "包含主推单品、颜色、版型、搭配"},
                    {"name": "contains_scene", "description": "包含具体场景、空间、道具、动作"},
                    {"name": "contains_camera_timeline", "description": "包含 9:16 竖屏、15 秒时间轴、镜头与运镜"},
                    {"name": "contains_negative_rules", "description": "包含无口播、无字幕、无电商贴纸、无水印、避免变形等限制"},
                ]
            ),
            ts,
            ts,
        ),
    )

    cur.execute(
        """
        INSERT INTO products (
          id, category, product_name, product_description, selling_points,
          target_audience, market, metadata_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          category=excluded.category,
          product_name=excluded.product_name,
          product_description=excluded.product_description,
          selling_points=excluded.selling_points,
          target_audience=excluded.target_audience,
          market=excluded.market,
          metadata_json=excluded.metadata_json,
          updated_at=excluded.updated_at
        """,
        (
            PRODUCT_ID,
            "女装服装带货",
            "蓝灰色无袖扭结针织上衣 + 白色高腰垂坠 A 字长裙",
            "蓝灰色无袖扭结针织上衣搭配白色高腰垂坠 A 字长裙，配珍珠项链和草编包，整体偏韩系、温柔、通勤、约会、咖啡店氛围。",
            "韩系干净风；温柔约会风；轻通勤风；显腰线；夏日窗边清冷温柔感；适合咖啡店、街角、展览、周末约会场景。",
            "25-35 岁偏好韩系干净穿搭、轻通勤和温柔约会风的女性用户",
            "CN",
            json_text(
                {
                    "sample_from_thread_id": THREAD_ID,
                    "expected_video_style": "无口播、无字幕、无电商贴纸、9:16 竖屏、15 秒氛围感",
                }
            ),
            ts,
            ts,
        ),
    )

    cur.execute(
        """
        INSERT INTO video_tasks (
          id, task_code, product_id, sop_template_id, category, status,
          priority, ai_provider, ai_session_id, libtv_template_id,
          libtv_project_id, libtv_api_mode, output_mode, input_payload_json,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(task_code) DO UPDATE SET
          product_id=excluded.product_id,
          sop_template_id=excluded.sop_template_id,
          category=excluded.category,
          status=excluded.status,
          priority=excluded.priority,
          ai_provider=excluded.ai_provider,
          libtv_project_id=excluded.libtv_project_id,
          libtv_api_mode=excluded.libtv_api_mode,
          output_mode=excluded.output_mode,
          input_payload_json=excluded.input_payload_json,
          updated_at=excluded.updated_at
        """,
        (
            TASK_ID,
            "TEST-WOMEN-OUTFIT-001",
            PRODUCT_ID,
            SOP_ID,
            "女装服装带货",
            "prompt_ready",
            10,
            "doubao",
            None,
            None,
            "libtv_canvas_share_eKd7dosD9",
            "manual_until_api_ready",
            "15s_vertical_no_voiceover",
            json_text(
                {
                    "workflow": "产品任务 -> 读取品类SOP -> 豆包十步演算 -> 提取最终提示词 -> LibTV生成 -> 保存视频链接和日志",
                    "product_image_note": "产品图作为 LibTV 素材图；第二步前上传给 AI 做读图建档",
                }
            ),
            ts,
            ts,
        ),
    )

    cur.execute(
        """
        INSERT INTO final_product_prompts (
          id, task_id, prompt_version, source_step_no, prompt_text,
          prompt_json, validation_status, validation_report_json,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(task_id) DO UPDATE SET
          prompt_version=excluded.prompt_version,
          source_step_no=excluded.source_step_no,
          prompt_text=excluded.prompt_text,
          prompt_json=excluded.prompt_json,
          validation_status=excluded.validation_status,
          validation_report_json=excluded.validation_report_json,
          updated_at=excluded.updated_at
        """,
        (
            PROMPT_ID,
            TASK_ID,
            "v1",
            10,
            FINAL_PROMPT,
            json_text(
                {
                    "video_type": "女装单品场景氛围感视频",
                    "duration_seconds": 15,
                    "aspect_ratio": "9:16",
                    "voiceover": False,
                    "subtitles": False,
                    "commerce_stickers": False,
                    "product": "蓝灰色无袖扭结针织上衣 + 白色高腰垂坠 A 字长裙",
                    "style_tags": ["韩系干净风", "温柔约会风", "轻通勤风"],
                    "scenes": ["咖啡店窗边", "安静街角", "展览入口", "周末约会路线"],
                    "negative_rules": ["不要字幕", "不要促销贴纸", "不要水印", "不要肢体变形", "不要衣服结构错乱", "不要低清画质"],
                }
            ),
            "pass",
            json_text({"source": "thread_019e6c6d_summary_plus_final_sop", "checks": ["product", "scene", "camera_timeline", "negative_rules"]}),
            ts,
            ts,
        ),
    )

    for step in STEP_INSTRUCTIONS:
        status = "succeeded" if step["step_no"] in (0, 10) else "pending"
        response = None
        completed_at = None
        if step["step_no"] == 0:
            response = "已读取女装 15 秒场景氛围感 SOP，准备按十步执行。"
            completed_at = ts
        elif step["step_no"] == 10:
            response = FINAL_PROMPT
            completed_at = ts
        cur.execute(
            """
            INSERT INTO ai_step_runs (
              id, task_id, step_no, step_name, instruction, status,
              response_text, raw_response_json, completed_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(task_id, step_no) DO UPDATE SET
              step_name=excluded.step_name,
              instruction=excluded.instruction,
              status=excluded.status,
              response_text=excluded.response_text,
              completed_at=excluded.completed_at
            """,
            (
                f"00000000-0000-0000-0000-0000000005{step['step_no']:02d}",
                TASK_ID,
                step["step_no"],
                step["step_name"],
                step["instruction"],
                status,
                response,
                "{}",
                completed_at,
                ts,
            ),
        )

    cur.execute(
        """
        INSERT INTO libtv_jobs (id, task_id, status, submit_payload_json, raw_response_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(task_id) DO UPDATE SET
          status=excluded.status,
          submit_payload_json=excluded.submit_payload_json
        """,
        (
            "00000000-0000-0000-0000-000000000601",
            TASK_ID,
            "pending",
            json_text({"mode": "manual_until_libtv_api_credentials_ready", "canvas_share_id": "eKd7dosD9", "input_prompt_id": PROMPT_ID}),
            "{}",
            ts,
        ),
    )

    checks = [
        ("contains_product", "pass", "包含主推单品、颜色、版型、搭配与材质细节。"),
        ("contains_scene", "pass", "包含咖啡店窗边、街角、展览入口等场景和道具动作。"),
        ("contains_camera_timeline", "pass", "包含 0-15 秒分段镜头、9:16 竖屏和运镜要求。"),
        ("contains_negative_rules", "pass", "包含无口播、无字幕、无贴纸、无水印、避免变形等限制。"),
    ]
    for index, (name, status, details) in enumerate(checks, start=1):
        cur.execute(
            """
            INSERT INTO prompt_quality_checks (id, prompt_id, check_name, check_status, details, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(prompt_id, check_name) DO UPDATE SET
              check_status=excluded.check_status,
              details=excluded.details
            """,
            (f"00000000-0000-0000-0000-0000000007{index:02d}", PROMPT_ID, name, status, details, ts),
        )

    settings = [
        (
            "sqlite_connection_hint",
            {
                "host_path": str(path),
                "active_database": "ai_product.sqlite",
                "database_type": "sqlite",
            },
            "SQLite 版本数据库位置",
        ),
        (
            "default_workflow",
            {"steps": ["产品任务", "读取品类SOP", "豆包十步演算", "提取最终提示词", "LibTV生成", "保存视频链接和日志"]},
            "AI 带货视频-SZ 数据库默认流程",
        ),
    ]
    for key, value, description in settings:
        cur.execute(
            """
            INSERT INTO app_settings (key, value_json, description, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
              value_json=excluded.value_json,
              description=excluded.description,
              updated_at=excluded.updated_at
            """,
            (key, json_text(value), description, ts),
        )

    cur.execute(
        """
        INSERT INTO task_events (id, task_id, event_type, message, payload_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            f"seed-{int(datetime.now().timestamp())}",
            TASK_ID,
            "seed_created",
            "已写入女装样本任务、SOP 模板和最终完整商品视频提示词。",
            json_text({"thread_id": THREAD_ID}),
            ts,
        ),
    )

    con.commit()
    con.execute("PRAGMA wal_checkpoint(FULL)")
    con.close()


def summarize(path: Path) -> dict:
    con = sqlite3.connect(path)
    cur = con.cursor()
    tables = [
        "sop_templates",
        "products",
        "video_tasks",
        "ai_step_runs",
        "final_product_prompts",
        "prompt_quality_checks",
        "libtv_jobs",
        "task_events",
    ]
    counts = {table: cur.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0] for table in tables}
    sample = cur.execute(
        """
        SELECT vt.task_code, p.product_name, fp.validation_status, length(fp.prompt_text)
        FROM video_tasks vt
        JOIN products p ON p.id = vt.product_id
        JOIN final_product_prompts fp ON fp.task_id = vt.id
        WHERE vt.id = ?
        """,
        (TASK_ID,),
    ).fetchone()
    con.close()
    return {"path": str(path), "counts": counts, "sample": sample}


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: build_sqlite_database.py <output.sqlite> [<output2.sqlite> ...]")
        return 2
    for arg in sys.argv[1:]:
        path = Path(arg)
        build_database(path)
        print(json.dumps(summarize(path), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
