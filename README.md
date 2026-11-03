# Money Machine

**100+ legal ways to get paid online, ranked by how likely you are to actually get paid, how much runs on autopilot, and how little effort it takes.**

Website: <https://konard.github.io/money-machine/> · Catalog: [`docs/business-plans/README.md`](docs/business-plans/README.md) · Data: [`data/strategies.json`](data/strategies.json)

Money Machine is an open, public-domain project with two parts:

1. **A researched catalog of business plans.** Every entry describes who pays you, why, how the money reaches a real bank account, what can be automated, what cannot, the risks, and the evidence that people get paid. Each entry is scored and ranked.
2. **An automation framework** (`src/`) for turning the best plans into strategy modules that run from a GitHub Actions button with the fewest possible manual steps. See [`REQUIREMENTS.md`](REQUIREMENTS.md) for what a strategy module must provide.

## The rules every plan must pass

- **Legal in at least 80% of countries with relatively free internet.** The reference set is the countries Freedom House rates "Free" or "Partly Free" in _Freedom on the Net_ (see [`docs/legal/reference-countries.md`](docs/legal/reference-countries.md)). If an activity is banned in more than 20% of them, it is out. Gambling, adult content, MLM, unlicensed finance, crypto-only schemes, spam and fake engagement are excluded on this basis; the evidence is in [`docs/legal/excluded-activities.md`](docs/legal/excluded-activities.md).
- **Compliant with each platform's Terms of Service.** No fake accounts, bot farms, multi-accounting or deception.
- **A real payout path.** Setup → execute → earn → money in a bank account, with the minimum payout and typical delay stated.
- **Preferably online end to end.** Plans with an unavoidable physical step say so.
- **A resourced business plan.** Every entry states what it takes to start (hours, cash, tools, skills, accounts), the unit economics (typical price, cost, fee, margin), the break-even point, and a calibrated estimate of how likely a diligent average starter is to reach a net profit under current market conditions.

## How plans are ranked

```
priority = 10 × ( 0.25 × paymentProbability
                + 0.10 × profitLikelihoodPercent / 10
                + 0.25 × automation
                + 0.15 × (11 − ongoingEffort)
                + 0.10 × (11 − setupEffort)
                + 0.05 × incomePotential
                + 0.10 × platformAvailabilityPercent / 10 )
         − 5 if the plan needs a physical asset or presence
         − 8 if it needs $100–499 of capital, − 20 if it needs $500 or more
```

`profitLikelihoodPercent` comes from each entry's business plan: the estimated share of diligent average starters who reach a real net profit within 12 months, after fees and fixed costs. Tier S (70+, and profit odds of at least 25%) is where to start; tier C is a long shot. Scores are calibrated to be honest, not promotional: most ways to earn online have a low probability of paying an average person, and the catalog says so. Full definitions are in [`docs/methodology.md`](docs/methodology.md).

## Repository layout

```
data/strategies/<category>.json   ← the source of truth: edit these
data/strategies.json              ← merged, gated, ranked (generated)
data/countries.json               ← reference countries and payout-rail availability
docs/business-plans/              ← ranked index + one page per plan (generated)
docs/methodology.md               ← legality gate and scoring formula
docs/legal/                       ← reference countries, excluded activities, incorporation costs (generated), remote incorporation options
data/incorporation/               ← what registering a business costs in each reference country
docs/plans/roadmap.md             ← what gets built next
docs/research/                    ← background research (legal framework, platform rules)
website/                          ← handwritten site shell; pages are generated and published by CI
src/                              ← automation framework and strategy modules
scripts/build-catalog.mjs         ← regenerates everything from data/strategies/*.json
```

## Website

The site at <https://konard.github.io/money-machine/> is **built and published by GitHub Actions** (`.github/workflows/pages.yml`) on every push to `main`. The workflow installs dependencies, runs `npm run build:catalog`, runs the tests, and deploys the `website/` folder. Generated site files (`website/plans/`, `website/docs/`, `website/strategies.json`) are not committed; only the JSON sources and the handwritten shell (`index.html`, `app.js`, `styles.css`) are.

The site has: a filterable, sortable catalog with "start here" shortlists and filters for startup cash and automation; one page per plan with scores, realistic expectations, resources and business plan (startup needs, unit economics, break-even, market conditions, pricing, path to profit), payout path, full cycle, automation plan, manual steps, legality, risks, evidence and sources; and rendered copies of the methodology, reference countries, excluded activities, incorporation costs by country, remote incorporation options, platform rules and roadmap.

## Working with the catalog

```bash
npm install
npm run build:catalog   # regenerate data/strategies.json, docs/business-plans/, docs/legal/incorporation-costs.md and the website pages
npm test                # unit tests + catalog requirements (>= 100 plans, legality gate, schema)
npm run check           # lint, formatting, file size, catalog freshness
npm run website         # build and serve the website locally (same output CI publishes)
```

To add or re-score a plan, edit the JSON in `data/strategies/`, run `npm run build:catalog`, and open a pull request. Say what changed in the real world and link the source.

## Using the automation framework

```javascript
import { createMoneyMachine, GitHubSponsorsStrategy } from 'money-machine';

const machine = await createMoneyMachine({ logLevel: 'info' });
machine.strategyManager.loadStrategy(
  new GitHubSponsorsStrategy({ login: 'your-login' })
);
const result = await machine.strategyManager.executeStrategy(
  'github-sponsors',
  {
    token: process.env.GITHUB_TOKEN,
  }
);
console.log(result);
```

Works on Node.js 20+, Bun and Deno. The [architecture](docs/architecture.md) document describes the strategy manager, compliance engine, rate limiter and scheduler.

## Disclaimer

Nothing in this repository is financial, legal or tax advice. Income figures are rough ranges for a solo operator; most people earn at the low end. Platform rules change often; sources are dated and should be re-checked before relying on them. Income is taxable everywhere.

## Contributing

1. Fork and branch.
2. Edit JSON under `data/strategies/` or code under `src/`.
3. `npm run build:catalog && npm run check && npm test`
4. `npm run changeset` to describe the change.
5. Open a pull request.

## License

[Unlicense](LICENSE). Public domain.
