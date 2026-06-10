# 持久化存储重启证据模板

更新时间：2026-06-10  
公开入口：`https://www.zkraiflow.top`  
结构化文件：`01_apps/ai_prompt_video_studio/deploy/persistent-storage-restart-evidence-template.json`  
校验命令：`npm run storage:restart-template`

## 1. 用途

这份模板用于关闭 `persistent-storage` 生产阻断项。它要证明：用户上传、生成结果、数据导出请求、账号删除请求、审核演示数据，不会因为 API 或 worker 服务重启而丢失。

当前状态仍是：模板就绪，等待生产挂载卷、对象存储适配器或托管持久盘的真实运行证据。

## 2. 官方依据

- Docker volumes：`https://docs.docker.com/engine/storage/volumes/`
- Kubernetes volumes：`https://kubernetes.io/docs/concepts/storage/volumes/`
- Google Cloud Run container filesystem：`https://docs.cloud.google.com/run/docs/container-contract#filesystem`
- Amazon S3 object storage：`https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html`

这些资料共同说明：容器可写层或内存文件系统不应承担生产持久化职责；如果选择容器化部署，需要明确挂载卷、持久卷或对象存储适配器。

## 3. 上线前必须准备

需要仓库外确认：

- 生产 `RUN_STORAGE_DIR`
- 挂载卷、托管磁盘或对象存储 bucket
- 备份频率
- 备份负责人
- 数据保留和删除策略
- worker 是否和 API 使用同一存储根，或是否通过对象存储共享结果

不要把云存储密钥、bucket access key、备份清单、私人上传素材、Cookie、审核账号密码放进仓库。

## 4. 重启测试步骤

重启前：

1. 确认 `RUN_STORAGE_DIR` 指向生产持久化路径或对象存储适配器。
2. 用审核安全账号登录。
3. 上传一张演示商品图。
4. 创建一个 dry-run 任务。
5. 创建一个数据导出请求。
6. 创建一个删除请求记录。

重启：

1. 重启 API 服务。
2. 如果有 worker，重启 worker 服务。
3. 不清空挂载卷或对象存储 bucket。

重启后：

1. 再次登录或确认会话状态。
2. 确认上传素材仍可读。
3. 确认任务/结果仍可见。
4. 确认数据导出和删除请求记录仍存在。
5. 运行 `npm run cloud:smoke`。
6. 只记录脱敏路径和对象 ID。

## 5. 证据文件格式

建议保存到：

`store/evidence/storage-restart/YYYY-MM-DD/persistent-storage-restart-redacted.json`

结果至少包含：

- 执行时间
- 公开域名
- 存储类型：挂载卷、对象存储适配器或托管磁盘
- 脱敏后的 `RUN_STORAGE_DIR`
- 重启动作
- passes/failures/warnings
- 已验证的 artifact：上传、生成结果、数据导出、删除请求、审核演示数据
- 关联 blocker ID

## 6. 不要放进仓库

不要放进仓库：

- 云存储 secret key
- bucket 原始凭据
- 私人商品图或用户上传
- 未脱敏备份清单
- Session Cookie
- 审核账号密码

仓库里只放脱敏路径、对象 ID、通过数量、失败数量、重启动作摘要和 blocker ID。

## 7. 关闭标准

关闭 `persistent-storage` 前必须满足：

1. 生产 `RUN_STORAGE_DIR` 或对象存储适配器已确定并配置。
2. 上传素材在 API/worker 重启后仍可读。
3. 生成结果或 dry-run 任务在 API/worker 重启后仍可见。
4. 数据导出和删除请求记录在重启后仍存在。
5. 备份频率、负责人、保留/删除策略已记录。
6. `npm run storage:restart-template` 通过。
7. 填写了脱敏的生产重启证据 JSON。
