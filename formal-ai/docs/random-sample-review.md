# Random site samples: review rounds

Each round draws random sentences from the site's own text with
`node formal-ai/scripts/sample.mjs sentence 20 <seed>` (the same seed gives
the same sample), translates them with the current translator and reviews
every result by hand. The script also reads each Russian translation back
to meta links and regenerates the English (`lost`, `changed`, `added` and
`en` lines), so information a translation drops is reported instead of
passing as "complete". A wrong word sense keeps the links' shape and is
not caught by those checks: that part is the manual review.

Statuses per sentence: `ok` complete and round-trips, `~~` complete but the
round trip reports a loss or change, `!!` untranslated words left.

## Round 1 — seed 41104

Before the fixes: 14/20 complete; by manual review about 3/20 acceptable.
After the fixes below the same seed gives 14/20 complete, 10 of them also
round-trip; the defects fixed are in sentences 5 and 12, and in general
constructions they exposed.

Fixed (general rules, no word lists):

- **Prepositional argument from the sense's own example.** "Invitations
  depend on your device" gave «зависят на»: the Russian entry has
  «от + genitive», but "on" was a free locative. An intransitive English
  sense whose usage examples show the verb followed by one marker ("it
  depends on the amount of snow") now maps that marker to the Russian
  government: «зависят от вашего устройства».
- **Possessive before a name or a noun that is also a verb.** "The site's
  FAQ says …" and "NativeCamp's tutor FAQ says …" read `'s` as "is"
  («Сайт — FAQ.», the rest silently dropped); "Tom's book is here" gave
  «Том — книга». A name after `'s`, or a noun whose verb reading is a bare
  base form (which cannot follow "is"), now starts the owned noun phrase.
- **A name keeps its possessor and noun modifiers.** «FAQ репетитора
  NativeCamp», «Мэри Тома», «ваш PayPal»: the name branch of the renderer
  had dropped them without a note.
- **No relative-clause gap in a copula with a complement.** "Tom says the
  pay is low" was read as the noun "says" with the relative clause "(that)
  the pay is low" («Голоса Тома, которые …»); a complement fills the slot a
  gap would need.
- **That-less complement clauses.** The dictionary's own usage examples
  ("He said he would be here tomorrow", "The sign says it's 50 km")
  now give the verb sense its "that" frame, and after such a verb a noun
  subject with an agreeing finite verb starts the complement: «Том
  говорит, что зарплата низка».
- **A plural mark on a written singular is no plurale tantum.**
  `{{tt+|ru|зарпла́та|f-p}}` for "pay" made every "pay" «зарплаты».
- **Light verbs are no cues.** In "to give consideration; heed; pay
  attention", "pay" was a cue of that sense of "depend", so "Pay depends
  on …" became «имеет дело на» (+3 cue, +1.2 partner evidence); in a
  verb's two-word synonym only the noun is a cue now.

Open, from the same sample (each is a lead for a later round):

- Wrong senses the round trip cannot see: "device" → «эмблема» under the
  document topic, "caps" → «пистоны», "Euro area" → «площадь европейца»,
  "controls" → «власти», "rank" → «горизонталь», "placements" →
  «трудоустройства».
- Headline noun phrases read as imperatives: "Script token cropping and
  export", "contract review (…)", "Referral/boost programs for …".
- "PayPal/Stripe -> bank": the arrow is read as a separator and "bank" as
  the verb «крениться».
- Wikidata's "Wikimedia category" item as a sense of "Category".
- "every time" + clause as a conjunction («каждый раз, когда»).
- "demographics": Wiktionary has no Russian noun; an override needs a
  singular Russian noun for an English plurale tantum.
- "(read in a browser Nov 2026)": a participle read as an imperative.
- "Pay attention to the price" → «в цену» (should be «на цену»).

### Found while checking round 1 against the replay

- **A word's contexts depended on the batch.** "We wait for the bus."
  gave «Мы ждём шины» in the full replay and «автобуса» alone: the
  Wiktionary label "stative" on a sense of "wait" was taken as a field, and
  "electronics → technique → activity → stative" in Wikidata made the
  electronics sense of "bus" agree with it once another label had loaded
  "activity"'s parents. Three fixes (`docs/architecture.md` §1): a depth
  cut no longer erases parents another label fetched; a word's contexts
  are read only within the loader's horizon from its own labels; and only
  Wiktionary's topical labels (`Module:labels/data/topical`) make a field.
- **A that-less clause is a `that` frame.** "Long development times mean
  many writers see no income" now parses with its clause; the valency
  check saw the clause only after an explicit "that", so the page topic
  chose "mean" = intend («собираются, что»). It is «значат, что» now.
- Near-tie, left as is: "Patrons" «Покровители» → «Заступники» (0.90 vs
  0.86, both dictionary translations) after the topical-label change
  removed extra pages fetched for false fields. Additive weights decide
  such ties; calibrating them is open.
