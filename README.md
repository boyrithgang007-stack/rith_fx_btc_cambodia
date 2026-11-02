# rith_fx_btc_cambodia

A Next.js market dashboard with Crypto, Forex reference rates, an FVG paper strategy, and account sign-in.

## Run locally

1. Install Node.js 22 or newer.
2. Create a Supabase project, choose **Transaction pooler** under Connect, copy its URI into `DATABASE_URL` in `.env.local`, and generate a private authentication secret:
	```sh
	node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
	```
	Put the generated value in `AUTH_SECRET`. Never commit `.env.local` or share the generated secret.
	If Node.js reports `self-signed certificate in certificate chain`, download the project root certificate from **Supabase → Database → SSL Configuration** and set its PEM contents as `DATABASE_SSL_CA` in `.env.local`. Certificate verification remains enabled.
3. Run `npm install` and then `npm run dev` from this directory. The application creates its PostgreSQL tables when first used.
4. Open `http://localhost:3000`.

Passwords are bcrypt-hashed; the session is a signed, seven-day `HttpOnly`, `SameSite=Lax` cookie. Keep `.env.local` private and never commit or share its secrets.

For production, use HTTPS, a stable private `AUTH_SECRET`, persistent database storage, and a shared rate limiter/WAF in front of every app instance. The built-in rate limit is process-local and is not sufficient by itself for a multi-instance public deployment. Public account registration requires email verification followed by administrator approval. Password reset is not implemented.

CoinGecko market and chart requests work without an API key but may be rate-limited. For higher request limits, add a CoinGecko Demo API key as `COINGECKO_API_KEY` in `.env.local` and restart the app. Keep it server-side; never use a `NEXT_PUBLIC_` variable.

Azure keys stay on the server and must never be placed in a `NEXT_PUBLIC_` variable.

The analysis area includes a disabled-by-default Binance Futures Testnet EA, plus a Forex visual formula builder that calculates signals from read-only Exness MT5 candles. Forex order automation is not implemented. Read [docs/ea-bot-testnet.md](docs/ea-bot-testnet.md) and [docs/forex-ea.md](docs/forex-ea.md) before configuring either feature. Neither feature can place live orders.

## Member administration

The first administrator must be bootstrapped from a trusted shell connected to the same Supabase database as the app:

1. Register the administrator's email through the app and complete email verification. Do not share the password or server credentials.
2. From this project directory, set `DATABASE_URL` to that database's transaction-pooler URI, then run `npm run admin:bootstrap -- admin@example.com`.
3. Sign in with that account and open **គ្រប់គ្រងសមាជិក** from the dashboard sidebar, or visit `/admin/members`.

The bootstrap command only works while no administrator exists. It approves and enables the matching registered account and grants its admin role; it cannot be used to add more admins. Keep server-shell access restricted. Admins can approve or reject pending registrations and disable or re-enable approved member access. Disabled accounts lose access on their next request, including requests using an existing session. Management actions are recorded in the admin audit log.

The member list records a new account's registration IP and updates its last-login IP after successful sign-in. These values are visible only through the admin-only member API and dashboard; accounts registered before this migration have no historical IP values. The application accepts only a valid `x-real-ip` address, so production reverse proxies must overwrite that header with the actual client address. Treat IP addresses as personal data and disclose their collection in the site's privacy notice.

Back up the database before production deployment and verify the bootstrap command's environment points at the production database, not a local development copy. `npm run db:backup -- ./backups` requires the PostgreSQL `pg_dump` utility; restore backups only into a verified target database.

## Free-tier Vercel + Supabase deployment

