# Forex strategy formulas and signal analysis

The Forex analysis area supports user-owned visual rule sets and administrator-published templates. Rules are stored as validated JSON; arbitrary JavaScript or user-supplied source code is never evaluated. Each member can save up to 10 personal rules, and administrators can publish up to 20 shared templates.

## Supported rule model

- Symbols: EURUSD, GBPUSD, USDJPY and XAUUSD.
- Entry timeframe: closed Exness MT5 15-minute candles.
- Higher-timeframe confirmation: one-hour candles aggregated from four complete 15-minute bars. BUY requires the latest completed 1h close above EMA20; SELL requires it below EMA20.
- Visual conditions use Close, EMA, RSI or ATR versus another indicator or a fixed numeric value. Periods are bounded to 2–100, and each side supports up to 10 AND conditions.
- BUY and SELL conditions must not both match. An ambiguous match returns WAIT.
- Stop-loss distance is ATR(14) multiplied by the selected 0.5–5.0 setting. Take-profit is fixed at 2R.
- The signal endpoint reads only candles from the member-owned, connected MT5 investor account. It does not expose credentials to the browser or place orders.

The EA panel's signal output is a deterministic application of the saved rule to returned candles—not a win probability or guarantee of accuracy. Historical/backtest validation, spread/slippage and broker-specific execution can change outcomes. There is no basis to claim 100% signal accuracy or profitability.

## MT5 candle bridge

The local Python bridge supports `/account` and `/candles` and binds only to `127.0.0.1:8787`. It requires the private bearer token, validates the account identity, accepts investor/read-only credentials only, and returns closed M15 candles for supported symbols. Broker symbols may have suffixes; if resolution is ambiguous, configure/resolve the exact symbol rather than trading a guessed match. The endpoint cannot submit, modify or cancel orders.

Configure `MT5_BRIDGE_URL`, `MT5_BRIDGE_TOKEN`, and optionally `MT5_TERMINAL_PATH` privately on the server. Install the official `MetaTrader5` Python package and run the bridge as described in [real-account setup](./real-account-setup.md). Never expose the local bridge publicly.

## Execution status and risk

Forex order automation is not implemented. The rule builder and read-only signal analysis must not be described as a working Forex trading bot. The 1% risk/order, 1:2 reward/risk, 5x leverage cap and 3% daily-loss stop are target safeguards only; they are not currently enforced by a Forex order service. Do not enter trading-enabled MT5 credentials into the investor-account connector. Any future order flow must be separately built and verified using Exness Demo only, including broker-aware volume sizing, account-currency risk calculation, order protection verification, idempotency, daily-PnL reconciliation and fail-closed behavior before it is enabled.
