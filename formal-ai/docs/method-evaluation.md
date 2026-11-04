# Method evaluation

Offline fixture sentences; occurrence-weighted lexical attestation, not reference translation accuracy. Survival = survives / all content occurrences; unknown evidence remains in the denominator. Same-sense English translation tables are an attestation proxy, not an independent proof of sense correctness. Source content words omitted from the meaning graph count as unknown; multiword meanings may cover multiple source words. Sentence round trip and chrF are not implemented.

| Disabled method    | Survives | Another meaning | Unknown | Total | Survival |  Δ pp | Changed Russian | Rebatched requests |
| ------------------ | -------: | --------------: | ------: | ----: | -------: | ----: | --------------: | -----------------: |
| None (defaults)    |      208 |               3 |      77 |   288 |   72.22% |  0.00 |               0 |                  0 |
| documentTopic      |      207 |               3 |      78 |   288 |   71.88% | -0.35 |               6 |                  0 |
| roundTrip          |      206 |               4 |      78 |   288 |   71.53% | -0.69 |               2 |                  0 |
| domainLabels       |      209 |               2 |      77 |   288 |   72.57% |  0.35 |               2 |                  0 |
| partners           |      207 |               4 |      77 |   288 |   71.88% | -0.35 |               5 |                  0 |
| entityContext      |      208 |               3 |      77 |   288 |   72.22% |  0.00 |               1 |                  0 |
| ruwikiFrequency    |      208 |               3 |      77 |   288 |   72.22% |  0.00 |               7 |                  0 |
| statisticalContext |      208 |               3 |      77 |   288 |   72.22% |  0.00 |               1 |                  0 |
| explicitContext    |      208 |               3 |      77 |   288 |   72.22% |  0.00 |               0 |                  0 |
| positionalContext  |      208 |               3 |      77 |   288 |   72.22% |  0.00 |               0 |                  0 |

A positive ablation delta means the enabled method lowers this metric. Defaults are retained; this harness does not silently disable methods.

- documentTopic off — Researchers post studies with a set reward.
  - Off: Исследователи вывешивают исследования с установленным вознаграждением.
  - Default: Исследователи помещают сообщение исследования с установленным вознаграждением.

- documentTopic off — Patrons are existing followers of your free work who pay to support you.
  - Off: Покровители существуют последователями вашего бесплатного труда, которые платят вам в опору.
  - Default: Покровители существуют подписчиками вашей бесплатной работы, которые платят вам в поддержку.

- documentTopic off — Payoneer and Wise withdrawals to local nostro accounts are possible.
  - Off: Payoneer и снятия Wise в локальные счета nostro возможны.
  - Default: Payoneer и снятия Wise в локальные основания nostro возможны.

- documentTopic off — Requires sharing location history for many surveys.
  - Off: Требует деление истории положения для многих топографических съёмок.
  - Default: Требует делиться прошлое положения для многих опросов.

- documentTopic off — Income tracks adoption, so it is slow and concentrated in popular maintainers.
  - Off: Доход отслеживает усыновление, поэтому оно медленно и концентрированно в народных мейнтейнерах.
  - Default: Доход отслеживает усыновление, поэтому оно медленно и концентрированно в популярных мейнтейнерах.

- documentTopic off — Neither homepage names the payout method, so confirm it in your contract.
  - Off: Также не домашняя страница называет метод выплаты, поэтому подтвердите его в своём контракте.
  - Default: Также не стартовая страница называет метод выплаты, поэтому подтвердите его в своём контракте.

- roundTrip off — Billing runs through Shopify, which pays partners twice monthly via Hyperwallet.
  - Off: Посылать счёт полосам через Shopify, зарплаты [which partners twice monthly via Hyperwallet].
  - Default: Посылать счёт бегам через Shopify, зарплаты [which partners twice monthly via Hyperwallet].

- roundTrip off — Each project limits which countries it accepts.
  - Off: Каждые рамки проекта [which countries it accepts].
  - Default: Каждые пределы проекта [which countries it accepts].
- **domainLabels lowers survival** by 0.35 percentage points.

- domainLabels off — Requires sharing location history for many surveys.
  - Off: Требует шарить прошлое положения для многих опросов.
  - Default: Требует делиться прошлое положения для многих опросов.

