# libTV Worker API 契约说明

日期：2026-06-10  
适用项目：`01_apps/ai_prompt_video_studio`  
公开域名：`https://www.zkraiflow.top`  
机器可读契约：`deploy/libtv-worker-api-contract.json`

## 目标

把 libTV、ffmpeg、长耗时视频生成、结果导入和失败重试从本地 Windows 桌面迁移到私有 worker。手机网页、PWA 和封装 App 只访问 Node API，不直接接触 worker、数据库路径、对象存储密钥或模型供应商密钥。

## 必须保留的接口

| 接口 | 方法 | 用途 |
| --- | --- | --- |
| `/healthz` | `GET` | 检查 worker、存储、libTV、ffmpeg 和队列是否可用 |
| `/tasks` | `POST` | 接收 API 发来的生成任务，使用 `taskId` 做幂等 |
| `/tasks/:workerTaskId` | `GET` | 查询任务状态、进度、结果引用和错误 |
| `/tasks/:workerTaskId/cancel` | `POST` | 允许 API 取消未完成任务 |

## 安全边界

- worker 只允许 Node API 调用，移动端和浏览器端不允许直接访问。
- API 调用 worker 时使用 `Authorization: Bearer <LIBTV_WORKER_TOKEN>`。
- `LIBTV_WORKER_TOKEN` 只能放在托管平台 secret manager，不进入前端源码、PWA manifest 或公开页面。
- worker 返回 `resultRefs`，不返回本地文件路径、数据库路径、provider key 或对象存储密钥。
- API 负责把 `resultRefs` 转成用户可访问的下载或预览。

## 幂等和状态

`/tasks` 必须支持 `idempotency-key`。重复提交同一个 `taskId` 时，应返回已有 `workerTaskId`，避免重复消耗真实生成额度。

标准状态：

- `accepted`
- `queued`
- `running`
- `succeeded`
- `failed`
- `cancelled`

## 错误码

标准错误码：

- `VALIDATION_ERROR`
- `ASSET_UNAVAILABLE`
- `COMPLIANCE_BLOCKED`
- `PROVIDER_FAILED`
- `WORKER_RUNTIME_ERROR`
- `TIMEOUT`
- `CANCELLED_BY_USER`

API 需要把 worker 错误码转换成普通用户能读懂的中文提示，再显示到手机端通知和任务卡片。

## 验收命令

```bash
npm run cloud:worker-contract
npm run cloud:worker-plan
npm run cloud:check:strict
npm run release:check
```

`cloud:worker-contract` 会验证契约文件、云端计划、本文档和生产运行手册是否互相引用，避免 worker 实施时遗漏认证、取消、错误码、状态或结果引用规则。
