# PWA 生产安装与离线验收计划

日期：2026-06-10  
项目：`01_apps/ai_prompt_video_studio`  
生产域名：`https://www.zkraiflow.top`

## 目的

这份计划用于判断手机端网页是否可以升级为第一阶段 PWA 试用版。它不等同于 App Store / Google Play 上架验收，只负责证明用户可以从生产域名安装、打开、离线看到清楚反馈，并在新版本发布时获得可控更新。

## 当前结论

PWA 资源已经具备内部验收基础：

- `public/manifest.webmanifest`
- `public/sw.js`
- `public/offline.html`
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`
- `public/icons/icon-maskable-512.png`
- 手机端首页、通知、图文模式、创建、素材、我的页面截图

仍未完成外部试用闭环：

- Android Chrome 真实安装截图。
- iOS Safari 添加到主屏幕截图。
- 生产域名离线重启截图。
- 新版本更新提示截图。
- 审核账号登录后的 PWA 重启验证。

## 验收顺序

1. 本地资源检查：`npm run pwa:check`
2. 生产公开域名检查：`npm run public:check`
3. 生产 PWA 公开资源烟测：`npm run pwa:public-smoke`
4. 移动端布局检查：`npm run mobile:check`
5. 截图计划检查：`npm run screenshots:check`
6. 生产账号链路检查：`npm run cloud:smoke`
7. PWA 生产验收计划检查：`npm run pwa:prod-plan`

`pwa:public-smoke` 会直接访问 `https://www.zkraiflow.top/manifest.webmanifest`、`/sw.js`、`/offline.html` 和图标资源。线上文件不可访问会阻塞；如果线上还没部署最新的用户确认更新机制，会先作为提醒，不阻塞本地发布检查。

## Android Chrome 验收

设备：真实 Android 手机或可信模拟器  
浏览器：Chrome

步骤：

1. 打开 `https://www.zkraiflow.top/`。
2. 等待页面出现安装提示，或打开 Chrome 菜单检查是否有安装入口。
3. 点击安装。
4. 从手机桌面图标重新打开。
5. 检查是否进入小白友好的首页大按钮布局。
6. 打开通知、创建、素材、我的页面。
7. 关闭网络后重新打开。
8. 部署新版本后检查“发现新版本”提示。

通过标准：

- 能安装到桌面。
- 从桌面打开后不是桌面端后台布局。
- 底部导航和通知卡片不遮挡内容。
- 离线时展示缓存页面或离线页，不假装继续生成任务。
- 新版本提示由用户点击后才刷新。

## iOS Safari 验收

设备：iPhone，后续补 iPad  
浏览器：Safari

步骤：

1. 用 Safari 打开 `https://www.zkraiflow.top/`。
2. 确认页面显示“添加到主屏幕”引导。
3. 点 Safari 分享按钮。
4. 选择“添加到主屏幕”。
5. 从主屏幕图标打开。
6. 检查首页、创建、素材、我的页面。
7. 打开支持、隐私、AI 说明、账号删除页面。

通过标准：

- 用户不需要理解技术概念也知道怎么添加到主屏幕。
- iOS 安全区不遮挡顶部或底部操作。
- 公开支持和合规页面可直接打开。
- 登录态、上传入口和数据权益入口行为清楚。

## 离线验收

步骤：

1. 在线打开首页、创建页、素材页、我的页。
2. 打开飞行模式。
3. 重新启动 PWA。
4. 尝试打开已访问过的页面。
5. 尝试点击创建或生成相关按钮。

通过标准：

- 已缓存页面或离线页能打开。
- 用户能看懂当前是网络问题。
- 创建、上传、生成等在线操作不会被误导为已经提交。

## 更新验收

步骤：

1. 安装或打开当前 PWA。
2. 发布一个改动了 Service Worker 缓存版本的新构建。
3. 刷新一次页面。
4. 等待页面出现“发现新版本”。
5. 点击“刷新更新”。

通过标准：

- 新版本不会静默打断用户当前操作。
- 点击按钮后等待中的 Service Worker 激活。
- 页面只刷新一次。
- 刷新后进入最新版本。

## 当前新增自动化

- `store/pwa-production-smoke-plan.json`
- `scripts/check-pwa-production-smoke-plan.mjs`
- `scripts/check-pwa-public-smoke.mjs`
- `npm run pwa:prod-plan`
- `npm run pwa:public-smoke`

这条检查已接入 `npm run release:check`，所以后续每次发布验收都会检查 PWA 生产安装计划是否完整。
