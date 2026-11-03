# Platform Rules and Terms of Service Database

This document is the reference for the platform rules that the money-machine must respect. All automation must follow these rules so that operation stays legal and sustainable.

**Scope.** It covers every platform that appears in two or more strategies of the catalog (`data/strategies/*.json`), plus every platform used by a tier-S or tier-A strategy. Platforms used by a single lower-tier strategy are listed one per line under **Other catalog platforms** at the end of each category. Platforms are grouped by catalog category, in the catalog's order. Payout, legality and availability facts come from the catalog fields `payout.*`, `legality.*`, `availability.*` and `sources`. Where an official page was checked (November 2026), the entry says "(verified)". Anything else is a catalog figure or a widely published policy, and it must be re-checked against the linked policy before money depends on it. Where the catalog itself marks a figure as estimated or unverified, this file says so.

**Field legend.**

- **Policy**: the official ToS or policy page.
- **Automate**: what may be automated.
- **Human**: what a human must do.
- **AI**: rules on AI-generated content and how to disclose it.
- **Accounts**: identity and multi-account rules.
- **Payout**: minimum, method and countries.
- **API**: official API and its rate limits.

## General Principles

1. **Authenticity**: Never impersonate humans when acting as a bot
2. **Rate Limiting**: Respect all rate limits and fair use policies
3. **Spam Prevention**: Never send unsolicited bulk messages
4. **Value Creation**: Focus on providing genuine value
5. **Transparency**: Disclose bot/automation status when required
6. **Data Privacy**: Respect user privacy and data protection laws

## Cross-Platform Rules

These rules repeat across almost every platform below, so they are stated once here.

- **KYC is always human.** Every platform that pays out needs identity verification, a tax form (W-8BEN/W-9 or a local equivalent) and payout-account linking. A real person does these steps once. The bot must never automate account creation.
- **One real identity per account.** Self-referrals, duplicate accounts and accounts made to evade a ban break the terms of every cashback, referral, bonus, freelancing and contributor program in this file.
- **AI disclosure is now a platform rule, not just good practice.** Disclosure is required by Adobe Stock, Freepik, KDP, Etsy, YouTube (realistic synthetic media), Meta, TikTok, Spotify/DDEX credits, Fiverr and end-user chatbots (EU AI Act transparency). Shutterstock, Pond5 and ACX refuse unauthorized AI content outright.
- **Scaled thin content is penalized.** Google spam policies (scaled content abuse), AdSense, YouTube "inauthentic content" and Pinterest spam rules all target mass-produced, low-value output. Gate every published item behind a human or rubric QA step.
- **Advertising disclosure.** Affiliate links and sponsored content need FTC (US), CAP/ASA (UK) or equivalent labels on every post.
- **Generic channels are not separate platforms.** The catalog also lists direct clients, own sites, email newsletters, direct sponsors and self-hosted directory software. Their rules come from the payment rail (Stripe, Wise, PayPal) and the Legal Frameworks section.
- **Payout rails decide country coverage.** The common limits are Stripe (about 46 countries), Stripe Connect, PayPal receiving (unavailable in Bangladesh, Sri Lanka, Lebanon, Libya, Iraq and a few others) and Payoneer/Wise (broadest coverage).

### AI Content Quick Reference

| Platform                  | AI-generated content                                                        | Disclosure mechanism                         |
| ------------------------- | --------------------------------------------------------------------------- | -------------------------------------------- |
| Adobe Stock               | Allowed                                                                     | "Created using generative AI tools" checkbox |
| Freepik                   | Allowed                                                                     | AI flag at upload                            |
| Shutterstock              | Not accepted from contributors (verified)                                   | n/a                                          |
| Pond5                     | Restricted; catalog says AI uploads lead to account termination             | n/a                                          |
| Amazon KDP                | Allowed; AI-generated must be disclosed, AI-assisted need not be (verified) | Question at title setup                      |
| ACX (Audible)             | Unauthorized TTS/AI narration prohibited (verified)                         | n/a                                          |
| Google Play Books         | Auto-narration offered by Google                                            | Labelled by Google                           |
| Etsy                      | Allowed under "Designed by" with disclosure                                 | Listing description / Creativity Standards   |
| YouTube                   | Allowed; realistic synthetic media must be disclosed (verified)             | "AI use" attribute in YouTube Studio         |
| Meta (Facebook/Instagram) | Allowed; photorealistic AI must be labelled                                 | "AI info" label                              |
| TikTok                    | Allowed; must be labelled                                                   | AIGC label                                   |
| Spotify / DSPs            | Allowed; spam, impersonation and voice clones of real artists banned        | DDEX AI credits via distributor              |
| Envato (AudioJungle)      | AI-primary music banned (catalog)                                           | n/a                                          |
| Fiverr                    | Allowed under Fiverr AI standards; no voice cloning without consent         | Disclose to buyer                            |
| Chatbots for clients      | Allowed                                                                     | Tell end users they are talking to an AI     |

## Finance & Capital-Light Arbitrage

Shared rules: KYC and bank linking are human steps. Automation is limited to monitoring rates and offers, sweeping balances and reminding about deadlines. The bot must never open accounts or move money without a human approval rule. Rewards and interest are taxable in most countries.

### Savings, Money-Market Funds and Government Bills

Used by `high-yield-savings-mmf-tbills` (S).

| Platform                                               | Policy                                                               | Notes                                                                                          |
| ------------------------------------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Online banks (Marcus, Ally, Chase UK, Trade Republic)  | Each bank's account terms                                            | One customer per identity; stay under deposit-insurance limits per bank                        |
| TreasuryDirect                                         | https://www.treasurydirect.gov/marketable-securities/treasury-bills/ | US persons only; auto-reinvest is built in, so no scripting is needed                          |
| Tesouro Direto                                         | https://www.tesourodireto.com.br/                                    | Brazilian CPF required                                                                         |
| Vanguard / Fidelity MMFs                               | Fund prospectus and brokerage terms                                  | Sweep rules set in the account; no public trading API for retail                               |
| Local T-bill auctions (e.g. Nigeria, Kenya, Singapore) | Central bank / MAS auction rules                                     | Local residency and a custodian or bank account; high local yields carry FX and inflation risk |

- **Payout**: interest is credited monthly; bills pay at maturity (4-52 weeks). No minimum.
- **Legality**: legal everywhere. Islamic equivalents are profit-sharing deposits and sukuk.

### Robo-Advisors

Used by `robo-advisor-index-dividends` (S). The catalog marks foreign platforms as restricted in Bangladesh, Nepal, Tunisia, Morocco, Libya and Iraq (capital controls). Use local index funds there.

| Platform         | Policy                            | Coverage (catalog)                |
| ---------------- | --------------------------------- | --------------------------------- |
| Betterment       | https://www.betterment.com/legal  | US                                |
| Wealthfront      | https://www.wealthfront.com/legal | US                                |
| Nutmeg           | https://www.nutmeg.com/legal      | UK                                |
| Scalable Capital | https://scalable.capital/en/legal | EU                                |
| StashAway        | https://www.stashaway.sg/         | SG, MY and others                 |
| Syfe             | https://www.syfe.com/             | SG, AU                            |
| Wahed            | https://www.wahed.com/            | Several Muslim-majority countries |

- **Human**: KYC and the suitability questionnaire must be answered truthfully by the account holder.
- **Payout**: dividends are paid quarterly. Withdrawals take 2-5 days, and some platforms set a $1-$100 minimum withdrawal.

### Bank Account Sign-Up Bonuses

Used by `bank-account-signup-bonuses` (A). This covers Chase, Wells Fargo and SoFi (US), UK CASS switching offers, Canada's big-5 banks and German direct banks. Offers are tracked through Doctor of Credit (https://www.doctorofcredit.com/best-bank-account-bonuses/) and MoneySavingExpert, which are information sources, not counterparties.

- **Accounts**: one bonus per person per offer. Many banks limit eligibility to once every 12-24 months and claw back the bonus if the account closes within about 6 months.
- **Human**: account opening, payroll or direct-deposit changes, and closing accounts after the hold period.
- **Automate**: offer tracking, calendar reminders for deposit and hold deadlines.
- **Payout**: a fixed $100-$900 is credited to the new account 30-120 days after the requirements are met. Offers exist mainly in the US, UK, Canada, Germany and Australia. A local residence and address are required.

### Brokerage Sign-Up and Transfer Bonuses

Used by `brokerage-signup-transfer-bonuses` (A) and `fintech-referral-bonuses` (A, IBKR).

| Platform            | Policy                                                        | Notes (catalog)                                    |
| ------------------- | ------------------------------------------------------------- | -------------------------------------------------- |
| Robinhood           | https://robinhood.com/ (legal disclosures)                    | US; free-share promos                              |
| Webull              | https://www.webull.com/policy                                 | US and Asia; transfer matches have holding periods |
| moomoo              | https://www.moomoo.com/                                       | US, SG, AU, MY, JP, CA                             |
| Tiger Brokers       | https://www.tigerbrokers.com.sg/                              | SG, AU, NZ, HK                                     |
| Trading 212         | https://www.trading212.com/                                   | UK, EU                                             |
| Public.com          | https://public.com/disclosures                                | US                                                 |
| Interactive Brokers | https://www.interactivebrokers.co.uk/en/accounts/referrer.php | Referral program excludes Japan, Spain and Israel  |

- **Accounts**: one per person. Free shares are often locked for 2-30 days. Transfer matches may require holding for 1-5 years or are clawed back.
- **API**: IBKR offers a trading API, but bonuses do not require trading automation. Do not run wash trades to meet requirements.
- **Payout**: sell the shares and withdraw to a bank. Free shares are taxable at receipt. Non-US residents file a W-8BEN.

### Cashback Portals

Used by `cashback-portals` (S).

| Platform    | Policy                                                                 | Minimum payout (catalog)                                               | Region          |
| ----------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------- |
| Rakuten     | https://www.rakuten.com/help/article/when-will-i-get-paid-360002117667 | US $5, paid quarterly (15 Feb/May/Aug/Nov); smaller balances roll over | US, CA, JP, FR  |
| TopCashback | https://www.topcashback.com/help/receive-cash-back/                    | No stated minimum, on demand once confirmed                            | US, UK          |
| Quidco      | https://www.quidco.com/                                                | Not in catalog                                                         | UK              |
| iGraal      | https://www.igraal.com/                                                | Not in catalog                                                         | FR, DE          |
| ShopBack    | https://www.shopback.com/                                              | ~S$10 (unverified)                                                     | SEA, AU, KR, TW |
| Cashrewards | https://www.cashrewards.com.au/                                        | Not in catalog                                                         | AU              |

- **Accounts**: one account per person (often per household). No self-referrals or fake referrals.
- **Automate**: price and rate comparison, and pending-cashback tracking. Do not script purchases or browser extensions that click affiliate links without a real purchase intent, because portals treat that as cookie stuffing.
- **Payout**: PayPal, ACH/bank, check or gift cards. Cashback stays pending for 30-90 days until the merchant confirms it.

### Other catalog platforms

One line each, with the catalog's figures. Check the source before relying on a figure.

- **US card issuers (Chase, Amex, Capital One, Citi) and UK Amex/Barclaycard** (`credit-card-signup-rewards`): a fixed bonus after a minimum spend, paid as statement credit, bank deposit or points about 90 days after approval (estimated). Source: https://www.doctorofcredit.com/best-current-credit-card-sign-up-bonuses/
- **Royalty Exchange** (`royalty-stream-trading`): auction proceeds by ACH or wire; buyers fund escrow within two business days of signing; investor distributions are quarterly with no stated minimum; investor-side fees are not published (unverified). Source: https://royaltyexchange.com/how-auctions-work-sellers
- **SongVest** (`royalty-stream-trading`): fees are only in its Offering Circular, not on the FAQ (unverified). Source: https://www.songvest.com/

## Other

### Salad (idle PC compute)

Used by `salad-idle-pc-compute` (S).

- **Policy**: https://salad.com/terms. Rewards help: https://support.salad.com/rewards/redeeming-your-rewards/how-to-redeem-paypal
- **Automate**: the desktop client runs unattended. Run it only on hardware you own and pay the electricity for.
- **Accounts**: one account per person. Do not farm with VMs or rented machines.
- **Payout**: PayPal rewards in supported countries arrive within about 24 hours, at small storefront denominations. Elsewhere only gift cards are available, which fails the bank-path rule. The exact PayPal minimum is unverified in the catalog.

### Vast.ai (GPU rental)

Used by `rent-gpu-vast-ai` (S).

- **Policy**: https://vast.ai/terms. Host payments: https://docs.vast.ai/host/payment
- **Automate**: pricing and availability, machine health monitoring.
- **Human**: hardware setup and repairs, payout-provider KYC. Check that your ISP and electricity terms allow hosting.
- **Payout (verified)**: Wise, PayPal or Stripe; no direct bank, ACH or wire. The minimum is $20. Invoices are generated on Fridays and paid the following Friday. The first payout can take up to two weeks. The catalog models a host fee of about 25% (estimated).

### Storj (and Sia)

Used by `rent-storage-storj-node` (S).

