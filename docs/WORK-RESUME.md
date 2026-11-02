# Resume work

Saved at the user's request on 2026-10-29 (Asia/Bangkok). Stop work here and continue when the user returns.

Project: `D:\lottery-system-new-main\lottery-system-main\Edikiter`.

## Current state

- Homepage preserved; application palettes and controls follow its design.
- Sidebar readability/background and desktop grid placement corrected.
- Strategy and Macro text contrast corrected.
- Overview includes digital Earth, space/star background, separate CPI and Bloomberg news orbit cards, and BTC/gold/silver/WTI quote galaxies.
- Macro/CPI uses the same Earth/Galaxy assets. The latest change restores FOREX, CRYPTO and CPI text/descriptions attached to orbiting galaxies, with upright text and hover pause; Khmer/English supported.
- Market analysis includes TradingView widget, closed-candle technical signals and optional OpenAI review. TradingView display data cannot be exported to the engine; analysis sources are explicitly separate.
- AI image reading includes upload/preview, validated PNG/JPEG/WebP input, structured OCR/chart observations and image-only reports. It cannot directly issue trade signals.

## Remaining external setup and verification

- OpenAI is not configured: needs server `OPENAI_API_KEY`, `OPENAI_ANALYSIS_MODEL`, and optionally a vision-capable `OPENAI_VISION_MODEL`. No live paid AI requests were performed.
- Forex/metals/oil candle analysis requires `TWELVEDATA_API_KEY` and provider permissions. Crypto Binance public candles were verified live.
- Authenticated visual review in a browser remains outstanding. Do not describe build/HTTP checks as a full visual audit.
- No orders, payments, account approvals or external messages were sent.

## Validation and running

- Latest production build passes; latest lint has no errors, four existing image optimization warnings.
- Full test suite most recently passed 90/90; subsequent Macro artwork/text changes passed build/lint and HTTP delivery checks.
- Local dev server was running at `http://127.0.0.1:3000`. It may need restarting after the computer/session stops: `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000` from the project directory.
- Restricted network execution previously caused public feed EACCES errors; an approved network-enabled localhost-only dev server resolved them.
- Source files are saved on disk. This project has no `.git` repository; there is no Git commit/checkpoint.

See `docs/tradingview-candle-analysis.md`, `docs/image-analysis.md`, and `docs/world-market-briefing.md` for implementation limits and setup. Read `AGENTS.md` and relevant installed Next.js docs before further code edits. Preserve the homepage and the user's original image references.
