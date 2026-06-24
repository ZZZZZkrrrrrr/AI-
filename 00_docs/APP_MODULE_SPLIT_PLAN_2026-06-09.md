# App.jsx 模块拆分与懒加载计划

日期：2026-06-09  
适用项目：`01_apps/ai_prompt_video_studio`

## 1. 当前基线

来自 `npm run analyze:app` 和 `npm run build:report`：

- `src/App.jsx`：约 17023 行。
- 顶层函数：398 个。
- 入口 JS：465.26KiB，gzip 131.14KiB。
- 设置页懒加载 chunk：约 8.28KiB，gzip 3.05KiB。
- 视频拼接页懒加载 chunk：约 8.44KiB，gzip 3.20KiB。
- 构建守卫：入口 JS 超过 500KiB 失败，超过 485KiB 警告。

当前已经低于 500KiB，但继续把移动端功能堆进 `App.jsx` 会很快触顶。下一阶段应优先做模块拆分，而不是继续增加主入口逻辑。

2026-06-09 已先抽出 `src/shared/compliance/aiEvidencePack.js`，把 AI 证据包构建和 JSON 下载逻辑从 `App.jsx` 移出。

2026-06-09 已把 `SettingsPage` 抽到 `src/features/settings/SettingsPage.jsx`，并通过 `React.lazy` 懒加载。主入口 JS 从 477.62KiB 降到 470.70KiB，设置页形成独立 chunk。后续新增功能前仍应优先做页面级拆分和懒加载。

2026-06-09 已把 `VideoStitchPage` 抽到 `src/features/stitch/VideoStitchPage.jsx`，并通过 `React.lazy` 懒加载。主入口 JS 继续降到 465.26KiB；拼接页形成独立 chunk，并补齐手机端视频选择卡片，桌面端继续保留宽表格。

2026-06-09 已新增 `scripts/check-mobile-readiness.mjs` 和 `npm run mobile:check`，把手机端底部导航、PWA 安装引导、移动端卡片视图、低频页懒加载和安全区样式纳入自动门禁。

2026-06-11 已把 `TextImagePage` 抽到 `src/features/textImage/TextImagePage.jsx`，并通过 `React.lazy` 懒加载。文生图继续保持“当前账号同一无限画布，生成结果追加节点”的产品规则；构建后主入口包为 `477.43KiB / 500KiB`，文生图独立 chunk 约 `14KiB`。

2026-06-12 已新增 `scripts/check-text-image-canvas-readiness.mjs` 和 `npm run text-image:check`，并纳入 `app:health`。后续拆分或移动端改版时，会自动检查文生图导航入口、懒加载、账号级画布接口、生成后追加节点、动态画布扩展、移动端样式和产品化文档。

2026-06-12 已继续拆出 `WorkflowModulePage` 和 `LoginPromptSheet`，作为独立懒加载 chunk，解决主入口包重新接近警戒线的问题。构建后主入口包为 `484.06KiB / 500KiB`，低于 485KiB 预警线；新增独立 chunk：`WorkflowModulePage` 约 `1.40KiB`，`LoginPromptSheet` 约 `1.61KiB`。

2026-06-12 已把低频的 `AI 证据包` 下载逻辑和 `文生图 -> 单条视频` 交接消费改为动态 import。构建后新增 `aiEvidencePack` 约 `3.98KiB`、`textImageStudioHandoff` 约 `1.16KiB` 独立 chunk，主入口包降到 `482.20KiB / 500KiB`，重新低于 485KiB 预警线。

2026-06-12 已把 `AssetsPage` 抽到 `src/features/assets/AssetsPage.jsx`，并通过 `React.lazy` 懒加载。素材页现在包含文生图来源追踪面板和手机端来源卡片；构建后新增 `AssetsPage` 约 `9.69KiB / gzip 2.75KiB` 独立 chunk，主入口包降到 `479.80KiB / 500KiB`。
2026-06-12 已把 `BatchPage` 抽到 `src/features/batch/BatchPage.jsx`，并通过 `React.lazy` 懒加载。批量页保留草稿恢复、预检、批次状态和手机端批次卡片；构建后新增 `BatchPage` 约 `42.41KiB / gzip 12.60KiB` 独立 chunk，主入口包降到 `446.22KiB / 500KiB`，不再触发入口包体预警。

## 2. 拆分原则

1. 先拆低耦合页面，再拆 `App` 主壳。
2. 先静态拆文件，构建通过后再做路由级懒加载。
3. 每拆一组都运行 `npm run app:health`，它会串起：
  - `npm run mobile:check`
  - `npm run text-image:check`
  - `npm run pwa:check`
   - `npm run analyze:app`
   - `npm run build`
   - `npm run build:report`
4. 入口 JS 必须保持低于 500KiB；理想目标是降到 380KiB 以下。
5. 不在拆分时顺手重构业务逻辑，避免把行为变更和文件移动混在一起。

## 3. 优先拆分候选

按当前函数行数和业务边界排序：

