# Meaning ranges

Measured against HEAD `849825c` on 2026-11-04. The selected concept remains a generation preference; it is no longer the only lexical meaning retained in the meta language.

## Meta links

`candidates (id …)` is the union of dictionary concepts still compatible with the available context, beside the existing scalar `concept` or `predicate`. It is emitted for nouns, finite and nonfinite verbs, attributive and predicative adjectives, and adverbs, including singleton ranges. Scalar degree and relation-adverb links use sibling `degreeCandidates` and `adverbCandidates`. Coordinated and nested phrases keep their own ranges. Existing noun `ambiguous` links remain compatible.

```lino
statement
  predicate preferred-verb
  candidates (verb-reading-1 verb-reading-2)
  complement
    kind property
    concept preferred-adjective
    candidates (adjective-reading-1 adjective-reading-2)
    degree preferred-adverb
    degreeCandidates (adverb-reading-1 adverb-reading-2)
```

A score advantage is not proof that the other senses are impossible: ranges do not collapse to the winner or to exact score ties. Explicit context views already filter the parser candidates. A direct object or passive excludes a solely intransitive verb reading. If every reading contradicts the incomplete dictionary, preserve the candidates instead of deleting the word. Other semantic and grammatical context restrictions remain incomplete; these are conservative dictionary ranges, not a claim of perfect disambiguation. The legacy preferred concept is preserved even when its scoring disagrees with a grammatical restriction.

## Reverse range and scoring

`roundTripEvidence` builds `englishRange` once in the existing public pre-pass. For each Russian lemma and source part of speech it unions the English gloss/definition features of every loaded English translation table listing that lemma, and English terms in every available Russian `перев-блок` parsed by `russianTranslations`. Different Russian senses remain in the union: narrowing the reverse side to the preferred English sense would hide added meanings. Missing reverse data is unknown, not a zero-overlap penalty.

The feature vocabulary uses the existing `glossWords` content-word tokenizer on both sides. Jaccard = intersection / union, so uncovered source features and additional Russian features both lower the score. Duplicate features do not vote twice. Source features are the union over the contextual candidates, computed before reverse scoring; no winner feeds its own meaning back into the source range. Evidence is added to every candidate score and recorded in `allEvidence` as `rangeOverlap Jaccard …`. The source range survives even when this method is disabled.

This is an intentionally coarse projection of senses onto English words, not a multilingual synset inventory. Shared gloss vocabulary is not sense identity, long definitions and incomplete reverse tables distort coverage, and the contextual range still includes semantic alternatives grammar cannot exclude. The measured regressions below rule out enabling it by default.

No new production lookup was introduced: range evidence reuses the pages already fetched by the pre-pass, including the `wiktionary-ru` bucket. No runtime dependencies or per-word rules were added. A missing _existing entityContext ablation_ request for six name pages was recorded through `fetchPages` with the unchanged project User-Agent; its English Wiktionary response is supplemental fixture data. It does not change production translations or add a Russian range request.

## Measurement and chosen weight

Reproduce with:

```sh
node formal-ai/scripts/measure-ranges.mjs
npm run formal-ai:evaluate -- --ablate
node formal-ai/scripts/read-back.mjs
FORMAL_AI_METHODS=rangeOverlap=1 node formal-ai/scripts/read-back.mjs
```

The sweep resolves the same public data once, then translates all 88 fixture sentences under each weight, including the fixed random website sample of 30 sentences. The range contribution is the only switch between rows; document topics are identical. All weights retain 76 complete sentences. Completion is not a quality measure.

| Weight | Changed / 88 | Changed website / 30 | Decision                         |
| -----: | -----------: | -------------------: | -------------------------------- |
|      0 |            0 |                    0 | Retained: no translation changes |
|    0.1 |            3 |                    1 | Rejected: regressions            |
|   0.25 |            8 |                    3 | Rejected: regressions            |
|    0.5 |           20 |                    9 | Rejected: regressions            |
|      1 |           26 |                   13 | Rejected: regressions            |
|      2 |           32 |                   17 | Rejected: regressions            |

**Default: `METHODS.rangeOverlap = 0`.** Even 0.1 changes “A free trial” from «Бесплатное испытание» to «Свободный суд» and patrons from «Покровители» to «Заступники». Larger weights improve traffic → «трафик» in one sentence but introduce table → «таблица», uses → «употребляет», names → «назначает», and check → «шахуйте». There is no measured positive weight whose changes are all improvements. Weight zero changes none of the 30 website translations.

Final default ablation: 199 survives, 3 another-meaning, 77 unknown, 279 content occurrences (71.33% lexical attestation). Disabling `rangeOverlap` changes 0 translations and 0 percentage points. See [method-evaluation.md](method-evaluation.md) for all registered-method ablations. Lexical attestation does not establish sense correctness.

