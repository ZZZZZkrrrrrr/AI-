# libTV Worker 与持久化存储迁移方案

日期：2026-06-10  
适用项目：`01_apps/ai_prompt_video_studio`  
公开域名：`https://www.zkraiflow.top/`

## 1. 目标

把当前依赖本机 Windows 路径、SQLite 文件、ffmpeg 和 libTV 桥接服务的执行方式，迁移为“公开 API + 私有 worker + 持久化存储”的生产形态。

首个生产版本建议采用单租户模式：用户只访问 `https://www.zkraiflow.top/`，Node API 负责登录、任务创建、状态查询、数据导出和删除申请；私有 libTV worker 负责长耗时的视频执行、结果导入和证据写入。

2026-06-12 补充：文生图功能已经新增 `outputs/text-to-image` 和 `text_image_canvas_nodes`。这部分虽然不由 libTV worker 执行，但属于同一套持久化存储和 AI 证据链，公开发布前需要纳入对象存储和数据库迁移。

## 2. 推荐架构

```text
Mobile Web / PWA / Packaged App
        |
        v
https://www.zkraiflow.top
        |
        v
Node API Service
        |
        +--> Persistent storage: /var/lib/ai-video-studio/runs
        +--> SQLite on mounted volume for pilot, PostgreSQL later
        +--> Private libTV worker endpoint
                 |
                 +--> Python runner
                 +--> libTV runtime
                 +--> ffmpeg
                 +--> worker-visible DB/storage
```

移动端、PWA 和封装 App 不应直接访问 worker、SQLite、ffmpeg、模型密钥或对象存储密钥。所有私有路径和密钥都留在服务端。

## 3. 第一阶段生产形态

建议先做“私有部署 + 小范围试用”，而不是直接做多租户 SaaS：

- API 与前端使用同一个 HTTPS 域名。
- `RUN_STORAGE_DIR` 指向持久化挂载卷。
- libTV worker 放在同一私有网络或同一云平台的内部服务里。
- `LIBTV_DEFAULT_DRY_RUN=true` 保持到 worker、存储和 smoke 验证全部通过。
- 真实出片只在小批量、可回滚、有费用上限的条件下开启。

## 4. 必填生产环境变量

| 变量 | 用途 | 示例 |
|---|---|---|
| `RUN_STORAGE_DIR` | 保存 uploads、runs、exports、删除申请证据和生成结果 | `/var/lib/ai-video-studio/runs` |
| `TEXT_IMAGE_STORAGE_MODE` | 文生图图片存储模式，内测可用 mounted-volume，公开发布应迁移 object-storage | `mounted-volume` |
| `LIBTV_BRIDGE_URL` | API 调用的私有 worker 地址 | `https://libtv-worker.internal.example.com` |
| `LIBTV_REGISTER_SCRIPT` | worker 内部脚本路径或等价服务命令 | `/app/services/libtv_runner/register_task_input.py` |
| `LIBTV_DB_PATH` | worker 可访问的数据库路径或托管数据库引用 | `/data/ai_product.sqlite` |
| `LIBTV_DEFAULT_DRY_RUN` | 真实执行开关 | `false`，但必须等 worker 验证后再切 |
| `SMOKE_BASE_URL` | 部署后 smoke 目标 | `https://www.zkraiflow.top` |

## 5. Worker 接口契约

最低可用接口：

| 接口 | 方法 | 目的 |
|---|---|---|
| `/healthz` | `GET` | 返回 worker、存储、libTV、ffmpeg 是否可用 |
| `/tasks` | `POST` | 接收 API 创建的视频生成任务 |
| `/tasks/:workerTaskId` | `GET` | 返回 worker 任务状态、进度、结果引用和错误 |

`/tasks` 请求至少要包含 `taskId`、`runDir`、商品图引用、提示词包、视频模式、是否 dry-run 和操作用户 ID。worker 返回结果时，不直接暴露本机文件路径给前端，只返回 API 能解析的结果引用。

## 6. 迁移步骤

1. 设置 `RUN_STORAGE_DIR` 到生产挂载卷，确认 API 重启后文件仍可读。
2. 把上传、运行结果、账号导出和删除申请证据统一落到 `RUN_STORAGE_DIR`。
3. 将文生图 `outputs/text-to-image` 纳入持久化媒体目录或对象存储，并让 `text_image_canvas_nodes` 保留对象 key、owner、tenant、提示词摘要和删除状态。
4. 搭建私有 worker 环境，安装 Python、ffmpeg、libTV runner 和运行凭据。
5. 给 worker 增加 `/healthz`、`/tasks`、`/tasks/:id`。
6. 将 `LIBTV_BRIDGE_URL` 从 localhost 改为私有 worker 地址。
7. 将 `LIBTV_REGISTER_SCRIPT` 与 `LIBTV_DB_PATH` 从 Windows 路径改为 worker/container 路径。
8. 先跑 dry-run，再跑一条受控真实出片。
9. 记录回滚方式：上一版构建产物、环境变量快照、worker 镜像或部署版本。

## 7. 验收标准

- `npm run cloud:worker-plan` 通过。
- `npm run cloud:check:strict` 不再提示 `RUN_STORAGE_DIR` 缺失、`LIBTV_BRIDGE_URL` 指向 localhost、libTV 路径为 Windows 本机路径。
- worker `/healthz` 返回 storage、libTV 和 ffmpeg 都可用。
- 生成任务在 API 创建后能进入 worker，状态能回写到移动端任务提醒和任务卡片。
- API 或 worker 重启后，已生成的结果、导出文件和删除申请证据仍可访问。
- API 重启后，text-image 图片和 `text_image_canvas_nodes` 画布节点仍可访问，且删除画布节点不会误删底层图片。
- 真实出片开关只在完成 smoke、费用上限和回滚确认后开启。

## 8. 当前仍需 owner 决策

- 生产持久化存储使用挂载卷还是对象存储。
- worker 部署位置：容器平台、私有云主机或托管 job runner。
- 审核/内测账号和 smoke 测试凭据。
- 生成视频、上传素材、账号导出和删除申请证据的保留周期。
- 真实出片的首批额度、并发上限和成本止损线。

## 9. 对应自动化

```bash
npm run cloud:worker-plan
npm run cloud:check:strict
npm run cloud:smoke
npm run release:check
```

相关机器可读计划：`deploy/libtv-worker-storage-plan.json`。
