CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
    CREATE TYPE task_status AS ENUM (
      'draft',
      'ready',
      'ai_running',
      'prompt_ready',
      'prompt_review',
      'libtv_pending',
      'libtv_running',
      'video_ready',
      'failed',
      'archived'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'run_status') THEN
    CREATE TYPE run_status AS ENUM ('pending', 'running', 'succeeded', 'failed', 'skipped');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'asset_type') THEN
    CREATE TYPE asset_type AS ENUM (
      'product_image',
      'reference_image',
      'reference_video',
      'audio',
      'bgm',
      'generated_image',
      'output_video',
      'cover'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quality_status') THEN
    CREATE TYPE quality_status AS ENUM ('pending', 'pass', 'fail', 'manual_review');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS sop_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_code text NOT NULL UNIQUE,
  category text NOT NULL,
  version text NOT NULL,
  title text NOT NULL,
  source_doc_name text,
  document_text text NOT NULL,
  read_instruction text NOT NULL DEFAULT '完整阅读我给你的文档，并准备开始工作',
  step_instructions jsonb NOT NULL,
  final_prompt_extraction_rule text NOT NULL,
  quality_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  product_name text NOT NULL,
  product_description text,
  selling_points text,
  target_audience text,
  market text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS video_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_code text NOT NULL UNIQUE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sop_template_id uuid NOT NULL REFERENCES sop_templates(id),
  category text NOT NULL,
  status task_status NOT NULL DEFAULT 'draft',
  priority integer NOT NULL DEFAULT 100,
  ai_provider text NOT NULL DEFAULT 'doubao',
  ai_session_id text,
  libtv_template_id text,
  libtv_project_id text,
  libtv_api_mode text NOT NULL DEFAULT 'manual_until_api_ready',
  output_mode text NOT NULL DEFAULT '15s_vertical_no_voiceover',
  input_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_video_tasks_status_priority ON video_tasks(status, priority, created_at);
CREATE INDEX IF NOT EXISTS idx_video_tasks_product_id ON video_tasks(product_id);

CREATE TABLE IF NOT EXISTS product_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  task_id uuid REFERENCES video_tasks(id) ON DELETE CASCADE,
  asset_type asset_type NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  file_url text,
  file_path text,
  width integer,
  height integer,
  format text,
  size_bytes bigint,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_assets_task_type ON product_assets(task_id, asset_type, sort_order);

CREATE TABLE IF NOT EXISTS ai_step_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES video_tasks(id) ON DELETE CASCADE,
  step_no integer NOT NULL CHECK (step_no BETWEEN 0 AND 10),
  step_name text NOT NULL,
  instruction text NOT NULL,
  status run_status NOT NULL DEFAULT 'pending',
  response_text text,
  raw_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, step_no)
);

CREATE INDEX IF NOT EXISTS idx_ai_step_runs_task_step ON ai_step_runs(task_id, step_no);

CREATE TABLE IF NOT EXISTS final_product_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL UNIQUE REFERENCES video_tasks(id) ON DELETE CASCADE,
  prompt_version text NOT NULL DEFAULT 'v1',
  source_step_no integer NOT NULL DEFAULT 10,
  prompt_text text NOT NULL,
  prompt_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_status quality_status NOT NULL DEFAULT 'pending',
  validation_report jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prompt_quality_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid NOT NULL REFERENCES final_product_prompts(id) ON DELETE CASCADE,
  check_name text NOT NULL,
  check_status quality_status NOT NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prompt_id, check_name)
);

CREATE TABLE IF NOT EXISTS libtv_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL UNIQUE REFERENCES video_tasks(id) ON DELETE CASCADE,
  external_job_id text,
  status run_status NOT NULL DEFAULT 'pending',
  submit_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  video_url text,
  cover_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  completed_at timestamptz,
  error_message text
);

