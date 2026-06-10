# AI 视频工作流控制台

这是一个本地 AI 视频生成工作流系统，核心链路是：

```text
提示词包 + 商品图片
-> 图片识别和类别判断
-> 大模型分析提示词包
-> 生成最终完整视频提示词
-> 写入 SQLite 数据库
-> 提交 libTV / Seedance 生成视频
-> 回写任务状态和视频结果
```

## 目录结构

```text
00_docs/
  项目文档、阶段计划、部署说明、目录索引

01_apps/
  ai_prompt_video_studio/
    主系统：React 前端 + Node 后端 API

02_services/
  libtv_runner/
    libTV 桥接服务、CLI 调用脚本、n8n workflow

  cloudflare_tunnel/
    本地域名展示用的 Cloudflare Tunnel 启动脚本和配置

03_database/
  ai_database/
    SQLite 建库脚本、数据库优化脚本、n8n 查询示例

04_runtime/
  本地运行输出目录。通常不上传 GitHub。

05_automation/
  n8n、提示词拆解和自动化资料

06_archive/
  历史归档。通常不参与当前系统运行。
```

## 本地启动

在 PowerShell 中运行：

```powershell
cd D:\Organized\Projects\codex_project\workflow
.\start_workflow_console.ps1
```

默认地址：

```text
网页控制台：http://localhost:5173
后端 API：http://localhost:3001
libTV 桥接：http://127.0.0.1:8799
```

只启动 libTV 桥接：

```powershell
cd D:\Organized\Projects\codex_project\workflow
.\start_libtv_bridge.ps1
```

## 环境配置

真实密钥不要上传 GitHub。

本地使用时，把下面文件复制成 `.env` 后填写自己的密钥：

```text
01_apps\ai_prompt_video_studio\.env.example
02_services\libtv_runner\.env.example
```

常用配置包括：

- 千问文本模型
- 千问视觉模型
- 豆包 / 火山方舟模型
- libTV 桥接地址
- 控制台登录账号和密码

## 数据库

默认数据库路径：

```text
03_database\ai_database\ai_product.sqlite
```

建库脚本：

```powershell
py -3 .\03_database\ai_database\build_sqlite_database.py
py -3 .\03_database\ai_database\optimize_database.py
```

SQLite 运行库属于本地数据，默认不上传 GitHub。

## 关键页面

- 生产总览
- 提示词工作台
- 单条视频
- 批量生成
- 视频拼接
- 任务看板
- libTV 任务
- 人物素材库
- 素材与输出
- 系统设置 / 模型中心

## 不上传内容

默认不上传：

- `.env`
- API Key
- 数据库运行文件
- 上传图片
- 生成视频
- 运行日志
- `node_modules`
- `dist`
- 本地缓存

## 当前项目索引

详细目录说明见：

```text
00_docs\当前项目目录索引_2026-06-09.md
```