| 优先级 | 模块 | 当前行数 | 建议目录 | 原因 |
| --- | ---: | ---: | --- | --- |
| P0 | `SelectionAssetsOverviewPage` | 1291 | `src/features/selection/` | 最大页面，属于桌面选品资产域，手机首屏不应加载。 |
| P0 | `ProductLibraryPage` | 884 | `src/features/selection/` | 商品库页体量大，和选品域共享数据，可一起拆。 |
| P1 | `ProductScoringPage` | 596 | `src/features/selection/` | 评分页主要桌面使用，可延后加载。 |
| P2 | `AccountAssetsPage` | 349 | `src/features/accounts/` | 账号资产库和设置域可分离。 |
| P2 | `StudioPage` | 267 | `src/features/studio/` | 创建页是移动端核心，AI 证据包继续增加后应先拆文件再拆子步骤。 |
| Done | `WorkflowModulePage` | 44 | `src/features/workflow/` | 已拆为独立懒加载 chunk，降低主入口预警风险。 |
| Done | `LoginPromptSheet` | 54 | `src/features/auth/` | 已拆为独立懒加载 chunk，仅游客登录弹窗按需加载。 |
| Done | `TextImagePage` | 480 | `src/features/textImage/` | 已拆为独立懒加载 chunk；账号级无限画布逻辑保持不变。 |
| Done | `VideoStitchPage` | 252 | `src/features/stitch/` | 已拆为独立懒加载 chunk，并增加手机端视频选择卡片。 |
| Done | `BatchPage` | 807 | `src/features/batch/` | 已拆为独立懒加载 chunk，包含批量草稿、预检、批次列表和手机端批次卡片。 |
| Done | `SettingsPage` | 162 | `src/features/settings/` | 已拆为独立懒加载 chunk，承载模型、合规协议、数据权利入口。 |

## 4. 推荐目录

```text
src/
  app/
    AppShell.jsx
    navigation.js
    notifications.js
  shared/
    components/
    formatting.js
    status.js
  features/
    auth/
      LoginPromptSheet.jsx
    studio/
      StudioPage.jsx
      mobileCreate.js
    batch/
      BatchPage.jsx
      batchDraft.js
      batchStatus.js
    assets/
      AssetsPage.jsx
    selection/
      SelectionAssetsOverviewPage.jsx
      ProductLibraryPage.jsx
      ProductScoringPage.jsx
      selectionDomain.js
    accounts/
      AccountAssetsPage.jsx
    textImage/
      TextImagePage.jsx
    workflow/
      WorkflowModulePage.jsx
    stitch/
      VideoStitchPage.jsx
```

## 5. 分阶段计划

### Phase 1：工具与边界固定

已完成：

- `npm run build` 接入入口体积守卫。
- `npm run build:report` 输出 chunk 体积报告。
- `npm run pwa:check` 校验 PWA manifest、Service Worker、离线页和应用图标。
- `npm run mobile:check` 校验移动端 App Shell、卡片化视图、低频页懒加载和安全区样式。
- `npm run analyze:app` 输出 `App.jsx` 结构报告。
- `npm run app:health` 串起移动端就绪检查、PWA 资产检查、结构分析、构建、体积守卫和体积报告。

验收：

- 构建通过。
- 当前入口 JS 基线保留在文档中。

### Phase 2：静态拆选品域

目标：

- 把 `SelectionAssetsOverviewPage`、`ProductLibraryPage`、`ProductScoringPage` 移到 `src/features/selection/`。
- 把只服务选品域的常量、评分函数、合规函数一起迁移到 `selectionDomain.js`。

验收：

- 行为不变。
- `npm run analyze:app` 中 `App.jsx` 行数明显下降。
- 首轮可以不要求入口 JS 大幅下降，因为静态 import 仍会打进入口。

风险：

- 选品域函数互相引用多，先迁移页面，再逐步迁移 domain helper。
- 不要跨域移动 `requestJson`、`formatDate` 等共享工具。

### Phase 3：批量生成独立化

目标：

- 把 `BatchPage`、批量草稿、批量预检、批次卡片移到 `src/features/batch/`。
- 保持现有 API 调用和通知参数不变。

验收：

- 批量上传、生成任务表、创建批次、执行状态、手机卡片视图均可用。
- `npm run build` 通过。

### Phase 4：路由级懒加载

已部分完成：

- `SettingsPage` 已懒加载。
- `TextImagePage` 已懒加载。
- `VideoStitchPage` 已懒加载。

目标：

- 对桌面低频页面做 `React.lazy`：
  - 选品资产
  - 商品库
  - 选品评分
  - 批量生成
  - 视频拼接
- 移动端首屏保留：首页、创建、素材、我的。

验收：

- 入口 JS 目标低于 380KiB。
- 懒加载页面有清晰 loading 状态。
- PWA 离线页和 Service Worker 更新逻辑不受影响。

### Phase 5：移动端核心页精简

目标：

- `StudioPage` 拆成商品图、提示词包、商品信息、提示词结果、视频进度五个子组件。
- 移动端只加载创建链路需要的子组件。

验收：

- 手机端创建流程仍可按当前 `资料 / 提示词 / 视频` 使用。
- 入口 JS 不反弹超过 400KiB。

## 6. 每次拆分后的检查清单

- `npm run app:health`
- 打开 `http://localhost:5173`
- 检查手机端底部导航：首页、创建、素材、我的。
- 检查创建页：商品图、提示词包、商品信息、提示词、视频。
- 检查批量生成：批次卡片、待创建任务卡片、执行明细卡片。
- 检查素材页：缩略图、视频预览、复制路径/链接、打开文件。

## 7. 停止条件

出现以下情况时，应暂停继续拆分，先修复：

- 入口 JS 超过 500KiB。
- 任一核心页面白屏。
- PWA 安装提示、Service Worker 更新提示失效。
- 手机端底部导航无法返回核心页面。
- 批量任务创建或执行状态刷新异常。
