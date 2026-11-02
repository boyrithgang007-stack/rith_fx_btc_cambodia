# Macro Observatory

The signed-in dashboard now includes a CSS 3D globe with pausable animation, an official CPI countdown, a manual CPI surprise comparison, social-source inspection, and a bounded research question panel. Reduced-motion preferences disable animation.

## Connections

- BLS calendar: server fetches the official ICS feed, cached for one hour. The parser handles BLS US-Eastern and daylight saving time. The UI displays Bangkok and New York times. If unavailable, no release date is guessed.
- X: optional `X_BEARER_TOKEN` in `.env.local`, with recent-search API access. Restart the server after changing it. The token stays on the server. The query returns up to ten English CPI/inflation posts mentioning Forex, Bitcoin or USD from the last seven days, cached for five minutes. Access, quota and provider failures show an unavailable state. No posts are published.
- Without X access, users can paste public commentary for local topic and percentage-claim extraction. This is not fact-checking or a sentiment model.
- The question panel uses deterministic supported intents, existing crypto price snapshots, the calendar and manual scenario inputs. It is not connected to an LLM. Forex prices remain daily reference rates in the existing dashboard.

## Limits

Actual CPI and consensus values are manual, not a release-data feed. Choose the same measure for both. Conditional reactions are educational scenarios, not trade instructions. The release-window notice does not change existing strategy signals. Review the earlier security and trading-engine findings before public deployment or real-money use.

Run `npm test`, `npm run lint`, and `npm run build` for verification. Live email, X access, provider availability and browser appearance require environment-specific checks.