1. Create a Supabase project and a Vercel project connected to this GitHub repository. Use the repository root as the Vercel project root; it contains `package.json`.
2. In Supabase, choose **Connect → Transaction pooler** and copy its connection URI. In Vercel project settings, add that value as `DATABASE_URL`, plus `AUTH_SECRET` (at least 32 bytes) and `EXCHANGE_ENCRYPTION_KEY` (64 hex characters). If the runtime reports a certificate-chain error, add the PEM contents of the root certificate from **Supabase ? Database ? SSL Configuration** as `DATABASE_SSL_CA`. Add `APP_BASE_URL` as the deployed HTTPS origin plus the email provider variables (`RESEND_API_KEY`, verified `APPROVAL_EMAIL_FROM`, and `APPROVAL_ADMIN_EMAIL`). Add market/AI/payment variables only for services you have configured. Never put secrets in `NEXT_PUBLIC_` variables or chat.
3. Deploy, open `/api/health`, and confirm it returns `{"status":"ok"}`. Register and verify the first admin email, then run the bootstrap command from a trusted local shell with `DATABASE_URL` set to the same Supabase project.
4. Sign in, review the member/admin controls, and test registration/approval and email delivery. Keep an offsite database backup and review Supabase/Vercel usage limits before inviting members. A fresh database starts empty; the previous local SQLite accounts and data are not migrated automatically.

Vercel's serverless functions do not run the app's long-lived polling worker: automatic EA operation is intentionally unavailable there and the API refuses to enable it. Binance Futures remains Testnet-only. Forex signals require a secured, reachable HTTPS MT5 bridge; `127.0.0.1` inside Vercel is not the user's/local bridge. Vercel's request-size and execution limits also do not support the 250 MB dubbing workflow; use a separate VM/background worker and object storage for that feature.

## Docker / single-VM deployment

The supplied `compose.yaml` can still run one Next.js container and Caddy, but the app now requires external PostgreSQL. Provide `DATABASE_URL` and the same required secrets in `.env.production`; the old SQLite volume is not used. Configure DNS, HTTPS, and firewall rules as described for your VM provider. Run `npm run admin:bootstrap -- <registered-email>` in a trusted environment connected to the production database. For backups, use a recent PostgreSQL client and a Supabase direct/session-pooler URI as `DATABASE_URL_DIRECT`; store dumps offsite and test restores.

The in-memory rate limiter is process-local; use a shared rate limiter/WAF for a multi-instance public deployment. ABA payments remain in sandbox until the bank authorizes live credentials and a production transaction test.

Do not announce a public launch until the privacy-notice draft at `/privacy` is reviewed and finalized by the service operator, registration/approval and email delivery are tested, an administrator is bootstrapped, offsite backups are verified, provider quotas and billing are understood, and DNS/TLS/restore procedures have been exercised. This checklist is operational guidance, not a legal or security certification.

## Azure setup

