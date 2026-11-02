# EA Bot: Binance Futures Testnet

The analysis panel includes an automatic EA for Binance USDⓈ-M Futures **Testnet only**. It is disabled by default and cannot send requests to Binance's live trading API.

## Setup

1. Sign in to an approved, email-verified member account and open **Crypto → Strategy**.
2. Create a Binance Futures Testnet API key. Use a testnet key only; do not enter a production key. Enable only the Futures access required for account reads and test orders; never enable withdrawals.
3. Ensure the Testnet account has test USDT and is in one-way position mode.
4. Configure `EXCHANGE_ENCRYPTION_KEY` on the server before adding credentials. Keys are encrypted with AES-256-GCM and are never returned to the browser after saving.
5. Select a supported symbol, allocated capital, risk (0.1–1.0%), and leverage (1–5x). Save the Testnet key and enable the EA.

The application verifies the Testnet account and one-way mode before enabling automation. Replacing the key disables the EA until the new key is verified. Disconnecting the key also disables the EA.

## Execution and risk limits

- The worker runs in the long-lived Node.js application process; the SQLite deployment must remain a single application instance.
- It evaluates completed 4-hour Binance Futures candles using the existing FVG/order-block strategy and a complete 1-day higher-timeframe confirmation. It checks every 30 seconds and processes a signal only once per symbol and candle.
- Entry sizing uses the configured capital and risk, reserves an estimated 20 bps for trading costs, respects Binance quantity/notional filters and available margin, and never exceeds 5x leverage.
- Each entry uses a market order followed by verified close-position stop-loss and take-profit triggers at 1:2 reward/risk. Ambiguous order states, excess risk, missing protection, or daily limits halt the EA; if protection cannot be verified, inspect the Testnet account manually.
- New entries require positive daily PnL. Daily PnL includes supported realized-income/fee/funding records and current unrealized PnL; the day boundary is `Asia/Phnom_Penh`. At a 3% daily loss the EA disables itself. Existing positions are not force-closed solely because the daily limit was reached; their exchange-side protective orders remain in place.
- The EA does not open a new position while any Futures position is open in the account. It does not manage or close manually opened positions.
- Settings changes and execution outcomes are recorded in the user-scoped EA audit/run history.

This is not a profitability guarantee or investment advice. Testnet behavior does not prove that live execution will behave identically. Live trading is not implemented or enabled by this feature; it requires a separate implementation, explicit opt-in, production-key safeguards, and additional exchange validation. Never share exchange keys in chat.
