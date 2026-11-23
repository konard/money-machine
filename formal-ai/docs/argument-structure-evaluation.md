# Production argument structure evaluation

2026-11-04. Production uses public runtime data and `data/overrides`.
No changes were made to the concurrent clause/parser/phrase or website implementation.

## Causes and changes

- `src/sources/government.mjs`: a Russian definition linking an English
  prepositional predicate, such as `[[wait for]]`, now associates its `+obj`
  government with that English argument marker.
- `src/russian/naturalize.mjs`: apply learned marker government to parsed
  relational complements as well as marked objects. Temporal modifiers retain
  temporal government: “works on Monday” still gives “работает в понедельник”.
  Publicly verified given names participate in person-specific government.
- `src/sources/wiktionary.mjs`, `src/sources/sense-data.mjs`, `src/resolve.mjs`:
  preserve `+ noun` translation qualifiers, separate restricted collocations
  from unrestricted synonyms, and link reflexive alternatives only when the
  same English verb's translation tables actually attest them.
- `src/senses.mjs`: score dictionary collocations against the resolved Russian
  object lemma; give core transitive senses the same modest argument-fit bonus
  previously available only through gloss heuristics. Normalize productive
  participial spelling in definition cues, allowing “written message” to fit
  the object of “write”.
- `src/russian/naturalize.mjs`: an objectless, non-passive predicate without a
  complement clause can select its attested reflexive alternative, preserving
  its own aspect pair and conjugation rather than appending a suffix to forms.
- `tests/formal-ai/argument-structure.test.mjs`: five offline regression tests,
  including a stub-fetch integration test checking the required User-Agent.

## The one override

`data/overrides/argument-structure.lino`: **answer → отвечать**, with
`на + acc` for themes and bare dative for people. English Wiktionary's
`отвечать` and `ответить` pages supply no `+obj` annotation. Russian
Wiktionary's `отвечать` page has `актанты` data, which the learner does not
consume, but that annotation itself lists dat./ins./acc. and omits the
required `на + acc` question frame. Thus simply implementing that template
would not recover the missing preposition. No other overrides were added.

## Concrete outputs

Before is the recorded production snapshot captured before this task; after
is the final production configuration. The requested `try.mjs` harness was
also run with all ten sentences together before and after, and each final
sentence was verified separately in a fresh process. Its batch baseline
already gave “Я спрашиваю у Мэри” for “I ask Mary”, unlike the recorded snapshot;
that acceptable output is preserved.

| English                    | Before                    | After                    |
| -------------------------- | ------------------------- | ------------------------ |
| I wait for Mary.           | Я жду для Мэри.           | Я жду Мэри.              |
| We wait for the bus.       | Мы ждём для автобуса.     | Мы ждём автобуса.        |
| Tom works for Google.      | Том работает для Google.  | Том работает на Google.  |
| Mary answers the question. | Мэри отвечает вопрос.     | Мэри отвечает на вопрос. |
| I answer Tom.              | Я отвечаю Тома.           | Я отвечаю Тому.          |
| Tom asks a question.       | Том спрашивает у вопроса. | Том задаёт вопрос.       |
| I ask Mary.                | Я прошу Мэри.             | Я спрашиваю у Мэри.      |
| We met in January.         | Мы встретили в январе.    | Мы встретились в январе. |
| We write a letter.         | Мы пишем букву.           | Мы пишем письмо.         |
| Mary uses Google.          | Мэри употребляет Google.  | Мэри использует Google.  |

“Спрашиваю у Мэри” is an acceptable inquire reading; a request infinitive can
still select the separate request sense.

## Verification and snapshot review

- `node formal-ai/scripts/sample.mjs sentence 15 7` and seed `11`: 30 website
  sentences compared before and after; completeness remains 8/15 and 7/15.
  No quality regressions identified in these samples. Changes include
  objectless “sell” → “продаются” and “report income” → “Сообщите доход”.
  Concurrent time-adverb work changes “в воскресенья” to “по воскресеньям”.
- `node formal-ai/scripts/generalization.mjs`: default seed 20261104, N=100;
  isolated baseline chrF **42.250**, final **42.277**; completeness **72.0%**
  in both. The isolated baseline retained the concurrent source changes and
  removed this task's implementation changes and override.
- The public fixture directory was removed and `npm run formal-ai:record`
  rerun: **70 live/offline translations identical**, fixtures **20.16 MiB**.
- The final snapshot has 16 changed translations against the saved snapshot.
  Eleven cover the ten requested sentences plus the second objectless “met”
  sentence. Concurrent time-expression work affects that overlapping “met”
  row and “Mary works in the evening”. The four remaining changes are
  described below. “Tom works on Monday” is unchanged.
- Full tests: **284 passed, 0 failed**. ESLint, file-size and whitespace
  checks passed. Concurrent tests were included in this count.
  One unrelated concurrent time-adverb test received Prettier formatting only
  to satisfy the required repository-wide lint check.

Other changed snapshot rows:

- “Cambly connects…”: “подсоединяет” → “связывает”; a better synonym, although
  this sentence still contains unrelated parsing/lexical errors.
- “Long development times mean…”: “собираются” → “значат”; the meaning reading
  replaces the intention reading. Other pre-existing errors remain.
- “…slow and concentrated…”: “сконцентрировало” → “сконцентрировалось”; the
  objectless reflexive repairs argument structure. The sentence remains partial.
- “Advertisers pay to reach developers without tracking”: “устремиться
  разработчиков” → “прибыть разработчикам”. **Unresolved changed output**:
  core transitive evidence changes which public “reach” sense wins, while the
  advertising sense and its Russian synonym remain wrong in both versions.
  Retained with this explicit limitation because the general rule fixes the
  target core transitive selection and aggregate generalization improves;
  this row should not be mistaken for an improved advertising translation.

The additions use public evidence and general grammar; the answer frame above
is the sole hand-written lexical exception. The learner still does not infer
all semantic object classes or arbitrary Russian government from prose.
