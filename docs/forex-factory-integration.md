# Forex Factory CPI and economic calendar

`/markets/macro` now displays the Forex Factory weekly calendar alongside the existing BLS US CPI calendar. The integration fetches the publicly linked weekly JSON export at `https://nfs.faireconomy.media/ff_calendar_thisweek.json`; it does not scrape protected pages or require account credentials.

## Data and UI

- The authenticated, rate-limited `/api/macro` route fetches BLS, X (if configured), and Forex Factory independently. A failure in one source does not label another as unavailable.
- Forex Factory requests have a 12-second timeout, no redirects and a 5-minute provider cache. Browser refresh remains every five minutes, with manual retry.
- Titles, ISO timestamps with explicit offsets, currency codes, impact, forecast, previous and optional actual values are validated. Invalid rows are omitted, identities deduplicated and events sorted. Empty weeks remain valid; entirely malformed responses fail closed.
- The table defaults to CPI and supports all economic events, currency and impact filters. Display times use Asia/Bangkok (UTC+7, same offset as Cambodia). Source and check time are visible.
- The verified weekly feed currently omits `actual`. It remains `null` and displays “—”; forecast/previous are never substituted. The UI explains this even for past events. The source website is linked for figures not present in the export.
- This is a current-week calendar, not a full historical/news-article API. No matching CPI in a week is distinguished from a failed provider. Headline/core and m/m/y/y are not merged. BLS remains the official US CPI schedule and retains the existing countdown.

## Verification

56 tests pass, including timezone parsing, malformed/missing fields, numeric zero, deduplication, authentication and independent provider outages. Lint has no errors (four existing image warnings); TypeScript/production build pass.

Live public feed verification outside the network-restricted sandbox returned HTTP 200 with 97 events, including 9 CPI events, and no `actual` fields. Sandbox Node fetch returned EACCES. The user-requested dev server was therefore restarted outside that restriction, bound only to `127.0.0.1:3000`; the running app logged successful macro requests. No account credentials were used in the public feed check. Visual browser/table interaction remains unverified.
