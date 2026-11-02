# Normal-mode reference refinement

The latest image applies to normal mode throughout the application, explicitly excluding the homepage. Added `normal-glass.css` as a normal-mode-only final layer.

- Mesh background uses blue, lavender and pink with translucent frosted surfaces, 20–24px card corners, soft edge highlights and clay-like controls.
- Market/Overview, sidebar/header, strategy, macro/CPI, account/bank, sign-in, membership review and learning surfaces share normal-mode glass tokens, readable dark text and blue/purple actions.
- Table, input, active, disabled, focus and responsive styles remain functional. Reduced motion and non-backdrop-filter fallbacks are provided.
- Every new selector is rooted in `.theme-light` on application/auth/account/review scopes. `.welcome-page` is deliberately excluded, so the welcome portrait, typography, buttons, Bloomberg section and existing homepage appearance are unchanged. Ocean dark styles are unchanged.

Validation: production build and TypeScript pass. A PostCSS scope audit found no unscoped or homepage-targeted selectors. Homepage component/portfolio CSS and Ocean-dark file hashes remain unchanged. The dev server serves the new stylesheet. Browser visual verification remains unavailable; reference equivalence is not certified.
