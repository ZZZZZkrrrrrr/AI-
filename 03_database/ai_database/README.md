# AI UGC Database

当前唯一使用的本地数据库：

```text
D:\Organized\Projects\codex_project\workflow\ai_database\ai_product.sqlite
```

网页端、libTV 桥接服务、注册脚本、Navicat 查看都使用这一份数据库。

## Navicat 查看

优先看这些视图：

- `v_video_task_dashboard`：任务看板，包含任务编号、日期、类别、序号、libTV 节点名、商品名、状态、图片路径、最终视频链接。
- `v_final_prompt_detail`：最终完整提示词明细。
- `v_product_asset_detail`：产品图、提示词文件等素材路径。
- `v_libtv_job_detail`：libTV 提交、轮询、视频链接和错误信息。

## 主要表

- `video_tasks`：视频任务主表。
- `products`：商品信息。
- `final_product_prompts`：最终完整提示词。
- `product_assets`：产品图、提示词文件等素材。
- `libtv_jobs`：libTV 提交状态和结果。
- `task_events`：任务事件日志。

## 优化视图和字段

如需重建视图或补齐字段：

```powershell
py -3 .\ai_database\optimize_database.py
```
