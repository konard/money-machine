# Rent spare disk space and bandwidth as a Storj storage node

**Rank #11 · Tier A · Priority score 69/100 · Category: Other**

Run a Storj storage node on a spare hard drive and earn monthly USDC stablecoin payouts for stored data and egress; convert to fiat via an exchange.

## Scores

| Metric | Value |
| --- | --- |
| Payment probability (6 months) | 4/10 |
| Automation after setup | 9/10 |
| Setup effort (1 = trivial) | 3/10 |
| Ongoing effort (1 = none) | 1/10 |
| Income potential | 1/10 |
| AI leverage | 1/10 |
| Legal in reference countries | 86% |
| Platform pays out in reference countries | 80% |
| Capital required | $0 |
| Time to first dollar | 35–120 d |
| Typical monthly income (low / median / high) | $1 / $8 / $40 |

## Realistic expectations

Most people who try this earn around **$1–$8 per month** in the first year; the high figure of $40 is a ceiling for a focused solo operator, not a typical outcome. The chance of receiving at least one real payout within six months is rated **4/10**. Expect the first payment after 35–120 d.

## How it works

Storj's decentralized S3-compatible cloud pays node operators for disk space used and download bandwidth. You run the node (Docker) on an always-on machine with a 1TB+ drive and open port. Earnings are calculated in USD and paid monthly in USDC on Ethereum (Storj no longer pays in STORJ tokens); the zkSync L2 option was sunset on 1 Sep 2026, so all payouts go via Ethereum L1 and are only sent when the gas fee is under 25% of the amount. New nodes have part of earnings held back during the first months. Sia (hostd) requires Siacoin collateral, a buy-in; prefer Storj.

**Platforms:** Storj, Sia (alternative)

## Resources & business plan

### What you need to start

| Resource | Amount |
| --- | --- |
| Time to launch | 6 hours |
| One-time cash | $0 |
| Recurring fixed cost | $2 / month |
| Tools | Storj node software (free); Docker |
| Skills | basic Linux/Docker; port forwarding and keeping the node online 99%+ |
| Equipment | always-on PC or Raspberry Pi; spare HDD (2 TB+); broadband |
| Accounts | Ethereum/USDC wallet; regulated crypto exchange account to convert to fiat |

### How the money is made (unit economics)

| Metric | Value |
| --- | --- |
| Unit | per TB stored per month |
| Typical price per unit (low / median / high) | $1 / $1 / $3 |
| Direct cost per unit | $0 |
| Platform fee | 5% |
| Gross margin (median case) | 95% |
| Human hours per unit after automation | 0 |

Storj pays $1.35 per TB-month stored and $1.00 per TB egress (rates as of 1 Sep 2026); with typical egress ~$1.5/TB-month blended, rounded to $1 median. Fee = estimated exchange/withdrawal costs; Ethereum gas can delay payouts.

### Break-even

| Metric | Value |
| --- | --- |
| Monthly fixed cost | $2 |
| Units per month to break even | 3 |
| Typical months to break even | 6 |
| Months to recover startup cash | 0 |

Fixed cost = recurringMonthlyUsd only (startup cash not amortised). Fixed cost = electricity for an always-on low-power box (~$2/month); a new node fills slowly (vetting takes months).

### Market conditions (Nov 2026)

| Factor | Assessment |
| --- | --- |
| Demand trend | stable |
| Competition | high |
| Effect of AI | neutral |
| Price pressure | falling |
| **Chance of real net profit within 12 months** (≥ $100/month where the plan can pay that much) | **50%** |
| Typical net profit at month 12 (low / median / high) | $-2 / $5 / $35 |

Storj reduced node payouts in 2024 and a new node fills only ~0.5-1 TB per year, so income is a few dollars a month. It is only worth it on hardware that is already running; buying drives to farm never pays back. Crypto conversion adds friction. Verifier: median price per TB-month lowered from $2 to $1 to match the published $1.35/TB storage rate.

### Pricing strategy

Not priced by you; maximise uptime and stored data, and pool nodes on one wallet to clear the payout threshold.

### Path to profit

1. Month 0: set up node on an existing drive (cost $0)
2. Month 1-6: vetting; payouts below threshold roll over
3. Month 6-12: $2-$8/month as the node fills
4. Month 12+: convert USDC to fiat once a year to minimise fees

_Business-plan sources:_

- <https://storj.dev/node/payouts>
- <https://forum.storj.io/t/february-and-first-batch-of-zksync-payments-complete/12138>

## Payout path

- **Methods:** USDC (Ethereum L1) -> exchange -> bank
- **Minimum payout:** Dynamic: payout skipped if gas fee exceeds 25% of amount (e.g. $68.56 minimum at a $17.14 fee)
- **Frequency:** monthly
- **Typical delay:** 40 days
- **Notes:** Unpaid balances roll over to the next month. zkSync payouts ended 1 Sep 2026. Fiat conversion requires a regulated exchange in your country; pooling all your nodes on one wallet helps clear the threshold.

## Full cycle (setup → earn → bank account)

1. Set up node + Ethereum wallet
2. Vetting period
3. Earn monthly (USD-denominated)
4. Receive USDC once above gas threshold
5. Sell on exchange
6. Withdraw to bank

## What can be automated

- Docker auto-update (watchtower)
- Uptime monitoring/alerts
- Scheduled USDC-to-fiat conversion

## Unavoidable manual steps

- Port forwarding/setup
- Exchange KYC

## Legality & compliance

Running the node is legal everywhere; receiving and converting crypto (including stablecoins) is banned or effectively prohibited in about 6-7 reference countries, giving ~86% coverage. Ecuador, Jordan and Lebanon restrict crypto as payment/banking but do not ban holding it. Country legal status is from general knowledge, not re-verified this session.

- **Restricted or banned in:** Bangladesh, Nepal, Iraq, Libya, Tunisia, Morocco (2017 crypto ban still formally in force), Angola (2024 crypto-mining ban; applicability to storage nodes unclear)
- **Compliance requirements:** crypto tax reporting; exchange KYC; ISP terms allowing hosting
- **Platform availability:** Nodes work anywhere with stable internet; fiat off-ramp needed.

## Risks

- Very low income per TB
- L1 gas threshold can delay small payouts for months
- Escrow held from new nodes
- Disk failure disqualifies node

## Evidence that people get paid

Storj's official node payout docs (storj.dev) describe monthly USDC payouts, the 25% gas-fee threshold rule and the zkSync sunset. paymentProbability lowered from 5 to 4 because small nodes may need several months to clear the L1 threshold.

## Sources

- <https://storj.dev/node/payouts>
- <https://forum.storj.io/t/february-and-first-batch-of-zksync-payments-complete/12138>

_Tags: passive, crypto, hardware_

---

_Generated from `data/strategies/licensing.json` by `npm run build:catalog`. Edit the JSON, not this file._
