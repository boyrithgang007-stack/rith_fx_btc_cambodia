# EA code and setup hub

This folder is the starting point for finding the project's EA code. The standalone MT5 source is kept here; the Binance EA and Forex signal engine remain in their application folders so their imports and API routes continue to work.

## MT5 Forex demo EA

- Source: [`MT5/Experts/RFX_Forex_Demo_EA.mq5`](./MT5/Experts/RFX_Forex_Demo_EA.mq5)
- Install and strategy guide: [`../docs/forex-ea.md`](../docs/forex-ea.md)
- MT5 bridge and local setup details: [`../docs/real-account-setup.md`](../docs/real-account-setup.md)

Copy the `.mq5` source into MT5's `MQL5/Experts` folder, compile it in MetaEditor, then attach it to a supported M15 chart. It is demo-account-only and trading is disabled by default. Keep it on Demo while validating it.

For new EA development, start from [`MT5/Experts/RFX_New_EA.mq5`](./MT5/Experts/RFX_New_EA.mq5). It is a non-trading scaffold; it contains no order submission logic.

## Binance Futures Testnet EA

The web app implementation is organized across these files:

- Worker and polling lifecycle: [`../app/lib/ea/worker.ts`](../app/lib/ea/worker.ts)
- Binance Futures Testnet execution: [`../app/lib/ea/binance-futures.ts`](../app/lib/ea/binance-futures.ts)
- Risk checks: [`../app/lib/ea/risk.ts`](../app/lib/ea/risk.ts)
- Settings and run history: [`../app/lib/ea/store.ts`](../app/lib/ea/store.ts)
- Settings API: [`../app/api/ea/route.ts`](../app/api/ea/route.ts)
- Setup page: [`../app/ea/setup/page.tsx`](../app/ea/setup/page.tsx)
- Configuration guide: [`../docs/ea-bot-testnet.md`](../docs/ea-bot-testnet.md)

This feature is Testnet-only. Vercel serverless does not run the long-lived EA worker.

## Forex signals and MT5 bridge

The web app's Forex feature reads candles and calculates signals; it does not place Forex orders:

- Signal rules: [`../app/lib/ea/forex-rules.ts`](../app/lib/ea/forex-rules.ts)
- Strategy storage: [`../app/lib/ea/forex-store.ts`](../app/lib/ea/forex-store.ts)
- Signal API: [`../app/api/ea/forex/signal/route.ts`](../app/api/ea/forex/signal/route.ts)
- Python MT5 bridge: [`../services/mt5-bridge/bridge.py`](../services/mt5-bridge/bridge.py)
- Setup and limitations: [`../docs/forex-ea.md`](../docs/forex-ea.md)

Keep API keys and bridge tokens in local/server environment settings. Never commit secrets or send them in chat.
