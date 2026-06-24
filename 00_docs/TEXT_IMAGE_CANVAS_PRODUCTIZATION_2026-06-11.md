# 文生图账号级无限画布产品化说明

日期：2026-06-11
适用项目：`01_apps/ai_prompt_video_studio`

## 1. 产品决策

文生图模块采用“一个账号一张固定画布”的模式，不再让用户理解或管理多个项目。

目标用户是运营、编导和小白商家，核心诉求是快速反复生成主图、封面、场景图，并把结果沉淀成可继续使用的素材池。因此产品上只保留一个清晰入口：

- 入口：`提示词工作台 / 文生图`
- 工作区：当前账号的同一张文生图画布
- 结果组织：每次生成成功后追加图片节点
- 保存方式：节点位置、图片、提示词、模型、尺寸和时间自动保存

## 2. 当前已落地

- 前端新增 `TextImageCanvas` 画布组件。
- 后端新增账号级画布数据表 `text_image_canvas_nodes`。
- 后端新增读取接口 `GET /api/text-image-canvas`。
- 后端新增节点位置保存接口 `POST /api/text-image-canvas/nodes/:nodeId`。
- 文生图任务完成后会自动调用 `appendTextImageCanvasNodes`，把图片写成画布节点。
- 节点支持拖动，释放后保存位置。
- 节点支持详情查看，展示图片、提示词、反向提示词、模型、尺寸、文件名、大小和生成时间。
- 节点支持从画布移除；当前只移除画布节点，不删除底层图片文件，避免用户误删素材。
- 画布支持按提示词、模型、尺寸和文件名搜索节点；搜索只筛选当前账号同一画布内的可见节点，不新建项目。
- 节点详情新增“送入单条视频”，会把当前图片追加到单条视频商品图片列表，不新建项目、不清空原有输入。
- 送入视频时会携带 `textImageCanvasNodeId`、原提示词、反向提示词、模型、尺寸和送入时间，后续下载 `AI 证据包` 时可追溯来源。
- 画布前端会按已有节点自动扩展尺寸，避免节点持续追加后超出可滚动范围。
- 文生图输出仍会保存到 `outputs/text-to-image`，并继续出现在素材输出里。
- 尺寸已改为高清默认值，并在后端兜底旧尺寸，避免 Seedream 因像素不足报错。
- 前端文生图页面已拆到 `src/features/textImage/TextImagePage.jsx`，并通过懒加载进入，用户入口和交互不变。
- 服务端已新增 `video_task_source_links`，当文生图节点图片送入单条视频并提交生成时，会按 `task_code` 持久化 `textImageCanvasNodeId`、来源类型、来源 ID 和来源摘要，避免只依赖前端证据包。
- `prompt_package.json` 已同步写入 `imageSources` 和 `textImageCanvasNodeIds`，方便后续排查某条视频用了哪张文生图节点图片。
- 后端已新增 `GET /api/task-source-links`，支持按当前账号和任务编号查询文生图来源记录。
- 账号数据导出 `GET /api/account/export` 已包含 `textImageSourceLinks`，用户导出的账号数据摘要里能看到视频任务使用过的文生图节点来源。
- 素材与输出页已新增“AI 图片来源”面板，选择某个任务后可直接看到该任务用过的文生图节点、模型、尺寸、提示词摘要，并支持复制节点来源或打开图片。
- 手机端素材页已新增紧凑来源卡片，运营可在移动端直接反查文生图节点，不需要先下载账号数据 JSON。
- 已新增自动门禁 `npm run text-image:check`，覆盖导航入口、懒加载、账号级画布接口、追加节点、动态扩展画布、移动端样式和文档记录。

## 3. 手机端交互

手机端不做复杂设计工具，先保证可用：

- 左侧表单在手机端变为上方表单。
- 画布在手机端变为下方可滚动区域。
- 图片节点只保留核心信息：图、文件名、尺寸、提示词摘要、时间。
- 节点多起来后，先用搜索框按提示词、模型、尺寸或文件名定位历史图片。
- 拖动只通过节点顶部手柄触发，避免和页面滚动冲突。
- 放大/缩小按钮保留，默认缩放适合手机宽度。

后续如果要更小白，可以把快捷模板扩成按钮式入口：

- 商品主图
- 短视频封面
- 场景氛围
- 爆款同款风格
- 商品转视频首帧

## 4. 数据与接口边界

当前 SQLite 表结构：

