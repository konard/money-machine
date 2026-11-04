# Grammatical partners in sense selection

The translator now uses the same attachment representation for adjective–noun
(including predicates), verb–subject/object, passive participle–noun, and
adverb–verb evidence. It matches a partner's lemma or dictionary-derived hypernym
against distinctive words in the sense's definition and usage examples. Examples
stay with their own definition; nested senses do not donate their examples.

The public pre-pass also queries Russian Wikipedia. Adjective queries are agreed
Russian phrases; verb/object, subject and adverb queries are article
co-occurrences, **not** measured bigram frequencies. Counts are normalized by
candidate lemma frequency when all compared candidates have it. A smoothed ratio
of at least three is required, confidence decreases for sparse observations, and
the bonus is capped. Duplicate translations do not multiply the smoothing mass.
Missing lookups supply no evidence. Incomplete parses do not receive the new
attachment bonus. No English/Russian word mappings were added.

## Targeted observations

These are isolated translations using the production public lexicon. Both sides
use the same recorded public data. The existing prior and other contextual scores
remain in force.

| English                      | Before                   | After                    |
| ---------------------------- | ------------------------ | ------------------------ |
| A free plan.                 | Свободный план.          | Свободный план.          |
| It is free.                  | Свободно.                | Свободно.                |
| Free tier available.         | Свободный ярус доступен. | Свободный ярус доступен. |
| A free trial.                | Свободное испытание.     | Бесплатное испытание.    |
| A free subscription.         | Бесплатная подписка.     | Бесплатная подписка.     |
| Prices range from $5 to $50. | Цены бродят от $5 в $50. | Цены бродят от $5 в $50. |
| edited files                 | Отредактированные дела   | Отредактированные файлы  |
| says only                    | Говорит только           | Говорит только           |

The file improvement comes from association per noun occurrence: «редактировать»
co-occurs with «дело» in 140 articles and «файл» in 125, but the standalone nouns
occur in 75,467 and 4,173 articles respectively. Raw co-occurrence counts favor
the common homonym; normalization favors the computer sense.

The free-trial improvement uses sparse phrase evidence: «бесплатное испытание»
has one recorded match and «свободное испытание» none. The uncertainty weighting
limits its contribution. «Бесплатная подписка» already had English dictionary
context supporting the price sense.

## Remaining limits

- The public entries loaded for “plan” describe drawings and intended actions;
  “tier” supplies a rank/stratum. Neither supplies the commercial reading needed
  to bridge these nouns to payment. The encyclopedia phrase counts also do not
  support changing “free plan”: «свободный план» has 13 matches and «бесплатный
  план» three; after normalization their association rates are similar. Both
  “free tier” Russian candidate phrases have zero matches. The scorer therefore
  leaves these choices unresolved instead of encoding a lexical exception.
- Standalone “It is free” has a pronoun, with no noun referent available to the
  new attachment scorer. Price versus availability requires discourse evidence.
- Wiktionary's numeric “range” definition (“Of a variable, to be able to take any
  of the values in a specified range”) has no Russian translation in the loaded
  table. Consequently no suitable Russian verb reaches the candidate set. Sense
  ranking cannot recover a missing candidate. The existing “to” rendering is
  another, independent realization issue.
- Bare “says only” already parses “only” as an adverb and translates correctly.
  A longer quotation-bearing website sentence can instead parse it as a noun;
  attachment scoring operates on that supplied part of speech and cannot turn
  a noun into an adverb. This needs quotation/attachment parsing work.

## Validation

Offline tests cover sense-local examples, grammatical attachment types,
distinctive partner/hypernym evidence, public API requests and agreement,
zero-count handling, frequency normalization, and duplicate translations.
The recording script includes all eight targeted examples.

The seeded review draws 30 sentences from the recorded website regression corpus
(seed 48173), retaining each source page as topic and the whole website as field.
The control disables only the new attachment scorer and lookup. Of the 30
sentences, 27 are unchanged and three improve without an observed regression:
“free work” uses «бесплатного труда», “set reward” uses «установленным
вознаграждением», and the quarterly dividend “distribution” uses
«распределении» instead of «распространении». Full before/after strings are in
[the sample](collocation-sense-sample.json). Existing unrelated grammar defects
remain visible in those strings.

This review caught a false hypernym match on the grammatical placeholder
“something”. Personal and indefinite pronouns are excluded using the existing
closed-class grammar tables; an offline regression assertion covers this case.

Final validation: `npm run formal-ai:record` verified 84 identical live/offline
translations. `npx eslint formal-ai tests` and `npm run check:file-size` passed.
`node --test --test-timeout=60000 tests/` passed all 458 tests (zero failures),
including the five new offline attachment tests. No commit was made.

## Changed files

- `src/english/attachments.mjs`, `src/attachment-context.mjs`, and
  `src/sources/attachment-frequency.mjs`: shared grammatical partners and scoring.
- `src/senses.mjs`, `src/resolve.mjs`, `src/sources/wiktionary.mjs`, and
  `src/sources/context-frequency.mjs`: small integration hooks and sense-local
  definition/example retention. Concurrent edits in these files were preserved.
- `tests/formal-ai/attachments.test.mjs`: offline tests.
- `scripts/record-fixtures.mjs`, public API fixtures, and
  `tests/formal-ai/fixtures/public-expected.json`: targeted examples and replay.
- This evaluation and `collocation-sense-sample.json`: evidence and limitations.

Source/script paths above are relative to `formal-ai/`; test paths are relative
to the repository root.
