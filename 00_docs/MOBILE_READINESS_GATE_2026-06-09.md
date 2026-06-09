# 移动端就绪自动检查门禁

日期：2026-06-09  
适用项目：`01_apps/ai_prompt_video_studio`

## 1. 目的

`npm run mobile:check` 用来保护手机端 App Shell 和核心移动端体验，避免后续继续拆模块、改样式或封装 PWA/App 时，把已经落地的移动端能力改丢。

这个检查不替代真机测试和截图验收。它只负责拦住基础结构缺失：

- 手机端底部导航。
- PWA 安装提示和 iOS 手动安装引导。
- 创建页手机端分段。
- 任务、素材、视频拼接的手机端卡片视图。
- 桌面宽表格在手机端隐藏。
- 低频页面懒加载。
- 安全区底部留白和基础触控高度。

## 2. 当前接入

已新增：

- `scripts/check-mobile-readiness.mjs`
- `npm run mobile:check`

已接入：

```bash
npm run app:health
```

`app:health` 当前顺序：

1. `npm run mobile:check`
2. `npm run pwa:check`
3. `npm run analyze:app`
4. `npm run build:report`

`release:check` 会通过 `app:health` 间接执行移动端检查。

## 3. 检查范围

### 前端结构

- `mobileTabItems` 存在，并包含 `overview`、`studio`、`assets`、`settings`。
- 页面渲染 `mobile-bottom-nav`。
- `SettingsPage` 使用 `React.lazy` 懒加载。
- `VideoStitchPage` 使用 `React.lazy` 懒加载。
- 创建页存在 `mobile-create-tabs` 和 `mobile-input-tabs`。
- 任务、素材、拼接页存在移动端卡片视图。

### PWA 安装体验

- 保留 `beforeinstallprompt` 处理。
- 保留 `appinstalled` 处理。
- 保留 iOS Safari 手动安装候选检测。

### 移动端样式

- 存在 `max-width: 900px` 移动断点。
- 主内容保留 `env(safe-area-inset-bottom)` 底部安全区。
- 手机端隐藏素材、任务、libTV、视频拼接的桌面表格。
- 底部导航和命令按钮保留基础触控高度。

## 4. 当前验证结果

本轮执行：

```bash
npm run mobile:check
```

结果：

- Passes：33
- Failures：0
- Warnings：0

## 5. 后续增强

下一阶段建议补充：

- 用 Playwright 或等价工具跑 390px、430px、768px 三档截图。
- 检查移动端文字是否溢出按钮和卡片。
- 检查创建、批量、素材、拼接四条核心路径的点击流。
- 在 Capacitor 预研阶段增加 iOS/Android WebView 安全区截图验收。
