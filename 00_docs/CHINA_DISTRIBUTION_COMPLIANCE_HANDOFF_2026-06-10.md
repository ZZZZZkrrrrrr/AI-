# 中国区发布与备案合规交接包

日期：2026-06-10  
适用项目：`01_apps/ai_prompt_video_studio`  
当前域名：`https://www.zkraiflow.top/`

## 1. 目标

把中国区公开发布、国内安卓商店、ICP备案、APP 备案、AI 生成内容标识和隐私材料统一成一份可执行清单。当前真实备案号、运营主体、联系方式仍需要 owner/法务提供，不能在代码里伪造。

## 2. 当前状态

- 域名已明确：`www.zkraiflow.top`。
- `store/submission-readiness.json` 已追踪 `operatorName`、`icpFilingNumber`、`appFilingNumber`、`filingDisplayLocation`。
- 这些字段当前仍是 TODO 或未开始状态。
- 隐私政策、AI 生成说明、账号删除入口、支持页已有草案，但上架前需要法务和运营确认最终文字。

## 3. 需要 owner 提供的值

| 字段 | 当前状态 | 写入位置 |
|---|---|---|
| 运营主体 | `TODO_OPERATOR_LEGAL_ENTITY` | `store/submission-readiness.json`、隐私政策、用户协议、支持页 |
| ICP 备案号 | `TODO_ICP_FILING_NUMBER` | `store/submission-readiness.json`、支持页或法律页 |
| APP 备案号 | `TODO_APP_FILING_NUMBER` | `store/submission-readiness.json`、支持页或 App 内设置页 |
| 备案展示位置 | `TODO_DISPLAY_APP_FILING_NUMBER_IN_APP` | `store/submission-readiness.json`、支持页、法律页或设置页 |
| 最终服务商/SDK 清单 | `TODO_FINAL_PROVIDER_LIST` | 隐私政策、数据安全表、国内安卓商店材料 |
| 保留与删除策略 | `TODO_RETENTION_POLICY` | 隐私政策、数据安全表、生产运行手册 |

## 4. 建议发布顺序

1. 先确认运营主体、域名归属和接入服务商。
2. 完成或确认网站/PWA 的 ICP 备案路径。
3. 完成封装 App 的 APP 备案路径。
4. 确认 AI 生成内容标识、人工复核、证据包和输出标识策略。
5. 确认隐私政策、SDK/权限说明、账号删除、数据导出和客服联系方式。
6. 再进入国内安卓商店提交。

## 5. 不应提交到仓库的材料

- 营业执照扫描件。
- 身份证件图片。
- 备案系统账号密码。
- 短信验证码。
- 签名证书私钥。
- API key 或云服务密钥。

## 6. 验收命令

```bash
npm run china:distribution-plan
npm run owner:inputs
npm run store:check
npm run compliance:check
npm run release:check
```

`china:distribution-plan` 只证明合规交接结构完整；真正解除阻断仍需要真实备案号、运营主体、展示位置和法务终稿。

## 7. 官方依据

- 工业和信息化部 APP 备案通知：<https://www.miit.gov.cn/zwgk/zcwj/wjfb/tz/art/2023/art_920db564162e4312916a01bed6540ad8.html>
- 工业和信息化部 ICP 备案服务：<https://beian.miit.gov.cn/>
- 国家互联网信息办公室《人工智能生成合成内容标识办法》：<https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm>