Read-back, before and retained default: 71/76 (93.4%); English round trip: 75/76; full circle: 70/76. At experimental weight 1: read-back 70/76 (92.1%), English 75/76, full circle 69/76. Word-for-word English regeneration stays 72/76. Reports were captured while the separately owned Russian analyser was being developed; they measure the same existing read-back entry point, not the new analyser.

## Every experimental Russian change

Each row below gives the entire Russian sentence before (weight 0), after, and every tested positive weight producing that exact after-text. Multiple after-texts for one English sentence are listed separately. Unchanged sentences are omitted. Existing bracketed leftovers and grammatical defects are preserved so the review does not hide regressions.

### I run every day.

Before: Я бегаю каждый день.

After (weight 0.5, 1, 2): Я бегаю каждые сутки.

### I have a pen.

Before: У меня есть ручка.

After (weight 2): У меня есть перо.

### The pen is on the table.

Before: Ручка на столе.

After (weight 1): Ручка на таблице.

After (weight 2): Перо на таблице.

### I use a phone.

Before: Я использую телефон.

After (weight 0.5, 1, 2): Я употребляю телефон.

### The phone is on the table.

Before: Телефон на столе.

After (weight 1, 2): Телефон на таблице.

### We sat on the river bank.

Before: Мы сели на береге.

After (weight 0.25, 0.5, 1, 2): Мы сели на береге реки.

### We started.

Before: Мы начали.

After (weight 0.25, 0.5, 1, 2): Мы запустили.

### Tom started.

Before: Том начал.

After (weight 0.25, 0.5, 1, 2): Том запустил.

### The meeting started.

Before: Собрание началось.

After (weight 0.1): Встреча началась.

After (weight 0.25, 0.5, 1, 2): Встреча запустилась.

### We wait for the bus.

Before: Мы ждём автобуса.

After (weight 2): Мы ждём шины.

### Mary uses Google.

Before: Мэри использует Google.

After (weight 0.5, 1, 2): Мэри употребляет Google.

### Use trademarked images.

Before: Используйте зарегистрированные как товарный знак образы.

After (weight 0.5, 1, 2): Употребите зарегистрированные как товарный знак образы.

### Use copyrighted images.

Before: Используйте покрытые авторским правом изображения.

After (weight 0.5, 1): Употребите покрытые авторским правом изображения.

After (weight 2): Употребите покрытые авторским правом образы.

### Use trademarked/copyrighted images.

Before: Используйте зарегистрированные как товарный знак/покрытые авторским правом изображения.

After (weight 0.5, 1): Употребите зарегистрированные как товарный знак/покрытые авторским правом изображения.

After (weight 2): Употребите зарегистрированные как товарный знак/покрытые авторским правом образы.

### A free trial.

Before: Бесплатное испытание.

After (weight 0.1, 0.25, 0.5, 1, 2): Свободный суд.

### Researchers post studies with a set reward.

Before: Исследователи помещают сообщение исследования с установленным вознаграждением.

After (weight 0.5, 1): Исследователи помещают сообщение исследования с установленной наградой.

After (weight 2): Исследователи помещают сообщение исследования с приверженной наградой.

### Advertisers pay to reach developers without tracking.

Before: Рекламодатели платят, чтобы доходить разработчикам без отслеживания.

After (weight 2): Рекламодатели платят, чтобы доходить застройщикам без отслеживания.

### Patrons are existing followers of your free work who pay to support you.

Before: Покровители существуют подписчиками вашей бесплатной работы, которые платят вам в поддержку.

After (weight 0.1, 0.25, 0.5, 1): Заступники существуют подписчиками вашей бесплатной работы, которые платят вам в поддержку.

After (weight 2): Заступники существуют последователями вашей бесплатной работы, которые платят вам в поддержку.

### Cambly connects English learners to tutors for on-demand or scheduled conversation calls.

Before: Cambly связывает учеников English репетиторам или Cambly спланировал звонки разговора [for on-demand].

After (weight 1, 2): Cambly подключает учеников English репетиторам или Cambly спланировал звонки разговора [for on-demand].

### Unlike Etsy you pay no listing fees and the marketplace brings its own traffic.

Before: Etsy, и рынок приносит его собственную торговлю [you pay no listing fees].

After (weight 0.5, 1, 2): Etsy, и рынок приносит его собственный трафик [you pay no listing fees].

### Fiscal host handles some compliance.

Before: Финансовый хозяин управляет некоторым согласием.

After (weight 0.5, 1): Фискальный хозяин управляет некоторым согласием.

After (weight 2): Фискальный хозяин сносит немного податливости.

### Income comes from a growing video library without needing your own traffic.

Before: Доход приходит из библиотеки видео биологического роста без того, чтобы нуждаться в вашем собственном движении.

After (weight 1, 2): Доход приходит из библиотеки видео биологического роста без того, чтобы желать ваше собственное движение.

### Billing runs through Shopify, which pays partners twice monthly via Hyperwallet.

