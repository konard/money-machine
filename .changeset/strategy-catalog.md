---
'money-machine': minor
---

Add a researched and fact-checked catalog of 230+ legal ways to get paid online, ranked by probability of payment, automation and effort, each with a resourced business plan, plus incorporation costs for the 50 reference countries.

- `data/strategies/*.json`: per-category strategy data with scores, payout paths, full cycles, risks and sources
- `scripts/build-catalog.mjs` (`npm run build:catalog`): legality gate (≥ 80% of reference countries), priority score, generated docs and website data
- `data/strategies/*.json` `businessPlan`: startup resources, unit economics with typical prices, break-even, market conditions and a calibrated profit likelihood for every entry; rendered by `scripts/render-business-plan.mjs`
- `data/incorporation/*.json` → `docs/legal/incorporation-costs.md`: sole-proprietor and company registration cost, time, tax and VAT for each reference country; `docs/legal/remote-incorporation-options.md`
- `docs/business-plans/`: ranked index (with start cash and profit odds) plus one page per strategy
- `docs/methodology.md`, `docs/legal/`, `docs/plans/roadmap.md`
- `website/` + `scripts/build-website.mjs`: static site (catalog, shortlists, one page per plan, rendered docs) built and published by the GitHub Pages workflow; generated output is not committed
- `tests/catalog.test.js`: enforces the catalog requirements
- README rewritten to describe the project instead of the template
