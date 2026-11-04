# Dates and amounts evaluation

Production CLI / sample harness; seeds 20261104 and 20261105. No commits made. Another agent was editing this workspace during measurement.

## Changes

- Dictionary variants: recognize short template aliases and retain every attested expansion; preserve capitalization aliases when inheriting month senses.
- Calendar grammar: month classes come from dictionary senses, with day/month/year structure preserved through formalization. Russian uses a genitive month after a day and prepositional month after «в». Bare dates after predicates are temporal adjuncts.
- Currency amounts: search candidate Wikidata items and require matching ISO 4217 property P498. Russian unit labels pass through existing public morphology. Currency evidence takes precedence over acronym/identifier parsing. Units work before or after amounts; bounded amounts and ranges use existing Russian quantity grammar.
- Parenthetical dates: third-person predicates followed by dates remain finite clauses.
- Small noun/fragment helpers were extracted to keep parser files below 1000 lines. Five offline tests cover variants, dates, reduced participles, arbitrary P498-verified codes, rejected acronyms and parenthetical clauses.

Files: `sources/wiktionary.mjs`, `sources/currencies.mjs`, `sources/compact.mjs`, `resolve.mjs`, `english/analyze.mjs`, `english/calendar.mjs`, `english/quantity.mjs`, `english/parser.mjs`, `english/clause.mjs`, `english/fragment.mjs`, `english/noun-helpers.mjs`, `formalize.mjs`, `russian/phrase.mjs`, `tests/formal-ai/calendar-amounts.test.mjs`.

## Remaining problems