Create Azure Speech and Translator resources. Put the Speech resource key, region, and resource name in `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, and `AZURE_SPEECH_RESOURCE_NAME`. Put the Translator key and region in `AZURE_TRANSLATOR_KEY` and `AZURE_TRANSLATOR_REGION`.

Speech recognition and Khmer voices use Azure Speech. Text translation uses Azure Translator. Both resources must be enabled and billed in the Azure subscription. Khmer dubbing offers Sreymom (female) and Piseth (male). Source and target languages can be selected in the translation panel.

## Current limits

- The dubbing route accepts video files up to 250 MB. The hosting platform must allow requests and executions of that size and duration; serverless platforms with smaller upload or timeout limits need a background worker and object storage.
- Dubbing replaces the source audio with one generated narrator voice and embeds translated subtitles as a selectable subtitle track. It does not clone the original actors' voices or preserve separate speakers.
- The image slideshow export is browser-based WebM. The Azure dubbing path exports MP4.
- The app does not store projects on a server. Imported media is kept in browser memory until the page closes.


## Market structure workspace

The dashboard includes a data-analysis view with a Crypto / Forex switch. Crypto analysis includes closed-candle BUY / SELL / WAIT signals, candlesticks, EMA 20, confirmed structure breaks, paired FVG/OB zones, stop/target levels, capped paper sizing, browser alerts, and a downloadable paper-trade log. Candle-analysis reports are saved per approved user (up to 100), plotted on the analyzed OHLC chart, and can be reopened from saved history; expired entries are labeled historical and are not current trade signals. Forex analysis shows ECB reference-rate history and movement; these rates are delayed and are not broker quotes or trade signals.

The system uses NR branding and provides shared dark and standard modes across the dashboard, sign-in, home, research, and account screens. The dark theme uses deep navy surfaces with purple/blue neon accents; standard mode follows the supplied brushed-metal, carbon-fiber, walnut and blue-highlight reference. The selected mode is stored in the current browser's local storage. `/markets/settings` lets an approved user update their display name, bcrypt-protected password, and PNG/JPEG/WebP profile image; profile images are limited to 700 KB and stored in the private auth database. Users can also select a dashboard background color or upload an image up to 1.4 MB; appearance preferences stay in that browser's local storage and are not synced between devices.

AI candle reviews and chart-image reading use the Google Gemini API. Create a key in [Google AI Studio](https://aistudio.google.com/apikey), then set `GEMINI_API_KEY` and a current JSON-output-capable `GEMINI_ANALYSIS_MODEL` ID in the server's `.env.local`; optionally set `GEMINI_VISION_MODEL` to a separate image-capable model (it falls back to `GEMINI_ANALYSIS_MODEL`). Use the model ID shown in AI Studio (without a `models/` prefix), keep the key server-only, and restart the app. Gemini reviews only the submitted evidence and cannot promote a technical `WAIT` signal to a trade entry. Technical candle analysis remains available without Gemini configuration.

Rules are deliberately explicit: two candles on each side confirm a strict swing; the first structure break establishes direction, subsequent same-direction breaks are BOS and opposite breaks are CHoCH. A gap must form within three candles of a matching break and pair with an opposite candle in the preceding eight bars. Only the first FVG touch followed by a same-bar rejection close qualifies. Zones expire after 40 bars or an OB boundary breach. Trend also requires agreement with EMA 20. These are single-timeframe rules, not the full multi-timeframe strategy in the reference document.

Signals are evaluated on candle closes, not the current market-card quote. OHLC fetches refresh every 60 seconds, clear failed results, and are keyed by asset/timeframe. Data older than one interval plus 15 minutes suppresses alerts and entry signals. CoinGecko candles use close timestamps and automatic granularity: 30m for one day, 4h for 30 days, and 4d for 365 days. Availability depends on provider plan and rate limits. Reference: https://docs.coingecko.com/reference/coins-id-ohlc

Backtesting uses the same signal engine on historical prefixes, enters at the next open, allows one position at a time, caps notional to capital and risk to 2%, charges configurable costs on both legs, and treats an ambiguous SL/TP bar as SL first. A gap beyond the stop fills at the open. Remaining positions close at the dataset end; drawdown measures closed-trade equity. Short borrowing/funding and order-book liquidity are not modeled. No broker orders are sent. There is no HTF/LTF confirmation or economic calendar filter yet.

Validation: `npm test`, `npm run lint`, `npx tsc --noEmit --incremental false`, `npm run build`.

## External account connections

Approved members can connect Binance, OKX, Bitget Classic Spot and Exness MT5 through encrypted private credentials. The app validates read-only permissions and fetches current account balances; it does not submit orders. Exness requires the included Windows MT5 bridge to be installed and started. The Forex formula analyzer can request closed 15m candles from that investor connection; automated Forex order execution is not implemented. ABA and ACLEDA balance access requires bank-approved integration and remains unavailable. See [real-account setup](docs/real-account-setup.md) for provider support, configuration and current verification limits.

Market and account tools are split into authenticated routes: `/markets/overview`, `/markets/macro`, `/markets/charts`, `/markets/analysis`, `/markets/assets`, `/markets/watchlist`, `/markets/strategy`, `/markets/forex`, `/markets/settings`, `/support`, and `/accounts/balances`, `/accounts/exchanges`, `/accounts/mt5`, `/accounts/bank`. The Support form sends the signed-in member's message to `SUPPORT_EMAIL` using the configured approval-mail provider; replies go to the member's account email. Watchlist selections and appearance preferences are stored in the current browser's local storage; they are not synced across devices.

The CPI/Macro observatory offers Khmer and English UI and rule-based assistant responses. CPI event times continue to use the official BLS feed; translated labels do not translate original third-party social posts.

### Multi-timeframe upgrade

HTF confirmation is now enabled by default. The 30m view fetches 4h history separately; 4h candles aggregate into complete UTC 1d bars, and 4d candles into complete UTC 16d bars. Partial groups and groups missing constituent candles are excluded. Both the current signal and historical simulation require at least 20 complete HTF bars and matching structure/EMA direction. Historical evaluation only sees HTF bars closed by the signal timestamp. This supplies trend confirmation; it is not a separate LTF CHoCH-after-HTF-zone-touch state machine.

An optional Discount/Premium filter compares the FVG midpoint against the midpoint of the trailing 20 HTF bars (a defined rolling range, not a discretionary swing/Fibonacci range). HTF confirmation can be disabled explicitly for comparison. Turning on filters can reduce or eliminate signals; no performance improvement is claimed without independent validation.

Sizing now includes configured per-leg costs in the stop-loss budget and caps exposure plus entry fees to capital. Gap losses can still exceed planned risk. Backtest adds closed-trade equity, profit factor and per-trade expectancy; insufficient samples are labeled. The API and client reject malformed OHLC, nonmonotonic timestamps and missing intervals; a separate 10-second clock updates signal freshness even during requests. No news filter or broker execution has been added.

## Membership approval by email

New accounts must verify their email and remain pending until the owner approves them; they receive no login session before both steps. Existing accounts are migrated to approved with their email marked verified to preserve current access. Login, session lookup, market API, forex API and the existing dubbing authorization require an approved account. The registration UI prompts the applicant to verify their email before the membership review.

Configure these server-only values in `.env.local`, then restart the server:

- `RESEND_API_KEY`: a Resend sending key.
- `APPROVAL_EMAIL_FROM`: a sender on your verified Resend domain.
- `APPROVAL_ADMIN_EMAIL`: the owner's inbox that receives approval requests.
- `SUPPORT_EMAIL`: the support team's inbox (defaults to `rithbtccambodia@gmail.com`).
- `APP_BASE_URL`: the exact public HTTPS origin, e.g. `https://your-domain.example`. Local development may use `http://localhost:3000`; a localhost link only works on the machine running the app.