```text
text_image_canvas_nodes
- id
- owner_user_id
- run_id
- node_type
- x
- y
- width
- height
- payload_json
- created_at
- updated_at
```

当前 `payload_json` 保存：

- 节点标题
- 原始提示词
- 反向提示词
- 模型
- 尺寸
- 图片文件名、URL、大小、MIME

云端化时不要把图片直接放进数据库。图片应迁移到对象存储，数据库只保存对象存储 URL、文件哈希、大小、内容类型和归属信息。

2026-06-12 已补充云端化工作流：

- `deploy/cloud-deployment-action-plan.json` 新增 `text-image-canvas-storage`。
- `deploy/libtv-worker-storage-plan.json` 新增文生图画布存储迁移项。
- `npm run cloud:check` 会检查生产运行手册是否覆盖 `TEXT_IMAGE_STORAGE_MODE`、`text_image_canvas_nodes` 和 text-image 持久化要求。
- `npm run product:report` 已把文生图画布列为独立产品化能力。

## 5. 合规要求

文生图画布属于 AI 生成图片资产，后续必须和视频一样纳入 AI 标识与证据体系：

- 节点详情显示“AI 生成/AI 辅助生成”。
- 导出图片时保留生成时间、模型、提示词、用户和来源记录。
- 图片进入视频生成流程时，证据包需要记录该图片节点 ID。
- 账号导出需要包含文生图节点和视频任务之间的来源关联，方便用户和运营复核。
- 用户协议说明不得移除、篡改或隐匿 AI 标识。
- 管理员侧后续需要能按账号、任务、图片节点追溯生成记录。

## 6. 下一步路线

P0：

- 增加撤销删除或回收站。
- 把“送入单条视频”的快捷动作继续扩展到批量生成。
- 把“AI 图片来源”面板继续扩展到批量生成任务，覆盖批量视频里的文生图节点来源。

P1：

- 支持节点分组：主图、封面、场景图、首帧。
- 增强画布搜索：按时间范围、节点类型和是否已用于视频继续筛选。
- 支持把某个图片节点一键送入“单条视频”流程。

P2：

- 迁移到云端对象存储和 PostgreSQL。
- 增加租户级额度、并发、审计日志和内容安全检查。
- 支持导出画布快照或长图，用于运营交付和复盘。

## 7. 验收

本轮已执行：

```bash
node --check server.js
npm run build
```

运行态已验证：

- 公网域名加载新前端包。
- 登录后 `GET /api/text-image-canvas` 返回当前账号固定画布。
- 未实际触发图片生成，避免消耗模型额度。

2026-06-11 增量验证：

- `node --check server.js` 通过。
- `npm.cmd run build` 通过。
- `npm.cmd run text-image:check` 通过。
- 文生图模块已形成独立 chunk：`TextImagePage` 约 `14KiB / gzip 5.1KiB`。
- 主入口包回到预算内：`477.43KiB / 500KiB`。

2026-06-12 增量验证：

- 新增 `scripts/check-text-image-canvas-readiness.mjs`。
- 新增 `package.json` 命令 `text-image:check`。
- `app:health` 已纳入 `text-image:check`，后续整体健康检查会自动验证文生图同账号画布能力。
- `npm.cmd run text-image:check` 通过：44 项通过，0 项失败。
- `npm.cmd run cloud:check` 通过审计模式，已识别 `text-image-canvas-storage` 云端化工作流。
- `npm.cmd run cloud:worker-plan` 通过：151 项通过，0 项失败，0 项警告。
- `npm.cmd run product:report` 通过，文生图画布已进入产品化矩阵。
- `npm.cmd run app:health` 通过：移动端、操作密度、文生图画布、PWA 资产、结构分析、构建体积和 Capacitor 就绪检查均已跑完。
- 主入口包经 `WorkflowModulePage` 和 `LoginPromptSheet` 懒加载拆分后回到预警线下：`484.06KiB / 500KiB`。
- `app:health` 当前仍有 3 条环境提醒：Android SDK 环境变量未设置、当前 JDK 版本偏低、iOS 打包仍需 macOS/Xcode。

2026-06-12 增量验证补充：

- 同一画布新增轻量搜索栏，支持按提示词、模型、尺寸和文件名筛选节点。
- 搜索只影响当前画布可见节点，不改变生成、追加节点、拖动保存、详情和删除接口。
- `npm.cmd run text-image:check` 已加入搜索栏和筛选逻辑检查。