- **Policy**: https://www.storj.io/legal (node operator terms)
- **Automate**: the node runs unattended. Monitor uptime, because downtime disqualifies the node.
- **Accounts**: one identity per node. Running many nodes behind one IP subnet does not increase traffic and may break the terms.
- **Payout (catalog, https://storj.dev/node/payouts)**: paid monthly in USDC on Ethereum L1; zkSync payouts ended on 1 September 2026. A payout is skipped, and rolls over, while gas would exceed 25% of the amount (for example a $68.56 minimum at a $17.14 fee). Rates are $1.35 per TB-month stored and $1 per TB of egress. A regulated exchange is needed to reach a bank. Receiving crypto is banned or restricted in Bangladesh, Nepal, Morocco, Iraq, Libya, Tunisia and Angola, and restricted in Ecuador, Jordan and Lebanon.

### Afternic (GoDaddy) and Dan.com

Used by `domain-lease-to-own` (A) and `domain-flipping-parking` (B, which also covers GoDaddy Auctions).

- **Policy**: https://www.afternic.com/. Dan.com is being shut down and its sellers migrated to Afternic: https://news.dan.com/240812-seller-migration-faqs
- **Automate**: portfolio listing, pricing and renewal decisions with a rules engine, and trademark screening before purchase.
- **Human**: purchase budget, negotiation, KYC.
- **Rules**: avoid names that contain trademarks, which is cybersquatting under UDRP/ACPA.
- **Payout (catalog, https://help.afternic.com/s/article/Supported-payment-methods-and-fees)**: monthly, as lease-to-own installments arrive. Minimums are PayPal $25, ACH $10 ($0.90 fee), eCheck $25 and wire $25. Commission is 25% (30% with Boost), or 15-20% with GoDaddy nameservers, with a $15 minimum; lease-to-own terms get up to 15% off. Sedo charges 10% (parked Buy Now), 15% (offers and auctions) or 20% (SedoMLS partners). Atom (marketplace) and NameBio (sales comps) are listed in the catalog without fee figures.

### Other catalog platforms

One line each, with the catalog's figures. Check the source before relying on a figure.

- **Airbnb** (`rent-room-airbnb`): split-fee hosts pay 3% (4% in Brazil and Mexico); the host-only fee is about 15.5%. No minimum; payout starts the business day after check-in and takes 30 minutes (Fast Pay) to 3-7 days (wire). Methods: bank, ACH, PayPal, Payoneer, wire, Western Union. Booking.com is listed as an alternative without figures. Source: https://www.airbnb.com/help/article/425
- **Turo** (`rent-car-turo`): US hosts keep 60-90% depending on the protection plan; paid per trip through Stripe to a bank, at most one payout a day, no minimum. Getaround is listed as an alternative without figures. Source: https://help.turo.com/en_us/getting-paid-SyALrVeN9
- **Neighbor** (`rent-parking-storage-space`): 4.9% + $0.30 processing per host payout; paid through Stripe at the end of each rental period, arriving in 2-3 business days, no minimum. JustPark, Spacer and Stashbee are listed as alternatives without figures. Source: https://help.neighbor.com/en_us/how-do-payouts-work-as-a-host-HJkBDAICu
- **EthicalAds** (`direct-ad-space-dev-sites`): publishers get 70%; $50 minimum, paid monthly by the 15th via Stripe Connect, PayPal, Open Collective or GitHub Sponsors. BuySellAds/Carbon is application-only and does not publish its share. Source: https://www.ethicalads.io/publisher-policy/
- **MissingMoney.com, state unclaimed-property sites, My Lost Account (UK), ASIC MoneySmart (AU) and Bank of Canada unclaimed balances** (`recover-money-you-are-owed`): free official searches; claims pay by bank transfer or cheque, about 45 days per claim (estimated). Settlement lists such as ClassAction.org are information sources. Source: https://www.missingmoney.com/

## Data & Security Work

### Honeygain and Pawns.app (bandwidth sharing)

Used by `bandwidth-sharing` (S).

- **Policy**: https://www.honeygain.com/terms-of-use/ and https://pawns.app/ (terms of service)
- **Automate**: the app runs unattended on devices you own.
- **Human**: check your ISP terms, many of which forbid reselling bandwidth. Do not run the app on employer, shared or metered networks, or through a VPN or proxy.
- **Accounts**: one account per person. Running it on multiple devices you own is permitted.
- **Payout (Honeygain, verified)**: the minimum is $20 (20,000 credits), paid to PayPal in USD or to JumpTask for gift cards or crypto. Earnings are void after 6 months without sharing or payouts, and earnings above the threshold expire after 24 months. Pawns.app pays from $5 by PayPal, ACH or Bitcoin.

### Apify Store (Actors and MCP tools)

Used by `public-data-scraping-service` (A) and `apify-actors-mcp-tools` (A). The same rules apply to the Apify MCP server and other MCP marketplaces such as MCPize.

- **Policy**: https://docs.apify.com/legal. Monetization: https://docs.apify.com/platform/actors/publishing/monetize
- **Automate**: Actor builds, runs, monitoring and pricing are all API-driven. The payout invoice is auto-approved.
- **Human**: legal review of each target site (ToS, robots.txt, database rights), KYC, and support replies.
- **Rules**: no personal data, no login or paywall bypass, and GDPR compliance when personal data is touched. The rental pricing model is being phased out in 2026 in favour of pay-per-event or pay-per-result. The catalog reports a 20% Apify commission.
- **Payout (verified)**: PayPal and Wise have a $20 minimum; other methods have a $100 minimum. Invoices are generated on the 11th and auto-approved on the 14th, and payouts arrive between the 21st and 25th. Balances below the minimum roll over.
- **API**: the Apify API applies per-resource rate limits. Respect the limits of the target sites as well.

### AWS Data Exchange

Used by `licensed-data-api-feeds` (A) and `sell-datasets` (B).

- **Policy**: https://aws.amazon.com/data-exchange/ (AWS Marketplace seller terms apply).
- **Rules**: data must be non-personal and licensed for commercial redistribution. Providers must be companies in AWS-eligible jurisdictions.
- **Automate**: dataset revisions are published through the API.
- **Payout**: AWS Marketplace disbursement to a bank, monthly. Datarade's commission-only plan takes 30% (https://providers.datarade.ai/apply). Hugging Face (gated datasets with external checkout) and Snowflake Marketplace are the other listed channels; marketplaces take about 15-30%.

### Other catalog platforms

One line each, with the catalog's figures. Check the source before relying on a figure.

- **Kaggle, DrivenData, Zindi and AIcrowd** (`ml-competitions`): lump-sum prizes with no minimum, paid by wire or PayPal (host-dependent) about 60 days after the competition. Source: https://community.drivendata.org/t/can-i-participate-in-this-competition/6276

## AI-Native Income

### ElevenLabs (Voice Library and Dubbing)

Used by `elevenlabs-voice-library` (S), `ai-voiceover-podcast-editing` (A) and `ai-dubbing-localization-service` (A).

- **Policy**: https://elevenlabs.io/terms-of-use and https://elevenlabs.io/use-policy
- **Automate**: TTS and dubbing generation through the API, and QA pipelines.
- **Human**: recording the voice sample, Voice Captcha verification and Stripe Connect KYC. Native-speaker spot checks of dubbing.
- **AI**: you may only clone your OWN voice. For dubbing, get written consent from the voice owner, and only localize content the client owns.
- **Accounts**: identity verification ties each Professional Voice Clone (PVC) to its owner. Creating a PVC requires the Creator plan or higher.
- **Payout (verified)**: through Stripe Connect. The minimum is $10 in most countries and higher in some. Payouts run automatically every 6-8 days once the minimum is reached. Only usage by paid users earns money. Countries without Stripe Connect cannot receive payouts.
- **API**: concurrency limits depend on the plan.

### Troveo and Calliope Networks (AI training footage)

Used by `ai-training-footage-licensing` (A).

- **Policy**: per-broker licensing contracts (https://www.troveo.ai/).
- **Human**: rights review, contract signing and broker KYC.
- **Rules**: you must own the copyright and hold model and property releases. The footage must not contain other people's likenesses or copyrighted music.
- **Payout**: per deal, by bank transfer or PayPal depending on the broker.

### Botpress and Voiceflow (agent SaaS)

Used by `niche-ai-agent-saas` (A). The same rules apply to `local-business-chatbot-setup` (A).

- **Policy**: https://botpress.com/partners and https://www.voiceflow.com/legal
- **AI**: bots must tell end users they are AI. This is required by EU AI Act transparency rules and US state bot-disclosure laws. Outbound robocalls without TCPA consent are not allowed. Do not give medical or legal advice.
- **Human**: sales calls, contracts and DPAs (data processing agreements), and onboarding.
- **Payout**: direct billing through Stripe Billing or Wise/Payoneer invoices.

### Vercel and Cloudflare (hosting)

Used by `ai-micro-tools-site` (A).

- **Policy**: https://vercel.com/docs/limits/fair-use-guidelines and https://www.cloudflare.com/terms/
- **Rule (verified)**: Vercel Hobby is "restricted to non-commercial personal use only". Commercial use covers any payment processing, affiliate-first sites and any ads, including AdSense. A monetized tool site needs Vercel Pro, or Cloudflare Pages/Workers instead.
- **Limits**: the Vercel Hobby fair-use guide is about 100 GB transfer and 1M function invocations per month.

### Poe (creator monetization)

Used by `poe-bot-creator` (B) and `ai-assistant-store-revenue` (B).

- **Policy**: https://poe.com/pages/earnings-tos. Docs: https://creator.poe.com/docs/creator-monetization
- **Rules**: bots must follow Poe's rules and the usage policies of the underlying model.
- **Payout (catalog, https://help.poe.com/hc/en-us/articles/21921312368020-Poe-Creator-Monetization-FAQs)**: Stripe to a bank in USD, monthly, 30-45 days after month end, with a $10 minimum. Taxpayer information must be submitted within 90 days of joining. Only countries on Poe's list can earn. The OpenAI GPT Store revenue share is an invite-only US pilot.

### Other catalog platforms

One line each, with the catalog's figures. Check the source before relying on a figure.

- **Gray Swan Arena** (`ai-redteam-bounties`): prize money per challenge wave; the payout method is set at winner onboarding (not verified). Source: https://app.grayswan.ai/arena
- **Tensor.Art and TensorHub** (`lora-model-creator-incentives`): $50 wallet minimum (TensorHub); withdrawals processed weekly, usually Mondays, by bank transfer (unverified, articles bot-blocked). Source: https://tensor.art/articles/963636376601904080
- **Troveo and other licensed AI data brokers** (`ai-training-footage-licensing`): payout per deal; see Troveo's payout article. Source: https://support.troveo.com/articles/6852961307-how-do-payouts-work-on-troveo
- **Top.gg** (`discord-premium-ai-bot`): a bot discovery listing; it does not pay.

## Marketplaces & E-Commerce

### Used-Goods Marketplaces

Used by `used-goods-reselling` (S). eBay is also used by `amazon-ebay-online-arbitrage` (B).

| Platform             | Policy                                                                              | Region       | API                                                    |
| -------------------- | ----------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------ |
| eBay                 | https://www.ebay.com/help/policies/member-behaviour-policies/user-agreement?id=4259 | ~190 markets | Official Sell APIs with daily call quotas per app      |
| Vinted               | https://www.vinted.com/terms_and_conditions                                         | EU, UK, US   | No public API; ToS forbid bots and scraping            |
| Mercari              | https://www.mercari.com/us/help_center/                                             | US, JP       | No public seller API                                   |
| Poshmark             | https://poshmark.com/terms                                                          | US, CA       | No public API; automated sharing tools risk suspension |
| Depop                | https://www.depop.com/legal/terms-of-service/                                       | UK, US, AU   | Partner API only                                       |
| Facebook Marketplace | https://www.facebook.com/policies_center/commerce                                   | Global       | No listing API for individuals                         |
| OLX                  | Local OLX site terms                                                                | LatAm, Asia  | Partner APIs in some markets                           |
| Jiji                 | https://jiji.ng/ (local terms)                                                      | Africa       | None                                                   |
| Carousell            | https://www.carousell.com/                                                          | SEA          | None                                                   |

- **Automate**: drafting listings (description and price research) and cross-listing through official APIs only.
- **Human**: photographing, packing and shipping items, meeting buyers locally, and anything that is clicked through a marketplace's own app.
- **Rules**: describe item condition honestly, and sell no counterfeit or prohibited items. Regular resale is a business: DAC7 (EU) and 1099-K (US) reporting applies above the thresholds.
- **Accounts**: eBay allows multiple accounts but forbids using them to evade restrictions. The others expect one account per person.
- **Payout (catalog, https://www.ebay.com/help/selling/fees-credits-invoices/selling-fees?id=4364)**: none to $1 minimum, on demand or daily, after the buyer confirms receipt (Vinted about 2 days after delivery, unverified; eBay timing not confirmed on an official page). eBay charges about 13% + $0.40 per order; Mercari about 10%, with free daily direct deposit or $3 Instant Pay; Vinted charges the buyer instead of the seller.
- **Amazon Seller Central (FBA)** (`amazon-ebay-online-arbitrage`, B): referral fee about 15%; disbursed to a bank (directly or through Payoneer) about every 14 days, with no minimum (schedule unconfirmed, login-only). Source: https://sell.amazon.com/pricing. Keepa, SellerAmp and Tactical Arbitrage are paid research tools, not payers.

### Redbubble, TeePublic and Amazon Merch on Demand

Used by `pod-marketplaces-redbubble-teepublic-merch` (A).

- **Policy**: https://www.redbubble.com/agreement, https://www.teepublic.com/terms and https://merch.amazon.com/ (Merch content policy)
- **Automate**: design generation drafts and upload metadata. Use bulk upload only where the platform UI offers it, and do not drive the UI with headless bots.
- **Human**: an IP and trademark check of every design, the Merch on Demand application (approval is selective), and the tax interview.
- **Accounts**: one account per person. Merch on Demand caps uploads by tier.
- **Payout**: Redbubble pays by PayPal or bank transfer, with a $10/£10/€10 threshold since 1 July 2026 (lowered from $20); it processes at the start of each month and lands by the 15th (https://help.redbubble.com/hc/en-us/articles/360027407652-What-is-the-Artist-Payment-Threshold). TeePublic pays on the 15th for the previous month, by PayPal or Payoneer only; its help center states no minimum (the Payoneer minimum is unverified). Amazon Merch pays by monthly bank deposit; the ~30 days after month end is not verified (Merch resources are login-only). Payout is global through PayPal and Payoneer.

### Shopify

Used by `shopify-dropshipping` (B), `print-on-demand-own-shop` (B), `shopify-apps` (B) and `website-themes-templates` (B).

- **Policy**: https://www.shopify.com/legal/terms and https://www.shopify.com/legal/aup
- **Automate**: catalog, inventory and order sync through the Admin API.
- **Human**: store and payment KYC, ad budget decisions, disputes and chargebacks.
- **Rules**: consumer law applies, including honest delivery times, the EU 14-day withdrawal right, GPSR product safety and no counterfeits. Ad platform policies also apply.
- **Payout**: Shopify Payments pays to a bank every 1-3 business days in about 23 countries. Elsewhere use PayPal or Stripe. Shopify Partners and app revenue goes through Hyperwallet with a $25 minimum, twice monthly. The App Store revenue share is 0% on the first $1M of lifetime revenue (https://shopify.dev/docs/apps/launch/distribution/revenue-share); the Theme Store takes 15%.
- **API**: the GraphQL Admin API uses cost-based throttling (about 100 points/s on standard plans). The REST API uses a leaky bucket (40 requests, 2/s on standard plans).

### Printful

Used by `shopify-dropshipping` (B) and `print-on-demand-own-shop` (B).

- **Policy**: https://www.printful.com/policies/terms-of-service
- **Automate**: order routing is fully automated through Etsy or Shopify integrations.
- **Human**: ordering samples to check quality, and handling defects and returns.
- **Payout**: none from Printful or Printify. You pay the base cost up front and profit arrives through the sales channel. The catalog prices a Printify base tee at $8.77 (Free plan) plus about $4.75 US shipping (estimated).
- **API**: Printful REST API with a general limit of 120 requests per minute.

### Flippa and Escrow.com

Used by `micro-saas-app-flipping` (B) and `website-newsletter-flipping` (C).

- **Policy**: https://flippa.com/terms-of-service and https://www.escrow.com/legal
- **Human**: buyer due diligence, the asset purchase agreement, and account handover.
- **Rules**: misrepresenting traffic or revenue is fraud. Analytics must be verified.
- **Payout (catalog, https://flippa.com/pricing)**: escrow pays by bank wire per sale. Flippa charges a 10% success fee on self-service sales plus a listing fee from $29. Acquire.com charges a 6-8% closing fee plus $25-100 per month while listed (https://help.acquire.com/how-much-does-it-cost-to-sell). Empire Flippers charges a $10,000 minimum commission and 15% up to $700k, so it does not suit small sites. Motion Invest, Duuce (newsletters) and Tiny Acquisitions are listed as alternatives without fee figures.

### Other catalog platforms

One line each, with the catalog's figures. Check the source before relying on a figure.

- **Udemy** (`online-course-marketplaces`): instructors get 37% of organic sales; $25 minimum since September 2025 (paid anyway each December); monthly via PayPal or Payoneer, about 30+ days after month end. Source: https://support.udemy.com/hc/en-us/articles/229605008-Instructor-revenue-share
- **Skillshare** (`online-course-marketplaces`): no cash minimum, but eligibility needs 50 followers and 400/650 qualifying minutes; paid on the 16th for the previous month via Tipalti. Teachable and Thinkific are own-site course tools. Source: https://help.skillshare.com/hc/en-us/articles/226578788-When-and-how-do-I-receive-payments-from-Skillshare
- **Fab (Epic Games)** (`3d-models-game-assets`): the publisher keeps 88%; $100 minimum (rolls over, paid regardless after 12 months), monthly about 30 days after month end. Sketchfab now sells through Fab. Source: https://dev.epicgames.com/documentation/en-us/fab/publisher-get-started-in-fab
- **Unity Asset Store** (`3d-models-game-assets`): 30% fee; PayPal monthly or bank transfer quarterly (USD only). Source: https://docs.unity.com/en-us/asset-store/publishing/asset-packages/revenue/payouts
- **CGTrader** (`3d-models-game-assets`): 20-45% commission; weekly on Wednesdays, sales paid 20 days after sale; $10 minimum for subscription earnings. Source: https://www.cgtrader.com/pages/earnings-and-payout-schedule
- **Thangs, Printables Store, Cults3D and MakerWorld** (`3d-printable-model-stores`): Thangs charges 20% on $5-9.99 sales (30% under $5, 15% at $10+) and pays monthly via Stripe Express; Printables takes 20% via Stripe; Cults3D pays designers 80% of the net price (15% fee + 5% banking) from EUR 5 via Hyperwallet or US$7 via Payoneer; MakerWorld pays cash only on Exclusive Points, $100 per withdrawal after a manual review of about a week. Source: https://thangs.com/resources/help-center-articles/what-does-thangs-charge-designers
- **Thangs Memberships, Printables Clubs and MyMiniFactory Tribes** (`stl-miniature-subscriptions`): Thangs keeps 14% and Printables 10%; MyMiniFactory needs the Pro ($24.99/month) or Studio ($99.99/month) plan, charges 15/12.5/10% + 3.49% + $0.49, and $2 on payouts under $100. Source: https://creator.myminifactory.com/how-to-request-a-payout
- **Creative Fabrica, Design Bundles and So Fontsy** (`craft-design-subscription-marketplaces`, `cross-stitch-embroidery-files`): designer share about 50% (estimated); monthly via PayPal or Payoneer; minimums unverified (sites bot-blocked). Source: https://www.creativefabrica.com/designer-program/
- **Silhouette Design Store** (`cutting-machine-design-store-artist`): royalty about 30% to the artist (estimated; not published); monthly (unverified). Cricut licensing is by private contract. Source: https://www.silhouettedesignstore.com/artists
- **The Game Crafter** (`pod-board-games-game-crafter`): keeps 30% of the profit over manufacturing cost; paid weekly on Mondays after a 30-day hold, by PayPal or shop credit, no minimum. Source: https://help.thegamecrafter.com/article/130-royalties
- **Roll20 Marketplace** (`vtt-assets-roll20-marketplace`): 50% split (estimated); payout method and minimum unverified. Foundry VTT premium packages are also unverified. Source: https://marketplace.roll20.net/
- **Second Life (SL Marketplace and LindeX)** (`second-life-virtual-goods`): Marketplace 10% + LindeX 5% sell fee; $3 plus fees per withdrawal, via Tilia to PayPal or another payout account. Source: https://lindenlab.freshdesk.com/support/solutions/articles/31000135224-process-credit-withdrawal-requests
- **Minecraft Marketplace and Partner Program** (`minecraft-marketplace-partner-content`): partner terms are under NDA; partner studios such as Noxcrew pay contractors per project via PayPal, Wise or bank (unverified). Source: https://www.minecraft.net/en-us/partner
- **Framer Marketplace** (`website-themes-templates`): 5% fee, monthly. Webflow Marketplace is listed without figures; the Shopify Theme Store takes 15%. Source: https://www.framer.com/help/articles/how-the-creator-program-works/
- **Freelancer.com** (`freelancer-com-contests`): 10% or $5 per project; USD 50 minimum after fees; Express local bank, PayPal, Skrill, Payoneer card or wire. Source: https://www.freelancer.com/feesandcharges
- **Workana** (`workana-latam-freelance`): 20% on the first $300 per client, then 10% and 5%; USD 50 minimum via Payoneer; twice monthly (weekly on paid plans); Payoneer to Airtm in 13 LatAm countries. Source: https://help.workana.com/hc/en-us/articles/360041937573-Methods-for-withdrawing-
- **PromptBase** (`ai-prompts-promptbase`): 20% fee (estimated); Stripe minimum $30 (account 30+ days old), weekly or monthly; Zoneless pays daily in USDC; $3.99 early-payout fee. Source: https://promptbase.com/knowledge-base/payouts
- **Decluttr, Swappa, Gazelle, musicMagpie and Back Market** (`electronics-buyback-sites`): buyback sites build their margin into the quote; Decluttr reportedly pays the day after inspection by direct deposit, PayPal or cheque, and Swappa pays via PayPal at sale (unconfirmed). Source: https://www.decluttr.com/
- **CardCash, GCX and Raise** (`sell-unused-gift-cards`): CardCash reportedly pays 70-92% of face value (the ~18% fee is estimated) by ACH, PayPal or cheque within 1-5 business days; GCX and Raise rates are unpublished. Source: https://www.cardcash.com/sell-gift-cards/
- **Pterodactyl, Paymenter/WHMCS and resale-friendly VPS hosts** (`game-server-hosting-reseller`): panel and billing software; customers pay you through Stripe or PayPal (about 3%). Source: https://pterodactyl.io/
- **Metafy** (`esports-coaching-metafy`): 12% + $1.79 per transaction (capped at 30%); $12.50 minimum, withdrawable after 1-4 business days pending and KYC; local bank/ACH $2.50, wire $30, PayPal or Venmo 5% + $1. Source: https://help.metafy.gg/en/articles/16415457-metafy-pricing-update-august-2026
- **AliExpress and CJ Dropshipping** (`shopify-dropshipping`): suppliers you pay; they do not pay out. Source: https://cjdropshipping.com/

## Licensing, Royalties & Rentals

### Stock Media Agencies

Used by `stock-media-contributor` (A), `ai-stock-imagery-adobe-freepik` (A), `music-sync-stock-libraries` (B) and `stock-music-sound-effects` (C).

| Platform               | Policy                                                                                                                           | AI content                                | Minimum payout (catalog)                                                                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adobe Stock            | https://helpx.adobe.com/stock/contributor/submit-your-content/submit-generative-ai-content/generative-ai-content-guidelines.html | Allowed, with label                       | $25; PayPal, Skrill or Payoneer (outside the US); first payout 45 days after the first sale                                                                                       |
| Shutterstock           | https://submit.shutterstock.com/help/en/articles/10594676-ai-generated-content-on-shutterstock-contributor-faq                   | Not accepted (verified)                   | ~$35 (not re-verified)                                                                                                                                                            |
| Pond5                  | https://www.pond5.com/legal/contributor                                                                                          | Restricted; catalog says termination risk | $25, paid on the 15th; Skrill 4% fee. On music and sound effects the contributor gets 30% and Pond5 keeps 70% (https://contributor.pond5.com/getting-started/payout-overview/)    |
| Freepik (now Magnific) | https://www.magnific.com/ai/docs/faqs-for-contributors                                                                           | Allowed, with label                       | $25 / EUR 50, monthly invoice; PayPal, Payoneer or SEPA                                                                                                                           |
| Dreamstime             | https://www.dreamstime.com/terms                                                                                                 | Per agency rules                          | Via Wirestock                                                                                                                                                                     |
| 123RF                  | https://www.123rf.com/terms.php                                                                                                  | Per agency rules                          | Via Wirestock                                                                                                                                                                     |
| Wirestock              | https://wirestock.io/                                                                                                            | Labels AI and routes it per agency        | $30 (third-party figure); not in the current catalog                                                                                                                              |
| Envato                 | https://help.author.envato.com/hc/en-us/articles/360000472943                                                                    | AI-primary music banned on AudioJungle    | $50 (SWIFT higher); author fee 50% for all authors from 1 July 2026 (https://author.envato.com/hub/changes-to-envato-market-revenue-share-and-exclusivity-what-you-need-to-know/) |

- **Automate**: keywording, metadata and batch upload through supported uploaders or FTP.
- **Human**: shooting and curating, model and property releases, and an IP check of every asset.
- **AI**: tick the AI flag on every generated asset. Do not use real people, trademarks, copyrighted characters or artist names in prompts. The generator's terms must grant commercial rights. Do not route AI assets to agencies that refuse them, including Shutterstock through Wirestock.
- **Accounts**: one contributor account per person, with an ID check.

### Music Distribution and YouTube Content ID

Used by `music-streaming-distribution` (A) and `youtube-content-id-own-catalog` (A). This covers DistroKid, TuneCore, CD Baby, Spotify, Apple Music and YouTube Content ID.

- **Policy**: https://support.distrokid.com/, https://www.tunecore.com/terms, https://cdbaby.com/, https://www.spotify.com/legal/platform-rules/ and https://support.google.com/youtube/answer/2797370
- **Automate**: metadata, release scheduling and royalty reporting.
- **Human**: creative curation of each release, rights verification, and Content ID dispute or whitelist handling.
- **AI**: you need all rights. Voice clones of real artists are not allowed. Disclose AI where a store asks for it (DDEX AI credits). Spotify removes spam and mass-uploaded tracks.
- **Rules**: only claim content you exclusively own through Content ID. Do not claim public-domain material, library loops or samples. Never manipulate streams with bots or stream farms.
- **Payout**: distributor to PayPal or bank, monthly, with a low or no minimum. Stores report 2-3 months after the stream. DistroKid Content ID is included in its annual Social Media Pack, and DistroKid keeps 20% of Content ID revenue (https://support.distrokid.com/hc/en-us/articles/360013535314-What-is-YouTube-Content-ID).

### Project Gutenberg (source texts)

Used by `public-domain-derived-works` (A).

- **Policy (verified)**: https://www.gutenberg.org/policy/license.html
- **Rule**: if you sell a work under the Project Gutenberg name or license, you owe a 20% royalty on gross profits, and the trademark may not be used without permission. To avoid this, strip the license and all references to Project Gutenberg. The license only addresses US law, so verify public-domain status in each sales country (life+50 or life+70).

### Other catalog platforms

One line each, with the catalog's figures. Check the source before relying on a figure.

- **BeatStars** (`beat-leasing-beatstars-airbit`): 0% on beat sales, paid straight to your PayPal or Stripe; buyers pay a 12% marketplace service fee; Starter plan $19.99/year. Airbit marketplace earnings are paid monthly via Tipalti with no minimum. Source: https://help.beatstars.com/hc/en-us/articles/206363117-How-do-I-get-paid-for-my-music-sales
- **SoundCloud for Artists and Audiomack** (`soundcloud-audiomack-monetization`): SoundCloud keeps 0% and pays from $25 on the last business day of the month via PayPal or bank; Audiomack pays NET 90 with no published minimum. Source: https://help.soundcloud.com/hc/en-us/articles/360051802713-Getting-Paid-by-SoundCloud-for-Artists
- **The MLC, ASCAP/BMI and PRS for Music** (`songwriter-publishing-royalties`): The MLC is free and pays monthly; PRS charges a one-off £100 joining fee and pays from £30 (UK) or £60 (international); PROs pay quarterly. Source: https://www.themlc.com/
- **Songtrust** (`songwriter-publishing-royalties`): $100 one-time fee plus 15% of performance and 20% of mechanical royalties. Source: https://www.songtrust.com/pricing
- **Artlist, Musicbed and Jamendo Licensing** (`music-sync-stock-libraries`): curated sync libraries listed without payout figures (estimated). Source: https://campaigns.musicbed.com/onboarding
- **Keygen** (`dual-license-open-source`): license-key service with a free Dev tier and a free self-hosted edition; it does not pay out. Source: https://keygen.sh/pricing/

## Software & Developer Monetization

### GitHub

Used by `dual-license-open-source` (B), `github-sponsors` (B) and `saas-recurring-affiliate-tutorials` (A, "Blog/GitHub").

**URL**: https://docs.github.com/en/site-policy/github-terms/github-terms-of-service. Acceptable use: https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies

**Key Rules**:

- Bots must identify themselves in user agent strings
- Must not abuse API rate limits
- Must not create accounts via automated means without permission. A machine user is allowed alongside a person's own account, but the person stays responsible for it.
- Must not use the platform for spam or for commercial content unrelated to development
- Bug bounty hunting is allowed only on authorized programs

**Rate Limits (verified)**:

- REST: 60 requests/hour unauthenticated; 5,000/hour authenticated (15,000 for Enterprise Cloud org apps); `GITHUB_TOKEN` 1,000/hour per repo
- Secondary: at most 100 concurrent requests; 900 points/minute for REST and 2,000 for GraphQL; content creation at most 80/minute and 500/hour
- GraphQL API: 5,000 points/hour; Search API: 30 requests/minute

**GitHub Sponsors (verified)**: https://docs.github.com/en/sponsors/getting-started-with-github-sponsors/about-github-sponsors. Recipients must live in one of 103 supported regions. There are no fees on sponsorships from personal accounts and up to 6% on sponsorships from organizations. The catalog says payouts go through Stripe Connect monthly, after KYC and a tax form. Unsupported regions can use a fiscal host such as Open Collective.

**Best Practices for Bots**:

- Use `User-Agent: money-machine-bot (github.com/username/money-machine)`
- Implement exponential backoff on 403/429 responses and honour `retry-after` and `x-ratelimit-reset`
- Cache responses with conditional requests (ETag)

### Browser Extension Stores

Used by `paid-browser-extensions` (A).

| Store                  | Policy                                                                               | Notes                                                    |
| ---------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| Chrome Web Store       | https://developer.chrome.com/docs/webstore/program-policies                          | One-time registration fee ($5, estimated in the catalog) |
| Firefox Add-ons        | https://extensionworkshop.com/documentation/publish/add-on-policies/                 | Human review for listed add-ons                          |
| Microsoft Edge Add-ons | https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies | Free registration                                        |
| ExtensionPay           | https://extensionpay.com/                                                            | Stripe-backed payments library; 5% fee                   |

- **Automate**: builds, packaging and submission through the store APIs (Chrome Web Store API).
- **Human**: developer registration and identity verification, replies to store reviews, Stripe KYC.
- **Rules**: no data harvesting, minimal permissions and a privacy policy. The spam policy forbids publishing multiple extensions that duplicate one experience.
- **Payout**: Stripe to a bank with no minimum (about 46 countries). Elsewhere use a merchant of record: Lemon Squeezy ($50 minimum) or Paddle ($100 minimum).

### WordPress.org and Freemius

Used by `wordpress-freemium-plugins` (A).

- **Policy**: https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/ and https://freemius.com/help/documentation/selling-with-freemius/your-earnings/
- **Rules**: code must be GPL. No trialware: free-directory code must not be locked. No phoning home without opt-in. No sockpuppet reviews or support accounts.
- **Human**: plugin review responses, support forum replies, seller verification.
- **Payout (catalog)**: Freemius pays automatically on the 10th of each month once $100 is reached (smaller balances roll over), by PayPal, Payoneer, Wise or wire. A month's earnings are released on the 1st of the second following month. Fees are 3.8% + $0.50 plus a 2.3% WordPress add-on (6.1% + $0.50); Freemius charges no payout fees.

### Stripe (and payout rails)

Used by 9 strategies directly, plus "Stripe Billing" and "Stripe/Wise invoicing". Examples: `paid-browser-extensions`, `ai-micro-tools-site`, `licensed-data-api-feeds`, `niche-directory-paid-listings` and `niche-ai-agent-saas` (all A).

**URL**: https://stripe.com/legal/ssa. Restricted businesses: https://stripe.com/legal/restricted-businesses

- **Rules**: follow the Restricted Businesses list. Give clear product and refund descriptions. Unlicensed financial signals, gambling and adult content are not allowed.
- **Accounts**: KYC per account. Multiple accounts are allowed for genuinely separate businesses but not to evade a closure.
- **Risk**: start with small transactions and build history gradually. Keep detailed records and answer disputes quickly, because high dispute rates freeze accounts.
- **Payout**: rolling 2-7 days to a bank, with no platform minimum. Direct accounts are available in about 46 countries. Elsewhere use a merchant of record (Lemon Squeezy, Paddle, Polar) or Wise/Payoneer invoicing.
- **API**: default limits are about 100 operations/s in live mode and 25/s in test mode. Handle `429` with backoff and use idempotency keys on every write.

**PayPal** (https://www.paypal.com/us/legalhub/useragreement-full) is the only payout rail for RapidAPI and the main one for Salad, Honeygain and Ko-fi. Its Acceptable Use Policy is strictly enforced, and chargebacks can freeze an account. Each person may have one personal and one business account. PayPal receiving is unavailable in several reference countries (see Cross-Platform Rules).

### Lemon Squeezy and Polar (merchants of record)

Used by `micro-saas-merchant-of-record` (B), `digital-downloads-gumroad-payhip` (B), `oss-funding-opencollective-polar-thanksdev` (B), `dual-license-open-source` (B), `paid-ide-plugins` (B) and `wordpress-freemium-plugins` (A, as the alternative).

- **Policy**: https://www.lemonsqueezy.com/terms and https://polar.sh/legal/terms
- **Rules**: the merchant of record handles VAT and sales tax. The seller passes verification and must not sell restricted products.
- **Payout (Lemon Squeezy, verified)**: the minimum is $50. Payouts follow a 13-day hold and go to a bank or verified PayPal (USD). Payouts are created on the 1st and 15th and paid on the 14th and 28th, then take 1-5 days to arrive (https://docs.lemonsqueezy.com/help/getting-started/getting-paid, checked Nov 2026). Fees are 5% + $0.50, plus 1.5% for international and PayPal payments and 0.5% for subscriptions (https://docs.lemonsqueezy.com/help/getting-started/fees). Lemon Squeezy is migrating toward Stripe Managed Payments.
- **Payout (Polar, catalog)**: Stripe Connect Express; no minimum is published. The Starter fee is 5% + $0.50 (organizations created before 27 May 2026 keep 4% + 40c; Pro is 3.8% + 40c), plus 1.5% on non-US cards (https://polar.sh/docs/merchant-of-record/fees).
- **Payout (Paddle, catalog)**: 5% + $0.50; paid on or before the 15th of the following month once the month's balance exceeds $100/EUR100/GBP100, by bank or PayPal, with $15 per international transfer (https://www.paddle.com/legal/terms).

### RapidAPI Hub

Used by `rapidapi-api-marketplace` (A) and `licensed-data-api-feeds` (A).

- **Policy**: https://docs.rapidapi.com/docs/payouts-and-finance (provider terms apply).
- **Automate**: API hosting, metering and plan management.
- **Human**: PayPal setup, pricing decisions, support. The underlying data must be licensed for resale.
- **Payout (verified)**: PayPal only, with a flat 25% marketplace fee plus PayPal fees. A month's charges are paid at the end of the following month, so January charges arrive in early March. No minimum is published.

### Other catalog platforms

One line each, with the catalog's figures. Check the source before relying on a figure.

- **Apple App Store, Google Play and AdMob** (`mobile-apps-iap-ads`): Apple and Google take 15% under their small-business programs; Apple's default minimum is $40 and it pays within 45 days of fiscal month end; AdMob pays from $100 around the 21st. Source: https://developer.apple.com/app-store/small-business-program/
- **Steam and itch.io** (`indie-games-steam-itch`): Steam takes 30% and pays monthly from about $100 (both estimated; Steamworks docs unreachable); itch.io pays on request after a holding period via PayPal or Payoneer. Source: https://partner.steamgames.com/doc/gettingstarted/appfee
- **JetBrains Marketplace** (`paid-ide-plugins`): 15% fee; $200/EUR 200 minimum (or paid every 31 December), monthly by bank transfer. Open VSX and the Visual Studio Marketplace have no paid-plugin payouts. Source: https://plugins.jetbrains.com/docs/marketplace/getting-paid.html
- **Atlassian Marketplace** (`workplace-app-marketplaces`): 0% on the first $1M for Forge apps; $500 accrued minimum, monthly by bank transfer. Figma Community pays through Stripe; Slack and Zoom App Marketplace payouts are not published. Source: https://developer.atlassian.com/platform/marketplace/pricing-payment-and-billing/
- **ThemeForest and CodeCanyon (Envato Market)** (`envato-code-themes`): $50 minimum (SWIFT higher), paid monthly on the 15th via PayPal, Payoneer or SWIFT. Envato's author fee is a flat 50% of the item price for all authors, plus a buyer fee added to the list price (confirmed Nov 2026); the catalog entry models 50%. Source: https://help.author.envato.com/hc/en-us/articles/360000472943
- **Algora** (`oss-bounties-algora`): the payer pays the fee, so contributors get 100% of the bounty via Stripe Connect in about 1-8 business days (not re-confirmed). Gitcoin (crypto) and Opire are alternatives. Source: https://github.com/algora-io/algora
- **thanks.dev** (`oss-funding-opencollective-polar-thanksdev`): maintainers must register to receive dependency-based donations. Source: https://thanks.dev

## Education & Tutoring

### Stuvia and Docsity

Used by `study-notes-stuvia` (A).

- **Policy**: https://www.stuvia.com/en/terms and https://www.docsity.com/
- **Rules**: original notes only. Some universities forbid selling notes from their lectures. AI-written notes passed off as lecture notes breach originality rules.
- **Payout (catalog, https://help.stuvia.com/en/articles/13311540-when-does-stuvia-pay-out-withdrawn-funds)**: withdrawals are processed on Mondays through Tipalti and arrive in 2-4 business days. The minimum is EUR/USD/GBP 10 or R200. Stuvia's commission of about 30% is estimated. Docsity's terms were not re-verified.

### Zoom

Used by `paid-webinars-workshops` (B) and `cohort-courses-maven` (C).

- **Policy**: https://explore.zoom.us/en/terms/
- **Automate**: scheduling, registration and recordings through the Zoom API (rate-limit categories depend on the plan).
- **Human**: live teaching. Tell participants when sessions are recorded.
- **Payout**: none from Zoom. Tickets are sold through Stripe (Payment Links), Luma, Eventbrite or Maven. Luma takes 5% on its free plan (https://luma.com/pricing); Maven takes 10% plus Stripe fees.

### Other catalog platforms

One line each, with the catalog's figures. Check the source before relying on a figure.

- **Cambly and Cambly Kids** (`cambly-on-demand-conversation`): $0.17 per minute ($10.20/hour), Kids $0.20 per minute; weekly via direct deposit, with PayPal and Payoneer not re-confirmed; no stated minimum. Source: https://www.cambly.com/english/tutors
- **Preply, italki and Wyzant** (`tutoring-marketplaces`): commissions are estimated (Preply about 25%); Preply withdrawal minimums are Wise $10, Payoneer $20-23 and PayPal $0; italki needs $30; Wyzant pays to US banks only. Source: https://help.preply.com/en/articles/4178971-how-to-withdraw-your-earnings
- **Superprof** (`superprof-lead-gen-tutoring`): 10% on in-platform payments (0% with Premium); otherwise students pay you directly (unverified). Apprentus is an alternative. Source: https://www.superprof.com.au/blog/charges-payments-superprof
- **Outschool** (`outschool-live-kids-classes`): keeps 30%; pays in USD via PayPal while the move to Stripe rolls out, in weekly batches, no minimum. Source: https://support.outschool.com/en/articles/2382129-educator-earnings-and-payments
- **Lingoda** (`fixed-rate-language-school-freelance`): about $8-13 per class (unverified; Lingoda publishes no rate); monthly teacher invoice. Source: https://www.lingoda.com/jobs
- **Engoo, 51Talk and NativeCamp** (`esl-company-tutoring`): Engoo's Payoneer USD 20 minimum and 20th-of-month pay date are unconfirmed; NativeCamp pays 430 NCC credits per booked class; 51Talk terms are unconfirmed. Source: https://engoo.com/tutors
- **GoStudent and Varsity Tutors** (`agency-assigned-tutoring-contractor`): GoStudent pays up to GBP 16 per hour, monthly by bank transfer, no minimum; Varsity Tutors' twice-weekly pay comes only from third-party sources. Source: https://tutors.gostudent.org/help-with-earnings/
- **Cuemath** (`cuemath-online-math-tutor`): no published rate, method or schedule (unverified). Source: https://www.cuemath.com/teach-with-cuemath/
- **Cambridge International and International Baccalaureate** (`exam-board-examiner-marking`): Cambridge pays GBP 1-5 per script; IB pays per exam session by bank transfer (unverified). Source: https://www.cambridgeinternational.org/about-us/examiners/frequently-asked-questions
- **MentorCruise** (`mentorship-marketplace`): fee added on top of the mentor's price, about 16.6% on average (the catalog uses 17%); Stripe within about 7 days or monthly bank transfer around the 4th; no minimum. Source: https://help.mentorcruise.com/article/45-payout
- **Clarity.fm** (`per-minute-expert-calls`): keeps 15% per call plus PayPal fees; manual export to PayPal every 14-15 days, no minimum. Source: https://clarity.fm/expert
- **Lessonface** (`lessonface-music-arts-lessons`): 15% for students Lessonface finds, 5% for your own, up to 30% for classes; PayPal weekly on Fridays, no minimum. Source: https://lessonface.com/fees
- **Hotmart** (`hotmart-course-affiliate-network`): 9.9% + USD 1 per sale (20% on products up to BRL 10); funds release after 30 days; minimum set in its Help Center (not confirmed). Source: https://hotmart.com/en/legal/payments-policy
- **LinkedIn Learning, Pluralsight and Domestika** (`curated-publisher-video-courses`): pay is per contract; Pluralsight pays quarterly royalties partly based on viewership; Domestika pays via verified PayPal. Source: https://business.linkedin.com/learn/instructors
- **Cal.com/Calendly, Google Business Profile and Stripe Payment Links** (`independent-online-tutoring-practice`, `paid-webinars-workshops`): booking, listing and checkout tools; payouts follow Stripe. Source: https://stripe.com/global

## Content & Media

### YouTube

Used by `saas-recurring-affiliate-tutorials` (A), `youtube-partner-program-ai-assisted` (B) and `youtube-content-id-own-catalog` (A, Content ID).

- **Policy**: https://www.youtube.com/t/terms. Monetization: https://support.google.com/youtube/answer/1311392. AI disclosure: https://support.google.com/youtube/answer/14328491
- **Automate**: scripting drafts, editing, captions, thumbnails and scheduling through the Data API.
- **Human**: review of every script for originality and accuracy, and the YPP application. Repetitive, mass-produced "inauthentic content" is demonetized.
- **AI (verified)**: disclose realistic altered or synthetic content (a real person saying something they did not, altered real events, realistic scenes that did not happen) through the "AI use" attribute in Studio. Disclosure is not needed for scripts, thumbnails, captions or beauty and colour edits. Repeat non-disclosure can lead to removal or YPP suspension. Disclosure alone does not reduce monetization.
- **Rules**: disclose paid promotion with the checkbox. Own the rights to all content.
- **Accounts**: multiple channels are allowed, but circumventing YPP with them is not.
- **Payout**: AdSense, $100 minimum, paid around the 21st-26th. The creator's 55% share of long-form ad revenue is an estimate in the catalog. YPP is available in 100+ countries. Creator Partnerships run in about 24 countries.
- **API**: the Data API v3 default quota is 10,000 units/day; an upload costs about 1,600 units.

### Display Ad Networks

Used by `seo-blog-display-ads` (A), `ai-micro-tools-site` (A) and `youtube-partner-program-ai-assisted` (B).

| Network           | Policy                                          | Minimum / terms (catalog)                                                           |
| ----------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| Google AdSense    | https://support.google.com/adsense/answer/48182 | $100; EFT/wire around the 21st; Google keeps 20% for AdSense for content (verified) |
| Ezoic             | https://www.ezoic.com/terms/                    | ~$25 typical for premium networks                                                   |
| Mediavine Journey | https://www.mediavine.com/                      | Net-65 (not re-verified)                                                            |
| Raptive           | https://raptive.com/                            | Net-45 (not re-verified); traffic bar lowered to 25,000 views                       |

- **Rules**: no invalid traffic, and never click your own ads or automate visits. Auto-generated thin pages are not allowed (https://developers.google.com/search/docs/essentials/spam-policies, scaled content abuse). EU, UK and Canadian traffic needs a cookie consent management platform and a privacy policy.
- **Accounts**: one AdSense account per payee; many sites can sit under one account.

### Amazon KDP (incl. Kindle Unlimited and Virtual Voice)

Used by `kdp-ebooks-low-content` (A), `public-domain-derived-works` (A) and `audiobooks-ai-narration` (A).

- **Policy**: https://kdp.amazon.com/en_US/help/topic/G200672390 (content guidelines)
- **Automate**: manuscript and cover drafts, metadata and royalty reports. KDP has no public upload API.
- **Human**: the KDP account and tax interview, human review of each manuscript, and manual upload in the KDP UI.
- **AI (verified)**: disclose AI-generated text, images or translations when publishing or republishing, even if they were heavily edited. AI-assisted content (your own work refined with AI) need not be disclosed.
- **Rules**: no trademarked or copyrighted material. The catalog reports a cap of 3 titles per day; Amazon confirmed it to the Authors Guild in 2023, but it is not on a help page. Kindle Unlimited requires exclusivity (KDP Select). Virtual Voice AI narration is US-only and invite-based.
- **Accounts**: one KDP account per person.
- **Payout**: EFT with no minimum in most marketplaces ($100 for wire or check), about 60 days after month end; Expanded Distribution royalties take about 90 days. KDP Select (Kindle Unlimited and Kindle+) pays about $4-4.5 per 1,000 KENP pages read (estimated).

### Audiobook Distributors

Used by `audiobooks-ai-narration` (A).

| Platform          | Policy                                                           | AI narration                                                                  |
| ----------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| ACX               | https://help.acx.com/s/article/acx-audio-submission-requirements | Unauthorized TTS/AI prohibited (verified); US/UK/CA/IE rights holders         |
| Google Play Books | https://play.google.com/books/publish/autonarrated/              | Google auto-narration allowed; broad country coverage; 52% royalty (verified) |
| Voices by INaudio | https://inaudio.com/                                             | Accepts AI narration with disclosure; PayPal payout; 80% of retailer net      |
| KDP Virtual Voice | See Amazon KDP                                                   | Amazon's own AI voice; US-only and invite-based                               |

- **Payout**: $0-$10 minimum, paid monthly 30-60 days after month end. You need audio rights to the text.

### Newsletter Platforms (beehiiv, Substack, Ghost)

Used by `newsletter-sponsorships-ad-network` (A), `newsletter-ad-network-boosts` (B), `paid-newsletter-subscriptions` (B), `gated-membership-site` (B) and `public-data-scraping-service` (A, Substack).

- **Policy**: https://www.beehiiv.com/tou, https://substack.com/tos and https://ghost.org/terms/
- **Automate**: drafting, scheduling and list hygiene.
- **Human**: editorial review of every issue, and negotiating sponsors.
- **Rules**: label sponsored content. Follow CAN-SPAM and GDPR/PECR: double opt-in and a working unsubscribe. Never import scraped lists. beehiiv bans fake or incentivized clicks on Ad Network placements.
- **Payout**: beehiiv Ad Network pays on the 20th through Stripe Express (no PayPal or Wise), with no fixed minimum, and is open to all paid plans; Lite costs $49/month billed annually or $59 monthly (https://www.beehiiv.com/support/article/17507491038231-Ad-Network-FAQ). beehiiv Boosts pay about $1-3 per subscriber (estimated). Substack takes 10% (estimated in the catalog); Ghost takes 0% (Publisher plan $29/month, https://ghost.org/pricing/); Memberful costs $49/month + 4.9%. Substack and Ghost pay paid subscriptions to Stripe on a rolling basis. Substack has special handling for India, Brazil, Indonesia, Mexico, Malaysia and Thailand.

### Meta (Facebook and Instagram)

Used by `meta-facebook-instagram-content-monetization` (B), `shopify-dropshipping` (B, ads) and `used-goods-reselling` (S, Marketplace).

- **Policy**: https://www.facebook.com/business/help/1348682518563619 (Partner and Content Monetization Policies)
- **AI**: label photorealistic AI content ("AI info").
- **Rules**: no unoriginal reposts. The Graph API publishes only to Business and Creator accounts. Automated likes, follows and DMs are prohibited.
- **Payout**: $100 minimum, around the 21st of the month, to a bank or PayPal (some countries); the catalog has not re-verified these figures. Meta Business Suite is the scheduling tool and pays nothing itself.

### TikTok

Used by `tiktok-creator-rewards` (C), `tiktok-shop-affiliate` (C) and `shopify-dropshipping` (B, ads).

- **Policy**: https://www.tiktok.com/legal/page/us/terms-of-service/en
- **AI**: AI-generated content must carry the AIGC label. Commercial and affiliate content needs the disclosure toggle.
- **Accounts**: 18+ (19+ in South Korea), with a real identity in an eligible country.
- **Payout**: Creator Rewards has a $10 in-app minimum and covers only about 8-10 markets; its per-view rates are estimated in the catalog. TikTok Shop pays through the creator wallet after the return window.

### Other catalog platforms

One line each, with the catalog's figures. Check the source before relying on a figure.

- **Draft2Digital** (`wide-ebook-distribution-aggregator`): keeps about 10% of list price (the catalog models 40% including retailers); $10 direct deposit/PayPal, $20 international/Payoneer, $100 check; monthly around the 15th. It reaches Apple Books, Kobo, Everand, OverDrive and Hoopla; PublishDrive is an alternative. Source: https://www.draft2digital.com/faq/
- **Leanpub** (`leanpub-technical-ebooks`): 80% royalty from $7.99 (80% minus $0.50 below); PayPal $20 or Wise $100, monthly around the 7th. Source: https://leanpub.com/authors
- **Reedsy Marketplace** (`reedsy-publishing-services-marketplace`): 10% from each side, falling to 9/8/7% above $5k/$10k/$15k; paid via Stripe once client payments clear, no minimum. Source: https://reedsy.com/faq/common-questions/fees
- **Patreon** (`patreon-memberships`, `web-serial-to-kindle-plus-page-reads`): 10% platform fee plus processing, currency and payout fees; monthly via PayPal, Payoneer or Stripe. Source: https://www.patreon.com/pricing
- **Royal Road** (`web-serial-to-kindle-plus-page-reads`): free serial host; income comes through Patreon and KDP Select (Kindle+) page reads; its own author rules are unconfirmed. Source: https://kdp.amazon.com/en_US/help/topic/G201541130
- **Twitch and Kick** (`live-streaming-twitch-kick`): Twitch pays 50% subscription share from $50 ($100 for wire) about 15 days after month end (timing not re-verified); Kick takes 5% (estimated) and pays monthly via Stripe with no minimum. Source: https://help.kick.com/en/articles/15159725-kick-payout-schedule-and-methods
- **Medium** (`medium-partner-program`): $10 minimum, monthly via Stripe (unverified). Source: https://help.medium.com/hc/en-us/articles/25267297935895
- **Spotify for Creators** (`podcast-monetization`): monthly to a bank; no minimum published. Source: https://newsroom.spotify.com/2026-10-20/spotify-memberships-creators/
- **WEBTOON CANVAS and Tapas** (`webcomics-webtoon-canvas-tapas`): WEBTOON pays 50% of ad revenue from 1,000 subscribers and 40,000 monthly page views; Tapas pays about 70% of ads and 100% of Ink tips; payout minimums unverified. Source: https://creators.webtoon.com/en/make-money
- **Vocal** (`vocal-media-reads`): Stripe Connect; minimum (historically ~$20) and per-read rates not verified. Source: https://vocal.media/
- **Wattpad** (`wattpad-paid-stories`): revenue share, method and minimum unverified. Source: https://www.wattpad.com/
- **Inkitt and Galatea** (`inkitt-galatea-revenue-share`): contracted royalties; rates unpublished (unverified). Source: https://www.galatea.com/
- **Choice of Games and Hosted Games** (`interactive-fiction-choice-of-games`): commissioned games pay $10,000-15,000 advances in milestones; Hosted Games authors get 25% (verified); PayPal, deposit or cheque. Source: https://www.choiceofgames.com/looking-for-writers/
- **Asimov's, Clarkesworld and Uncanny Magazine** (`pro-rate-short-fiction-markets`): Asimov's pays 8-10 cents per word on acceptance; other rates not verified. Source: https://www.asimovs.com/contact-us/writers-guidelines/
- **Blue Mountain Arts** (`greeting-card-verse-blue-mountain`): $300 per accepted verse for worldwide card rights ($50 for one-time book use); payment method not stated. Source: https://www.sps.com/greeting-card-guidelines-submissions
- **The New York Times, LA Times and Universal crosswords** (`crossword-puzzle-submissions`): NYT pays $500 daily and $2,250 Sunday (unverified); other outlets about $100-400 (estimated). Source: https://www.nytimes.com/article/submit-crossword-puzzles-the-new-york-times.html
- **Quora** (`community-contributor-programs`): 2026 monetization status could not be verified. Source: https://techcrunch.com/2021/08/05/creators-can-now-monetize-their-expertise-on-quora/

## Services & Freelancing

### Fiverr

Used by 10 strategies, including `data-cleaning-conversion-gigs`, `seo-audit-productized`, `transcription-subtitles-human-qa`, `website-in-a-day`, `resume-linkedin-rewriting` and `local-business-chatbot-setup` (all A).

**URL**: https://www.fiverr.com/terms_of_service. AI policy: https://help.fiverr.com/hc/en-us/articles/37333379620369

**Key Rules**:

- One account per person, with an ID check
- Must deliver services as described and within the deadline
- No automation of communication (must respond personally)
- No external links or off-platform payment in contact
- Gig fulfillment can be automated if quality is maintained
- Fiverr AI standards: disclose AI use to buyers and use tools with commercial-rights licences. Cloning another person's voice without consent is prohibited.
- Never fabricate credentials, for example in resumes. Do not claim guaranteed rankings or use link schemes in SEO gigs.

**Automation Considerations**:

- Can automate: service delivery, file processing, analysis, first-draft generation
- Cannot automate: customer communication, account creation, gig listing creation
- Must QA every delivery and handle disputes personally

**Payout (catalog, unconfirmed: Fiverr's official pages block automated checks)**: Fiverr takes a 20% fee and holds funds for 14 days. Withdrawal minimums are $1 to PayPal and $20 to a bank through Payoneer, on demand. Payoneer reaches almost every country; PayPal receiving is missing in some, such as Bangladesh.

### Upwork

Used by 13 strategies, including `ai-automation-agency`, `ai-voiceover-podcast-editing` and `newsletter-social-content-retainer` (all A).

**URL**: https://www.upwork.com/legal

**Key Rules**:

- Freelancers must be real individuals, with one freelancer account per person. No account sharing or renting.
- Must personally perform work or clearly indicate subcontracting
- All communication must be genuine
- No automated bidding or bot-written proposals sent without review
- Can use tools, including AI, to perform work if the client's AI policy allows it. Do not misrepresent AI output as something else. Upwork updated its global ToS alongside its own AI agent in 2026.

**Automation Considerations**:

- Can automate: actual work delivery, reporting
- Cannot automate: proposals, client communication
- Hybrid approach: human oversight plus automated execution

**Payout (catalog)**: since May 2025 the freelancer fee is variable, 0-15% per contract (estimated; https://support.upwork.com/hc/en-us/articles/211067778). Withdrawals go by ACH, local bank, Payoneer or PayPal in 180+ countries.

### Contra

Used by 7 strategies, including `ai-automation-agency`, `website-in-a-day` and `seo-audit-productized` (A).

- **Policy**: https://contra.com/terms. Payouts: https://help.contra.com/en/articles/10008642-payout-methods-on-contra
- **Automate**: portfolio and project delivery. Client communication stays human, as on Fiverr and Upwork.
- **Payout**: 0% commission for freelancers; clients pay a $19 contract fee and processor fees apply (https://contra.com/commission-free). Funds clear in about 4 days. Payouts go through Stripe in 100+ countries, plus PayPal or USDC.

### Make, Zapier and n8n (automation tooling)

Used by `ai-automation-agency` (A).

- **Policy**: https://www.make.com/en/solution-partners, https://zapier.com/legal and https://github.com/n8n-io/n8n/blob/master/LICENSE.md
- **License (verified)**: n8n's Sustainable Use License allows use "only for your own internal business purposes or for non-commercial or personal use". Building workflows on a client's own n8n instance is the safe path. Selling hosted n8n access to clients needs a commercial or Embed license.
- **Rules**: sign a DPA with clients for personal data, and keep cold outreach within CAN-SPAM, GDPR/PECR and CASL.
- **Payout**: direct invoicing through Stripe or Wise. The Make affiliate program pays via Wise from $100, after 3 paying referrals (https://www.make.com/en/affiliate); the n8n affiliate program pays from EUR 100 via PayPal (https://n8n.io/affiliates). Make Solution Partners and the Zapier Solution Partner Program are listings, not payers.

### Other catalog platforms

One line each, with the catalog's figures. Check the source before relying on a figure.

- **Kolabtree** (`kolabtree-science-freelance`): no freelancer commission is published (only a 2% Payoneer conversion fee); USD 49.99 minimum via Payoneer per milestone release. Source: https://kolabtree-help.freshdesk.com/support/solutions/articles/3000135619-what-charges-will-i-have-to-bear-
- **Gengo** (`crowd-translation-gengo`): payouts on request, processed on the 5th and 20th via PayPal (1.5%, min $1.50, max $20) or Payoneer; rates estimated and terms unconfirmed. Unbabel and ProZ are alternatives. Source: https://support.gengo.com/hc/en-us/articles/231441467-How-do-I-get-paid-
- **Smartcat** (`translation-post-editing`, `crowd-translation-gengo`): 0% commission; withdrawals cost 0.5% + $1-10; automatic payout at a threshold you set, to bank, Payoneer or PayPal. Source: https://help.smartcat.com/understanding-freelancer-fees-in-smartcat/
- **Textbroker** (`content-mill-writing`): $10 minimum, on request, processed twice a week via PayPal. Verblio invoices weekly with no minimum; Crowd Content is listed without figures. Source: https://www.textbroker.com/authors-payments-conditions
- **Cad Crowd** (`cad-drafting-3d-rendering`, `patent-technical-illustration`): 20% fee; no stated minimum; PayPal (USD) after a security hold (5 days for fixed-rate work). Source: https://www.cadcrowd.com/help/designers/service-fees/
- **Codementor, Topcoder and Toptal** (`developer-marketplaces-code-review`): Codementor fee about 15% (estimated), PayPal $1 or 2% withdrawal fee; Topcoder pays only through Trolley ($1-9 fee plus 2% FX); Toptal invoices contracts. Source: https://www.topcoder.com/thrive/articles/Payment
- **AirGigs and SoundBetter** (`remote-session-mixing-mastering`, `music-transcription-gigs`): AirGigs charges a $20 activation fee and 10-15% (min $8 per order), with daily PayPal withdrawals after 3 days; SoundBetter releases escrowed funds when the client closes the job. Source: https://help.airgigs.com/help/how-much-does-airgigs-charge-me
- **SubmitHub and Groover** (`music-curator-paid-reviews`): SubmitHub curators cash out to PayPal (minimum not published); Groover pays €20 for the first withdrawal, then €50, one free withdrawal per 30 days. Source: https://help.groover.co/en/articles/2975306-how-to-transfer-withdraw-my-grooviz-in
- **Songfinch** (`custom-songs-jingles`): artist share and payout terms are not public. Source: https://support.songfinch.com/hc/en-us/articles/17016466252571-Pricing-Payment-Options-Discount-Codes
- **GLG, Guidepoint, AlphaSights and JustAnswer** (`expert-calls-and-paid-qa`): networks pay per call (GLG reportedly ~$175/hour), Guidepoint within about 15 days; JustAnswer's ~$20 minimum is unverified. Source: https://www.guidepoint.com/guidepoint-global-advisors-terms-conditions/
- **BELAY, Fancy Hands and OnlineJobs.ph** (`virtual-assistant-bookkeeping`): BELAY publishes no rates ($18-23/hour is third-party); Fancy Hands pays every other Tuesday; OnlineJobs.ph employers pay workers directly. Source: https://www.belaysolutions.com/careers/
- **ModSquad, Working Solutions, Arise, LiveOps and TaskUs** (`remote-contract-support-work`): ModSquad pays hourly every two weeks or monthly (PayPal outside the US); Working Solutions pays $0.25-0.31 per productive minute (US/CA); the others are estimated. Source: https://modsquad.com/approach/the-mods/
- **Paraform and BountyJobs** (`split-fee-recruiting-marketplaces`): Paraform pays the recruiter's 80% split in thirds at 30/60/90 days after the hire starts; BountyJobs pays after the employer pays and 60 days of employment. Source: https://www.paraform.com/recruiters
- **Draft.dev** (`technical-writing-api-docs`): pays writers but publishes no rates. Source: https://draft.dev/write
- **Tools, not payers**: Gophish and KnowBe4 partner platforms (`smb-security-questionnaires-awareness`), Google Ads manager accounts and Meta Business Manager (`smb-ppc-ads-management`), and licensed contact-data vendors (`compliant-b2b-outbound-lead-gen`). Direct-client work is invoiced through Stripe or Wise.

## Community & Memberships

### Ko-fi and Buy Me a Coffee

Used by `kofi-buymeacoffee-tips` (A).

- **Policy**: https://help.ko-fi.com/hc/en-us/articles/360002506494-Does-Ko-fi-Take-a-Fee and https://buymeacoffee.com/terms
- **Automate**: posting free content that motivates tips, and thank-you messages that are labelled as automated.
- **Rules**: no fake supporters and no self-tipping to inflate rankings. Tips are taxable.
- **Payout**: $0 minimum; money goes straight to PayPal or Stripe. Processor fees are about 3% + $0.30. Buy Me a Coffee charges 5% (https://buymeacoffee.com/faq) and pays through Stripe, or Wise in 44 countries. The Ko-fi fee was not re-checked.

### Discord

Used by `paid-chat-community` (B) and `discord-premium-ai-bot` (B).

- **Policy**: https://discord.com/developers/docs/policies-and-agreements/developer-policy
- **Rules**: bots must be clearly labelled as apps. No selling data and no message logging beyond what the app needs. A privacy policy is required. Self-bots on user accounts are banned.
- **Payout (catalog, https://support-dev.discord.com/hc/en-us/articles/17299902720919-Premium-Apps-Payout)**: native Premium Apps are limited to US, UK and EU developers and pay through Stripe within 45 days after month end. The first payout needs $100 and a manual eligibility review; later payouts need $25. Developers keep 85% (the 15% fee is estimated) of the first $1M, then 70%.
- **Alternatives (`paid-chat-community`)**: Whop has a $10 minimum withdrawal and 2.7% + $0.30 processing; Whop's fees page lists no separate platform fee, only optional add-ons: orchestration 0.8%, billing 0.5% and tax remittance 2% (https://docs.whop.com/fees, checked Nov 2026). LaunchPass Premium costs $29/month + 3.5% + Stripe. Skool costs $9/month + 10% (Hobby) or $99/month + 2.9% (Pro). Telegram channels are paid through these tools or Stripe.
- **API**: global limit of 50 requests/s per bot, plus per-route buckets. Honour `X-RateLimit-*` headers.

### Other catalog platforms

One line each, with the catalog's figures. Check the source before relying on a figure.

- **Kickstarter** (`crowdfunding-creative-projects`): 5% plus 3-5% processing, only if funded; paid once by direct deposit; the payout starts 14 days after the campaign ends and lands 3-14 business days later. Indiegogo is an alternative. Source: https://help.kickstarter.com/en-us/articles/16236674-what-are-the-fees
- **NLnet, Emergent Ventures and Sovereign Tech Agency** (`grants-fellowships`): grants of about EUR 5k-50k (NLnet) and $1k-50k (Emergent Ventures), paid per milestone or award (estimated). Source: https://nlnet.nl/propose/

## Affiliate & Performance Marketing

Shared rules: disclose on every page or post (FTC/CAP). No self-referrals, cookie stuffing, trademark bidding or incentivized clicks unless the program allows them. Commissions lock after the merchant's validation or return window (30-120 days).

### Amazon Associates

Used by `pinterest-affiliate-pinning` (A), `amazon-associates-comparison-site` (B) and `amazon-influencer-shoppable-videos` (C).

**URL**: https://affiliate-program.amazon.com/help/operating/agreement

- Disclose the affiliate relationship clearly on every page or post that has links.
- Links must appear in a relevant context. Do not incentivize clicks, and do not use links in email or offline.
- Do not show Amazon prices unless they are pulled live from the Product Advertising API or Creators API.
- New accounts close if they do not make 3 qualifying sales within 180 days.
- Claims about products must be first-hand. Reviews must be genuine, not fake or incentivized.
- **Payout (verified)**: about 60 days after month end, by direct deposit, gift certificate or check. The US threshold is $10; the UK is GBP 25. Each Amazon store has its own program. The Amazon Influencer Program (`amazon-influencer-shoppable-videos`) pays the same way; US onsite commission rates are 0-4% (https://affiliate-program.amazon.com/help/node/topic/G4ARBJC7Z2NK48CA).

### Affiliate Networks

Used by `coupon-deal-aggregator-site` (A), `saas-recurring-affiliate-tutorials` (A), `pinterest-affiliate-pinning` (A) and `affiliate-network-programmatic-seo` (B).

| Network                   | Policy                                                                                                                                                            | Minimum payout (catalog)                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Awin                      | https://success.awin.com/articles/en_US/Knowledge/What-are-the-payment-thresholds                                                                                 | Selectable from GBP/EUR/USD 20 (default 50), twice monthly                                                          |
| CJ Affiliate              | https://www.cj.com/publishers                                                                                                                                     | ~$50 (not re-verified); twice monthly by direct deposit or Payoneer                                                 |
| Impact.com                | https://help.impact.com/partner/what-would-you-like-to-learn-about/platform-features/finance/payments-withdrawals-and-balance/withdraw-funds-to-your-bank-account | $10, PayPal (2% fee, max $20) or bank                                                                               |
| LTK                       | https://company.shopltk.com/                                                                                                                                      | Reported $25-$100 (not re-verified); creator approval                                                               |
| PartnerStack              | https://partnerstack.com/ (partner terms)                                                                                                                         | ~$5, PayPal or Stripe                                                                                               |
| Rewardful / FirstPromoter | Vendor-hosted program terms                                                                                                                                       | Set by each vendor ($0-$50)                                                                                         |
| Skimlinks                 | https://support.skimlinks.com/hc/en-us/articles/223835448-Payment-Schedule-When-will-I-get-paid                                                                   | $65 / EUR 55 / GBP 50 (not re-verified)                                                                             |
| Sovrn Commerce            | https://www.sovrn.com/ (legal pages)                                                                                                                              | ~$25 (not re-verified)                                                                                              |
| Rakuten Advertising       | https://rakutenadvertising.com/ (publisher terms)                                                                                                                 | ~$50 (not re-verified)                                                                                              |
| ShopMy                    | https://shopmy.helpkit.so/payment/43V9gf7Co7gb6ZT2oTe8eM/payment-faq/43V9gf7Co5t5aH6rWwpwyi                                                                       | $11, weekly on Fridays, Stripe or PayPal                                                                            |
| MaxBounty                 | https://www.maxbounty.com/                                                                                                                                        | $100, monthly about 15 days after month end (weekly after the first payment); PayPal, direct deposit, check or wire |

- **Coupons**: publish only codes the merchant authorized. Fake or leaked codes break consumer-protection law. Google treats white-label coupon sections as site reputation abuse.
- **Automate**: link building and deal feeds through the network APIs. Approval for each merchant is a human step.

### Pinterest and Tailwind

Used by `pinterest-affiliate-pinning` (A).

- **Policy**: https://policy.pinterest.com/en/community-guidelines and https://policy.pinterest.com/en/developer-guidelines. Tailwind: https://www.tailwindapp.com/terms
- **Automate**: scheduling pins through the official API or Tailwind, which is an approved partner.
- **Rules**: no link cloaking, deceptive redirects, repetitive pins or mass-created accounts. The account must claim the website it links to.
- **API (verified)**: Trial access allows 1,000 requests/day. Standard access allows 100 requests/s per user per app, with category limits (for example `org_write` 100/minute).
- **Payout**: Pinterest does not pay; the affiliate network does.

### Newsletter and Podcast Sponsorship Marketplaces (Paved, Passionfroot, Podcorn)

Used by `newsletter-sponsorships-ad-network` (A), `video-podcast-sponsorship-marketplaces` (C) and `podcast-monetization` (C).

- **Policy**: https://www.paved.com/, https://www.passionfroot.me/ and https://podcorn.com/
- **Rules**: label sponsored content and disclose sponsor reads out loud in podcasts. Follow the brand contract.
- **Payout**: per completed booking, to a bank or PayPal. Paved pays once the balance reaches $1,000, within 60 days after month end; its fee is shown in the platform and not published (https://www.paved.com/publisher-terms). The catalog's 20% marketplace cut for beehiiv and Paved is estimated. Brands favour English-language audiences.
- **Video and podcast alternatives (`video-podcast-sponsorship-marketplaces`, `podcast-monetization`)**: ThoughtLeaders brokers sponsorships per campaign. YouTube Creator Partnerships (BrandConnect) pays per campaign; the catalog's 10% cut is estimated (https://support.google.com/youtube/answer/9385307). Spotify for Creators pays monthly to a bank; no minimum is published (https://support.spotify.com/us/creators/article/spotify-partner-program/).

### Fintech Referral Programs (Wise, Revolut, Payoneer, Interactive Brokers)

Used by `fintech-referral-bonuses` (A).

- **Policy**: https://wise.com/uk/help/articles/77zvWSO4tKdGobXrgHIJAA/how-does-the-standard-invite-program-work, https://www.revolut.com/en-US/legal/referrals-terms/, https://www.payoneer.com/legal/ and https://www.interactivebrokers.co.uk/en/accounts/referrer.php
- **Rules**: you must hold a real account in each app. No self-referrals. Financial-promotion rules apply (for example UK FCA): stay factual, add risk warnings, give no personalised advice, and avoid crypto and leveraged products.
- **Payout**: credited in the app per qualifying referral, with no minimum. IBKR pays $200 per referral (at most 15 a year) and the referrer needs $2,000+ net liquidation value; Wise rewards must be claimed within a year. Each app is licensed only in certain countries. The IBKR referral program excludes Japan, Spain and Israel.

### Other catalog platforms

One line each, with the catalog's figures. Check the source before relying on a figure.

- **MaxBounty** (`pay-per-lead-landing-pages`): $100 minimum (or higher if you choose); monthly, weekly after the first payment on electronic methods; PayPal, direct deposit, check or wire. CJ and Impact CPL offers and vendor partner programs follow the Affiliate Networks table. Source: https://www.maxbounty.com/
- **ThoughtLeaders** (`video-podcast-sponsorship-marketplaces`): brokers sponsorships per campaign; its cut is not published (estimated). Source: https://outlierkit.com/resources/youtube-sponsorship-platforms/
- **EarnKaro** (`earnkaro-india-deal-sharing`): ₹10 minimum confirmed profit; NEFT to an Indian bank, processed three times a week. Flipkart, Myntra and Ajio are the merchants. Source: https://earnkaro.com/faq
- **Shopee Affiliate Program** (`shopee-affiliate-sea-brazil`): no minimum for local affiliates in MY, SG, ID and PH (USD 500 for Philippine cross-border payees; Brazil sets a minimum in the dashboard); weekly in MY/SG/ID, monthly in PH and BR (unverified in part). Lazada and Daraz are alternatives without figures. Source: https://help.shopee.com.my/portal/10/article/177403-[ENG]-Payment-Frequently-Asked-Questions-[FAQ]
- **Jumia KOL Program** (`jumia-kol-affiliate`): ₦5,000 minimum in Nigeria from third-party guides (unverified); monthly local bank transfer. Source: https://www.jumia.com.ng/sp-kol/
- **Mercado Livre Afiliados** (`mercado-livre-afiliados`): R$30 minimum (smaller balances roll over), credited to Mercado Pago 2 months after the balance passes it; commission counts only on approved sales within 24 hours of the click. Source: https://www.mercadolivre.com.br/ajuda/33544

## Digital Products

### Etsy

Used by `spreadsheet-templates-calculators` (A), `etsy-digital-printables-svg` (B), `photo-presets-luts` (B), `canva-templates` (B) and `print-on-demand-own-shop` (B).

- **Policy**: https://www.etsy.com/legal/ and Creativity Standards at https://www.etsy.com/legal/creativity
- **Automate**: listing drafts, and inventory and order sync through Open API v3.
- **Human**: shop identity and bank verification, an originality and IP check of each design, and buyer messages.
- **AI**: AI-generated designs go under "Designed by", and the AI use must be disclosed in the listing. Trademarked or copyrighted characters are not allowed.
- **Accounts**: multiple shops are allowed if each follows policy. Opening a new shop to evade a suspension is not.
- **Payout (catalog, https://help.etsy.com/hc/en-us/articles/115015710408)**: Etsy Payments to a bank. The weekly schedule has no minimum; daily deposits need a local minimum (USD 25, GBP 15, EUR 20). New sellers have a 14-day hold. Fees are 6.5% transaction + about 3% + $0.25 processing + $0.20 per listing. Some countries are paid through Payoneer (India, Japan, Ukraine, Brazil, Argentina, Thailand, Peru, Serbia, Georgia and South Korea).
- **API (verified)**: limits are set per API key and shown in the Developer Portal. The documented example is 150 QPS and 100,000 QPD, with QPD on a rolling 24-hour window.

### Gumroad and Payhip

Used by `public-domain-derived-works` (A), `spreadsheet-templates-calculators` (A), `digital-downloads-gumroad-payhip` (B), `notion-templates` (B), `photo-presets-luts` (B) and `design-assets-fonts-icons-ui-kits` (C).

- **Policy**: https://gumroad.com/terms and https://payhip.com/terms
- **Automate**: product and file updates, and license-key delivery through the APIs or webhooks.
- **Human**: KYC, payout linking, quality review of product content.
- **Rules**: both act as merchant of record and collect VAT. You must hold the copyright of everything included.
- **Payout (catalog, https://gumroad.com/help/article/13-getting-paid)**: Gumroad pays weekly by default (7-day hold) to a local bank in about 120 countries, or PayPal (2% fee) where banks are unsupported. The minimum is $100 for all scheduled payouts; eligible accounts can take instant payouts from $1. The fee is 10% + $0.50 (30% on Discover sales). Payhip pays instantly to PayPal or Stripe with no minimum and takes 5% on the free plan.
- **Notion Marketplace** (`notion-templates`): 8% + $0.40 per sale; $20 minimum, paid every other Thursday through Stripe Connect (https://www.notion.com/help/selling-on-marketplace).

### Creative Market

Used by `photo-presets-luts` (B), `canva-templates` (B) and `design-assets-fonts-icons-ui-kits` (C).

- **Policy**: https://creativemarket.com/terms
- **Human**: shop application approval, and vector or kerning QA.
- **Rules**: original work only, with no derivative fonts. Preview images must be your own.
- **Payout**: $20 minimum, by PayPal (free in the US, 1% up to $10 elsewhere) or bank, through Tipalti in the first 5 business days of the month, with a 2.5% FX fee. Creative Market's commission of about 40% is estimated (help pages bot-blocked). UI8 is listed as a lower-fee alternative without figures.

### Other catalog platforms

One line each, with the catalog's figures. Check the source before relying on a figure.

- **Tebex and the Cfx.re marketplace** (`minecraft-server-tebex-store`, `fivem-redm-script-marketplace`): 5% as merchant of record (15% for FiveM); withdrawals from PayPal $5, bank about $20 or wire about $50, about 14 days after the sale. Source: https://docs.tebex.io/creators/tebex-checkout/fund-withdrawals-and-transfers
- **Overwolf Appstore** (`overwolf-in-game-apps`): $200 net minimum (lower amounts roll over), paid NET 60 in USD via Payoneer; revenue share unpublished. Overwolf ads and Tebex subscriptions are its other income routes. Source: https://dev.overwolf.com/ow-native/monetization/overview
- **Nexus Mods** (`nexus-mods-donation-points`): 1,000 Donation Points = $1, credited NET 90 and redeemed via PayPal; the value can change. Source: https://help.nexusmods.com/article/112-donation-points-faq
- **CurseForge and Modrinth** (`minecraft-mod-rewards-curseforge-modrinth`): CurseForge pays from 100 points ($5) via PayPal or Payoneer early each month; Modrinth gives authors 75% of ad revenue, NET 60. Source: https://support.curseforge.com/en/support/solutions/articles/9000197902-reward-program-faq
- **Roblox DevEx** (`roblox-game-devex`): 30,000 earned Robux minimum, $0.0038 per Robux, one cash-out a month via Tipalti. Source: https://create.roblox.com/docs/production/monetization/developer-exchange
- **Fortnite Creative / UEFN** (`fortnite-uefn-island-creator`): 40% of net revenue goes to the engagement pool, and in-island purchases pay 50%; monthly via Hyperwallet; minimum not stated (unverified). Source: https://dev.epicgames.com/documentation/fortnite/engagement-payout-in-fortnite-creative
- **Twitch Extensions and Bits** (`twitch-extensions-bits`): $100 threshold, monthly by check or EFT; developers get 20% of Bits (2018 split, unconfirmed). Source: https://dev.twitch.tv/docs/extensions/monetization/
- **VRChat Creator Economy, Jinxxy and BOOTH** (`vrchat-avatar-assets-creator-economy`): VRChat pays from 20,000 credits (about $100) via Tilia to PayPal or bank; Jinxxy takes 5% and pays weekly ($1.50 per payout); BOOTH pays monthly in JPY. Source: https://creators.vrchat.com/economy/payout
- **Teachers Pay Teachers** (`teachers-pay-teachers`): Basic sellers keep 55% minus $0.30 per resource; Exclusive sellers ($59.95/year) keep 80% (77.5% from 2027); monthly via Hyperwallet. Source: https://help.teacherspayteachers.com/hc/en-us/articles/360044219891-Seller-Fees-and-Payout-Rates
- **Canva Creators** (`canva-templates`): per-use royalty pool; $10 minimum ($25 by wire), monthly via Trolley. Source: https://www.canva.com/help/canva-creators-program/
- **Bandcamp** (`bandcamp-direct-sales`): 15% on digital (10% after $5,000 in 12 months) and 10% on physical; paid per sale or monthly via PayPal. Source: https://get.bandcamp.help/hc/articles/23020694353047
- **ArrangeMe** (`sheet-music-arrangeme`): you get 50% on originals and public-domain arrangements, 10% on copyrighted ones; $20 minimum (PayPal/ACH), $100 (check). Musicnotes Marketplace, Sheet Music Direct and Sheet Music Plus are other outlets. Source: https://www.arrangeme.com/terms
- **Splice Sounds, Loopmasters, Producer Loops and ADSR** (`sample-packs-splice-loopmasters`): Producer Loops pays 50% quarterly from £100; Splice and Loopmasters terms are per label agreement (estimated). Source: https://www.producerloops.com/provider/register.php
- **DMs Guild and DriveThruRPG** (`ttrpg-supplements-dmsguild-drivethrurpg`): DMs Guild pays 50%; DriveThruRPG 65-70% for your own IP (both estimated); PayPal monthly (unverified). Source: https://kotaku.com/d-ds-dungeon-masters-guild-wants-players-to-monetize-fa-1784518350
- **Ravelry, Ribblr and LoveCrafts** (`knitting-crochet-patterns`): Ravelry buyers pay your PayPal directly (3.5% fee); Ribblr pays via Stripe; LoveCrafts terms unverified. Source: https://ribblr.com/paymentspolicy
- **Makerist** (`sewing-quilting-pdf-patterns`): appears offline since November 2026 (unverified). Source: https://payhip.com/sell-sewing-patterns
- **Rebrickable** (`lego-moc-instructions-rebrickable`): about 13% commission (estimated), invoiced monthly when over $5; buyers pay via PayPal or Stripe. Source: https://rebrickable.com/help/selling-premium-mocs/
- **Minecraft server software and server lists** (`minecraft-server-tebex-store`): tools and listings; they do not pay.

## Micro-Tasks & Paid Research

### HackerOne and Bugcrowd

Used by `bug-bounty-programs` (C) and `ai-redteam-bounties` (C).

- **Policy**: https://www.hackerone.com/policies/terms and https://www.bugcrowd.com/ (platform terms)
- **Automate**: scanners only within the program scope and at its stated automation and rate limits.
- **Human**: manual validation, report writing, triage replies, NDAs.
- **Rules**: testing outside scope is a computer-crime offence. Payouts are blocked to OFAC-sanctioned persons and banks.
- **Payout**: HackerOne has no PayPal minimum, $15 for crypto, $50 for local bank and $100 for SWIFT (https://docs.hackerone.com/en/articles/8395720-payment-preferences). Bugcrowd pays by PayPal or bank, with a payment threshold you set (https://docs.bugcrowd.com/researchers/payments/frequently-asked-questions-payment-methods/). Intigriti's EUR 50 minimum is unconfirmed; funds arrive in 1-3 working days in Belgium and 3-5 elsewhere. huntr (AI/ML bounties) has no published payout terms in the catalog.

### Outlier (Scale AI)

Used by `generalist-rlhf-ai-training` (C) and `expert-ai-training` (C).

- **Policy**: https://outlier.ai/
- **Human**: tasks must be done by the worker personally. AI-generated submissions are forbidden and lead to removal.
- **Accounts**: one per person, with an ID check. Projects restrict which countries they accept (about 50-61 countries).
- **Payout**: weekly. PayPal and Airtm come from third-party reviews (unconfirmed), and no minimum is stated.
- **Alternatives**: DataAnnotation pays about $25-50 per hour by PayPal, on request with no stated minimum (https://www.dataannotation.tech/faq). Alignerr pays weekly (https://www.alignerr.com/). Mercor advertises daily payouts and an average contracted rate of $91 per hour (https://www.mercor.com/). Remotasks is listed as legacy.

### Other catalog platforms

One line each, with the catalog's figures. Check the source before relying on a figure.

- **Prolific** (`academic-research-studies`, `paid-research-interviews`): £6/$6 minimum, on demand once a day via PayPal; studies must pay at least £6/$8 per hour. CloudResearch Connect pays from $5 (PayPal) or $25 (bank). Source: https://participant-help.prolific.com/en/article/3bfbb2
- **Respondent, User Interviews and dscout** (`paid-research-interviews`): Respondent pays per study via Tremendous in 5-7 days; the others were not re-checked. Source: https://www.respondent.io/participants
- **UserTesting, Userlytics and Trymata** (`remote-usability-testing`): UserTesting pays via PayPal about 14 days after each test; Userlytics pays $10-50 per study every 15 days. Source: https://www.usertesting.com/get-paid-to-test
- **Rev, TranscribeMe and GoTranscript** (`transcription-work`): Rev pays $0.40-1.10 per audio minute, weekly via PayPal; TranscribeMe $15-22 per audio hour. Source: https://www.rev.com/freelancers
- **Clickworker, UHRS, Mindrift and Appen CrowdGen** (`crowd-microtask-platforms`): Clickworker pays from €/$10 (PayPal, SEPA, ACH) or €/$20 (Payoneer); Mindrift pays on the 5th and 20th. Source: https://support-workplace.clickworker.com/en/support/solutions/articles/80000672348-what-do-i-have-to-do-to-receive-payment-from-clickworker-
- **TELUS Digital AI Community and RWS TrainAI** (`search-and-ai-rating`): monthly invoice by bank or Payoneer (estimated). Source: https://www.mediabistro.com/jobs/2026277722-content-reviewer-us
- **DataForce Community** (`dataforce-data-sourcing-projects`): paid per project after QA by wire, PayPal, Western Union, check or Tremendous; no minimum. Source: https://dataforcecommunity.transperfect.com/FAQ
- **MSPA-member mystery-shopping firms** (`online-mystery-shopping`): per assignment via PayPal or direct deposit, about 45 days (estimated). Source: https://www.mspa-americas.org/shopper-faq/
- **Survey panels: Swagbucks, Branded Surveys, PrizeRebel, Survey Junkie, Toluna, YouGov and Mobrog** (`paid-survey-panels`): $5-10 minimums; Branded Surveys pays $5 via PayPal, bank or gift cards; YouGov and Toluna thresholds not confirmed. Source: https://help.swagbucks.com/hc/en-us
- **Qmee** (`qmee-surveys-no-minimum-cashout`): no minimum; PayPal, Venmo (US) or gift cards. Source: https://www.qmee.com/
- **Google Opinion Rewards** (`google-opinion-rewards`): Play credit on Android with no threshold; PayPal on iOS (threshold undocumented). Source: https://surveys.google.com/google-opinion-rewards/
- **Receipt Hog, Ibotta, Shopmium, Checkout 51 and CoinOut** (`receipt-and-shopping-data-apps`): Ibotta pays from $20 to bank, PayPal or gift cards; Shopmium refunds within 2 business days. Source: https://help.ibotta.com/hc/en-us
- **Nielsen Computer & Mobile Panel, MobileXpression and SavvyConnect** (`passive-data-panels`): SavvyConnect pays $3 per device type per month; Nielsen's ~$50 a year per device is estimated. Source: https://www.surveysavvy.com/savvyconnect
- **Premise, Roamler, BeMyEye and Streetbees** (`retail-audit-task-apps`): $5-10 minimums; Premise pays via PayPal, Payoneer or Bitcoin (unconfirmed). Source: https://contributors.premise.com/
- **Testlio, uTest, test IO, Testbirds and Ubertesters** (`crowdtesting-bug-hunts`): Testlio pays hourly, weekly via Payoneer or PayPal; the others are reported as twice-monthly or monthly (unconfirmed). Source: https://www.testlio.com/join-the-community
- **PlaytestCloud, BetaTesting and Antidote.gg** (`game-playtesting`): PlaytestCloud pays via PayPal within 7 days of a test; BetaTesting projects pay $15-50. Source: https://www.playtestcloud.com/player-terms-of-service
- **OnlineVerdict, eJury and JuryTest** (`paid-online-juror`): OnlineVerdict pays $30-60 per case by cheque; eJury's $5-10 via PayPal is unconfirmed. Source: https://www.onlineverdict.com/jurors/
- **Slicethepie** (`slicethepie-music-reviews`): $20 minimum via PayPal, Revolut, Airtm or gift cards. Source: https://www.slicethepie.com/

## Legal Frameworks

**CAN-SPAM (US)**: accurate "From" information, clear subject lines, the message identified as an ad, a physical address, and opt-outs honoured within 10 days. You are responsible for what others send on your behalf.

**GDPR (EU) and UK GDPR**: a lawful basis for processing, data subject rights (access, correction, deletion), data minimization, security, privacy by design, and a DPA with every client whose personal data you process. PECR/ePrivacy require consent for marketing email.

**Advertising disclosure**: FTC Endorsement Guides (US) and CAP Code/ASA (UK) cover affiliate and sponsored content.

**AI transparency**: the EU AI Act requires chatbots to tell users they are AI and synthetic media to be labelled. Some US states have bot-disclosure laws.

**Marketplace income reporting**: DAC7 (EU) and Form 1099-K (US) apply above their thresholds.

**General compliance**: do not offer services that need a licence (financial advice, legal services, certified translation, tax advice). Income is taxable. Consumer protection and intellectual property laws apply.

## Rate Limiting Strategy

To respect all platforms, implement:

1. **Global Rate Limiter**: Track requests across all platforms
2. **Per-Platform Limits**: Respect individual platform limits (table above and below)
3. **Exponential Backoff**: Handle 429/403 errors and honour `Retry-After`
4. **Request Queuing**: Batch requests efficiently
5. **Cache Everything**: Minimize redundant requests

```javascript
// Platform-specific configuration (verify against current docs before use)
const PLATFORM_LIMITS = {
  github: { requestsPerHour: 5000, concurrent: 100, writesPerMinute: 80 },
  pinterest: { trialPerDay: 1000, standardPerSecondPerUser: 100 },
  etsy: { perSecond: 'per key (Developer Portal)', perDay: 'per key' },
  shopify: {
    graphqlPointsPerSecond: 100,
    restBucket: 40,
    restLeakPerSecond: 2,
  },
  printful: { requestsPerMinute: 120 },
  stripe: { liveOpsPerSecond: 100, testOpsPerSecond: 25 },
  youtube: { quotaUnitsPerDay: 10000 },
  discord: { globalPerSecond: 50 },
};

// Before any platform action:
// 1. Check that the action is allowed for automation on that platform (see "Automate")
// 2. Verify rate limit availability
// 3. Log the action for the audit trail
// 4. Execute with error handling
// 5. Update the rate limit counter
```

## Monitoring and Compliance

The money-machine should:

1. Log all platform interactions
2. Track rate limit usage
3. Monitor for ToS violations and policy-change announcements
4. Automatically pause if limits are approached or an account receives a warning
5. Generate compliance reports, including the AI-disclosure status of every published asset

## Updates Required

Review and update this document:

- Monthly: check for ToS, AI-policy and payout-threshold changes, especially items marked as catalog-only or unverified
- When adding new platforms or catalog strategies
- After any platform change
- When legal frameworks change

## Resources

- Strategy catalog: `data/strategies/*.json` (fields `platforms`, `payout`, `legality`, `availability`, `sources`)
- ToS;DR (Terms of Service; Didn't Read): https://tosdr.org/
- Platform API documentation (always authoritative)
- Legal consultation for specific jurisdictions
