# Recurring sense choices

Evaluation: 2026-11-04. No word-to-translation exceptions were added. Runtime remains Node ESM with no dependencies.

## Before / after

These are measured standalone document translations, using the same public-data pre-pass in each evaluation. The source sentences include Markdown where supplied.

| English                                                                               | Before                                                                                             | After                                                                                                 |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| The chance of receiving at least one real payout within six months is rated **3/10**. | Возможность получать не менее одной настоящей выплаты в пределах шести месяцев обругана 3/10.      | Возможность получать не менее одной настоящей выплаты в пределах шести месяцев оценена 3/10.          |
| **Foreign currency.** Capital controls: reporting only.                               | **Иностранная валюта.** Меры: сообщать только.                                                     | **Иностранная валюта.** Контроли за движением капитала: только отчётность.                            |
| Country list not verified.                                                            | Деревенский список не проверен.                                                                    | Список страны не проверен.                                                                            |
| Separate business and personal finances                                               | Отдельное занятие и личные финансы                                                                 | Отделите финансы бизнеса и личные финансы                                                             |
| **Human**: store and payment KYC, ad budget decisions, disputes and chargebacks.      | Человеческий: сохраняйтесь, и Знай своего клиента, бюджетные решения рекламы, споры [chargebacks]. | Человек: магазин, Знай своего клиента, бюджетные решения рекламы, споры и чарджбеки.                  |
| Most beginners burn their ad budget on product tests and quit.                        | Большинство дебютантов обжигают их бюджет рекламы на тестах продукта и увольнении.                 | Большинство дебютантов тратят их бюджет рекламы на тестах продукта, и большинство дебютантов бросают. |
| Platform reachable in most countries; …                                               | Доступ перрона в большинстве стран                                                                 | Платформа доступна в большинстве стран                                                                |
| Userlytics recruits more broadly.                                                     | Userlytics вербует больше [broadly].                                                               | Userlytics вербует более широко.                                                                      |

## General rules and files

- `src/english/participle-evidence.mjs`: all adjective definitions carrying usage/domain labels support the passive alternative, while an ordinary adjective definition and attested adjective complements preserve state readings.
- `src/sources/sense-data.mjs`, `src/senses.mjs`: historical labels survive translation pointers; a usage-penalized sense cannot outrank an ordinary candidate. Coordinated shared modifiers exclude alternative-item cues, so “personal” does not imply the occupation sense of “business”.
- `src/compounds.mjs`, `src/resolve.mjs`, `src/sources/terms.mjs`, `src/sources/wiktionary.mjs`: retry multiword titles after learning plural forms; distinguish a restricted definition from an equivalent; resolve missing inflected nouns and preserve independently attested noun readings alongside verb inflections. Exact Wikidata labels require dictionary/common-concept evidence, excluding named instances.
- `src/sources/productive-definitions.mjs`: follow adjective translation pointers and derive missing manner adverbs using public Russian short-neuter forms.
- `src/sources/definition-synonyms.mjs`, `src/sources/restricted-definitions.mjs`, `src/sources/definition-translations.mjs`: adjective equivalents and explicitly object-restricted verb definitions fill missing tables; an object definition supplies weaker supporting class evidence than a direct class match.
- `src/sources/context-frequency.mjs`, `src/senses.mjs`: Russian noun–predicate co-occurrences supply contextual evidence. A broader frequency-weight experiment was removed after the sample showed regressions.
- `src/english/nominal-evidence.mjs`, `src/english/parser.mjs`, `src/english/lists.mjs`, `src/english/multiword.mjs`, `src/english/shared-head.mjs`, `src/english/coordination-context.mjs`: noun-first relational modifiers, shared noun heads, compositional alternatives, and matching sentence-final coordinated verbs.
- `src/english/fact-list.mjs`, `src/english/clause.mjs`, `src/english/headline-copula.mjs`, `src/formalize.mjs`, `src/russian/fragment.mjs`: nominal colon values and focus particles, animate noun labels, and omitted present copulas before predicate adjectives.
- `src/hyphenated.mjs`: a noun modifier takes priority over an adjective when all adjective readings are restricted; this avoids the slang adjective in the sample’s “cash-out”. The compound itself still needs better public translation evidence.
- `src/sources/compact.mjs` and public fixtures: retain foreign-only language headings so live/offline analysis agrees. Production expectations were regenerated only after live/offline agreement.
- `tests/formal-ai/recurring-choices.test.mjs`: 15 offline tests with stubbed public APIs, including User-Agent checks.

## Validation

- Prettier ran on changed code and the new tests.
- `npx eslint formal-ai tests`: passed, no warnings.
- `npm run check:file-size`: passed; all JavaScript files remain below the limit.
- `node --test --test-timeout=60000 tests/`: **438 passed, 0 failed** in the shared working tree.
- Production recording: **76 live/offline translations identical**, including an empty-cache replay.
- Fixed website sample: `node formal-ai/scripts/sample.mjs sentence 30 48173`; **19/30 → 21/30** parser-complete. No previously complete sample became incomplete. Completion is not a translation-quality score. Full before/after text is in `recurring-sense-sample.json`.
- Manual comparison removed the broad frequency boost and restricted shared-head inference to common nouns. Some unchanged samples remain poor. The shared-tree sample also contains ongoing concurrent edits, so not every changed sample is attributed to this work.

## Remaining problems

- The rating predicate still omits Russian “в” before the score.
- “Capital controls” now finds the exact public term, but still inflects it as “контроли”; the regime label should normally use singular “контроль”.
- “Country list” now uses a noun genitive, but “список страны” should use the generic plural “список стран”.
- The responsibility label now uses “человек” and a noun “магазин”, and resolves “чарджбеки”; shared “store and payment KYC” scope and the KYC label itself remain awkward.
- “Burn” and “quit” now select the requested verbs, but Russian spending government (“на тесты”), reflexive possession, and repeated coordinated subjects still need work.

No commit was made by this task.
