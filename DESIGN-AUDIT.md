# NR standard-mode design review

Reviewed 2026-10-05. Standard mode is the existing theme-light setting.

| Surface | Design coverage | Functional limits |
| --- | --- | --- |
| Home and desktop experience | Existing responsive presentation; shared NR badge | Browser visual review still needed |
| Login and registration | Forms, feedback, theme toggle; shared badge | Membership approval requires configured email |
| Overview, assets, watchlist | Sidebar, tables, search, loading and empty states | Live data depends on market provider |
| Charts and market analysis | Chart panels and instrument controls | Provider availability affects chart history |
| Forex and strategy | Instrument selection, candlesticks, signals and strategy controls | Signals do not execute orders |
| Macro / CPI | Calendar, scenarios, assistant and input states | Calendar depends on upstream data |
| Settings | Profile, password, avatar and appearance forms | Browser interaction review still needed |
| Balances, exchanges, MT5, bank | Navigation, cards, unavailable and disabled states | Actual account connections and order submission are not implemented |
| Membership review | Approval / rejection and feedback | Requires a valid review token |
| Mobile navigation | Main tabs and shortcuts cover market and account sections | Browser review at mobile widths still needed |

Changes: created a scalable NR Innovations badge inspired by the supplied metallic, carbon and walnut reference; applied it throughout standard-mode branding; fixed seven unreachable nested market-app CSS selectors for panels, headings, table cells and status indicators; restored readable page-introduction text on the dark metal surface; added visible keyboard focus treatment.

The SVG is a recreation inspired by the reference, not an exact extraction of the attached image. Existing material styling remains in design-theme.css. This source review does not certify pixel equivalence or complete end-to-end functionality.

## Full surface update

Added app/nr-surfaces.css, imported after the existing styles. Shared brushed steel, carbon, walnut and circuit materials now cover all market views, account pages, guest home, authentication and membership review. Strategy and backtest internals, macro cards, settings feedback, skeletons, error states and mobile shortcuts receive matching treatments. Custom appearance backgrounds retain their existing inline precedence. Dark mode retains its existing theme.

Validation: production build passed, including TypeScript and all route generation. Browser visual verification could not run because the computer-use runtime reported no connected browsers.
