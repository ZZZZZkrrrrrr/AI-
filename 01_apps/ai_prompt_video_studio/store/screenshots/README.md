# Store Screenshot Staging

This folder is reserved for App Store, Google Play, domestic Android store, PWA, and mobile web screenshot sets.

The machine-readable plan lives in `store/screenshot-plan.json`. Run this before release checks:

```bash
npm run mobile:qa
npm run screenshots:check
npm run screenshots:capture
```

First-pass capture sets:

- `mobile-web-390`: video-mode home, image/text-mode home, prompt-package guided entry, create, assets, settings. Captured by `npm run screenshots:capture`.
- `mobile-web-430`: home, create, assets, stitch. Captured by `npm run screenshots:capture`.
- `tablet-web-768`: home, create, assets. Captured by `npm run screenshots:capture`.
- `ios-app-store-iphone`: App Store Connect iPhone sizes after Capacitor validation.
- `google-play-phone`: Play Console phone screenshots after Android package validation.
- `domestic-android-store`: screenshots required by the selected domestic channel.

Suggested file naming:

```text
mobile-web-390/01-home.png
mobile-web-390/02-home-image.png
mobile-web-390/03-create-prompt-intent.png
mobile-web-390/04-create.png
mobile-web-390/05-assets.png
mobile-web-390/06-settings.png
```

Quality bar:

- Use real production UI, not placeholder marketing slides.
- Do not expose API keys, private product assets, personal data, unfinished TODO URLs, or local file paths.
- First shots should make the value path clear: video-mode workbench, image/text-mode workbench, guided prompt package entry, create, assets/results, settings/compliance.
- Keep all text legible on small phones.
- Capture localized sets for each market submitted.

Native store screenshots stay blocked until Capacitor iOS/Android projects are generated and tested on real devices or store-accurate simulators.

The real-device and beginner-user QA plan lives in `store/mobile-device-qa-plan.json`. Use it to confirm the current web screenshots, PWA install flow, native Android/iOS behavior, legal/data-rights entry points, and store screenshot readiness are all tied to a release decision.
