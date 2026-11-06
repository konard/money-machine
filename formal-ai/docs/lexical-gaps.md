# Recurring lexical gaps

Public-data probe: `resolveText` followed by `translateDocument`, production overrides, Node 20. No English-to-Russian word overrides were added. HTTP requests retain the existing generic User-Agent.

| English                  | Before                                   | After                                    |
| ------------------------ | ---------------------------------------- | ---------------------------------------- |
| Sell old books online.   | Продайте старые книги [online].          | Продайте старые книги онлайн.            |
| Learn the basics first.  | Выучитесь учебным лагерям во-первых.     | Изучите основы сперва.                   |
| Keep the receipt.        | Храните получение.                       | Храните квитанцию.                       |
| Run ads on social media. | Управляйте рекламой на социальной медиа. | Управляйте рекламой на социальных медиа. |
| These data show growth.  | Этот рост представления данных.          | Эти данные показывают рост.              |

## Causes and general rules

- **Missing adverb translation:** [online](https://en.wiktionary.org/wiki/online#English) has an empty Russian Adverb table, while Adjective supplies `онлайн`. The [Russian entry](https://en.wiktionary.org/wiki/онлайн#Russian) independently identifies that candidate as an adverb translating the same English lemma. Empty adverb plans can now borrow sibling adjective-table candidates only with that reverse attestation; an adjective ending is never invented for the adverb.
- **Missing ordinary noun sense:** [basics](https://en.wiktionary.org/wiki/basics#English) points to `basic`, whose knowledge-sense table has no Russian translation. The military cross-reference was the only surviving translated noun sense. Empty plural-noun senses now search public Russian noun entries for the exact English plural, require that link in a definition rather than a quotation, align the English meanings, and reject ties. [основа](https://en.wiktionary.org/wiki/основа#Russian) supplies the plural fundamentals sense. Other languages and search snippets cannot supply translations.
- **Reflexive default versus direct object:** the [learn](https://en.wiktionary.org/wiki/learn#English) table starts with `учиться`, whose Russian entry supplies dative government and an infinitive construction. The scorer now mildly favors an independently attested accusative alternative when a complete English parse has a direct noun object. Explicit transitivity labels, experiencer verbs, incomplete parses and infinitive complements retain their previous treatment. Both primary and secondary reflexive senses are considered.
- **Parenthetical versus temporal adverb:** [first](https://en.wiktionary.org/wiki/first#English) lists `во-первых` before `сперва`. Reverse-attested adverb alternatives are retained when dictionary examples demonstrate parenthetical punctuation after a clause boundary. Such readings require corresponding English punctuation, so sentence-final `first` selects `сперва`. General adverb defaults are preserved.
- **Document versus action noun:** [receipt](https://en.wiktionary.org/wiki/receipt#English) already supplies `квитанция`. Corpus lookup previously considered only the first two noun readings, excluding that third reading, and frequency favored `получение`. Lookup now covers up to six readings; noun selection uses verb–object co-occurrence normalized by noun frequency, discounted for small counts. An attested core noun with object-association evidence does not receive an additional rarity penalty merely because its Russian translation is less frequent.
- **Whole multiword and target number:** [social media](https://en.wiktionary.org/wiki/social_media#English) was already learned and merged as one term. Its Russian table explicitly marks `социальные медиа` plural, but composing the Russian phrase discarded that flag. Compound construction now retains the supplied plural mark. This fixes agreement while preserving the public table's translation.
- **Mass/plural parsing:** [data](https://en.wiktionary.org/wiki/data#English) has both a plural inflection and a lexical mass reading. Translation filtering lost the former's number evidence when its base lacked a usable translation. The resolver now retains that English grammatical evidence independently. A plural determiner or following base-form predicate can select the plural reading without pluralizing ordinary compound modifiers.

## Changed implementation

`src/sources/lexical-gaps.mjs`, `src/sources/definition-translations.mjs`, `src/sources/translation-senses.mjs`, `src/sources/context-frequency.mjs`, `src/resolve.mjs`, `src/senses.mjs`, `src/sense-context.mjs`, `src/english/parser.mjs`; seven offline regression tests in `tests/formal-ai/lexical-gaps.test.mjs`, plus public replay responses and expectations.

## Website sample

Command: `node formal-ai/scripts/sample.mjs sentence 40 73519`.

The same 40 sentences were translated before and after. Completeness stayed **25/40**. An isolated copy with only this task's rules removed produced **40/40 identical outputs** to the final sample. Against the initial working-tree run, one punctuation/conjunction output changed during concurrent edits; the isolated baseline already contains that change. Full before/after text and source locations are in [lexical-gaps-sample.json](lexical-gaps-sample.json).

The existing production set also has **76/76 unchanged translations** against that isolated baseline, and live/offline replay is identical.

## Remaining limitations

`Run ads` still selects `Управляйте рекламой`; this task fixes the multiword's agreement, not that separate verb sense. The public table supplies `социальные медиа`, rather than replacing it with the related phrase `социальные сети`. The website sample still contains substantial unrelated lexical and parsing errors; completeness is not a measure of translation accuracy.

## Validation

- Seven new offline tests pass.
- `npx eslint formal-ai tests` passes.
- `npm run check:file-size` passes.
- `node --test --test-timeout=60000 tests/`: 404 tests pass, zero failures.
- Production recording: 76 live/offline translations identical.
- No commit created.
