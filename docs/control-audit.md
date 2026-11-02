# Shared action-control audit

The inconsistent button appearance came from overlapping page/theme selectors. This revision migrates 62 active buttons across 15 components to `ControlButton.tsx` rather than adding another page-specific appearance exception. The homepage component, portrait controls and Bloomberg homepage controls are excluded from the new control styling; the shared theme button keeps its existing homepage appearance because the styles are scoped only to application/auth/account/review containers.

## Contract and coverage

- Central variants: primary, secondary, danger, ghost/text and data-row. Central sizes: regular, compact, icon and large icon.
- Consistent typography, rounded edges, color, padding, hover, pressed, selected, disabled and keyboard-focus treatments in homepage-derived normal and Ocean dark modes.
- Existing layout classes, event handlers, refs, disabled attributes and ARIA attributes are forwarded. Unspecified button types now safely default to `button`; explicit form submits remain `submit` and get primary styling.
- Disconnect/logout/reject actions use a distinct danger treatment. Selected toggles/ranges/favorites stay visibly selected. Favorites and watchlist filtering now expose `aria-pressed`.
- Profile upload labels receive the same secondary treatment and a focusable visually hidden file input. Mobile dock icon controls keep their dedicated size.
- Header height adapts to controls instead of clipping them. Reduced motion removes lift transitions. Styling does not override form or interaction semantics.
- `control-buttons.css` deliberately uses important declarations only for the migrated controls' visual properties, to neutralize older high-specificity button rules. This file is the single owner of control appearance going forward.

## Verification

Workspace composition refinement: desktop sidebar is 240px (210px on medium screens), with a single action bar and constrained content width. Forms use aligned fields and collapse to one column on mobile; tables scroll inside their own containers. Removed the redundant sidebar theme toggle and unrelated crypto refresh/errors on settings and macro views. Homepage remains untouched. Build/lint and guest HTTP checks verify compilation/delivery, not authenticated visual appearance.

2026-10-29 refinement: homepage-derived styling now covers account hub links, provider marks, balances, safety notes, learning surfaces, password controls and keyboard focus. Explicit terminal selectors resolve legacy sidebar/card specificity. Active controls retain their selected background on hover. Text-input paint excludes native radio/checkbox/range/file controls. Small-screen terminal navigation scrolls within its own row. Original homepage and its palette source hashes are unchanged. Browser visual review remains unavailable; do not interpret build/HTTP checks as a full visual audit.

Latest design direction: all application surfaces now follow the existing homepage palette, pill controls, soft shadows and typography. `application-design.css` applies the shared surface/spacing/type rules; the alternate lavender normal-glass stylesheet is no longer imported. Homepage source and its palette files remain unchanged. Production build and all 62 tests pass after this update; both final stylesheets parse with PostCSS. Browser appearance still requires visual review when browser access is available.

62 unit tests pass, including new checks for default button type, native submit/disabled behavior and forwarding of handlers, refs and accessibility attributes. Existing provider/auth/payment/strategy tests remain mocked. TypeScript and production build pass; lint has no errors and four existing image optimization warnings. Nine public/guest page HTTP checks pass and expose the shared controls. The control stylesheet parses with PostCSS.

Browser inventory was retried and reports both the native Computer Use pipe and browser access host unavailable. Actual visual comparison, touch/keyboard interactions and every authenticated provider workflow cannot be certified from these checks. No real payments, orders or external messages were performed.
