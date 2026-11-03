# Twitch Extensions monetized with Bits

**Rank #149 · Tier C · Priority score 49/100 · Category: Digital products**

Build interactive Twitch Extensions (polls, viewer games, overlays) where viewers spend Bits on actions; the developer gets a share of the Bits revenue.

## Scores

| Metric | Value |
| --- | --- |
| Payment probability (6 months) | 2/10 |
| Automation after setup | 7/10 |
| Setup effort (1 = trivial) | 6/10 |
| Ongoing effort (1 = none) | 3/10 |
| Income potential | 4/10 |
| AI leverage | 7/10 |
| Legal in reference countries | 100% |
| Platform pays out in reference countries | 75% |
| Capital required | $0 |
| Time to first dollar | 60–365 d |
| Typical monthly income (low / median / high) | $0 / $0 / $3,000 |

## Realistic expectations

Most people who try this earn around **$0–$0 per month** in the first year; the high figure of $3,000 is a ceiling for a focused solo operator, not a typical outcome. The chance of receiving at least one real payout within six months is rated **2/10**. Expect the first payment after 60–365 d.

## How it works

Build a panel/overlay Extension with Bits products (1-10,000 Bits), such as triggering on-stream effects or viewer mini-games. Twitch splits Bits revenue 80% to the broadcaster and 20% to the developer. You get paid after completing Twitch's monetization onboarding (tax interviews and financial details). You earn only if many streamers install it.

**Platforms:** Twitch Extensions, Twitch Bits

## Resources & business plan

### What you need to start

| Resource | Amount |
| --- | --- |
| Time to launch | 100 hours |
| One-time cash | $0 |
| Recurring fixed cost | $0 / month |
| Tools | Twitch Extensions developer rig; free-tier backend hosting; coding agent |
| Skills | web development (HTML/JS); backend service for extension; Twitch API |
| Equipment | PC |
| Accounts | Twitch developer account; Twitch monetization onboarding (tax + payout) |

### How the money is made (unit economics)

| Metric | Value |
| --- | --- |
| Unit | per 10,000 Bits spent in your extension |
| Typical price per unit (low / median / high) | $20 / $20 / $20 |
| Direct cost per unit | $0 |
| Platform fee | 0% |
| Gross margin (median case) | 100% |
| Human hours per unit after automation | 1 |

Viewers pay about $1.40 per 100 Bits; Twitch credits $0.01 per Bit, and the Twitch Developer Services Agreement pays the developer 20% of $0.01 per Bit ($20 per 10k Bits).

### Break-even

| Metric | Value |
| --- | --- |
| Monthly fixed cost | $0 |
| Units per month to break even | 0 |
| Typical months to break even | 12 |
| Months to recover startup cash | 0 |

No fixed monthly cost. No cash outlay; meaningful income needs many installing streamers.

### Market conditions (Nov 2026)

| Factor | Assessment |
| --- | --- |
| Demand trend | stable |
| Competition | medium |
| Effect of AI | tailwind |
| Price pressure | stable |
| **Chance of real net profit within 12 months** (≥ $100/month where the plan can pay that much) | **2%** |
| Typical net profit at month 12 (low / median / high) | $0 / $0 / $2,500 |

Very few extensions earn meaningful Bits; streamers rely on a handful of popular overlays. Failure modes: no installs and low Bits usage.

### Pricing strategy

Price Bits products low (50-100 Bits) to encourage viewer use.

### Path to profit

1. Month 0-3: build and pass review (cost $0)
2. Month 3-6: recruit streamers; little revenue
3. Month 6-12: most earn $0

_Business-plan sources:_

- <https://dev.twitch.tv/docs/extensions/monetization/>
- <https://blog.twitch.tv/en/2018/04/23/the-next-big-update-for-extensions-is-here-a036151cc309/>

## Payout path

- **Methods:** Twitch payout by check or EFT (bank) as Twitch chooses
- **Minimum payout:** $100 (Payment Threshold in the Twitch Developer Services Agreement)
- **Frequency:** monthly
- **Typical delay:** 45 days
- **Notes:** Twitch Developer Services Agreement (read in a browser Nov 2026): for each eligible Bit used in your extension you receive a Bits Fee of 20% of one US cent ($0.002 per Bit, i.e. $20 per 10,000 Bits); paid about 45 days after the end of the calendar month in which the Bits were used, by check, EFT or other methods Twitch chooses; payments accrue until they reach the $100 Payment Threshold. Twitch may claw back the Bits Fee on refunds, withhold fees for 3 months after termination, and fees unclaimed for 180 days (missing payment/tax info) are forfeited month by month. The developer docs recommend choosing 'Hold My Payments' during onboarding.

## Full cycle (setup → earn → bank account)

1. Build extension
2. Pass Twitch review
3. Enable Bits products
4. Get streamers to install
5. Monthly payout

## What can be automated

- Use AI coding agents to build the extension front end and EBS backend
- Serverless hosting with automatic scaling
- Automated outreach and onboarding docs for streamers

## Unavoidable manual steps

- Monetization onboarding (tax, ID)
- Extension review submission
- Recruiting streamers to install

## Legality & compliance

Legal. No chance-based paid mechanics (loot boxes, gambling). Must check the isBitsEnabled flag and follow Twitch Extension guidelines and review.

- **Compliance requirements:** Twitch developer account and extension review; tax interviews and identity verification; Twitch Developer Agreement
- **Platform availability:** Bits work only on channels that can receive Bits. Developer payout countries are not listed on the docs. Estimate unverified.

## Risks

- Very low adoption for most extensions
- Twitch policy and API changes
- Extension reviews have been paused before

## Evidence that people get paid

Official Twitch developer docs (fetched 2026-11) describe Bits in Extensions, revenue sharing with developers and the onboarding flow; Twitch's 2018 launch post gives the 20% developer share. Widely installed extensions show the model works at the top end, but most extensions earn little.

## Sources

- <https://dev.twitch.tv/docs/extensions/monetization/>
- <https://dev.twitch.tv/docs/extensions/bits/>
- <https://blog.twitch.tv/en/2018/04/23/the-next-big-update-for-extensions-is-here-a036151cc309/>
- <https://blog.twitch.tv/en/2022/07/12/coming-soon-a-lower-payout-minimum/>
- <https://legal.twitch.com/legal/developer-agreement/>

_Tags: games, streaming, developer, low-probability_

---

_Generated from `data/strategies/games-virtual-worlds.json` by `npm run build:catalog`. Edit the JSON, not this file._