CREATE TABLE IF NOT EXISTS task_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES video_tasks(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  message text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_events_task_time ON task_events(task_id, created_at);

CREATE TABLE IF NOT EXISTS error_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES video_tasks(id) ON DELETE CASCADE,
  source text NOT NULL,
  error_code text,
  error_message text NOT NULL,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE VIEW v_ready_tasks AS
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
  st.step_instructions,
  vt.libtv_template_id,
  vt.libtv_project_id,
  vt.created_at
FROM video_tasks vt
JOIN products p ON p.id = vt.product_id
JOIN sop_templates st ON st.id = vt.sop_template_id
WHERE vt.status IN ('ready', 'prompt_review', 'prompt_ready')
ORDER BY vt.priority ASC, vt.created_at ASC;

INSERT INTO sop_templates (
  id,
  template_code,
  category,
  version,
  title,
  source_doc_name,
  document_text,
  step_instructions,
  final_prompt_extraction_rule,
  quality_rules
) VALUES (
  '00000000-0000-0000-0000-000000000101',
  'women_outfit_scene_15s_v1',
  '女装服装带货',
  '1.0',
  '女装服装带货 15秒场景氛围感视频提示词规范',
  '女装服装带货_15秒场景氛围感视频提示词规范.docx',
  $$本 SOP 用于女装单品图到 LibTV 15 秒竖屏场景氛围感视频的自动化演算。必须先完整阅读文档，再在同一 AI 会话里按“执行第一步”到“执行第十步”逐步运行。禁止一次性合并多步。第十步输出必须是可直接复制到 LibTV 的完整视频提示词。$$,
  jsonb_build_array(
    jsonb_build_object('step_no', 0, 'step_name', '完整阅读 SOP 文档', 'instruction', '完整阅读我给你的文档，并准备开始工作'),
    jsonb_build_object('step_no', 1, 'step_name', '风格包初始化', 'instruction', '执行第一步'),
    jsonb_build_object('step_no', 2, 'step_name', '读图建档', 'instruction', '执行第二步'),
    jsonb_build_object('step_no', 3, 'step_name', '女装造型师判断', 'instruction', '执行第三步'),
    jsonb_build_object('step_no', 4, 'step_name', '完整造型方案', 'instruction', '执行第四步'),
    jsonb_build_object('step_no', 5, 'step_name', '风格标签', 'instruction', '执行第五步'),
    jsonb_build_object('step_no', 6, 'step_name', '女性气质主题', 'instruction', '执行第六步'),
    jsonb_build_object('step_no', 7, 'step_name', '场景空间道具动作', 'instruction', '执行第七步'),
    jsonb_build_object('step_no', 8, 'step_name', '9:16 摄影光影运镜', 'instruction', '执行第八步'),
    jsonb_build_object('step_no', 9, 'step_name', '15 秒时间轴', 'instruction', '执行第九步'),
    jsonb_build_object('step_no', 10, 'step_name', '最终完整视频提示词', 'instruction', '执行第十步')
  ),
  '读取第十步输出，提取“可直接复制到 LibTV 的完整视频提示词”。必须保留产品、风格、人物、场景、道具、动作、镜头、光影、时间轴、负面约束、输出规格。',
  jsonb_build_array(
    jsonb_build_object('name', 'contains_product', 'description', '包含主推单品、颜色、版型、搭配'),
    jsonb_build_object('name', 'contains_scene', 'description', '包含具体场景、空间、道具、动作'),
    jsonb_build_object('name', 'contains_camera_timeline', 'description', '包含 9:16 竖屏、15 秒时间轴、镜头与运镜'),
    jsonb_build_object('name', 'contains_negative_rules', 'description', '包含无口播、无字幕、无电商贴纸、无水印、避免变形等限制')
  )
) ON CONFLICT (template_code) DO UPDATE SET
  category = EXCLUDED.category,
  version = EXCLUDED.version,
  title = EXCLUDED.title,
  source_doc_name = EXCLUDED.source_doc_name,
  document_text = EXCLUDED.document_text,
  step_instructions = EXCLUDED.step_instructions,
  final_prompt_extraction_rule = EXCLUDED.final_prompt_extraction_rule,
  quality_rules = EXCLUDED.quality_rules,
  updated_at = now();

INSERT INTO products (
  id,
  category,
  product_name,
  product_description,
  selling_points,
  target_audience,
  market,
  metadata
) VALUES (
  '00000000-0000-0000-0000-000000000201',
  '女装服装带货',
  '蓝灰色无袖扭结针织上衣 + 白色高腰垂坠 A 字长裙',
  '蓝灰色无袖扭结针织上衣搭配白色高腰垂坠 A 字长裙，配珍珠项链和草编包，整体偏韩系、温柔、通勤、约会、咖啡店氛围。',
  '韩系干净风；温柔约会风；轻通勤风；显腰线；夏日窗边清冷温柔感；适合咖啡店、街角、展览、周末约会场景。',
  '25-35 岁偏好韩系干净穿搭、轻通勤和温柔约会风的女性用户',
  'CN',
  jsonb_build_object(
    'sample_from_thread_id', '019e6c6d-6a8d-7280-9cbd-846be63756b8',
    'expected_video_style', '无口播、无字幕、无电商贴纸、9:16 竖屏、15 秒氛围感'
  )
) ON CONFLICT (id) DO UPDATE SET
  category = EXCLUDED.category,
  product_name = EXCLUDED.product_name,
  product_description = EXCLUDED.product_description,
  selling_points = EXCLUDED.selling_points,
  target_audience = EXCLUDED.target_audience,
  market = EXCLUDED.market,
  metadata = EXCLUDED.metadata,
  updated_at = now();

INSERT INTO video_tasks (
  id,
  task_code,
  product_id,
  sop_template_id,
  category,
  status,
  priority,
  ai_provider,
  ai_session_id,
  libtv_template_id,
  libtv_project_id,
  input_payload
) VALUES (
  '00000000-0000-0000-0000-000000000301',
  'TEST-WOMEN-OUTFIT-001',
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000101',
  '女装服装带货',
  'prompt_ready',
  10,
  'doubao',
  NULL,
  NULL,
  'libtv_canvas_share_eKd7dosD9',
  jsonb_build_object(
    'workflow', '产品任务 -> 读取品类SOP -> 豆包十步演算 -> 提取最终提示词 -> LibTV生成 -> 保存视频链接和日志',
    'product_image_note', '产品图作为 LibTV 素材图；第二步前上传给 AI 做读图建档'
  )
) ON CONFLICT (task_code) DO UPDATE SET
  product_id = EXCLUDED.product_id,
  sop_template_id = EXCLUDED.sop_template_id,
  category = EXCLUDED.category,
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  ai_provider = EXCLUDED.ai_provider,
  libtv_project_id = EXCLUDED.libtv_project_id,
  input_payload = EXCLUDED.input_payload,
  updated_at = now();

INSERT INTO final_product_prompts (
  id,
  task_id,
  prompt_version,
  source_step_no,
  prompt_text,
  prompt_json,
  validation_status,
  validation_report
) VALUES (
  '00000000-0000-0000-0000-000000000401',
  '00000000-0000-0000-0000-000000000301',
  'v1',
  10,
  $$生成一条 15 秒 9:16 竖屏女装场景氛围感视频，无口播、无字幕、无电商贴纸、无价格促销信息、无水印。主推单品是蓝灰色无袖扭结针织上衣，搭配白色高腰垂坠 A 字长裙，整体造型配珍珠项链和草编包，突出韩系干净风、温柔约会风、轻通勤风。画面风格是夏日窗边韩系清冷温柔通勤感，真实自然、干净高级、不过度商业化。

人物为 25-32 岁亚洲女性，妆容清透，发型自然，姿态放松，情绪温柔自信。场景可在咖啡店窗边、安静街角、展览入口或周末约会路线中切换，使用咖啡杯、花束、书、草编包作为自然道具。重点展示上衣的无袖肩线、胸前扭结细节、针织质感、蓝灰色柔和色调，以及白色高腰长裙的垂坠感和显高比例。

镜头时间轴：0-3 秒，半身近景从窗边自然光切入，人物整理珍珠项链或轻扶草编包，突出上衣扭结细节；3-6 秒，中景展示完整穿搭，人物从咖啡店窗边站起或转身，裙摆自然垂落；6-9 秒，低角度轻推镜头拍摄步行动作，表现高腰长裙的线条和轻盈感；9-12 秒，侧逆光或街角场景，人物回头微笑，手拿咖啡杯或花束，氛围清爽；12-15 秒，定格在干净完整的全身造型，画面稳定，服装版型清晰，适合直接作为女装带货素材。

摄影要求：自然日光、柔和阴影、浅景深、真实布料纹理、轻微手持感或稳定滑轨运镜，色彩保持蓝灰、白色、浅木色和植物绿的清爽组合。不要出现夸张滤镜、赛博风、浓重商业广告感、变形肢体、错误手指、衣服结构错乱、文字乱码、品牌 logo、水印、字幕条、促销贴纸或低清画质。最终视频应像真实生活方式短片，重点让观众一眼看清单品搭配、气质和适用场景。$$,
  jsonb_build_object(
    'video_type', '女装单品场景氛围感视频',
    'duration_seconds', 15,
    'aspect_ratio', '9:16',
    'voiceover', false,
    'subtitles', false,
    'commerce_stickers', false,
    'product', '蓝灰色无袖扭结针织上衣 + 白色高腰垂坠 A 字长裙',
    'style_tags', jsonb_build_array('韩系干净风', '温柔约会风', '轻通勤风'),
    'scenes', jsonb_build_array('咖啡店窗边', '安静街角', '展览入口', '周末约会路线'),
    'negative_rules', jsonb_build_array('不要字幕', '不要促销贴纸', '不要水印', '不要肢体变形', '不要衣服结构错乱', '不要低清画质')
  ),
  'pass',
  jsonb_build_object(
    'source', 'thread_019e6c6d_summary_plus_final_sop',
    'checks', jsonb_build_array('product', 'scene', 'camera_timeline', 'negative_rules')
  )
) ON CONFLICT (task_id) DO UPDATE SET
  prompt_version = EXCLUDED.prompt_version,
  source_step_no = EXCLUDED.source_step_no,
  prompt_text = EXCLUDED.prompt_text,
  prompt_json = EXCLUDED.prompt_json,
  validation_status = EXCLUDED.validation_status,
  validation_report = EXCLUDED.validation_report,
  updated_at = now();

INSERT INTO ai_step_runs (task_id, step_no, step_name, instruction, status, response_text, completed_at)
SELECT
  '00000000-0000-0000-0000-000000000301'::uuid,
  (step->>'step_no')::integer,
  step->>'step_name',
  step->>'instruction',
  CASE WHEN (step->>'step_no')::integer IN (0, 10) THEN 'succeeded'::run_status ELSE 'pending'::run_status END,
  CASE
    WHEN (step->>'step_no')::integer = 0 THEN '已读取女装 15 秒场景氛围感 SOP，准备按十步执行。'
    WHEN (step->>'step_no')::integer = 10 THEN (SELECT prompt_text FROM final_product_prompts WHERE task_id = '00000000-0000-0000-0000-000000000301')
    ELSE NULL
  END,
  CASE WHEN (step->>'step_no')::integer IN (0, 10) THEN now() ELSE NULL END
FROM sop_templates st
CROSS JOIN jsonb_array_elements(st.step_instructions) AS step
WHERE st.id = '00000000-0000-0000-0000-000000000101'
ON CONFLICT (task_id, step_no) DO UPDATE SET
  step_name = EXCLUDED.step_name,
  instruction = EXCLUDED.instruction,
  status = EXCLUDED.status,
  response_text = EXCLUDED.response_text,
  completed_at = EXCLUDED.completed_at;

INSERT INTO libtv_jobs (task_id, status, submit_payload)
VALUES (
  '00000000-0000-0000-0000-000000000301',
  'pending',
  jsonb_build_object(
    'mode', 'manual_until_libtv_api_credentials_ready',
    'canvas_share_id', 'eKd7dosD9',
    'input_prompt_id', '00000000-0000-0000-0000-000000000401'
  )
) ON CONFLICT (task_id) DO UPDATE SET
  status = EXCLUDED.status,
  submit_payload = EXCLUDED.submit_payload;

INSERT INTO prompt_quality_checks (prompt_id, check_name, check_status, details)
VALUES
  ('00000000-0000-0000-0000-000000000401', 'contains_product', 'pass', '包含主推单品、颜色、版型、搭配与材质细节。'),
  ('00000000-0000-0000-0000-000000000401', 'contains_scene', 'pass', '包含咖啡店窗边、街角、展览入口等场景和道具动作。'),
  ('00000000-0000-0000-0000-000000000401', 'contains_camera_timeline', 'pass', '包含 0-15 秒分段镜头、9:16 竖屏和运镜要求。'),
  ('00000000-0000-0000-0000-000000000401', 'contains_negative_rules', 'pass', '包含无口播、无字幕、无贴纸、无水印、避免变形等限制。')
ON CONFLICT (prompt_id, check_name) DO UPDATE SET
  check_status = EXCLUDED.check_status,
  details = EXCLUDED.details;

INSERT INTO app_settings (key, value, description)
VALUES
  ('n8n_connection_hint', jsonb_build_object('host_from_n8n', 'ai-ugc-postgres', 'port_from_n8n', 5432, 'host_from_windows', 'localhost', 'port_from_windows', 5433, 'database', 'ai_ugc', 'user', 'ai_ugc'), 'n8n PostgreSQL 节点连接信息'),
  ('default_workflow', jsonb_build_object('steps', jsonb_build_array('产品任务', '读取品类SOP', '豆包十步演算', '提取最终提示词', 'LibTV生成', '保存视频链接和日志')), 'AI 带货视频-SZ 数据库默认流程')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();

INSERT INTO task_events (task_id, event_type, message, payload)
VALUES (
  '00000000-0000-0000-0000-000000000301',
  'seed_created',
  '已写入女装样本任务、SOP 模板和最终完整商品视频提示词。',
  jsonb_build_object('thread_id', '019e6c6d-6a8d-7280-9cbd-846be63756b8')
);

