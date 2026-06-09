# LibTV local runner

这个目录是本地脚本项目，用来从唯一数据库 `ai_ugc_product.sqlite` 读取产品图和最终提示词，调用 LibTV 生成视频，并把会话、状态、视频链接写回同一份数据库。

旧版 `POST /openapi/session` 现在只返回“已升级为 LibTV CLI”的提示，所以真实生成使用官方 `libtv` CLI：

- `libtv project create`：创建画布项目
- `libtv node create ... -t video -r`：创建视频节点并触发生成
- `libtv node <node>`：轮询节点，读取视频 URL
- `libtv download`：可选下载生成结果

## 1. CLI 登录

CLI 已安装到：

```
D:\Organized\Projects\codex_project\workflow\libtv_runner\bin\libtv.exe
```

先完成一次网页登录。脚本默认把登录态放在 `libtv_runner\.libtv_config`，不污染系统全局登录态。

```powershell
$env:LIBTV_CONFIG_DIR="D:\Organized\Projects\codex_project\workflow\libtv_runner\.libtv_config"
D:\Organized\Projects\codex_project\workflow\libtv_runner\bin\libtv.exe login web --open
```

## 2. 查看可提交任务

```powershell
py -3 .\libtv_runner\libtv_cli_db_runner.py list
```

## 3. 登记一张产品图和一个提示词文档

提示词文档支持 `.txt`、`.md`、`.docx`。产品图先用本地路径保存到数据库的 `product_assets.file_path`。

```powershell
py -3 .\libtv_runner\register_task_input.py `
  --task-code PROD-001 `
  --product-name "产品名称" `
  --category "产品视频" `
  --image-path "D:\path\to\product.png" `
  --prompt-doc "D:\path\to\prompt.docx"
```

登记后任务状态是 `prompt_ready`，可以被 `list` 和 `submit` 读取。

## 4. 先做 dry run

不会调用 LibTV，也不会改数据库：

```powershell
py -3 .\libtv_runner\libtv_cli_db_runner.py submit --task-code PROD-001 --dry-run
```

如果该任务有 `product_image`，提交时脚本会先用 `libtv upload` 上传图片资源节点，再用 `mixed2video` 把图片节点连到视频节点。

## 5. 提交到 LibTV

```powershell
py -3 .\libtv_runner\libtv_cli_db_runner.py submit --task-code PROD-001
```

脚本会写回：

- `libtv_jobs.external_job_id` = LibTV `nodeKey` 或节点名
- `libtv_jobs.status` = `submitted`
- `video_tasks.status` = `video_generating`
- `video_tasks.libtv_project_id` = LibTV 项目 UUID
- `task_events` 增加 `libtv_cli_submitted`

## 6. 轮询并写回视频链接

```powershell
py -3 .\libtv_runner\libtv_cli_db_runner.py poll --task-code PROD-001
```

如果返回视频 URL，脚本会写回：

- `libtv_jobs.status` = `succeeded`
- `libtv_jobs.video_url`
- `libtv_jobs.cover_url`
- `video_tasks.status` = `video_ready`
- `task_events` 增加 `libtv_cli_video_ready`

## 7. 一条命令提交并等待

```powershell
py -3 .\libtv_runner\libtv_cli_db_runner.py run --task-code PROD-001 --download
```

默认模型是 `star-video2`，参数是 `9:16`、`15` 秒、`720p`、无声音。可以用 `--model`、`--duration`、`--ratio`、`--resolution` 覆盖。