No approval or Support emails can be sent until these settings are filled in. Registration fails closed if they are missing. Provider API reference: https://resend.com/docs/api-reference/emails/send-email

Applicants receive a private verification link that expires after 24 hours; after verifying, the owner receives the private review link. Review links contain 256-bit random tokens, stored as SHA-256 hashes, expire after 72 hours and are consumed atomically once. Both token types are placed in URL fragments, not query strings; the verification page removes its fragment before sending the token to the server. Review links grant the right to decide one application: treat them like passwords and do not forward them. The admin interface and bootstrap command reject unverified email addresses.

If sending fails, the account remains pending. The applicant can submit registration again with the same email and password to request another email (subject to registration rate limits). Existing credentials are never overwritten. A new request invalidates the old link. Rejected accounts cannot self-register again with the same email. Members can sign in after approval; this version does not send an approval-result email to the applicant. Email verification and review delivery are tracked separately in `email_verifications` and `membership_reviews`. Email delivery tests use mocks; test real inbox delivery after configuring your provider.

### Gmail SMTP alternative

Set `APPROVAL_MAIL_PROVIDER=gmail`, `GMAIL_USER` to your Gmail address, `GMAIL_APP_PASSWORD` to the Google App Password, and `APPROVAL_ADMIN_EMAIL` to the owner's inbox. Keep `APP_BASE_URL` configured as above. The sender is always the authenticated Gmail account. Resend settings are not required in Gmail mode. Spaces in Google's displayed App Password are removed automatically. The local `.env.local` has blank fields ready for these values; do not commit or share it.

Gmail sends over TLS to smtp.gmail.com:465 with connection and socket timeouts. SMTP errors remain generic and do not log credentials. Unlike Resend's idempotency key, SMTP does not guarantee duplicate suppression after an ambiguous timeout; older review links are invalidated when registration is retried. See https://nodemailer.com/guides/using-gmail for Google account requirements.

After saving `.env.local`, restart `npm run dev`, register a new test member, and check the owner's Gmail inbox/Spam folder for the approval request. For localhost testing, open the email link on the same computer as the running server. Approve the request, then sign in as the test member. No real test email is sent automatically by the unit tests.

## Merchant payments

`/accounts/bank` includes ABA PayWay KHQR payment requests and server-side transaction verification, defaulting to sandbox. Configure the private ABA_PAYWAY_* variables and follow [real-account setup](docs/real-account-setup.md). The user has existing ABA/ACLEDA merchant accounts; ACLEDA payment and both banks' personal balance APIs still need bank-specific integration contracts. No live bank account or payment was tested during implementation.