- domainLabels off — First dividend arrives at next quarterly distribution.
  - Off: Первый дивиденд прибывает в следующем квартальном распределении.
  - Default: Первый дивиденд доходит в следующем квартальном распределении.

- partners off — Use copyrighted images.
  - Off: Используйте покрытые авторским правом образы.
  - Default: Используйте покрытые авторским правом изображения.

- partners off — Use trademarked/copyrighted images.
  - Off: Используйте зарегистрированные как товарный знак/покрытые авторским правом образы.
  - Default: Используйте зарегистрированные как товарный знак/покрытые авторским правом изображения.

- partners off — A free trial.
  - Off: Свободное испытание.
  - Default: Бесплатное испытание.

- partners off — Income comes from a growing video library without needing your own traffic.
  - Off: Доход приходит из библиотеки видео биологического роста без того, чтобы нуждаться в вашем собственном трафике.
  - Default: Доход приходит из библиотеки видео биологического роста без того, чтобы нуждаться в вашем собственном движении.

- partners off — First dividend arrives at next quarterly distribution.
  - Off: Первый дивиденд прибывает в следующем квартальном распространении.
  - Default: Первый дивиденд доходит в следующем квартальном распределении.

- entityContext off — Payoneer and Wise withdrawals to local nostro accounts are possible.
  - Off: Payoneer и снятия Уайза в локальные основания nostro возможны.
  - Default: Payoneer и снятия Wise в локальные основания nostro возможны.

- ruwikiFrequency off — Advertisers pay to reach developers without tracking.
  - Off: Рекламодатели платят, чтобы доходить разработчикам без выслеживания.
  - Default: Рекламодатели платят, чтобы доходить разработчикам без отслеживания.

- ruwikiFrequency off — Patrons are existing followers of your free work who pay to support you.
  - Off: Заступники существуют подписчиками вашей бесплатной работы, которые платят вам в поддержку.
  - Default: Покровители существуют подписчиками вашей бесплатной работы, которые платят вам в поддержку.

- ruwikiFrequency off — Physical merch adds shipping.
  - Off: Физический товар добавляет перевозку.
  - Default: Физический товар добавляет отправку.

- ruwikiFrequency off — Requires sharing location history for many surveys.
  - Off: Требует шарить прошлое положения для многих опросов.
  - Default: Требует делиться прошлое положения для многих опросов.

- ruwikiFrequency off — Never pay to join, and treat any 'deposit this cheque' request as a scam.
  - Off: Никогда не платите, чтобы соединять и угощайте, как афера [any 'deposit this cheque ' request].
  - Default: Никогда не платите, чтобы соединять и лечите, как афера [any 'deposit this cheque ' request].

- ruwikiFrequency off — Must check the isBitsEnabled flag and follow Twitch Extension guidelines and review.
  - Off: Шахуйте флаг isBitsEnabled и директивы Twitch Extension фолловинга и делайте обзор [Must].
  - Default: Проверьте флаг isBitsEnabled и директивы Twitch Extension фолловинга и делайте обзор [Must].

- ruwikiFrequency off — Each project limits which countries it accepts.
  - Off: Каждые рамки проекта [which countries it accepts].
  - Default: Каждые пределы проекта [which countries it accepts].

- statisticalContext off — Some sites also exclude people working in law or insurance.
  - Off: Несколько сайтов тоже исключают людей или страхование [working in law].
  - Default: Несколько сайтов тоже исключают лиц или страхование [working in law].

Round-trip changes 2/30 seeded website sentences; 0 lose completion. Lexical survival cannot establish that those changes improve sentence meaning; incomplete outputs are shown above.

documentTopic remains at 0.5. Known qualitative regressions include studies → «сообщение исследования», traffic → «торговлю», and accounts → «основания»; lexical attestation alone cannot reliably detect those sense errors.

Run `npm run formal-ai:evaluate -- --ablate` to reproduce this table. The fixture set includes the seeded random website sample in fixture-sentences.json (30 sentences). Changed Russian is shown above for manual review. Missing Russian translation blocks and seed vocabulary without public sense anchors remain unknown.
