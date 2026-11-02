# TradingView and candle analysis

Open `/markets/analysis`. The new desk embeds the official TradingView Advanced Chart widget and has independent **New AI Signal** and **Technical analysis** actions. Widget display data is not extracted or scraped. TradingView documents that its widgets cannot export/download data and do not expose a general data API: https://www.tradingview.com/widget-docs/faq/data/ . Official embedding configuration: https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/ .

## Actual candle sources

- BTC/USDT and ETH/USDT: public Binance spot klines at `https://data-api.binance.vision/api/v3/klines`. No private Binance credentials are required. Closed times are normalized to exclusive close timestamps. The still-open candle is excluded. Endpoint reference: https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market .
- XAU/USD, XAG/USD, WTI/USD, EUR/USD, GBP/USD and USD/JPY: Twelve Data `/time_series`, with `TWELVEDATA_API_KEY` configured privately on the server. A provider plan authorizing each symbol is required. UTC candle-open timestamps are converted into close times. Provider reference: https://twelvedata.com/docs and https://support.twelvedata.com/en/articles/5214728-getting-historical-data . No spot/futures substitution is made when a symbol is denied or unavailable.
- Timeframes: 5m, 15m, 1h, 4h. TradingView may display OANDA or TVC data for Forex/commodities while analysis uses Twelve Data aggregate quotes, so candles/prices may differ. Both providers are visible in the UI. Local OHLC analysis chart uses exactly the candles returned by the analysis endpoint; entry/SL/TP lines are not injected into the TradingView widget.

## AI setup

Set these in `.env.local` or deployment secrets, never `NEXT_PUBLIC_` variables:

```dotenv
OPENAI_API_KEY=<your-server-key>
OPENAI_ANALYSIS_MODEL=<model-your-project-can-use-with-Responses-structured-outputs>
TWELVEDATA_API_KEY=<your-authorized-data-provider-key>
```

Restart the server and reload the page after changing configuration. The current installation had no configured OpenAI key/model; no live paid AI request was made. The UI exposes that state and disables AI generation until configured. Crypto technical analysis remains available without those keys; Forex/metal/oil candle generation needs the Twelve Data key. Server AI readiness means configuration exists, not verified model/account access.

The optional OpenAI Responses API review uses strict structured JSON outputs, `store:false`, a bounded output budget and a 30-second timeout. Only public candle data, computed rule checks and public symbol/source/timing are submitted; private account data and credentials are not included. The model is configured explicitly instead of silently choosing a model. Structured-output reference: https://developers.openai.com/api/docs/guides/structured-outputs .

## Signal semantics and limits

This is paper research; it submits no orders. The deterministic Structure/EMA20/FVG/OB first-touch/rejection engine supplies BUY/SELL/WAIT. AI reviews that assessment and can veto a setup, but cannot promote WAIT to BUY/SELL or invent executable prices/levels. Missing/refused/invalid AI review yields WAIT for AI-requested runs. An insufficient/invalid/future/stale/gapped history yields WAIT with no actionable price levels. No accuracy, win-rate or calibrated-probability claim is made.

At least 60 closed candles are required. The latest close must remain within its next interval, and the most recent 60 bars must be continuous. This strict gap policy can suppress Forex/commodity setups across weekends, sessions or holidays; there is no assumed exchange calendar or fabricated fill. Signals expire when a new candle is due. The server rechecks expiry after AI completion, and the client expires reports while displayed. History is session-only, limited to 12 reports. Entry is the last closed-candle reference, not an executable broker quote. Spread/slippage, higher-timeframe confirmation and news filters are not included in this new engine; existing separate strategy/backtest and multi-source research remain available below/elsewhere.

## Validation

Production build and lint are checked. Eight added integration/model tests bring the suite to 83 passing tests: timestamp parsing, open-bar removal, malformed/gapped/stale rejection, provider configuration gating, AI strict-output validation/refusals/errors, approved authentication/origin/rate-limit protection, and AI veto/no-promotion. The origin guard was corrected to compare the browser-facing Host (without trusting forwarded hosts), because Next's internal loopback URL canonicalized 127.0.0.1 to localhost and incorrectly rejected valid local requests. Cross-site origins remain rejected. Live public Binance and official TradingView script requests returned HTTP 200 (300 Binance rows); the real parser accepted 299 closed candles and passed quality checks. AI/Twelve Data calls were mocked; no real API key was available to certify those integrations. Browser visual interaction remains unverified.
