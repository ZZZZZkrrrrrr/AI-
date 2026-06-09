-- 1. Pick the next product task for n8n.
SELECT *
FROM v_ready_tasks
ORDER BY priority ASC, created_at ASC
LIMIT 1;

-- 2. Mark a task as running the AI ten-step prompt workflow.
UPDATE video_tasks
SET status = 'ai_running',
    ai_session_id = :ai_session_id,
    started_at = COALESCE(started_at, datetime('now')),
    updated_at = datetime('now')
WHERE id = :task_id;

-- 3. Save one AI step response.
INSERT INTO ai_step_runs (
  id,
  task_id,
  step_no,
  step_name,
  instruction,
  status,
  response_text,
  raw_response_json,
  completed_at,
  created_at
) VALUES (
  :id,
  :task_id,
  :step_no,
  :step_name,
  :instruction,
  :status,
  :response_text,
  COALESCE(:raw_response_json, '{}'),
  datetime('now'),
  datetime('now')
)
ON CONFLICT(task_id, step_no) DO UPDATE SET
  step_name = excluded.step_name,
  instruction = excluded.instruction,
  status = excluded.status,
  response_text = excluded.response_text,
  raw_response_json = excluded.raw_response_json,
  completed_at = excluded.completed_at;

-- 4. Save the final complete product prompt from step 10.
INSERT INTO final_product_prompts (
  id,
  task_id,
  prompt_version,
  source_step_no,
  prompt_text,
  prompt_json,
  validation_status,
  validation_report_json,
  created_at,
  updated_at
) VALUES (
  :id,
  :task_id,
  'v1',
  10,
  :prompt_text,
  COALESCE(:prompt_json, '{}'),
  :validation_status,
  COALESCE(:validation_report_json, '{}'),
  datetime('now'),
  datetime('now')
)
ON CONFLICT(task_id) DO UPDATE SET
  prompt_text = excluded.prompt_text,
  prompt_json = excluded.prompt_json,
  validation_status = excluded.validation_status,
  validation_report_json = excluded.validation_report_json,
  updated_at = excluded.updated_at;

-- 5. Read the final prompt to send into LibTV.
SELECT
  vt.task_code,
  p.product_name,
  fp.prompt_text,
  fp.prompt_json
FROM final_product_prompts fp
JOIN video_tasks vt ON vt.id = fp.task_id
JOIN products p ON p.id = vt.product_id
WHERE fp.task_id = :task_id;

-- 6. Create or update a LibTV job row.
INSERT INTO libtv_jobs (
  id,
  task_id,
  external_job_id,
  status,
  submit_payload_json,
  raw_response_json,
  submitted_at,
  created_at
) VALUES (
  :id,
  :task_id,
  :external_job_id,
  :status,
  COALESCE(:submit_payload_json, '{}'),
  COALESCE(:raw_response_json, '{}'),
  datetime('now'),
  datetime('now')
)
ON CONFLICT(task_id) DO UPDATE SET
  external_job_id = excluded.external_job_id,
  status = excluded.status,
  submit_payload_json = excluded.submit_payload_json,
  raw_response_json = excluded.raw_response_json,
  submitted_at = excluded.submitted_at;

-- 7. Save final LibTV video URLs.
UPDATE libtv_jobs
SET status = 'succeeded',
    video_url = :video_url,
    cover_url = :cover_url,
    raw_response_json = COALESCE(:raw_response_json, raw_response_json),
    completed_at = datetime('now')
WHERE task_id = :task_id;

UPDATE video_tasks
SET status = 'video_ready',
    finished_at = datetime('now'),
    updated_at = datetime('now')
WHERE id = :task_id;

-- 8. Log a task event.
INSERT INTO task_events (
  id,
  task_id,
  event_type,
  message,
  payload_json,
  created_at
) VALUES (
  :id,
  :task_id,
  :event_type,
  :message,
  COALESCE(:payload_json, '{}'),
  datetime('now')
);

-- 9. Record an error for Part 8 write-back/error attribution.
INSERT INTO error_reports (
  id,
  task_id,
  source,
  error_code,
  error_message,
  raw_payload_json,
  created_at
) VALUES (
  :id,
  :task_id,
  :source,
  :error_code,
  :error_message,
  COALESCE(:raw_payload_json, '{}'),
  datetime('now')
);

UPDATE video_tasks
SET status = 'failed',
    updated_at = datetime('now')
WHERE id = :task_id;

