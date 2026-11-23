# English → meta → English round trip

The invariant is equality of **every stored statement link**, as required by
[meaning-context-vision.md §0](meaning-context-vision.md#0-precision-the-meta-language-is-exactly-as-vague-as-the-text).
An exact result alone does not establish that the first formalization retained
everything the source said.

## Use

```sh
node formal-ai/bin/formal-ai.mjs roundtrip 'The children play in the park.'
node formal-ai/bin/formal-ai.mjs roundtrip --json 'The book was written by Mary.'
node formal-ai/scripts/english-round-trip.mjs /tmp/english-round-trip.json
```

The measurement command always replays `tests/formal-ai/fixtures/public` in a
new empty temporary cache with networking disabled. It loads the complete
`sentenceSet()` from `record-fixtures.mjs`: 58 basic sentences plus all 30
seeded website sentences from `fixture-sentences.json`. No new lookups or fixture
recording are needed. The optional JSON file includes both meta structures and
every differing path, value and change kind for every sentence.

`englishRoundTrip(sentence, lexicon?, options?)` returns `english`, `exact`,
`differences`, `before`, `after`, and `complete`. Like `formalize`, the synchronous
API uses an already loaded lexicon; applications can call `resolveText` first.
The CLI performs its usual public pre-pass unless `--offline` is supplied.
Both formalizations start with independent, equally initialized memories.

The generator reads only statements, punctuation, and lexicon entries. It never
reads the original sentence, token spellings, or leftovers. English forms come
from `en` entries and the public form-of index, with productive morphology as a
fallback. Closed-class pronouns, determiners, auxiliaries, prepositions and
conjunctions reuse the analyzer's grammatical inventory. Russian generation and
the lexical Russian `src/round-trip.mjs` are unchanged.

## Measurement (2026-11-04)

| Metric                                                | First generator | After grammar fixes |
| ----------------------------------------------------- | --------------: | ------------------: |
| Identical meta links, all fixture sentences           |   79/88 (89.8%) |   **81/88 (92.0%)** |
| Identical links and complete parses on both sides     |   73/88 (83.0%) |   **75/88 (85.2%)** |
| Complete parses on both sides, regardless of equality |           75/88 |               76/88 |
| Basic sentences with identical links                  |           57/58 |           **58/58** |
| Website sentences with identical links                |           22/30 |           **23/30** |

After the negation-scope links (`sharedPolarity`, `det.no`/`det.neither`,
correlative pairs) and the "pay to support you" infinitive fix: **82/88**
identical links, **76/88** identical with complete parses on both sides —
every sentence that parses completely now round trips exactly.

`complete` requires at least one statement and no unknown words or leftovers on
either side. It is a parser diagnostic, not proof of correct interpretation:
the “Patrons” example below has a complete but incorrect initial parse.

Each defined leaf is compared by its full structural path, including array
indices, candidate ranges, roles, modifiers, number, definiteness, tense,
aspect, mood, polarity, voice, and modality. Explicit nulls and empty containers
are compared too; absent and undefined fields are equivalent. Changed values
are reported as `changed` with both values, rather than counted twice as lost
and added. Source strings, sense-scoring diagnostics, and punctuation are not
statement links. Punctuation is retained during generation.

Most frequent differences after fixes (counts are links, not sentences):

| Link kind                   | Lost | Added | Changed |
| --------------------------- | ---: | ----: | ------: |
| concept                     |   11 |     9 |       2 |
| number                      |    7 |     6 |       0 |
| link (clause conjunction)   |    3 |     0 |       0 |
| type                        |    3 |     0 |       1 |
| modifiers (empty container) |    3 |     1 |       0 |
| definiteness                |    2 |     2 |       0 |
| predicate                   |    1 |     2 |       1 |
| kind (modifier category)    |    1 |     2 |       0 |
| coordination                |    0 |     2 |       0 |

Paths are intentionally not realigned: moving an entity from one role to another
loses its old links and adds its new links. Thus one incorrect attachment can
produce several concept and number differences.

## Generator gaps fixed

- Reduced passive notes: “Billed monthly.” initially generated “Is billed
  monthly.”, which parsed as a fragment. Omitting the finite copula with the
  implicit subject preserves the passive statement and its tense/aspect links.
- Shared noun subjects: “Firms pay per sheet and repeat.” initially generated
  “Firms pay per sheet and firms repeat.” The repeated subject was swallowed
  into a coordinated noun phrase. Coordinated clauses with equal noun subjects
  now share the subject, retaining both statements. Formalization currently
  drops the ellipsis flag for noun subjects, while retaining it for pronouns.
- Public irregular inflections are also registered in `lexicon.byForm`, rather
  than always copied onto `en` entries. Reading that index changes “Mary goed to
  Moscow.” to “Mary went to Moscow.”, “We meeted in January.” to “We met in
  January.”, and “The childs play in the park.” to “The children play in the
  park.” These grammatical improvements **do not increase the link score**:
  productive analysis accepted the incorrect regularized forms too.
- Unit cases also caught and fixed dropped questioned noun heads (“Which book
  do you read?”), negating `never` placement, grammatical `have` past forms,
  preservation of `no` subjects, and determiners with inconsistent input number.

## Remaining differing sentences: initial formalization defects

These seven cases account for every remaining difference above. They need
parser/sense changes rather than word-specific generation rules. They are left
visible: modifying their analyses would also change Russian output, which this
task requires preserving.

1. **“Patrons are existing followers of your free work who pay to support you.”**
   The first parse invents progressive `predicate=wikt:exist:verb:1` instead of
   a copular adjective; inside `objects.0.relative` it attaches `you` as a direct
   object of `pay` and `support` as `modifiers.0.entity.concept=wikt:support:noun:2`
   under `rel.to`. Generation gives “…that pay you to support.” The second parse
   replaces that noun relation with `complementClause.predicate=wikt:support:verb:1`
   (plus its empty objects/modifiers). This accounts for the lost relation,
   modifier kind, noun concept/number, and added predicate/container links.
2. **“Cambly connects English learners to tutors for on-demand or scheduled conversation calls.”**
   The first parse drops `for on-demand` and invents a second past-tense clause
   `statements.1.predicate=wikt:schedule:verb:2`, subject `Cambly`, link `conj.or`.
   Generation gives “…to tutors or scheduled conversation calls.” The second
   parse coordinates the calls with the tutors in `statements.0.modifiers.0.entity`
   and reads `scheduled` as `wikt:scheduled:adj:2`. The invented second statement
   disappears, losing its tense, mood, aspect, frame, polarity, predicate,
   subject, objects, type and conjunction links.
3. **“LinkedIn Learning's instructor page says only 'earn extra income'.”**
   The quoted payload is leftover; the first parse incorrectly creates
   `objects.0.concept=wikt:only:noun:1`, number singular. Generation ends at
   “says only.” Reanalysis replaces this noun object with an adverb modifier
   `wikt:only:adv:3`, losing the object concept/number and adding modifier
   concept/kind links.
4. **“Long development times mean many writers see no income in the first year.”**
   The first parse omits `see no income in the first year`, while the sense
   selector still uses those words as context. After generation omits them,
   `subject.concept` changes from `wikt:time:noun:20` to `wikt:time:noun:3`, and
   `subject.properties.0.concept` from `wikt:long:adj:1` to `wikt:long:adj:2`.
5. **“Never pay to join, and treat any 'deposit this cheque' request as a scam.”**
   The quoted object is omitted and `as a scam` becomes a separate fragment
   (`statements.2`, `link=conj.as`). In “Never pay to join and treat as a scam.”,
   reanalysis attaches that fragment as `statements.1.modifiers.0`, kind `role`.
   Its concept, number and definiteness move paths; the fragment type,
   conjunction and empty modifiers are lost. The predicate sense also changes
   from `wikt:treat:verb:9` to `wikt:treat:verb:7` after its context disappears.
6. **“Some sites also exclude people working in law or insurance.”**
   The first parse drops `working in law` and creates an `insurance` fragment
   linked by `conj.or`. “Some sites also exclude people or insurance.” reparses
   both as coordinated direct objects. This loses the fragment type, link and
   empty modifiers, moves concept/number links into coordination items, and
   changes the person sense from `wikt:person:noun:8` to `wikt:person:noun:1`.
7. **“Each project limits which countries it accepts.”**
   The first parse drops `which countries it accepts` and creates a fragment
   headed by `wikt:limit:noun:1`, number plural, determiner `det.each`, with
   `project` as its noun modifier. Those number/determiner links are inconsistent.
   Generation preserves `each` but “Each project limits.” parses as a statement
   with singular subject `project` and `predicate=wikt:limit:verb:1`. The fragment
   links disappear and the statement links are added.

There are also exact-but-incomplete cases. For example, “Direct Stripe billing
avoids the marketplace cut.” can regenerate only “Direct Stripe.” and retain
identical meta links because the first parse already omitted the rest. Such
cases count in the invariant numerator but not the complete numerator. Likewise,
an initial analysis can omit a modal (“Must check…”); equality cannot recover
information absent from both structures. Fixing these requires the source →
meta precision invariant in addition to this meta → English → meta invariant.

The offline unit vocabulary has a small known-loss regression test:
“The bank lends money.” → “The bank.” The unrecognized predicate is absent from
the first meta structure but still supplies financial sense context. The
second parse adds `entity.ambiguous` candidate links after losing that context;
the result must report `exact=false` and `complete=false`. Production fixtures
know `lend`; this particular loss concerns only the restricted unit vocabulary.

## Validation and limits

Offline tests cover statements, wh/yes-no questions, negation, imperative,
passive/progressive passive, modal, perfect/progressive/future auxiliaries,
relative subject/object gaps, coordination, plural/definite nouns, existential
clauses, passive infinitives, gerunds, dictionary morphology, comparison paths,
and the known loss.
A stubbed Wiktionary form-of response verifies irregular generation and the
required generic User-Agent. Source-free generation is tested explicitly.

Validation: 41/41 new English tests and 562/562 full repository tests pass.
`npx eslint formal-ai tests`, Prettier on changed files, and
`npm run check:file-size` pass. The full suite needs localhost access for its
existing server tests. Production replay matches HEAD for all 88 Russian
translations (zero differences); no public responses were added or re-recorded.

The fixture website subset is the repository's fixed seeded random sample of
30 website sentences. Russian replay checks the same 30 plus all basic sentences.
Concrete Russian outputs remain “Мэри шла в Москву.”, “Дети играют в парке.”,
and “Посылается счёт ежемесячно.” before and after this English-only change.

Outside the measured constructions, lexical ambiguity can still select a
different sense after English reordering. Spelling-based article selection
cannot resolve pronunciation exceptions without pronunciation data, and stress
dependent consonant doubling needs dictionary forms. More elaborate fragment
labels, emphasis, and parenthetical positioning need broader generation tests.
The API reports differences rather than copying source text to hide those gaps.
