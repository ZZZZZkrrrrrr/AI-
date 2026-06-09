# AI 带货视频-SZ 控制台

本项目是本地 AI 工作流管理后台：

- 前端控制台：Vite SPA，默认端口 `5173`
- 后端 API：Node 服务，默认端口 `3001`
- 数据库：`D:\Organized\Projects\codex_project\workflow\ai_ugc_database\ai_ugc_product.sqlite`
- libTV 桥接：`http://127.0.0.1:8799`

## 启动

```powershell
cd D:\Organized\Projects\codex_project\workflow\ecommerce_ugc_video_system\ai_prompt_video_studio
.\start_console.ps1
```

打开：

```text
http://localhost:5173
```

## 链路

1. 上传 Word 提示词包或粘贴 SOP 文本。
2. 上传商品图片。
3. 后端调用千问视觉识别商品事实和类别。
4. 后端调用豆包按提示词包里的动态步骤执行，不固定 10 步。
5. 前端按步骤显示状态和输出。
6. 后端封装最终完整提示词。
7. 用户可手动编辑或复制最终提示词。
8. 点击写入数据库并提交 libTV。
9. 后端写入 SQLite 并调用本机 libTV 桥接。
10. libTV 生成结果后，后端保存视频链接和本地 mp4。

## 页面

- 提示词工作台：上传、分析、生成提示词、提交 libTV。
- 任务看板：读取 `v_video_task_dashboard`。
- libTV 任务：读取 `v_libtv_job_detail`。
- 素材与输出：读取产品素材和本地视频输出。
- 系统设置：查看 API、数据库、libTV 桥接状态。
