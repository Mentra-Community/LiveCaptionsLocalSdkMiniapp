# Live Captions Local SDK Miniapp

Local MentraOS miniapp version of the original `LiveCaptionsOnSmartGlasses` app.

This app runs as a JavaScript bundle inside the MentraOS mobile app WebView. It subscribes directly to `session.transcription`, mirrors the live caption text to glasses with `session.display.showTextWall`, and persists final transcript history with `session.storage`.

## Development

This app currently depends on the local MentraOS miniapp SDK. Use a MentraOS checkout on
the `mentra-miniapp-sdk` branch so the `@mentra/miniapp` and
`@mentra/miniapp-cli` file dependencies resolve locally.

```bash
bun install
bun run dev
```

Scan the printed QR code from MentraOS Developer Settings.

## Release Build

```bash
bun run build
bun run pack
```
