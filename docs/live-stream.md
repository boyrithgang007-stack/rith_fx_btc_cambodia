# Live signal data

BTC/ETH: on the analysis page, select **Start live Binance stream**. An authenticated technical-only request seeds closed candles. The browser connects to Binance's public market-data WebSocket (no private keys). Forming candle prices update the status; only validated closed candles update technical signals, chart and levels. Signals are not AI reviewed or persisted; the seed report is saved by the existing endpoint. Generate signal stops streaming and runs the server review flow.

Reconnects resynchronize REST history, with a 30-second retry delay. Stale events, wrong instruments/intervals and invalid OHLC are rejected. Gaps trigger a resync. Disconnect/stale status prevents a current NOW signal. Event age is an approximate event timestamp difference, not a measured round-trip latency. Local clock accuracy matters.

This stream runs only while the browser page is open. It does not create an always-on backend, send orders, or provision infrastructure. Existing EA remains disabled on Vercel.

Exness: existing serialized read-only Python bridge is at services/mt5-bridge. It currently supports account reads and closed 15m Forex candles, not a persistent tick stream or all metals/timeframes. To activate, provision Windows/MT5, configure a reachable authenticated HTTPS bridge and matching MT5_BRIDGE_URL/TOKEN. Credentials remain server-side. Broker tick ingestion and the persistent worker require a separate deployment; this release does not claim them operational. Do not substitute Binance or generic gold prices for Exness prices.
