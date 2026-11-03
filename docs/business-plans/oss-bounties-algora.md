# Paid open-source bounties (Algora, Opire, Gitcoin)

**Rank #175 · Tier C · Priority score 46/100 · Category: Software & developer monetization**

Solve GitHub issues that companies have attached cash bounties to and get paid when the PR is merged.

## Scores

| Metric | Value |
| --- | --- |
| Payment probability (6 months) | 3/10 |
| Automation after setup | 5/10 |
| Setup effort (1 = trivial) | 2/10 |
| Ongoing effort (1 = none) | 6/10 |
| Income potential | 5/10 |
| AI leverage | 8/10 |
| Legal in reference countries | 96% |
| Platform pays out in reference countries | 65% |
| Capital required | $0 |
| Time to first dollar | 7–120 d |
| Typical monthly income (low / median / high) | $0 / $150 / $3,000 |

## Realistic expectations

Most people who try this earn around **$0–$150 per month** in the first year; the high figure of $3,000 is a ceiling for a focused solo operator, not a typical outcome. The chance of receiving at least one real payout within six months is rated **3/10**. Expect the first payment after 7–120 d.

## How it works

Companies and maintainers post bounties ($50-$5,000+) on GitHub issues via Algora and similar platforms. You (often assisted by an AI coding agent) claim the issue, submit a quality PR, and once merged the bounty is paid out. Payers are funded OSS companies wanting features/fixes. Competition is fierce on popular bounties, and spammy AI PRs get banned, so quality and communication matter. Gitcoin-style bounties pay in crypto and are less relevant now.

**Platforms:** Algora, Opire, Gitcoin (crypto)

## Resources & business plan

### What you need to start

| Resource | Amount |
| --- | --- |
| Time to launch | 10 hours |
| One-time cash | $0 |
| Recurring fixed cost | $20 / month |
| Tools | Algora / Opire accounts (free); AI coding agent subscription (~$20/mo); GitHub |
| Skills | read and modify unfamiliar codebases; write tests and clean PRs; communicate with maintainers (AI assists but cannot replace review quality) |
| Equipment | laptop or desktop; stable internet |
| Accounts | GitHub account; Algora account + Stripe Connect KYC; PayPal/Wise for other platforms |

### How the money is made (unit economics)

| Metric | Value |
| --- | --- |
| Unit | per merged bounty |
| Typical price per unit (low / median / high) | $50 / $200 / $2,000 |
| Direct cost per unit | $10 |
| Platform fee | 0% |
| Gross margin (median case) | 95% |
| Human hours per unit after automation | 8 |

Algora bounties typically range $50-$500 with occasional $1k-$5k items; payer pays the platform fee; cost is AI-agent credits per attempt (estimate).

### Break-even

| Metric | Value |
| --- | --- |
| Monthly fixed cost | $20 |
| Units per month to break even | 1 |
| Typical months to break even | 3 |
| Months to recover startup cash | 0 |

Fixed cost = recurringMonthlyUsd only (startup cash not amortised). One median bounty a month covers the AI subscription; unpaid attempts (PRs not merged) are the real cost and are not counted here.

### Market conditions (Nov 2026)

| Factor | Assessment |
| --- | --- |
| Demand trend | stable |
| Competition | saturated |
| Effect of AI | headwind |
| Price pressure | falling |
| **Chance of real net profit within 12 months** (≥ $100/month where the plan can pay that much) | **5%** |
| Typical net profit at month 12 (low / median / high) | $-20 / $30 / $1,500 |

Winners are experienced contributors who specialise in one or two codebases and get assigned bounties before posting PRs. Since 2025 AI agents let anyone file a PR in minutes, so popular bounties get dozens of attempts and maintainers increasingly ban low-quality AI PRs or close bounty programs. Failure mode: many hours of unpaid work on PRs that lose the race.

### Pricing strategy

Not price-set by you: target $100-$500 bounties in a stack you know, comment with a plan before coding, and build reputation so maintainers assign you work directly or offer paid contracts.

### Path to profit

1. Month 0: set up accounts and pick 2-3 repositories you can learn deeply (cost $0-$20)
2. Month 1-2: fix small issues to build reputation; first bounty expected $0-$200
3. Month 3-6: claim 1-2 bounties/month in the same codebases; expected $100-$400/month
4. Month 6-12: convert maintainer relationships into retainers or contract work

_Business-plan sources:_

- <https://algora.io/>
- <https://github.com/algora-io/algora>
- <https://opire.dev/>

## Payout path

- **Methods:** Stripe Connect -> bank
- **Minimum payout:** No minimum per bounty
- **Frequency:** per bounty
- **Typical delay:** 5 days
- **Notes:** Algora fee/timing figures (payer pays fee on top; contributor gets 100% in ~1-8 business days) could not be re-confirmed: algora.io/docs/payments and algora.io/pricing return 404 and the algora.io homepage now markets hiring/recruiting. Replit Bounties is discontinued (replit.com/bounties redirects to Contra). IssueHunt has pivoted to a Japanese security bug-bounty platform and is no longer an OSS issue-bounty site.

## Full cycle (setup → earn → bank account)

1. Sign up on Algora with GitHub
2. Connect Stripe
3. Find bounty
4. Claim and submit PR
5. PR merged
6. Bounty paid to Stripe
7. Payout to bank

## What can be automated

- Watch Algora/GitHub bounty labels via API and rank by value vs. difficulty
- AI coding agent drafts fixes and tests
- Automated CI checks before submission

## Unavoidable manual steps

- Claiming issues and communicating with maintainers
- Human review of PR quality
- Stripe onboarding

## Legality & compliance

Fiat bounties are ordinary contractor income. Crypto-paid bounties (Gitcoin) are restricted where crypto is banned.

- **Restricted or banned in:** Bangladesh (crypto-paid bounties only), Nepal (crypto-paid bounties only)
- **Compliance requirements:** Stripe KYC; contractor tax reporting
- **Platform availability:** Algora pays through Stripe Connect including cross-border payouts; some countries without Stripe payout support cannot receive.

## Risks

- Competition and duplicate claims
- Low-quality AI PRs lead to bans
- Unpaid work if PR rejected
- Bounty platforms keep closing or pivoting (Replit Bounties closed; IssueHunt pivoted; Algora now recruiting-first)

## Evidence that people get paid

Algora's open-source repo (github.com/algora-io/algora) still describes a GitHub app for bounties and tips with a Stripe-based payout processor, and public GitHub issues show /bounty and /claim payouts. Payment probability lowered from 5 to 3: Algora's public pricing/docs pages are gone and its homepage now leads with recruiting, Replit Bounties closed, IssueHunt left OSS bounties, and popular bounties draw many competing (often AI) PRs.

## Sources

- <https://github.com/algora-io/algora>
- <https://algora.io/>
- <https://opire.dev/>
- <https://issuehunt.io/>

_Tags: bounties, developer, ai-assisted, per-task_

---

_Generated from `data/strategies/software.json` by `npm run build:catalog`. Edit the JSON, not this file._
