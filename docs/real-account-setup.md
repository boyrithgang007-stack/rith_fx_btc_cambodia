# Real account setup

Registration already creates pending members and sends a private review link to the configured administrator. Approval is required before login and before accessing any connection endpoints. Email delivery still needs a live registration test using the configured mail service; the automated suite uses a mocked mail transport.

## Local configuration

Run `node scripts/setup-private-config.mjs` from Edikiter. This preserves configured keys, reuses the development session secret when available, and creates missing authentication, vault and MT5 bridge secrets without printing them. It was run during this implementation. Keep `.env.local` private and back it up separately from the database. Losing the encryption key makes stored exchange credentials unreadable. Rotation currently requires disconnecting and reconnecting accounts; automatic key migration is not implemented.

For public deployment, configure APP_BASE_URL to the real HTTPS origin, keep AUTH_SECRET stable, set DATABASE_URL to a Supabase transaction-pooler URI, and add a shared rate limiter or WAF. The included limiter is process-local. Vercel serverless does not run the continuous EA worker or support the 250 MB dubbing workflow; use separate worker/object-storage infrastructure for those features.

## Exchange accounts

Approved users open `/accounts/exchanges`, select Binance, OKX or Bitget, and enter credentials in the app. The server validates provider permissions and reads the account before encrypting credentials. Credentials never enter local storage or API responses. One connection per provider per member is supported; connecting again replaces that provider's credentials.

- Binance: HMAC API key with reading enabled, trading/withdrawal/transfer/futures permissions disabled. Displays Spot wallet available and locked quantities.
- OKX: HMAC API key, secret and passphrase; current account configuration must return `read_only`. Displays trading-account currency balances, not the separate funding wallet.
- Bitget: HMAC API key, secret and passphrase; Classic Spot account information must return recognized read-only authorities. Unknown authorities fail closed. Displays available, locked and frozen separately. Unified Trading Account and RSA keys are not supported by this connector.

Bind API keys to the server's outgoing IP when supported. Providers can deny requests because of regional restrictions, account type, API permissions or expired credentials. No credentials were supplied during implementation, so live exchange calls have not been validated with an actual account.

`/accounts/balances` and `/connections` list the member's connections. Click Refresh to fetch a fresh balance; failed refresh clears the prior snapshot instead of showing stale balances as current. Disconnect removes the encrypted credential record and records an audit event. It does not revoke the key at the provider; revoke it there too when appropriate. Backups may retain historical encrypted records until their retention period ends.

## Exness MT5 on Windows

The included bridge reads MT5 through the official MetaTrader5 Python package. This machine did not expose a Python command during setup, and no dedicated terminal/account credentials were available, so the bridge has not been started or tested against Exness.

1. Install 64-bit Python and a dedicated Exness MT5 desktop terminal on the bridge host. Use a terminal intended for this reader, since logging in switches the terminal's current account.
2. Install dependencies: `python -m pip install -r services/mt5-bridge/requirements.txt`.
3. Optionally set MT5_TERMINAL_PATH in `.env.local` to that dedicated terminal's executable.
4. Start the bridge from a dedicated terminal: `powershell -ExecutionPolicy Bypass -File services/mt5-bridge/start.ps1`. This process is long-running and binds only 127.0.0.1:8787.
5. Open `/accounts/mt5`. Enter the MT5 account number, read-only/investor password and exact Exness server name shown for that account.

The bridge verifies login/server identity and rejects sessions where trading is allowed. It reads balance, equity, margin and free margin, and provides closed 15m candles for the Forex rule analyzer. It serializes requests because a terminal has one current account. Requests use a private bearer token and credentials are not logged. It has no order API. A remote Windows bridge requires a properly configured HTTPS reverse proxy and private network access; opening the loopback service directly to the internet is not supported. Use a process supervisor and health monitoring for continuous operation.

## Trading risk settings and order execution

The Binance Futures EA is Testnet-only. Forex formulas and read-only MT5 signal analysis are available, but Forex order automation is not implemented. Forex's proposed 1% risk/order, 1:2 reward/risk, 5x leverage and 3% daily-loss limits are not yet enforced by an order service. Do not enable trading permissions or use a live/master password for the investor-account connector. See [Forex EA status and formula model](./forex-ea.md). Demo execution requires a separate, independently verified Demo-only bridge and server-side safeguards before it can be enabled; live execution is out of scope.

## ABA and ACLEDA

These banks remain explicitly unavailable for personal balance access. A bank account number, mobile password or OTP is not an API authorization. Bank-approved integration credentials and their balance-access contract are required before a connector can be implemented. Payment-gateway integration is a separate feature and does not by itself give access to personal account balances. The user has confirmed existing ABA and ACLEDA merchant accounts; their balance API contracts and ACLEDA signing specification are still needed.

References:

- [Binance account API](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/account) and [key restrictions](https://developers.binance.com/en/docs/catalog/core-trading-wallet/api/rest-api/account)
- [OKX API documentation](https://www.okx.com/docs-v5/en/)
- [Bitget REST authentication and permissions](https://www.bitget.com/docs/classic/rest-api)
- [MetaTrader5 Python initialize](https://www.mql5.com/en/docs/python_metatrader5/mt5initialize_py)
- [Exness read-only access settings](https://get.exness.help/hc/en-us/articles/360006922872-Trading-account-settings)
- [ABA PayWay developer suite](https://developer.payway.com.kh/)
- [ACLEDA integration information](https://toanchetpay.acledabank.com.kh/toanchetpay/xpay-api)

## Verification

Run `npm test`, `npm run lint` and `npm run build`. Connection tests cover encrypted record tampering, owner binding, user isolation, credential replacement, audit events, permissions, signed reads, MT5 account identity and unauthenticated/cross-origin rejection. They use provider mocks, not live financial accounts. Browser verification is still pending because no browser is connected in this session.

## ABA merchant payments

The bank page now generates ABA PayWay KHQR requests and persists the member-owned payment references. Configure ABA_PAYWAY_MERCHANT_ID and ABA_PAYWAY_API_KEY in private server configuration. ABA_PAYWAY_MODE defaults to sandbox; change to production only after sandbox validation and merchant domain approval. Do not enter keys in chat.

QR requests pay the one merchant configured for this application, not separate personal bank accounts for each user. USD and KHR are supported with bounded, validated amounts. QR lifetime is 15 minutes. The member can check payment status against ABA; the server only records paid after checking transaction ID, approved status, original/payment amount, currency and zero refund amount. Browser messages/callbacks never grant paid status. Payments are not automatically credited to trading balances or membership plans. Refunds, payment webhooks, automated reconciliation, merchant settlement reporting and ACLEDA payment execution are not implemented. Recent references are persisted and displayed; requests older than seven days need the separate transaction-details API. Never assume a paid record reflects later refunds without reconciliation.

No merchant secrets have been provided to this session, so no live payment requests or payments were sent. Automated verification uses mocked provider responses. Current test suite: 41 passing tests.

Production smoke check passed on temporary port 3101: home returned 200; unauthenticated connection and payment endpoints returned 401; cross-origin connection POST returned 403. The temporary server was stopped. Build passed; lint completed with zero errors and six pre-existing image warnings.
