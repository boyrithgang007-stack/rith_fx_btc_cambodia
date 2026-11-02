# Glass/clay Overview refinement

Applied the latest guide specifically to Overview while preserving the shared normal/dark selector. Normal Overview uses `#F4F7FB`, blurred violet/pink/cyan ambient light, 70%-white frosted cards, 20px corners, translucent edge highlights and soft inset/drop shadows. Dark Overview uses tinted translucent charcoal surfaces. Unsupported backdrop filtering receives solid-surface fallbacks.

The bento arrangement places four KPI cards with clay-style squircle icons across the desktop top row. Existing OHLC rendering gains a close-price gradient area. The new `OverviewAnalytics` renders actual reported-volume bars and market-cap composition across the tracked assets, with responsive layouts and labeled empty states. Asset details are a separate lower table; View selects the chart and scrolls to it. No account transactions, users or geographical activity are fabricated. Existing decorative torus remains.

Bars grow from the baseline, the close line draws in, and cards retain shallow pointer tilt plus 4px hover elevation. Refresh timestamps remount data charts to replay loading transitions and trigger fresh OHLC fetching. The Overview pause control and reduced-motion preferences disable the new animations.

Verification: production build/TypeScript pass. SSR smoke checks verify 75%/25% sample composition, volume chart/table structure and empty states without NaN. These checks use sample data outside the running app. Browser visual validation remains unavailable in the session; exact glass/blur appearance and live hover interaction are not certified.