Before: Посылать счёт бегам через Shopify, зарплаты [which partners twice monthly via Hyperwallet].

After (weight 2): Посылать счёт полосам через Shopify, зарплаты [which partners twice monthly via Hyperwallet].

### Long development times mean many writers see no income in the first year.

Before: Длинные месяцы развития значат много писателей [see no income in the first year].

After (weight 2): Длинные времена развития значат много писателей [see no income in the first year].

### Physical merch adds shipping.

Before: Физический товар добавляет отправку.

After (weight 1, 2): Физический товар добавляет перевозку.

### Requires sharing location history for many surveys.

Before: Требует делиться прошлое положения для многих опросов.

After (weight 0.25, 0.5): Требует делиться историю положения для многих опросов.

After (weight 1, 2): Требует делиться историю размещения для многих опросов.

### Never pay to join, and treat any 'deposit this cheque' request as a scam.

Before: Никогда не платите, чтобы соединять и лечите, как афера [any 'deposit this cheque ' request].

After (weight 1, 2): Никогда не платите, чтобы соединять и угощайте, как афера [any 'deposit this cheque ' request].

### That's different from self-publishing on Udemy or Skillshare.

Before: Это отлично или Skillshare [from self-publishing on Udemy].

After (weight 0.5, 1, 2): Это разно или Skillshare [from self-publishing on Udemy].

### Neither homepage names the payout method, so confirm it in your contract.

Before: Также не стартовая страница называет метод выплаты, поэтому подтвердите его в своём контракте.

After (weight 0.25, 0.5, 1, 2): Также не стартовая страница назначает метод выплаты, поэтому подтвердите его в своём контракте.

### Some sites also exclude people working in law or insurance.

Before: Несколько сайтов тоже исключают лиц или страхование [working in law].

After (weight 0.5): Несколько сайтов тоже исключают лиц или страховка [working in law].

After (weight 1, 2): Несколько участков тоже исключают лиц или страховка [working in law].

### Must check the isBitsEnabled flag and follow Twitch Extension guidelines and review.

Before: Проверьте флаг isBitsEnabled и директивы Twitch Extension фолловинга и делайте обзор [Must].

After (weight 0.5): Шахуйте флаг isBitsEnabled и директивы Twitch Extension фолловинга и делайте обзор [Must].

After (weight 1, 2): Шахуйте флаг isBitsEnabled и директивы Twitch Extension фолловинга и пересматривайте [Must].

### First dividend arrives at next quarterly distribution.

Before: Первый дивиденд доходит в следующем квартальном распределении.

After (weight 2): Первый дивиденд достигает в следующем квартальном распределении.

## Remaining problems

“Prices range from $5 to $50.” remains «Цены бродят от $5 до $50.» before and after the retained change (also at every tested positive weight). The loaded `range` verb concepts contain wander/classify/sieve readings, but no usable Russian candidate for “vary between limits”. A range scorer cannot select варьироваться/колебаться/составлять when none enters its candidates. General sense/translation completion and stronger contextual constraints are needed; no word-specific exception was added.

Ranges are preserved and tested for more parts of speech, but context narrowing is still partial. Gloss-token overlap alone cannot satisfy the exact-vagueness ideal. The method remains available for measurement without changing default output.

## Validation

Five new offline tests cover metadata for every content role and nonfinite predicates, retention of a non-tied alternative, coverage/addition scoring, independent grammatical filtering and the weight switch, and stubbed Russian pre-pass fetching plus union of distinct English tables.

Task-only validation on an isolated copy of HEAD (plus the same generated `website/strategies.json` input): **574/574 tests pass**, including the production offline replay and the five new range tests. `npx eslint formal-ai tests`, `npm run check:file-size`, and Prettier pass. The offline production test compares every translation with the HEAD expectations: **0/88 Russian translation differences**, so the retained default also has 0/30 website-sample regressions. No expected translations were rewritten for this task.

The shared working-tree full run also ran with localhost sockets enabled: 585/588 pass. Its three failures concern negative noun rendering in `constructions.test.mjs` and `speech.test.mjs`, and a production request absent while fixtures were being re-recorded concurrently. Shared-tree ESLint also reported formatting in the concurrently edited `src/russian/analyze/`. These files were not changed by this task; isolating this task's changes removes the failures. The protected analyser and Russian read-back files remain untouched by this task.

Files changed by this task: `src/formalize.mjs`, `src/meaning-ranges.mjs`, `src/senses.mjs`, `src/round-trip.mjs`, `src/resolve.mjs`, `src/methods.mjs`, `scripts/measure-ranges.mjs`, this document, the regenerated `docs/method-evaluation.md`, `tests/formal-ai/meaning-ranges.test.mjs`, and the supplemental public name-page fixture `wiktionary/80/800b93f547556a2943c9cfd1c8652b10428d73a8.json`. Changes made concurrently to the same `formalize.mjs` file (negation links) are separate from this task's range links. No commit was made.
