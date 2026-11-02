# Two-mode system review — 2026-10-28

Latest requirement: exactly two shared appearance modes. Normal mode follows the white welcome page; dark mode follows the cinematic Overview. This supersedes the earlier forced-dark Overview and custom background appearance directions.

## Implementation

- `theme-store.ts` is the single theme persistence/subscription implementation. It accepts `light`/`dark`, synchronizes same-tab and storage events, uses a stable server snapshot and keeps switching functional in memory if storage is blocked.
- Welcome, market workspace, sign-in, account routes and membership review use the shared hook/scope. Overview no longer forces dark or hides its mode controls.
- `two-modes.css` is the final palette layer: normal uses warm white, ink and teal; dark uses navy, pale text and cyan/green. Text, surfaces, focus/control states, inputs, primary/secondary button treatments and card depth share these values. Market gain/loss and error colors retain semantic meaning.
- Settings now offers only normal/dark previews via radio controls. The former arbitrary background color/image controls and inline appearance overrides are removed. Existing stored background preferences are not deleted; they no longer override the two approved palettes. Avatar/profile/password editing remains.
- The welcome retains portrait motion and the Overview retains its 3D layout, mesh and pause controls in either palette. Reduced-motion rules remain.

## Verification

- 50 unit tests pass, including appearance validation, listener filtering/unsubscription, cross-tab storage notifications and storage-denied fallback. Existing authentication/membership, account isolation, payment, strategy, macro and commodity tests pass with provider mocks.
- TypeScript passes; lint has no errors and four pre-existing next/image optimization warnings.
- Production build passes.
- Production HTTP smoke checks passed for 21 page/API paths. Protected market/account pages present the sign-in gate to guests and four private read endpoints return 401. Welcome exposes the shared mode button and the compiled two-mode styles are served. Temporary port-3100 verification server was stopped afterward; the user-requested dev server is separate.
- Browser/native interaction access was unavailable during recent visual checks. Full visual comparison, keyboard testing and live provider/account connectivity are not certified by these tests. No external order/payment or message was submitted.