- Additional live P498 check: `USD 300; 300 EUR; INR 300.` → «300 долларов сша; 300 евро; 300 индийских рупий.» The existing label/morphology path lowercases the acronym США.
- The numeric verb “range” still selects an unrelated Russian sense. Its [English Wiktionary numeric sense](https://en.wiktionary.org/wiki/range#Verb) has no Russian translation. Finnish `vaihdella` is an attested translation; [its entry](https://en.wiktionary.org/wiki/vaihdella#Finnish) gives English `vary` and `fluctuate`. [Vary](https://en.wiktionary.org/wiki/vary#Verb) also lacks Russian translations in its English tables. `Fluctuate` adds irregular change, so following it would not establish an exact equivalent for numeric range. A reciprocal bridge was investigated and removed because it did not measurably improve output. No lexical exception was added.
- The full banking example still mishandles CASS, switch, parenthetical amount labels and the reduced paid clause. Its leftover output is shown verbatim below.
- “when checked” in the bot-blocked example still selects the wrong check sense and repeats the subject; its month/date now translates correctly.

## Verification

- `npx prettier --write` applied to changed source/test files.
- `npx eslint formal-ai tests`: passed.
- `npm run check:file-size`: passed.
- New offline tests: 5/5 passed.
- Full suite: 447/448 passed. Missing public responses were recorded without rewriting expected translations. Production replay now executes and reports four snapshot differences: “animals in the pen” improves to «Животные в загоне»; LinkedIn instructor page, long development times and concentrated maintainers also differ from the shared snapshot. The existing expected-output file was left unchanged. All other tests, including the five new offline tests and server tests, pass.
- Both 30-sentence samples retained completeness: 23/30 and 16/30. 58 Russian outputs were identical; two differed only in punctuation whitespace. No semantic regression observed.

## Concrete examples

EN: Examples checked Nov 2026: in the US, Chase pays $400 for a new Total Checking account with $1,000+ of direct deposits within 90 days (offer ends 27 Jan 2027, paid within 15 days); in the UK, CASS switch bonuses range GBP 175-300 (Barclays up to GBP 300, Santander GBP 240, HSBC GBP 220).

Before: Примеры, проверенные: в США Chase платит $400 за новый текущий счёт Total с $1 000+ прямых задатков в пределах 90 дней (предложите концам 27 джиннам 2027), 15 дней; в Великобритании премии выключателя Академия общественных наук КНР отсеивают фунт стерлингов 175–300 (Barclays), GBP 240, GBP 220 [paid within up to GBP 300].

After: Примеры, проверенные в ноябре 2026 г.: в США Chase платит $400 за новый текущий счёт Total с $1 000+ прямых задатков в пределах 90 дней (предложение заканчивается 27 января 2027 г.), 15 дней; в Великобритании премии выключателя Академия общественных наук КНР отсеивают от 175 до 300 фунтов стерлингов (Barclays), фунт стерлингов 240 Сантандера, фунт стерлингов 220 HSBC [paid within up to GBP 300].

EN: Their official fee pages were bot-blocked when checked in Nov 2026.

Before: Их официальные страницы гонорара были блокированные ботом, когда их официальные страницы гонорара зарегистрировались Nov 2026.

After: Их официальные страницы гонорара были блокированные ботом, когда их официальные страницы гонорара зарегистрировались в ноябре 2026 г.

EN: 27 Jan 2027

Before: 27 джиннов [2027]

After: 27 января 2027 г.

EN: Nov 2026

Before: Nov [2026]

After: Ноябрь 2026 г.

EN: January 2026

Before: Январь 2026

After: Январь 2026 г.

EN: on 3 March

Before: На 3 мартах

After: 3 марта

EN: Examples checked Nov 2026.

Before: Примеры проверили Nov 2026.

After: Примеры проверены в ноябре 2026 г.

EN: Bonuses range GBP 175-300.

Before: Премии отсеивают фунт стерлингов 175–300.

After: Премии отсеивают от 175 до 300 фунтов стерлингов.

EN: up to GBP 300

Before: До GBP 300

After: До 300 фунтов стерлингов

EN: (offer ends 27 Jan 2027)

Before: Предложите концам 27 джиннам 2027

After: (предложение заканчивается 27 января 2027 г.)

## Sample 20261104: 23/30 → 23/30 complete

1. `docs/legal/incorporation-costs.md`

EN: 'Freiberufler' or 'Gewerbetreibender' (Einzelunternehmen).

Before: 'Freiberufler или 'Gewerbetreibender (индивидуальный предприниматель в Германии) [' '].

After: 'Freiberufler или 'Gewerbetreibender (индивидуальный предприниматель в Германии) [' '].

2. `docs/business-plans/bandwidth-sharing.md`

EN: ISP ToS violation

Before: Нарушение ISP ToS

After: Нарушение ISP ToS

3. `strategies.json#roblox-game-devex`

EN: Legal; Roblox itself has been blocked by some governments (platform availability, not illegality of the activity).

Before: Юридический; сам Roblox блокирован некоторыми правительствами (наличие перрона, правонарушение деятельности).

After: Юридический; сам Roblox блокирован некоторыми правительствами (наличие перрона, правонарушение деятельности).

4. `strategies.json#kdp-ebooks-low-content`

EN: Legal across the set; must own rights to text and images.

Before: Через набор юридическо; завладейте права в текст и образы [must].

After: Через набор юридическо; завладейте права в текст и образы [must].

5. `strategies.json#fintech-referral-bonuses`

EN: countries where a given app is not licensed

Before: Страны, где данное приложение не лицензируется

After: Страны, где данное приложение не лицензируется

6. `docs/business-plans/esl-company-tutoring.md`

EN: NativeCamp's tutor portal shows 430 NCC per booked class and 192 NCC per 25-minute instant lesson, plus a 2,200 NCC new-tutor incentive for 100 lesson slots in two weeks; it says applications from some countries are paused.

Before: NativeCamp — портал репетитора за заказанный класс и NCC за 25, мелкий немедленный урок, плюс; оно говорит применения из некоторых стран [a 2,200 NCC new-tutor incentive for 100 lesson slots in two weeks are paused].

After: NativeCamp — портал репетитора за заказанный класс и NCC за 25, мелкий немедленный урок, плюс; оно говорит применения из некоторых стран [a 2,200 NCC new-tutor incentive for 100 lesson slots in two weeks are paused].

7. `docs/legal/incorporation-costs.md`

EN: _Confidence: estimated; last checked 2026-11-03._

Before: Confidence; длитесь, 3 [estimated checked 2026-11].

After: Confidence; длитесь, 3 [estimated checked 2026-11].

8. `docs/legal/incorporation-costs.md`

EN: Sole proprietorship ('獨資商號') registered with the city/county government.

Before: Индивидуальный предприниматель (獨資商號), с правительством города/графства [' ' registered].

After: Индивидуальный предприниматель (獨資商號), с правительством города/графства [' ' registered].

9. `strategies.json#3d-printable-model-stores`

EN: Cross-post to all stores (MakerWorld exclusives cannot be sold elsewhere under the exclusive licence)

Before: Во все магазины (эксклюзивы MakerWorld не могут быть проданы где-то в другом месте под исключительной лицензией) с поперечным столбом

After: Во все магазины (эксклюзивы MakerWorld не могут быть проданы где-то в другом месте под исключительной лицензией) с поперечным столбом

10. `strategies.json#crossword-puzzle-submissions`

EN: Database of used clues

Before: База данных используемых ключей

After: База данных используемых ключей

11. `strategies.json#data-cleaning-conversion-gigs`

EN: Process orders via pipeline + QA

Before: Заказы процесса через разработку и обеспечение качества

After: Заказы процесса через разработку и обеспечение качества

12. `docs/business-plans/domain-lease-to-own.md`

EN: AI name generation and trademark screening

Before: Создание имени ИИ и отбор товарного знака

After: Создание имени ИИ и отбор товарного знака

13. `docs/business-plans/passive-data-panels.md`

EN: Month 1-2: accumulate points

Before: Месяц 1–2: накопите пункты

After: Месяц 1–2: накопите пункты

14. `docs/business-plans/used-goods-reselling.md`

EN: Selling your own used goods is legal everywhere.

Before: Продавать ваши собственные используемые толки везде юридическо.

After: Продавать ваши собственные используемые толки везде юридическо.

15. `docs/business-plans/public-data-scraping-service.md`

EN: _Generated from `data/strategies/micro-tasks.json` by `npm run build:catalog`.

Before: Порождено из `data/strategies/micro-tasks.json` `npm run build:catalog`.

After: Порождено из `data/strategies/micro-tasks.json` `npm run build:catalog`.

16. `strategies.json#retail-audit-task-apps`

EN: Go to locations and complete tasks

Before: Го в положения и полные задания

After: Го в положения и полные задания

17. `strategies.json#smb-ppc-ads-management`

EN: policy disapproval fixes

Before: Неодобрение политики чинит

After: Неодобрение политики чинит

18. `docs/business-plans/expert-calls-and-paid-qa.md`

EN: JustAnswer pays verified professionals a share of customer payments per answer.

Before: JustAnswer платит удостоверенным профессионалам акцию платежей клиента за ответ.

After: JustAnswer платит удостоверенным профессионалам акцию платежей клиента за ответ.

19. `docs/business-plans/earnkaro-india-deal-sharing.md`

EN: Convert Flipkart, Myntra, Nykaa and other Indian store links into EarnKaro profit links, share them in WhatsApp/Telegram groups, and withdraw from ₹10.

Before: Превратите Flipkart, Myntra, Nykaa и другой магазин Indian связывают в ссылки прибыли EarnKaro, Myntra, Nykaa и другой магазин Indian шарят их в группах WhatsApp/Telegram, и Myntra, Nykaa и другой магазин Indian снимают от ₹10.

After: Превратите Flipkart, Myntra, Nykaa и другой магазин Indian связывают в ссылки прибыли EarnKaro, Myntra, Nykaa и другой магазин Indian шарят их в группах WhatsApp/Telegram, и Myntra, Nykaa и другой магазин Indian снимают от ₹10.

20. `docs/business-plans/second-life-virtual-goods.md`

EN: AI texture tools help production.

Before: Инструменты строения ИИ помогают производству.

After: Инструменты строения ИИ помогают производству.

21. `docs/business-plans/wide-ebook-distribution-aggregator.md`

EN: Publish the same ebook to every non-Amazon store plus subscription and library channels through one aggregator, instead of Amazon-exclusive KDP Select.

Before: Опубликуйте одинаковую электронную книгу в каждый магазин non-Amazon плюс подписка и каналы библиотеки через один агрегатора, Amazon-exclusive KDP Select [instead of].

After: Опубликуйте одинаковую электронную книгу в каждый магазин non-Amazon плюс подписка и каналы библиотеки через один агрегатора, Amazon-exclusive KDP Select [instead of].

22. `docs/research/platform-rules.md`

EN: **Automate**: portfolio listing, pricing and renewal decisions with a rules engine, and trademark screening before purchase.

Before: Автоматизируйте: реклама портфолио, оценка и решения обновления с движком правлений и зарегистрируйте как товарный знак просеивать до купленной вещи.

After: Автоматизируйте: реклама портфолио, оценка и решения обновления с движком правлений и зарегистрируйте как товарный знак просеивать до купленной вещи.

23. `strategies.json#used-goods-reselling`

EN: Tax reporting thresholds

Before: Пороги отчётности налога

After: Пороги отчётности налога

24. `strategies.json#bank-account-signup-bonuses`

EN: Chase pays within 15 days of meeting requirements; UK switch bonuses typically within weeks of the switch.

Before: Чейс платит в пределах 15 дней из того, чтобы встречать необходимости; премии выключателя Великобритании в пределах недель выключателя.

After: Чейс платит в пределах 15 дней из того, чтобы встречать необходимости; премии выключателя Великобритании в пределах недель выключателя.

25. `docs/business-plans/oss-bounties-algora.md`

EN: Winners are experienced contributors who specialise in one or two codebases and get assigned bounties before posting PRs.

Before: Победители — опытные благодетели, которые специализируют в одном или двух кодовых базах и мерзавце, перенесённом, прежде чем посылать PRs.

After: Победители — опытные благодетели, которые специализируют в одном или двух кодовых базах и мерзавце, перенесённом, прежде чем посылать PRs.

26. `strategies.json#pod-board-games-game-crafter`

EN: weekly (Mondays) after 30-day hold

Before: Еженедельник (понедельники) после 30, захват дня

After: Еженедельник (понедельники) после 30, захват дня

27. `docs/business-plans/study-notes-stuvia.md`

EN: Creating the original notes

Before: Создавать первоначальные заметки

After: Создавать первоначальные заметки

28. `strategies.json#developer-marketplaces-code-review`

EN: skill bar is high

Before: Планка умения высока

After: Планка умения высока

29. `docs/business-plans/fixed-rate-language-school-freelance.md`

EN: Open time slots

Before: Открытые щели времени

After: Открытые щели времени

30. `docs/business-plans/real-estate-virtual-staging.md`

EN: Upwork: variable 0-15% freelancer service fee set per contract since May 2025 (pre-May-2025 contracts 10%), per Upwork's SEC 10-Q; Upwork help pages block automated fetch.

Before: Upwork: переменная, с тех пор как смогите 2025 (pre-May), 2025 контрактов, Upwork — 10-Q; страницы помощи Upwork, которые блок автоматизировал, приносят [0-15% freelancer service fee set per contract 10% per].

After: Upwork: переменная, с тех пор как смогите 2025 (pre-May), 2025 контрактов, Upwork — 10-Q; страницы помощи Upwork, которые блок автоматизировал, приносят [0-15% freelancer service fee set per contract 10% per].

## Sample 20261105: 16/30 → 16/30 complete

1. `strategies.json#amazon-ebay-online-arbitrage`

EN: Seller identity verification

Before: Проверка тождественности продавца

After: Проверка тождественности продавца

2. `strategies.json#wordpress-freemium-plugins`

EN: Freemius publishes data on thousands of WordPress products and payouts; many WordPress businesses (e.g. plugins with Pro tiers) report six-figure ARR.

Before: Freemius публикует данные на тысячах продуктов WordPress и выплат; много предприятий WordPress (например, плагины с ярусами Pro) сообщают [six-figure ARR].

After: Freemius публикует данные на тысячах продуктов WordPress и выплат; много предприятий WordPress (например, плагины с ярусами Pro) сообщают [six-figure ARR].

3. `docs/business-plans/earnkaro-india-deal-sharing.md`

EN: Profit shows as pending within 72 hours and is confirmed after the retailer's return window.

Before: Эксплуатируйте программы, как 72 часа, после того как розничный торговец будет окном возврата [pending within is confirmed].

After: Эксплуатируйте программы, как 72 часа, после того как розничный торговец будет окном возврата [pending within is confirmed].

4. `docs/methodology.md`

EN: This page explains how every entry in the [business plans catalog](./business-plans/README.md) is screened and ranked.

Before: Эта страница объясняет, и эта страница ранжировала [how every entry in the [business plans catalog](./business-plans/README.md) is screened].

After: Эта страница объясняет, и эта страница ранжировала [how every entry in the [business plans catalog](./business-plans/README.md) is screened].

5. `docs/business-plans/online-mystery-shopping.md`

EN: never pay fees to join; follow call-recording laws; report income for tax

Before: Никогда не платите гонорары, чтобы соединять; последуйте за записывающими крик законами; сообщите доход для налога

After: Никогда не платите гонорары, чтобы соединять; последуйте за записывающими крик законами; сообщите доход для налога

6. `strategies.json#fivem-redm-script-marketplace`

EN: Tebex's official docs (fetched 2026-11) give the 15% FiveM fee, the commission-free Cfx Marketplace and withdrawal minimums.

Before: Официальные документы Tebex (2026–11), дайте гонорар 15% FiveM, Cfx Marketplace и минимумы снятия [fetched].

After: Официальные документы Tebex (2026–11), дайте гонорар 15% FiveM, Cfx Marketplace и минимумы снятия [fetched].

7. `docs/business-plans/saas-recurring-affiliate-tutorials.md`

EN: No fixed monthly cost, so any commission is profit; months count ramp-up to the first payable earnings.

Before: Без фиксированных ежемесячных расходов, поэтому комиссия — прибыль; месяцы считаются [ramp-up to the first payable earnings].

After: Без фиксированных ежемесячных расходов, поэтому комиссия — прибыль; месяцы считаются [ramp-up to the first payable earnings].

8. `strategies.json#translation-post-editing`

EN: Deliver edited files

Before: Доставьте отредактированные дела

After: Доставьте отредактированные дела

9. `docs/business-plans/bandwidth-sharing.md`

EN: Reviews report $1-3 per device per month; electricity is treated as zero because the device is already on.

Before: Пересмотры сообщают $1–3 за эмблему в месяц; электричество относится как 0, потому что эмблема уже.

After: Пересмотры сообщают $1–3 за эмблему в месяц; электричество относится как 0, потому что эмблема уже.

10. `docs/business-plans/academic-research-studies.md`

EN: Studies that match your profile appear first come, first served.

Before: Учится, что сопоставьте свой профиль, первая передача работается [appear first come].

After: Учится, что сопоставьте свой профиль, первая передача работается [appear first come].

11. `strategies.json#meta-facebook-instagram-content-monetization`

EN: Cross-posting own original videos via Meta Graph API / Business Suite scheduling

Before: Помещают сообщение креста собственные первоначальные видео через расписание Meta Graph API/Business Suite

After: Помещают сообщение креста собственные первоначальные видео через расписание Meta Graph API/Business Suite

12. `docs/business-plans/tiktok-shop-affiliate.md`

EN: Failure: never reaching the follower bar or posting without sales.

Before: Провал, а не доходить бар последователя или посылать без продаж.

After: Провал, а не доходить бар последователя или посылать без продаж.

13. `strategies.json#game-server-hosting-reseller`

EN: Elsewhere use PayPal (45/50) or a merchant of record such as Paddle/Lemon Squeezy.

Before: Где-то в другом месте используйте PayPal (45/50) или торговцу рекорда Paddle/Lemon Squeezy как.

After: Где-то в другом месте используйте PayPal (45/50) или торговцу рекорда Paddle/Lemon Squeezy как.

14. `docs/business-plans/micro-saas-merchant-of-record.md`

EN: Failure mode: a polished product with no channel to customers.

Before: Режим провала: полированный продукт с никаким каналом к клиентам.

After: Режим провала: полированный продукт с никаким каналом к клиентам.

15. `docs/business-plans/remote-contract-support-work.md`

EN: Avoid vendors that charge certification fees (Arise requires a business entity and fees).

Before: Избегите продавцов, которых сертификация цены нанимает на работу (вставайте), и гонорары [requires a business entity].

After: Избегите продавцов, которых сертификация цены нанимает на работу (вставайте), и гонорары [requires a business entity].

16. `docs/business-plans/wide-ebook-distribution-aggregator.md`

EN: Payoneer and direct deposit cover all 50 reference countries; store reach varies by country.

Before: Payoneer и прямой залог закрывают всех 50 стран ссылки; сохраняйтесь [reach varies by country].

After: Payoneer и прямой залог закрывают всех 50 стран ссылки; сохраняйтесь [reach varies by country].

17. `docs/business-plans/minecraft-mod-rewards-curseforge-modrinth.md`

EN: Month 8-12: most earn $5-30/month; a popular mod can earn hundreds

Before: Месяц 8–12: большинство зарабатывает $5–30 в месяц; народная мода может заработать ста

After: Месяц 8–12: большинство зарабатывает $5–30 в месяц; народная мода может заработать ста

18. `strategies.json#3d-printable-model-stores`

EN: MakerWorld: Exclusive Points cash withdrawal -> bank (via payout provider; users report Airwallex wire)

Before: MakerWorld: исключительные точки обналичивают снятие, крените (провайдер выплаты); пользователи сообщают провод Airwallex [via]

After: MakerWorld: исключительные точки обналичивают снятие, крените (провайдер выплаты); пользователи сообщают провод Airwallex [via]

19. `docs/research/platform-rules.md`

EN: No selling data and no message logging beyond what the app needs.

Before: Никакие данные продажи и никакая загробная жизнь рубки леса сообщения [what the app needs].

After: Никакие данные продажи и никакая загробная жизнь рубки леса сообщения [what the app needs].

20. `docs/business-plans/ai-voiceover-podcast-editing.md`

EN: Fiverr/Upwork broadly available.

Before: Fiverr/Upwork доступен.

After: Fiverr/Upwork доступен.

21. `strategies.json#cad-drafting-3d-rendering`

EN: Blender/CAD scripting for repetitive parts and lighting rigs

Before: Blender, который пишет сценарий для повторных частей и освещения, /система автоматизированного проектирования фальсифицирует

After: Blender, который пишет сценарий для повторных частей и освещения,/система автоматизированного проектирования фальсифицирует

22. `strategies.json#real-estate-virtual-staging`

EN: Win photographers with batch pricing

Before: Добейтесь фотографов с оценкой партии

After: Добейтесь фотографов с оценкой партии

23. `docs/business-plans/sell-datasets.md`

EN: You compile data from sources whose licence allows commercial reuse (open-government data, your own measurements, synthetic generation), document it, and list it.

Before: Вы компилируете данные от источников (данные с открытым правительством), ваши собственные размеры, синтетическое поколение, документируйте его и внесите в список его [whose licence allows commercial reuse].

After: Вы компилируете данные от источников (данные с открытым правительством), ваши собственные размеры, синтетическое поколение, документируйте его и внесите в список его [whose licence allows commercial reuse].

24. `docs/business-plans/shopee-affiliate-sea-brazil.md`

EN: Brazil (Programa de Afiliados Termos e Condições): balance paid monthly within 60 days of system approval; the minimum payout is set by Shopee from time to time and shown in the affiliate dashboard (no fixed amount published); companies must issue a Nota Fiscal.

Before: Brazil (Programa): оцените платный ежемесячник в пределах 60 дней из одобрения системы; минимальная выплата кладётся Shopee время от времени, и приборная панель аффилированного лица (никакое фиксированное количество, опубликованное, ); компании должны принять Nota Fiscal [de Afiliados Termos e Condições shown in].

After: Brazil (Programa): оцените платный ежемесячник в пределах 60 дней из одобрения системы; минимальная выплата кладётся Shopee время от времени, и приборная панель аффилированного лица (никакое фиксированное количество, опубликованное,); компании должны принять Nota Fiscal [de Afiliados Termos e Condições shown in].

25. `docs/business-plans/paid-survey-panels.md`

EN: one account per person; truthful demographic profile; no VPN or automation (ToS)

Before: Один счёт за человека; правдивый демографический профиль; виртуальная частная сеть или автоматизация (ToS)

After: Один счёт за человека; правдивый демографический профиль; виртуальная частная сеть или автоматизация (ToS)

26. `strategies.json#reedsy-publishing-services-marketplace`

EN: Writing and selling original text is legal in all reference countries; royalties are taxable.

Before: Письменность, и продавать первоначальный текст во всех странах ссылки юридическо; царственности [taxable].

After: Письменность, и продавать первоначальный текст во всех странах ссылки юридическо; царственности [taxable].

27. `docs/business-plans/esports-coaching-metafy.md`

EN: Month 0: profile and offers (cost $0)

Before: Месяц 0: профиль и предложения (расходы $0)

After: Месяц 0: профиль и предложения (расходы $0)

28. `docs/business-plans/ai-automation-agency.md`

EN: Most people who try this earn around **$0–$800 per month** in the first year; the high figure of $15,000 is a ceiling for a focused solo operator, not a typical outcome.

Before: Большинство людей, которые судят это, зарабатывают примерно $0–$800 в месяц в первом годе; высокая фигура $15 000 — потолок для целеустремлённого самостоятельного оператора, а не типичный исход.

After: Большинство людей, которые судят это, зарабатывают примерно $0–$800 в месяц в первом годе; высокая фигура $15 000 — потолок для целеустремлённого самостоятельного оператора, а не типичный исход.

29. `docs/business-plans/exam-board-examiner-marking.md`

EN: Receive fee to bank

Before: Получите гонорар в банк

After: Получите гонорар в банк

30. `docs/business-plans/README.md`

EN: **C (<50)** — long shots or labor-heavy; included for completeness.

Before: C (50), длинные кадры; или для полноты [labor-heavy included].

After: C (50), длинные кадры; или для полноты [labor-heavy included].
