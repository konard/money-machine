/** Dictionary-backed derivation for manner adverbs and passive adjectives. */
import {
  englishEntries,
  fetchPages,
  renderRussian,
  russianTemplates,
} from './wiktionary.mjs';
import { russianEntry } from '../russian-entry.mjs';
import { publicSenses } from './sense-data.mjs';

const adjectiveTranslation = (s) =>
  s.russian.some((c) => /(?:ый|ий|ой)(?: |$)/.test(c.word));

export async function completeDerivations(plans, entries, options, context) {
  const wanted = new Set(context.words || []);
  const forms = (context.forms || []).filter(
    (f) =>
      wanted.has(f.form) &&
      f.pos === 'verb' &&
      !context.lexicon?.lookup('verb', f.lemma).length &&
      ![
        ...(entries.get(f.lemma) || []),
        ...(entries.get(`${f.lemma}/translations`) || []),
      ].some(
        (e) => e.pos === 'verb' && e.senses.some((s) => s.russian.length)
      ) &&
      /past participle|ed-form/.test(f.kind)
  );
  const adverbs = [...entries].flatMap(([word, list]) =>
    wanted.has(word) &&
    /ly$/.test(word) &&
    list.some((e) => e.pos === 'adv' && !e.rare) &&
    !plans.some(
      (p) =>
        p.lemma === word &&
        p.pos === 'adv' &&
        p.senses.some((s) => s.russian.length)
    )
      ? [{ word, base: word.replace(/ily$/, 'y').replace(/ly$/, '') }]
      : []
  );
  const pages = await fetchPages(
    adverbs.map((a) => a.base),
    options
  );
  const dictionary = new Map(
    [...pages].map(([w, p]) => [w, englishEntries(p)])
  );
  const references = [...dictionary.values()].flatMap((es) =>
    es.filter((e) => e.pos === 'adj').flatMap((e) => e.see.map((s) => s.page))
  );
  for (const [word, page] of await fetchPages(references, options)) {
    dictionary.set(word, englishEntries(page));
  }
  const adjectiveSenses = (base) =>
    publicSenses(dictionary, base, 'adj').filter((s) => !s.rare);
  const add = (lemma, pos, senses) => {
    if (!senses.length) {
      return;
    }
    let plan = plans.find((p) => p.lemma === lemma && p.pos === pos);
    if (!plan) {
      plan = { lemma, pos, senses: [] };
      plans.push(plan);
    }
    // Keep directly translated lexical senses ahead of a derived reading.
    if (
      !plan.senses.some((s) =>
        pos === 'adj' ? adjectiveTranslation(s) : s.russian.length
      )
    ) {
      plan.senses.push(...senses);
    }
  };
  const adjectives = adverbs.flatMap(({ base }) =>
    adjectiveSenses(base).flatMap((s) => s.russian)
  );
  const adjectivePages = await fetchPages(
    adjectives.map((c) => c.word),
    options
  );
  const shortNeuters = new Map();
  for (const [word, page] of adjectivePages) {
    const entry = russianTemplates(page).find(
      (e) => e.pos === 'adj' && e.headword
    );
    if (entry) {
      const rendered = await renderRussian(word, entry, options);
      const short = russianEntry('adj', word, rendered, entry.headword)
        .shortForms?.n;
      if (short) {
        shortNeuters.set(word, short);
      }
    }
  }
  for (const { word, base } of adverbs) {
    const senses = adjectiveSenses(base).flatMap((s) =>
      s.russian
        .filter((c) => shortNeuters.has(c.word) || /(?:ный|тый)$/.test(c.word))
        .slice(0, 1)
        .map((c) => ({
          ...s,
          russian: [
            {
              word: shortNeuters.get(c.word) || `${c.word.slice(0, -2)}о`,
              attested: true,
            },
          ],
          composed: true,
        }))
    );
    add(word, 'adv', senses);
  }
  const verbs = forms.flatMap((f) =>
    plans
      .filter((p) => p.lemma === f.lemma && p.pos === 'verb')
      .flatMap((p) =>
        p.senses
          .filter((s) => !s.rare && !s.side && !s.variant && s.russian.length)
          .map((sense) => ({ form: f.form, sense }))
      )
  );
  const ruPages = await fetchPages(
    verbs.flatMap((v) => v.sense.russian.map((c) => c.word.split(' ')[0])),
    options
  );
  const partners = [...ruPages.values()].flatMap((text) =>
    russianTemplates(text)
      .filter((e) => e.pos === 'verb')
      .map((e) => e.headword?.named?.pf)
      .filter(Boolean)
  );
  (await fetchPages(partners, options)).forEach((v, k) => ruPages.set(k, v));
  const rendered = new Map();
  const participle = async (word) => {
    if (rendered.has(word)) {
      return rendered.get(word);
    }
    const e = russianTemplates(ruPages.get(word) || '').find(
      (e) => e.pos === 'verb' && e.headword
    );
    if (!e) {
      return null;
    }
    const v = russianEntry(
      'verb',
      word,
      await renderRussian(word, e, options),
      e.headword
    );
    rendered.set(word, v);
    return v;
  };
  for (const { form, sense } of verbs) {
    if (
      plans.some(
        (p) =>
          p.lemma === form &&
          p.pos === 'adj' &&
          p.senses.some(adjectiveTranslation)
      )
    ) {
      continue;
    }
    for (const c of sense.russian) {
      const [head, ...tail] = c.word.split(' ');
      let v = await participle(head);
      if (v?.partner) {
        v = (await participle(v.partner)) || v;
      }
      // The productive Russian loan-verb class has a regular passive form.
      // The infinitive is dictionary-attested, even when its table omits it.
      if (!v?.pastPassive && /ировать$/.test(head)) {
        v = { pastPassive: head.replace(/ировать$/, 'ированный') };
      }
      if (!v?.pastPassive) {
        continue;
      }
      const short = v.pastPassive.replace(/нный$/, 'н').replace(/тый$/, 'т');
      add(form, 'adj', [
        {
          ...sense,
          passiveForms: Object.fromEntries(
            ['m', 'f', 'n', 'p'].map((gender, i) => [
              gender,
              [short + ['', 'а', 'о', 'ы'][i], ...tail].join(' '),
            ])
          ),
          russian: [
            { word: [v.pastPassive, ...tail].join(' '), attested: true },
          ],
          composed: true,
        },
      ]);
      break;
    }
  }
}
