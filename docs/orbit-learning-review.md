# Direction-changing portrait orbit and learning lab

The user confirmed that the requested market-learning feature means lessons and interactive exercises.

## Portrait

`portrait-orbit.ts` supplies continuous yaw, pitch and roll. The orbit's spin velocity crosses zero and reverses smoothly rather than spinning only in a fixed direction. The projected orbit remains below the face. Existing hover/focus visibility, click/touch pinning, Escape, pause, reduced motion, document/intersection visibility and cleanup behavior remain in place.

## Learning

`/learn` is a public Khmer/English learning studio with the shared normal/dark themes. Links are available from the welcome, market sidebar, terminal and mobile shortcuts.

- OHLC lesson: interactive close-price slider and labeled synthetic candle.
- Reasoning lesson: three synthetic historical sequences and prompts distinguishing observations, missing context and assumptions.
- Risk lesson: hypothetical long-position arithmetic, validation and an unleveraged capital cap. It explicitly excludes costs and broker-specific lot conversion and explains that stop levels do not guarantee losses.
- Each lesson has a multiple-choice exercise, immediate explanatory feedback, session-only progress and reset. Language switching retains answers. No live quotes, forecast claims, broker orders or paid AI integration are involved.

Further-reading links use CME Group technical-analysis education and Investor.gov's Forex investor bulletin. The risk example is illustrative arithmetic rather than a recommended position.

## Validation

54 tests pass, including smooth reversal, changes on all three axes, sampled finite projection/face clearance, candle validation and risk sizing/caps/invalid inputs. TypeScript and lint pass; four existing image-optimization warnings remain. Browser/native interaction access was unavailable in previous checks, so the final orbit appearance and hands-on mobile interactions still need visual verification.
