# Rent out a spare GPU rig on Vast.ai

**Rank #6 · Tier S · Priority score 72/100 · Category: Other**

List an idle NVIDIA GPU machine on Vast.ai's marketplace and earn per-hour rental fees from AI/ML customers.

## Scores

| Metric | Value |
| --- | --- |
| Payment probability (6 months) | 6/10 |
| Automation after setup | 9/10 |
| Setup effort (1 = trivial) | 5/10 |
| Ongoing effort (1 = none) | 2/10 |
| Income potential | 5/10 |
| AI leverage | 2/10 |
| Legal in reference countries | 100% |
| Platform pays out in reference countries | 75% |
| Capital required | $0 |
| Time to first dollar | 7–30 d |
| Typical monthly income (low / median / high) | $0 / $60 / $600 |

## Realistic expectations

Most people who try this earn around **$0–$60 per month** in the first year; the high figure of $600 is a ceiling for a focused solo operator, not a typical outcome. The chance of receiving at least one real payout within six months is rated **6/10**. Expect the first payment after 7–30 d.

## How it works

You install the Vast.ai host software on an Ubuntu machine with a modern NVIDIA GPU (RTX 3090/4090 class or better) and set hourly prices. Renters run Docker containers for AI training/inference and pay per hour; Vast takes a fee. Earnings depend on GPU demand, reliability score, bandwidth and your pricing; electricity is the main cost. RunPod's Community Cloud is closed to new hosts, so Vast is the main fiat-paying option.

**Platforms:** Vast.ai

## Resources & business plan

### What you need to start

| Resource | Amount |
| --- | --- |
| Time to launch | 12 hours |
| One-time cash | $0 |
| Recurring fixed cost | $0 / month |
| Tools | Vast.ai host software (free); Ubuntu Linux |
| Skills | Linux and Docker administration; network port forwarding and uptime monitoring |
| Equipment | NVIDIA GPU rig you already own (RTX 3090/4090 or better); stable broadband |
| Accounts | Vast.ai host account + KYC; PayPal/Wise or crypto payout per Vast options |

### How the money is made (unit economics)

| Metric | Value |
| --- | --- |
| Unit | per 100 GPU-hours rented |
| Typical price per unit (low / median / high) | $15 / $35 / $150 |
| Direct cost per unit | $8 |
| Platform fee | 25% |
| Gross margin (median case) | 52% |
| Human hours per unit after automation | 0 |

Consumer GPUs rent at ~$0.15-$0.40/hour (data-centre GPUs higher); cost = electricity (~0.5 kW x 100 h x $0.15/kWh). Vast host-side fee ~25% is estimated (not published in the Vast host payment, earnings or FAQ docs). Hardware depreciation not included.

### Break-even

| Metric | Value |
| --- | --- |
| Monthly fixed cost | $0 |
| Units per month to break even | 0 |
| Typical months to break even | 1 |
| Months to recover startup cash | 0 |

Fixed cost = recurringMonthlyUsd only (startup cash not amortised). No fixed cost if the rig already exists and runs on home internet; electricity is counted per unit.

### Market conditions (Nov 2026)

| Factor | Assessment |
| --- | --- |
| Demand trend | growing |
| Competition | high |
| Effect of AI | tailwind |
| Price pressure | falling |
| **Chance of real net profit within 12 months** (≥ $100/month where the plan can pay that much) | **45%** |
| Typical net profit at month 12 (low / median / high) | $0 / $45 / $500 |

AI demand keeps GPU rental utilisation healthy, but a 2025-2026 supply glut pushed hourly prices down sharply, especially for older cards. Profit depends on cheap electricity (US, Canada, parts of Asia) and high uptime; in Germany/UK-level electricity prices margins can go negative. Buying a GPU just to rent it rarely pays back.

### Pricing strategy

Undercut similar machines slightly to get occupancy and reliability ratings, then raise toward the market median.

### Path to profit

1. Month 0: install host software and pass verification (cost $0)
2. Month 1: first rentals; expected $20-$60
3. Month 2-6: tune pricing to keep 50%+ occupancy
4. Month 6-12: $30-$100/month net per consumer GPU

_Business-plan sources:_

- <https://docs.vast.ai/host/payment>
- <https://docs.vast.ai/host/earning>
- <https://docs.runpod.io/hosting>

## Payout path

- **Methods:** Wise, PayPal, Stripe
- **Minimum payout:** $20
- **Frequency:** weekly (invoices Fridays, paid next Friday)
- **Typical delay:** 10 days
- **Notes:** No direct bank/ACH/wire/SWIFT from Vast; balances under $20 roll forward; invoices generated Fridays, generally paid the following Friday; first payout can take up to two weeks. Hosts must be able to receive B2B payments through their chosen provider.

## Full cycle (setup → earn → bank account)

1. Prepare Ubuntu + NVIDIA drivers
2. Install Vast host daemon
3. Pass verification
4. List and price
5. Renters pay hourly
6. Weekly payout to Wise/PayPal -> bank

## What can be automated

- Auto-pricing script against market rates
- Uptime monitoring and auto-restart
- Automated driver/host updates

## Unavoidable manual steps

- Hardware setup and Ubuntu install
- Payout provider KYC
- Hardware repairs

## Legality & compliance

Renting your own hardware's compute is legal; check residential electricity/ISP terms and local business registration.

- **Compliance requirements:** ISP terms allowing hosting; tax reporting; payout-provider KYC
- **Platform availability:** Hosting is open globally; payout depends on Wise/PayPal/Stripe support in your country. capitalRequiredUsd assumes you already own the GPU.

## Risks

- Electricity may exceed earnings for older GPUs
- Hardware wear
- Demand/price swings
- Need good upload bandwidth

## Evidence that people get paid

Vast.ai official host docs document the $20 minimum and weekly payouts; Vast publishes host-earnings articles; hosts report earnings on forums.

## Sources

- <https://docs.vast.ai/host/payment>
- <https://docs.vast.ai/host/earning>
- <https://docs.runpod.io/hosting>

_Tags: passive, hardware, compute_

---

_Generated from `data/strategies/licensing.json` by `npm run build:catalog`. Edit the JSON, not this file._
