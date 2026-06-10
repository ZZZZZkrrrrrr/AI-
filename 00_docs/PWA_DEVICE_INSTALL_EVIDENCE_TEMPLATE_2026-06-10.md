# PWA 真机安装证据模板

更新时间：2026-06-10  
公开入口：`https://www.zkraiflow.top`  
结构化文件：`01_apps/ai_prompt_video_studio/store/pwa-device-install-evidence-template.json`  
校验命令：`npm run pwa:device-template`

## 1. 用途

这份模板用于记录 Android Chrome 和 iOS Safari 上的 PWA 真机安装证据。它解决的是“网页能不能像 App 一样被用户安装、从主屏幕打开、离线时有清楚反馈、更新时可控刷新”的问题。

当前状态仍是：模板就绪，等待真实设备截图和测试结果。它不能替代 App Store / Google Play 的原生构建审核。

## 2. 官方依据

- MDN Making PWAs installable：`https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable`
- web.dev PWA installation：`https://web.dev/learn/pwa/installation`
- Chrome installable manifest audit：`https://developer.chrome.com/docs/lighthouse/pwa/installable-manifest`
- MDN Service Worker API：`https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API`

这些资料共同决定了验收重点：manifest、HTTPS、图标、service worker、安装入口、主屏幕启动、离线回退和更新生命周期都要在真实设备上验证。

## 3. Android Chrome 必测

设备：真实 Android 手机优先，可信模拟器可作补充。  
浏览器：Chrome 稳定版。

必须记录：

- 浏览器安装入口或安装提示
- 安装后的主屏幕图标
- 从主屏幕打开后的首页
- 首页大按钮、底部导航、通知卡片是否适配
- 离线重启或离线页截图
- 更新提示截图

通过标准：用户能安装到主屏幕，从图标打开后看到手机端大按钮首页，离线时能看懂当前不可联网操作，更新提示由用户确认后才刷新。

## 4. iOS Safari 必测

设备：iPhone 优先，iPad 后续补充。  
浏览器：Safari 稳定版。

必须记录：

- 页面里的“添加到主屏幕”引导
- Safari 分享菜单路径或测试者说明
- 主屏幕图标
- 从主屏幕打开后的页面
- 顶部/底部安全区是否遮挡内容
- 支持、隐私、AI 说明、账号删除页面是否能打开

通过标准：非技术用户知道怎么添加到主屏幕，打开后不被 iOS 安全区遮挡，公开合规页面能从手机端找到。

## 5. 证据命名

建议保存到：

`store/evidence/pwa-device/YYYY-MM-DD/<device-id>/<case-id>-redacted.png`

每条结果 JSON 至少包含：

- 执行时间
- 公开域名
- 设备 ID：`android-chrome` 或 `ios-safari`
- 用例 ID
- 结果：`pass`、`fail` 或 `blocked`
- 浏览器和系统大版本
- 观察到的显示模式：`standalone`、`browser` 或 `unknown`
- 脱敏截图路径
- 关联 blocker ID

## 6. 不要放进仓库

不要放进仓库：

- 私人通知内容
- 测试者手机号
- 审核账号密码
- Session Cookie
- 私人商品素材
- 未脱敏浏览器账号或个人资料

仓库里只放脱敏截图、通过/失败摘要、浏览器和系统大版本、显示模式、阻断项编号。

## 7. 关闭标准

PWA 作为主要外部试点渠道前必须满足：

1. Android 安装、主屏图标、独立启动、离线重启证据已捕获。
2. iOS 添加到主屏幕、主屏启动、安全区、公开合规页证据已捕获。
3. 至少一个部署周期验证过更新提示。
4. 登录后重启仍等待审核账号和认证冒烟证据，不可提前关闭。
5. 所有 P0 失败项已写入 `store/release-blockers-register.json`。
