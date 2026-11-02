# Bloomberg economics headlines on the welcome page

The homepage now includes an economic-news section after the workspace showcase, with six original-language Bloomberg Economics headlines, publication dates in Asia/Bangkok (UTC+7), source attribution and direct outbound article links. It supports the existing Khmer/English interface and both normal/dark palettes.

The public `/api/news` endpoint reads only the canonical public RSS endpoint `https://www.bloomberg.com/feeds/economics/news.rss`. Live verification confirmed HTTP 200; the legacy `feeds.bloomberg.com` URL redirects to this canonical endpoint. The integration does not fetch full articles, paid content or account credentials. The UI explains that full articles may require a Bloomberg subscription.

Provider requests use a 12-second timeout and 10-minute cache. Browser refresh runs every 10 minutes and can be requested manually. Errors provide a retry/source link without fabricated news; failed refresh retains clearly labeled last-loaded headlines. The client aborts requests and clears timers on unmount.

The narrowly scoped RSS parser handles CDATA/entities, rejects DTD/entity declarations, validates HTTPS Bloomberg-only links and dates, deduplicates URLs, sorts by publication time and limits output to six. No article descriptions/body HTML are rendered. Feed content is treated as untrusted data.

Validation: 59 tests pass, including parser/link safety, malformed RSS, duplicate handling and provider failure. Lint has no errors (four existing image optimization warnings). The live local `/api/news` returned HTTP 200 with six headlines and validated dates/links. Visual browser verification remains unavailable in the current session.
