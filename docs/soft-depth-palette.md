# User-specified palette and soft depth

Updated the shared two-mode tokens to use `#F5F5F7` as normal-mode background/surface, `#1D1D1F` as normal text/dark background, `#AAAAAA` for dark secondary text and neutral borders, and `#007AFF` for the primary accent. Normal-mode small secondary text uses `#66666b` for readability; readable link variants are `#0064d2` on light and `#78b4ff` on dark.

`soft-depth.css` is the final surface/control layer. Cards use 20–24px radii; controls use 14–16px or pills. Normal surfaces pair lower-right `rgba(0,0,0,.08)` and upper-left `rgba(255,255,255,.9)` shadows. Dark surfaces use subdued highlights rather than white glare. Primary buttons use blue gradients with white labels; inputs retain inset depth and focus outlines. Decorative scene colors and financial/error semantic colors remain distinct from the action palette. Portrait click target stays transparent.

The latest primary-button request supersedes the earlier teal action palette. The same two theme choices remain in place, including welcome, Overview, account, learning and news surfaces. Reduced-motion preferences remain supported.

Validation: production build and TypeScript pass. No business logic changed. Browser visual verification remains unavailable in the current session.
