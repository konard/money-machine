# Tatoeba English–Russian generalization evaluation

## Protocol

The evaluation uses public [Tatoeba search responses](https://tatoeba.org/en/api_v0/search?from=eng&to=rus&query=&sort=created&page=1), not website prose. The endpoint returned ten records per page; requesting a larger limit did not increase the returned records and changed pagination metadata. We therefore fetched 40 pages sequentially, with a one-second pause between searches and the shared fetcher's throttling, retry handling and raw JSON cache. Requests use only `formal-ai-translator/0.1 (https://github.com/konard/money-machine)`.

Only English records with **direct** Russian translations (`translations[0]`) and 4–20 word tokens were eligible. Indirect translations (`translations[1]`) were excluded. Apostrophes and internal hyphens remain inside a word. Duplicate English IDs were removed. This produced **162 eligible records**; a Fisher–Yates shuffle with mulberry32 and seed **20261104** selected **100** without replacement. The API search window contains recent contributions: this is a uniform sample of that fetched pool, not of all Tatoeba. Some Tatoeba records contain several sentences or typographical errors; these were retained.

The exact English IDs and Russian references are preserved in [generalization-sample.json](generalization-sample.json). Text belongs to Tatoeba contributors under the license recorded by the API (CC BY 2.0 FR). English and Russian IDs link to `https://tatoeba.org/en/sentences/show/ID`, which provides contributor attribution. Raw responses remain in the `tatoeba` bucket of the shared `getJson` cache. Dictionary responses also use that cache; retaining it is necessary to freeze public vocabulary evidence as well as the sentence sample.

`resolveText` receives only the sampled English text before `translateDocument` translates each record separately. References never enter resolution, sense selection, topic or document context. chrF2 uses character orders 1–6, clipped ngram counts, beta 2, NFC Unicode, case sensitivity, whitespace removal and effective orders for short strings. Precision and recall are averaged over orders before computing F2. Each record takes the maximum score over its references; the reported score is the arithmetic mean of these sentence scores on a 0–100 scale. This is sentence macro chrF, not corpus micro chrF. Punctuation and untranslated/bracketed text remain in the score. Completion means **no square brackets**, not correctness.

```sh
# New crawl (raw responses cached by src/sources/fetch.mjs)
node formal-ai/scripts/generalization.mjs 100 20261104 /tmp/tatoeba.json
# Exact saved sample, independent of changes to Tatoeba search results
node formal-ai/scripts/generalization.mjs 100 20261104 /tmp/tatoeba-replay.json \
  --input=formal-ai/docs/generalization-sample.json
# Once dictionary requests are cached, add FORMAL_AI_OFFLINE=1 to replay offline.
node formal-ai/scripts/sample.mjs sentence 30 20261104
```

The harness emits mean chrF, completion percentage and the 25 lowest scoring records with EN / every REF / OURS. Its JSON output retains all scores and parser diagnostics. Automatic tags identify bracketed parse failures, unknown words or remaining lowercase Latin words (lexical-gap **candidates**, since names can legitimately remain Latin), and internal errors. Grammar and semantic error classes require manual review; labels can overlap.

## Results

| Same sample, N=100               | Before |  After |               Change |
| -------------------------------- | -----: | -----: | -------------------: |
| Mean sentence chrF2              | 37.525 | 38.656 |               +1.130 |
| No bracketed leftovers           |    65% |    70% | +5 percentage points |
| Bracketed parse failures         |     35 |     30 |                   −5 |
| Automatic lexical-gap candidates |      3 |      3 |                    0 |
| Internal errors                  |      0 |      0 |                    0 |

Six outputs changed; all six gained chrF, five became bracket-free, and 94 were identical. Scores and all 100 Russian outputs are saved in [generalization-results.json](generalization-results.json). The before/after pair used an isolated local copy of the translator and vocabulary because the lead was concurrently changing the resolver and vocabulary. Only the finite-complement patch was applied between those measurements; the after run replayed cached public responses offline. The frozen baseline matched the initial current-resolver run exactly. These are measurements of that frozen state, not an attribution of concurrent vocabulary improvements to this patch.

The out-of-domain test exposes substantial remaining errors. A score of 38.656 and 70% bracket completion do **not** establish reliable general translation. Several low scores are acceptable paraphrases or imperfect references: for example #14085625 asks about a favorite word while its Russian references mention food; #14097239 spells planing while its reference means planning. Both remain in the scored sample.

## Top five observed error classes

Counts are records, not individual tokens. Parse coverage is automatic (square brackets); the other classes are a manual, overlapping audit of all 100 baseline outputs. Lexical/form gaps can cause a parse failure too: a bracket is an operational parser failure, not proof the parser alone caused it. Syntactic mistakes without brackets appear under predicate/clause structure. These categories are descriptive, not independent causal estimates.

| Class                          | Baseline records | Responsible code paths                                                                                                                 |
| ------------------------------ | ---------------: | -------------------------------------------------------------------------------------------------------------------------------------- |
| S: Sense/name selection        |               46 | `src/senses.mjs`; `src/english/analyze.mjs:contentReadings`; `src/resolve.mjs:resolveNames`                                            |
| P: Parse coverage              |               35 | `src/english/parser.mjs:parseTail`; `src/english/clause.mjs:parseClause/parseWhQuestion`; `src/english/verb-group.mjs`                 |
| A: Predicate/clause structure  |               20 | `src/english/verb-group.mjs`; `src/russian/naturalize.mjs:verbGroup/modalWord`; `src/russian/copula.mjs`                               |
| C: Morphology/government       |               18 | `src/russian/naturalize.mjs:renderObjects/governmentFor`; `src/russian/phrase.mjs:features/renderEntity`; `src/russian/morphology.mjs` |
| I: Literal phrase construction |               17 | `src/english/multiword.mjs`; `src/sources/wiktionary.mjs`; `src/russian/nonfinite.mjs`; `src/russian/phrase.mjs`                       |

### S: Sense/name selection — three examples

- [#14097401](https://tatoeba.org/en/sentences/show/14097401) EN: Tom doesn't help his parents. REF: Том не помогает родителям. OURS: Кот не помогает его родителям.
- [#14079740](https://tatoeba.org/en/sentences/show/14079740) EN: She speaks English with a strong German accent. REF: Она говорит по-английски с сильным немецким акцентом. OURS: Она говорит по-английски с сильным ударением Германа.
- [#14089194](https://tatoeba.org/en/sentences/show/14089194) EN: You won't learn it from Tom. REF: От Тома вы это не узнаете. / От Тома ты это не узнаешь. / От Тома вы об этом не узнаете. / От Тома ты об этом не узнаешь. / У Тома вы этому не научитесь. / У Тома ты этому не научишься. OURS: Вы не будете изучать его от кота.

### P: Parse coverage — three examples

- [#14085617](https://tatoeba.org/en/sentences/show/14085617) EN: I didn't know how you would take it. REF: Я не знал, как ты к этому отнесёшься. / Я не знал, как вы к этому отнесётесь. OURS: Я не знал [how you would take it].
- [#14081778](https://tatoeba.org/en/sentences/show/14081778) EN: I don't think I can help with that. REF: Не думаю, что могу с этим помочь. OURS: Я не думаю обо мне [can help with].
- [#14085083](https://tatoeba.org/en/sentences/show/14085083) EN: Don't you think you're drunk a little early? REF: Ты не рановато напился? / Вы не рановато напились? / Тебе не кажется, что ты рановато напился? / Вам не кажется, что вы рановато напились? OURS: Вы не думаете о вас ['re drunk a little early]?

### A: Predicate/clause structure — three examples

- [#14079638](https://tatoeba.org/en/sentences/show/14079638) EN: Something's happening over there. REF: Там что-то происходит. OURS: У чего-то есть происходить там.
- [#14086368](https://tatoeba.org/en/sentences/show/14086368) EN: The streets have become empty. REF: Улицы опустели. OURS: У улиц есть [become empty].
- [#14096359](https://tatoeba.org/en/sentences/show/14096359) EN: I wouldn't like that too if I were her. REF: Мне бы на её месте такое тоже не понравилось. OURS: Я не нравиться, если я был ей [too].

### C: Morphology/government — three examples

- [#14085623](https://tatoeba.org/en/sentences/show/14085623) EN: She told him about her childhood. REF: Она рассказала ему о своей молодости. OURS: Она рассказала его о своём детстве.
- [#14089923](https://tatoeba.org/en/sentences/show/14089923) EN: I'm tired of this life. REF: Я устала от этой жизни. OURS: Я усталый этой жизни.
- [#14085650](https://tatoeba.org/en/sentences/show/14085650) EN: He learned to rely on himself. REF: Он научился полагаться на себя. OURS: Он изучал полагаться на себе.

### I: Literal phrase construction — three examples

- [#14087594](https://tatoeba.org/en/sentences/show/14087594) EN: We played crazy golf. REF: Мы играли в мини-гольф. OURS: Мы играли в сумасшедший гольф.
- [#14085614](https://tatoeba.org/en/sentences/show/14085614) EN: My dad is busy right now. REF: Сейчас мой отец занят. / Отец сейчас занят. OURS: Мой папа занят немедленно.
- [#14095148](https://tatoeba.org/en/sentences/show/14095148) EN: Unfortunately, I don't have a driver's license. REF: К сожалению, у меня нет прав. / К сожалению, у меня нет водительских прав. OURS: К сожалению у меня нет лицензии водителя.

## General grammar change and control

Parse coverage (35/100) was the most frequent general, non-lexical class. The retained fix targets **finite-complement boundaries**, one recurring cause within that class; it does not claim to repair all 35 failures. `english/complements.mjs` probes for an overt pronoun subject followed by an agreeing finite verb. `parser.mjs:parseTail` preserves that boundary instead of consuming the subject as an object. `clause.mjs` then parses omitted-that and non-inverted wh complements, adding Russian что or retaining the wh-word. Unambiguous English subject pronouns are a small closed class; ambiguous you/it require a public dictionary that-clause frame. No content-word translation list was added. Object-controlled to-infinitives and object-only pronouns are preserved. Noun-subject complements and verb ellipsis remain limitations.

| English                                      | Before Russian                                  | After Russian                                 | chrF before → after |
| -------------------------------------------- | ----------------------------------------------- | --------------------------------------------- | ------------------: |
| I didn't know how you would take it.         | Я не знал [how you would take it].              | Я не знал, как вы взять его.                  |       16.96 → 43.22 |
| Don't you think you're drunk a little early? | Вы не думаете о вас ['re drunk a little early]? | Вы не думаете, что вы пьяны [a little early]? |       14.09 → 17.02 |
| Will you shut the door when you leave?       | Вы запрёте дверь, уходите [you]?                | Вы запрёте дверь, когда вы уходите?           |       30.36 → 47.19 |
| I don't think I can help with that.          | Я не думаю обо мне [can help with].             | Я не думаю, что я могу помогать с этим.       |       16.84 → 53.12 |
| I didn't know what you would think of this.  | Я не знал [what you would think of this].       | Я не знал, о чём вы думать этого.             |       16.25 → 30.08 |
| I'm sorry I offended you.                    | Я жалок [offended you].                         | Я жалок, что я нарушил вас.                   |        2.98 → 19.87 |

The remaining Я жалок and я нарушил вас are lexical errors, and вы взять / вы думать are unresolved conditional-mood errors; the improvement is recovery of clause structure, not a claim that these sentences are now good Russian.

The independent website control used `sample.mjs` sentence selection, 30 records, seed 20261104, with each page as topic and the whole website as field. Before and after were **18/30 complete**, with **all 30 Russian outputs byte-for-byte identical**. This checks observed regression on that control, not all possible website input.

## Worst 25 baseline records: manual review

Sorted by baseline chrF, then English ID. Every Russian reference returned for the direct link is shown. After outputs are shown when changed. All file paths below are relative to `formal-ai/src/`. These are the baseline worst 25 so the hand audit and repair remain directly comparable; the harness also prints the worst 25 for any new after run.

### 1. #14080188 — chrF 2.98 → 19.87

- EN: I'm sorry I offended you.
- REF: Прости, что я тебя обидел. / Прости за то, что я тебя обидел. / Простите за то, что я вас обидел. / Простите, что я вас обидел. / Прости, что обидел. / Простите, что обидел.
- OURS before: Я жалок [offended you].
- OURS after: Я жалок, что я нарушил вас.
- Manual classification: P/S: the zero-that finite complement is swallowed after the copular adjective; sorry/offend also select the wrong senses. Clause boundary fixed; lexical errors remain.

### 2. #14085933 — chrF 4.13

- EN: I am going to have to kill you.
- REF: Мне придётся тебя убить. / Мне придётся вас убить.
- OURS before: Я иду [to have to kill you].
- Manual classification: P/A: stacked going-to + have-to auxiliaries are treated as motion plus unparsed material (`english/verb-group.mjs`).

### 3. #14081130 — chrF 5.45

- EN: As your European customers, we are watching you.
- REF: Мы, твои европейские клиенты, следим за тобой.
- OURS before: Ас, мы смотрим вас [your European customers].
- Manual classification: P/S/C: the initial as-phrase is treated as a nominal/name-like fragment; its customer NP is left over (`english/clause.mjs`, `english/parser.mjs`).

### 4. #14094976 — chrF 6.27

- EN: I needed to be there on time.
- REF: Мне нужно было быть там вовремя.
- OURS before: Я нуждался [to be there on time].
- Manual classification: P/A: need-to + copular infinitive is not retained as a finite predicate complement (`english/parser.mjs`, `russian/nonfinite.mjs`).

### 5. #14080908 — chrF 7.48

- EN: Who chose the present for Tom?
- REF: Кто выбирал Тому подарок?
- OURS before: Настоящее для кота [chose]?
- Manual classification: P/L/S: chose has no usable verb-form reading in the resolved run; present is interpreted as the time sense, Tom as a common noun (`english/analyze.mjs`, `forms.mjs`, `senses.mjs`).

### 6. #14083035 — chrF 12.13

- EN: I left earlier so as not to meet Tom.
- REF: Я ушёл пораньше, чтобы не встретиться с Томом. / Я вышел пораньше, чтобы не встретиться с Томом.
- OURS before: Я ушёл, поэтому ас [earlier to meet Tom].
- Manual classification: P/L/I: earlier is unresolved and so as not to is not recognized as a purpose construction (`english/analyze.mjs`, `english/clause.mjs`, `russian/nonfinite.mjs`).

### 7. #14086930 — chrF 12.36

- EN: The Crusaders were losers.
- REF: Крестоносцы были неудачниками. / Крестоносцы были лузерами.
- OURS before: The Crusaders был проигравшими.
- Manual classification: S/C: Crusaders becomes an opaque singular proper name, producing singular был with a plural nominal complement (`english/analyze.mjs`, `russian/phrase.mjs`, `russian/copula.mjs`).

### 8. #14085626 — chrF 12.64

- EN: Did she have glasses or not?
- REF: Она была в очках или без?
- OURS before: У неё были стаканы [not]?
- Manual classification: P/S: glasses chooses drinking vessels and or not has no ellipsis expansion (`senses.mjs`, `english/clause.mjs`).

### 9. #14083748 — chrF 12.83

- EN: Man is a brother to man.
- REF: Человек человеку брат.
- OURS before: Мужчина — брат к мужчине.
- Manual classification: S/C: generic man chooses мужчина; brother-to is rendered with a literal к relation instead of a dative predicate relation (`senses.mjs`, `russian/phrase.mjs`).

### 10. #14086368 — chrF 14.08

- EN: The streets have become empty.
- REF: Улицы опустели.
- OURS before: У улиц есть [become empty].
- Manual classification: P/A: the perfect have become is treated as possession; the predicate adjective is lost (`english/verb-group.mjs`).

### 11. #14085083 — chrF 14.09 → 17.02

- EN: Don't you think you're drunk a little early?
- REF: Ты не рановато напился? / Вы не рановато напились? / Тебе не кажется, что ты рановато напился? / Вам не кажется, что вы рановато напились?
- OURS before: Вы не думаете о вас ['re drunk a little early]?
- OURS after: Вы не думаете, что вы пьяны [a little early]?
- Manual classification: P: the omitted-that embedded subject is consumed as an object of think; a little early also remains unparsed. The finite boundary is fixed.

### 12. #14090355 — chrF 14.14

- EN: The post office is across from the bank.
- REF: Почта напротив банка.
- OURS before: Почта [across from the bank].
- Manual classification: P: across from is not retained as a complete locative copular complement (`english/parser.mjs`, `russian/copula.mjs`).

### 13. #14079636 — chrF 14.38

- EN: Who's the guy swimming over there?
- REF: Что за парень там плывёт? / Что за чувак там плавает?
- OURS before: Кого шкот плаёт там?
- Manual classification: S/C: guy selects шкот; the question/copula structure and Russian swim form are also wrong (`senses.mjs`, `english/clause.mjs`, `russian/morphology.mjs`).

### 14. #14089194 — chrF 14.44

- EN: You won't learn it from Tom.
- REF: От Тома вы это не узнаете. / От Тома ты это не узнаешь. / От Тома вы об этом не узнаете. / От Тома ты об этом не узнаешь. / У Тома вы этому не научитесь. / У Тома ты этому не научишься.
- OURS before: Вы не будете изучать его от кота.
- Manual classification: S: learn chooses studying rather than finding out; Tom becomes кот (`senses.mjs`, `english/analyze.mjs`, `resolve.mjs:resolveNames`).

### 15. #14094914 — chrF 14.65

- EN: They won't be harmed.
- REF: Им не причинят вреда.
- OURS before: Они не будут повреждены.
- Manual classification: V: повреждены is a less natural wording for people, but largely conveys the passive harm meaning. Low chrF here is not evidence of a parser failure or a clear semantic error.

### 16. #14096359 — chrF 14.94

- EN: I wouldn't like that too if I were her.
- REF: Мне бы на её месте такое тоже не понравилось.
- OURS before: Я не нравиться, если я был ей [too].
- Manual classification: P/A: conditional would produces an infinitive without бы; too is also left over (`russian/naturalize.mjs:verbGroup/modalWord`, `english/parser.mjs`).

### 17. #14085616 — chrF 16.25 → 30.08

- EN: I didn't know what you would think of this.
- REF: Я не знал, как ты к этому отнесёшься. / Я не знал, как вы к этому отнесётесь.
- OURS before: Я не знал [what you would think of this].
- OURS after: Я не знал, о чём вы думать этого.
- Manual classification: P: a non-inverted embedded what-question is not parsed; boundary fixed, conditional mood and interpretation still wrong.

### 18. #14081778 — chrF 16.84 → 53.12

- EN: I don't think I can help with that.
- REF: Не думаю, что могу с этим помочь.
- OURS before: Я не думаю обо мне [can help with].
- OURS after: Я не думаю, что я могу помогать с этим.
- Manual classification: P: the embedded I can is consumed as an object NP, leaving its predicate unparsed. Boundary fixed.

### 19. #14085617 — chrF 16.96 → 43.22

- EN: I didn't know how you would take it.
- REF: Я не знал, как ты к этому отнесёшься. / Я не знал, как вы к этому отнесётесь.
- OURS before: Я не знал [how you would take it].
- OURS after: Я не знал, как вы взять его.
- Manual classification: P: a non-inverted embedded how-question is not parsed; boundary fixed, but would still yields an infinitive.

### 20. #14084138 — chrF 17.22

- EN: Tom didn't say anything else, although it was clear he still had something to say.
- REF: Больше Том не сказал ничего, хотя ясно было, что ему ещё есть что сказать.
- OURS before: Кот не говорил что-нибудь иначе, хотя было ясно [still had something to say].
- Manual classification: P/S: Tom is selected as a common noun, although introduces an incomplete chain, and a finite complement after clear is lost (`english/clause.mjs`, `senses.mjs`).

### 21. #14080831 — chrF 18.46

- EN: Few people know it.
- REF: Мало кто об этом знает.
- OURS before: Мало людей знают его.
- Manual classification: V: Мало людей знают его is a plausible literal rendering, while the reference uses Мало кто об этом знает. The low overlap partly reflects paraphrase and pronoun interpretation.

### 22. #14092193 — chrF 18.65

- EN: The snowman's heart has melted.
- REF: Сердце снеговика растаяло.
- OURS before: У снежной бабы есть сердце [has melted].
- Manual classification: P: the possessive clitic is taken as have and the following has melted is not attached as the predicate (`english/parser.mjs`, `english/verb-group.mjs`).

### 23. #14082786 — chrF 19.13

- EN: The slaves did the dirtiest and hardest work.
- REF: Рабы выполняли самую грязную и тяжёлую работу.
- OURS before: Рабы сделали, и самая трудная работа [the dirtiest].
- Manual classification: P: a coordinated superlative object NP is split into separate predicates/fragments (`english/quantity.mjs`, `english/parser.mjs`).

### 24. #14085641 — chrF 19.33

- EN: I no longer expect anything from anyone.
- REF: Я уже ни от кого ничего не жду.
- OURS before: Я надеюсь что-нибудь больше не из кого-нибудь.
- Manual classification: S/C/I: no longer and negative-polarity anything/anyone fail Russian negative concord; expect selects hope and from is literal из (`senses.mjs`, `russian/naturalize.mjs`, `russian/phrase.mjs`).

### 25. #14081801 — chrF 19.40

- EN: We were there. You guys weren't.
- REF: Мы там были, а вы нет.
- OURS before: Мы были там. Вы [guys were n't].
- Manual classification: P/S/A: vocative-like guys is interpreted as шкот; the second clause has an elided predicate after weren’t (`english/parser.mjs`, `english/clause.mjs`, `senses.mjs`).

## Audit ledger

The full baseline review makes the overlapping counts reproducible. Codes: S sense/name, P bracketed parse failure, A predicate/clause structure, C morphology/government, I literal phrase construction, L lexical/form gap, R source/reference mismatch, V acceptable reference variation. A dash means no issue flagged by this review, not a claim of perfect equivalence. Some observations are stylistic or depend on context; chrF itself cannot decide correctness.

| English ID | Review codes | chrF before | chrF after |
| ---------- | ------------ | ----------: | ---------: |
| 14085617   | P            |       16.96 |      43.22 |
| 14084138   | P, S         |       17.22 |      17.22 |
| 14081780   | P            |       93.71 |      93.71 |
| 14093787   | P, A         |       27.41 |      27.41 |
| 14085083   | P            |       14.09 |      17.02 |
| 14097239   | R            |       37.48 |      37.48 |
| 14081779   | —            |      100.00 |     100.00 |
| 14080831   | V            |       18.46 |      18.46 |
| 14089767   | —            |      100.00 |     100.00 |
| 14085623   | C, V         |       49.00 |      49.00 |
| 14087669   | S            |       25.12 |      25.12 |
| 14080908   | P, S, L      |        7.48 |       7.48 |
| 14087507   | C            |       26.65 |      26.65 |
| 14081130   | P, S, C      |        5.45 |       5.45 |
| 14082963   | P, C         |       23.01 |      23.01 |
| 14080848   | —            |      100.00 |     100.00 |
| 14080745   | V            |       53.23 |      53.23 |
| 14091485   | P, S         |       25.07 |      25.07 |
| 14082750   | S, A         |       31.84 |      31.84 |
| 14081253   | V            |       43.81 |      43.81 |
| 14082713   | S, C         |       20.29 |      20.29 |
| 14094937   | —            |       75.84 |      75.84 |
| 14087594   | I            |       53.81 |      53.81 |
| 14079638   | A            |       52.09 |      52.09 |
| 14085618   | C, I         |       21.24 |      21.24 |
| 14089023   | S, A, C      |       39.38 |      39.38 |
| 14085613   | I            |       51.16 |      51.16 |
| 14095155   | I            |       53.65 |      53.65 |
| 14097401   | S            |       70.94 |      70.94 |
| 14085609   | S, I         |       53.76 |      53.76 |
| 14096330   | P, S, I      |       19.61 |      19.61 |
| 14082571   | S, I         |       46.47 |      46.47 |
| 14080433   | P, S, L      |       37.77 |      37.77 |
| 14083015   | —            |       41.33 |      41.33 |
| 14081782   | S            |       40.76 |      40.76 |
| 14085622   | P, A         |       30.36 |      47.19 |
| 14085625   | R            |       26.08 |      26.08 |
| 14089748   | S, I         |       30.25 |      30.25 |
| 14088980   | S, C, I      |       36.56 |      36.56 |
| 14079511   | S, A         |       41.94 |      41.94 |
| 14080753   | —            |      100.00 |     100.00 |
| 14094914   | V            |       14.65 |      14.65 |
| 14079740   | S            |       66.37 |      66.37 |
| 14085641   | S, C, I      |       19.33 |      19.33 |
| 14085619   | P, L         |       58.09 |      58.09 |
| 14086368   | P, A         |       14.08 |      14.08 |
| 14082678   | S            |       23.07 |      23.07 |
| 14095148   | I            |       55.37 |      55.37 |
| 14081915   | S, A         |       45.54 |      45.54 |
| 14085614   | I            |       21.22 |      21.22 |
| 14085933   | P, A         |        4.13 |       4.13 |
| 14089750   | I            |       43.65 |      43.65 |
| 14094976   | P, A         |        6.27 |       6.27 |
| 14082768   | A, C         |       28.29 |      28.29 |
| 14081628   | S, C         |       39.99 |      39.99 |
| 14089533   | P            |       43.28 |      43.28 |
| 14086930   | S, C         |       12.36 |      12.36 |
| 14081778   | P            |       16.84 |      53.12 |
| 14079636   | S, C         |       14.38 |      14.38 |
| 14096359   | P, A         |       14.94 |      14.94 |
| 14087435   | S            |       32.50 |      32.50 |
| 14080853   | P, A         |       32.21 |      32.21 |
| 14096355   | —            |       42.45 |      42.45 |
| 14083748   | S, C         |       12.83 |      12.83 |
| 14082956   | —            |      100.00 |     100.00 |
| 14080407   | —            |       75.13 |      75.13 |
| 14080740   | S, A         |       25.34 |      25.34 |
| 14085621   | S, A         |       21.67 |      21.67 |
| 14087748   | P, S         |       36.05 |      36.05 |
| 14090355   | P            |       14.14 |      14.14 |
| 14080324   | S, I         |       21.22 |      21.22 |
| 14085616   | P            |       16.25 |      30.08 |
| 14089923   | C            |       66.00 |      66.00 |
| 14087465   | —            |       55.21 |      55.21 |
| 14083035   | P, I, L      |       12.13 |      12.13 |
| 14092193   | P            |       18.65 |      18.65 |
| 14095507   | S, A, I      |       28.92 |      28.92 |
| 14094909   | P            |       32.45 |      32.45 |
| 14092324   | P, S         |       32.71 |      32.71 |
| 14084842   | —            |       61.56 |      61.56 |
| 14089753   | —            |      100.00 |     100.00 |
| 14087110   | S            |       41.86 |      41.86 |
| 14080188   | P, S         |        2.98 |      19.87 |
| 14081076   | S            |       55.37 |      55.37 |
| 14089758   | V            |       28.32 |      28.32 |
| 14085626   | P, S         |       12.64 |      12.64 |
| 14082786   | P            |       19.13 |      19.13 |
| 14090651   | S, A         |       36.60 |      36.60 |
| 14089194   | S            |       14.44 |      14.44 |
| 14096318   | S, C, I      |       25.65 |      25.65 |
| 14089208   | S            |       25.45 |      25.45 |
| 14089997   | P            |       71.97 |      71.97 |
| 14094989   | S, C         |       25.45 |      25.45 |
| 14085650   | S, C         |       57.94 |      57.94 |
| 14081801   | P, S, A      |       19.40 |      19.40 |
| 14081775   | S            |       41.62 |      41.62 |
| 14085624   | P, A         |       20.98 |      20.98 |
| 14096336   | P            |       32.90 |      32.90 |
| 14082998   | P, S, A      |       30.94 |      30.94 |
| 14079410   | S            |       50.32 |      50.32 |

## Validation and remaining limits

- `npx prettier --write` ran on the changed harness, grammar files, tests and evaluation artifacts.
- `npx eslint formal-ai tests` passed.
- `npm run check:file-size` passed; all added files are also below 1,000 lines.
- `node --test --test-timeout=60000 tests/` passed: **226 tests, zero failures**. Server tests need local loopback access, so the final full run used the approved execution environment.
- Offline fixtures verify chrF arithmetic (including clipped repeats and Unicode), seeded selection, direct-link and length filtering, API pagination/deduplication/spacing/User-Agent, reference isolation, max-over-references scoring, finite complements, wh-complements, and preservation of objects and controlled infinitives.
- The final isolated offline Tatoeba replay matched all previously measured after outputs exactly; the 30 website control outputs remained identical.

Remaining problems include name/common-noun and word-sense selection, 30 bracketed records, perfect and stacked auxiliaries, conditional mood, case government, literal idioms, and noun-subject or elliptical embedded clauses. The public search window and sometimes imperfect references limit the conclusion. This run demonstrates measurable improvement on an out-of-domain sample while exposing substantial generalization failures.

This task issued no commit command. A concurrent workspace process created commit `7a59cdb`, which includes the evaluation and grammar files; the final validation notes were added afterward and remain uncommitted.
