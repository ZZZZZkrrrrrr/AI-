# AI-n8n-libTV

本仓库是一套本地 AI 带货视频工作流，包含：

- 网页端提示词工作台：上传提示词包和商品图，生成最终完整视频提示词。
- 后端 API：调用千问视觉、千问文本/豆包分析模型，写入数据库并提交 libTV。
- SQLite 数据库结构：保存商品、任务、最终提示词、素材、libTV 状态。
- libTV 本机桥接：让 Docker 中的 n8n 或网页端调用 Windows 本机脚本和 libTV CLI。
- n8n workflow：本地脚本复用、任务提交和轮询示例。

## 目录

```text
ai_ugc_database/
  init/001_schema_and_seed.sql      SQLite 建表和视图
  build_sqlite_database.py          创建本地数据库
  optimize_database.py              优化视图和字段

ecommerce_ugc_video_system/
  ai_prompt_video_studio/           前端控制台 + 后端 API

libtv_runner/
  libtv_n8n_bridge.py               本机桥接服务
  libtv_cli_db_runner.py            libTV 数据库任务执行器
  register_task_input.py            网页任务注册入库脚本
  n8n/libtv_local_runner.workflow.json
  bin/libtv.exe                     libTV CLI
```

## 不上传的本地数据

仓库不会提交以下内容：

- 真实 `.env` 和 API Key
- `node_modules/`
- 运行日志
- 上传图片和生成过程目录 `runs/`
- 生成视频目录 `outputs/`
- SQLite 运行库和备份文件
- Python 缓存

需要真实运行时，请复制 `.env.example` 为 `.env`，再填入自己的 API Key。

## 启动网页控制台

```powershell
cd ecommerce_ugc_video_system\ai_prompt_video_studio
npm install
copy .env.example .env
.\start_console.ps1
```

打开：

```text
http://localhost:5173
```

默认服务：

```text
前端控制台：http://localhost:5173
后端 API：http://localhost:3001
libTV 桥接：http://127.0.0.1:8799
```

## 启动 libTV 桥接

```powershell
cd libtv_runner
copy .env.example .env
.\start_n8n_bridge.ps1
```

Docker 中的 n8n 访问本机桥接时使用：

```text
http://host.docker.internal:8799
```

## 创建数据库

```powershell
py -3 .\ai_ugc_database\build_sqlite_database.py
py -3 .\ai_ugc_database\optimize_database.py
```

默认数据库路径：

```text
ai_ugc_database\ai_ugc_product.sqlite
```

该运行库已被 `.gitignore` 排除。仓库保留建表 SQL 和构建脚本。

## 当前链路

```text
提示词包 + 商品图片
  -> 千问视觉识别商品事实和类别
  -> 千问文本/豆包按提示词包动态分析步骤
  -> 封装最终完整商品视频提示词
  -> 写入 SQLite
  -> 调用 libTV 桥接
  -> libTV 生成视频
  -> 前端查看状态和结果
```

## 已完成能力

- 中文 Word 提示词包上传解析
- 多张商品图片上传
- 图片识别和类别自动判断
- 可切换提示词分析模型和图片识别模型
- 可查看模型分析过程
- 生成中可中断
- 最终提示词可复制、可手动编辑
- 写入数据库并提交 libTV
- 任务看板、libTV 任务、素材与输出、系统设置页面
- 明亮 / 深色主题图标切换

## 阶段交付文档

详见：

```text
ecommerce_ugc_video_system\ai_prompt_video_studio\DELIVERY_2026-05-29.md
```
# AI-n8n-libTV
