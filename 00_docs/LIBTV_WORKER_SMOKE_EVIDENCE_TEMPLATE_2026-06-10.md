# libTV Worker 冒烟证据模板

目标域名：`https://www.zkraiflow.top`

这份模板用于把当前依赖本机 Windows 路径、localhost bridge、桌面 libTV 运行时的能力，迁移到可上线的私有 worker 后进行最小可证明验收。它不是让用户直接看到的页面，而是给发布负责人、开发和运维使用的检查表。

## 先跑本地模板检查

在 `01_apps/ai_prompt_video_studio` 下执行：

```bash
npm run cloud:worker-smoke-template
```

这个命令只检查模板、文档和发布链路是否完整，不会连接真实 worker，也不会触发付费生成。

## 需要先由负责人确认

- worker 部署形态：私有容器、私有 VM、Cloud Run/Job、队列 worker，或同等的私有任务执行服务。
- `LIBTV_BRIDGE_URL`：必须是非 localhost 的私有 worker 地址，前端网页和 App 不能直接访问。
- `LIBTV_WORKER_TOKEN`：只能放在云平台 secret manager 或托管平台密钥里，不要放进仓库、前端代码、截图、日志或公开文档。
- `LIBTV_REGISTER_SCRIPT`：应是容器或 worker 内路径，例如 `/app/services/libtv_runner/register_task_input.py`，不能继续使用 Windows 本机路径。
- `LIBTV_DB_PATH`：应是持久卷、托管数据库或 worker 可访问的服务端路径，不能依赖开发电脑。
- `RUN_STORAGE_DIR`：需要和持久化存储重启证据打通，确保上传、结果、导出和删除请求不会因服务重启丢失。
- 配额与成本负责人：真实视频生成前，要有每日任务上限、失败告警、费用告警和回滚负责人。

## 最小冒烟场景

1. 健康检查：从 API 服务或私有网络访问 `GET /healthz`，确认 worker ready、存储可写、libTV/ffmpeg 状态明确、队列深度可读。
2. 未授权拒绝：无 token 或浏览器直连 worker 必须返回 401/403，不能创建任务，也不能暴露路径或密钥。
3. dry-run 提交：用安全素材和提示词提交 `dryRun=true` 任务，确认返回 `workerTaskId`，不会触发付费生成。
4. 幂等重试：相同 `taskId` 或幂等 key 重复提交，不应产生第二次付费生成。
5. 状态轮询：按契约轮询到 `succeeded`、`failed`、`cancelled` 或 `timed_out` 等终态。
6. 取消任务：对排队或可控长任务发起取消，移动端任务提醒要显示小白能理解的状态。
7. 失败映射：用安全方式触发缺少提示词包、非法素材引用等错误，API 要映射成用户能看懂的原因。
8. 结果导入：dry-run 或审核安全真实任务完成后，结果引用要进入 API 的任务/结果视图，浏览器不能拿到 worker 存储密钥。
9. 重启恢复：worker 重启后健康检查恢复，任务状态仍可读，并能关联到持久化存储证据。

## 证据怎么存

建议把脱敏后的结果放到：

```text
store/evidence/libtv-worker/YYYY-MM-DD/libtv-worker-smoke-redacted.json
```

可以放进仓库的内容：

- 脱敏后的场景 pass/fail 汇总。
- 脱敏后的状态时间线。
- 公开安全的版本号、镜像 tag 或 release id。
- 用户可见错误文案。
- 不含 token、密钥、私有素材和用户数据的截图或日志摘要。

不要放进仓库的内容：

- `LIBTV_WORKER_TOKEN` 的真实值。
- AI/provider API key。
- 登录 cookie、session、审核账号密码。
- 用户原始图片、视频、提示词私密内容。
- 数据库密码、对象存储 key、私有网络凭证。
- 含本机路径、内部路径、token、用户数据的完整原始日志。

## 可以解除 worker 阻塞的标准

- `LIBTV_BRIDGE_URL` 已经指向非本机、非 localhost 的私有 worker。
- `LIBTV_REGISTER_SCRIPT` 和 `LIBTV_DB_PATH` 已替换为 worker/container/托管服务路径。
- 健康检查、未授权拒绝、dry-run 提交、幂等重试、状态轮询、取消、失败映射、结果导入、重启恢复均有脱敏证据。
- 持久化存储重启证据已经和 worker 结果存储打通。
- dry-run 回退仍可用，真实生成失败时能快速关闭付费执行。
- 配额、费用、第一周监控和回滚负责人已确认。

## 参考资料

- [Dockerfile HEALTHCHECK](https://docs.docker.com/reference/dockerfile/#healthcheck)
- [Kubernetes liveness/readiness/startup probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [Cloud Run health checks](https://cloud.google.com/run/docs/configuring/healthchecks)
- [Cloud Tasks retry configuration](https://cloud.google.com/tasks/docs/configuring-queues)
