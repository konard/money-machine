/** Conservative compositional translation of dictionary verb frames. */
import {
  englishEntries,
  fetchPages,
  renderRussian,
  russianTemplates,
} from './wiktionary.mjs';
import { russianEntry, compoundNoun } from '../russian-entry.mjs';
import { declineNoun, conjugate } from '../russian/morphology.mjs';
import { glossWords } from './sense-data.mjs';

export function definitionFrame(sense, pos) {
  const text = (sense.definition || sense.gloss || '').replace(/[.]$/, '');
  const clauses = text.split(/;\s*/);
  for (const clause of clauses.reverse()) {
    const m =
      /^To ([a-z]+) (?:something|someone|somebody) as (?:a|an|the) ([a-z -]+)$/i.exec(
        clause
      ) || /^To ([a-z]+) (?:a|an|the) ([a-z -]+) to$/i.exec(clause);
    if (m) {
      return {
        verb: m[1].toLowerCase(),
        noun: m[2],
        relation: / as /.test(clause) ? 'as' : 'object',
        recipient: / to$/.test(clause),
      };
    }
  }
  if (pos === 'adj') {
    const m = /^([A-Z][a-z]+) (as|by) (?:a|an|the) ([a-z -]+)(?:,.*)?$/.exec(
      text
    );
    if (m) {
      return {
        verb: m[1].toLowerCase(),
        noun: m[3],
        relation: m[2],
        participle: true,
      };
    }
  }
  return null;
}

export async function completeVerbDefinitions(plans, options) {
  const missing = plans.flatMap((p) =>
    ['verb', 'adj'].includes(p.pos)
      ? p.senses
          .filter((s) => !s.russian.length && !s.side && !s.variant)
          .map((s) => ({ sense: s, frame: definitionFrame(s, p.pos) }))
          .filter((x) => x.frame)
      : []
  );
  if (!missing.length) {
    return;
  }
  const pages = await fetchPages(
    [...new Set(missing.flatMap((x) => [x.frame.verb, x.frame.noun]))],
    options
  );
  const entries = (word) => englishEntries(pages.get(word) || '');
  const bases = missing.flatMap(({ frame }) =>
    entries(frame.verb).flatMap((e) =>
      e.formOf.filter((f) => /past|ed-form/.test(f.kind)).map((f) => f.lemma)
    )
  );
  (await fetchPages(bases, options)).forEach((v, k) => pages.set(k, v));
  const candidate = (word, pos, context) =>
    entries(word)
      .filter((e) => e.pos === pos && !e.rare)
      .flatMap((e) => e.senses)
      .filter(
        (s) =>
          !s.rare &&
          s.russian.length &&
          !(
            s.frames?.includes('intransitive') &&
            !s.frames.includes('transitive')
          )
      )
      .sort((a, b) => {
        const want = new Set(glossWords(context, word));
        const overlap = (s) =>
          glossWords(`${s.gloss} ${s.definition || ''}`, word).filter((w) =>
            want.has(w)
          ).length;
        return (
          overlap(b) - overlap(a) || (b.languages || 0) - (a.languages || 0)
        );
      })[0]?.russian[0];
  const selected = missing.flatMap((x) => {
    const base =
      entries(x.frame.verb)
        .filter((e) => e.pos === 'verb')
        .flatMap((e) => e.formOf)[0]?.lemma || x.frame.verb;
    const context = `${x.sense.gloss} ${x.sense.definition || ''}`;
    const verb = candidate(base, 'verb', context);
    const adjective =
      x.frame.participle && candidate(x.frame.verb, 'adj', context);
    const noun = candidate(x.frame.noun, 'noun', context);
    return (verb || adjective) && noun ? [{ ...x, verb, noun, adjective }] : [];
  });
  const ruPages = await fetchPages(
    [
      ...new Set(
        selected
          .flatMap((x) => [
            x.verb?.word,
            x.adjective?.word,
            ...x.noun.word.split(' '),
          ])
          .filter(Boolean)
      ),
    ],
    options
  );
  const rendered = new Map();
  const get = async (word, pos) => {
    const key = `${pos}:${word}`;
    if (rendered.has(key)) {
      return rendered.get(key);
    }
    const e = russianTemplates(ruPages.get(word) || '').find(
      (e) => e.pos === pos && e.headword
    );
    if (!e) {
      return null;
    }
    const ru = russianEntry(
      pos,
      word,
      await renderRussian(word, e, options),
      e.headword
    );
    rendered.set(key, ru);
    return ru;
  };
  for (const { sense, frame, verb, noun, adjective } of selected) {
    let v = verb && (await get(verb.word, 'verb'));
    if (frame.participle && !adjective && v?.partner) {
      (await fetchPages([v.partner], options)).forEach((text, title) =>
        ruPages.set(title, text)
      );
      v = (await get(v.partner, 'verb')) || v;
    }
    for (const w of noun.word.split(' ')) {
      await get(w, 'noun');
    }
    const n = noun.word.includes(' ')
      ? compoundNoun(noun.word, (w) => rendered.get(`noun:${w}`))
      : await get(noun.word, 'noun');
    if (
      (!v && !adjective) ||
      !n ||
      (frame.participle && !adjective && !v.pastPassive)
    ) {
      continue;
    }
    const tail = `${frame.relation === 'as' ? 'как ' : ''}${declineNoun(n, frame.relation === 'by' ? 'ins' : 'acc')}`;
    sense.russian = [
      {
        word: `${adjective?.word || (frame.participle ? v.pastPassive : v.lemma)} ${tail}`,
        recipient: frame.recipient,
        ...(frame.participle ? { attested: true } : {}),
      },
    ];
    sense.composed = true;
  }
}

/** Inflect the lexical head with its attested paradigm, retaining its object. */
export function translatedPredicate(word, pos, russian, candidate) {
  const [head, ...rest] = word.split(' ');
  const entry = russian(head, pos, {
    word: head,
    attested: candidate?.attested,
  });
  if (!entry) {
    return null;
  }
  const tail = rest.join(' ');
  const append = (form) => form && `${form} ${tail}`;
  if (pos === 'adj') {
    return { ...entry, lemma: word };
  }
  return {
    ...entry,
    lemma: word,
    lexicalHead: entry,
    definitionTail: tail,
    present: entry.present?.map(append),
    past: entry.past?.map(append),
    imperative: append(entry.imperative),
    pastPassive: append(entry.pastPassive),
    converb: append(entry.converb),
    partner: append(entry.partner),
    ...(candidate?.recipient
      ? { government: { preposition: null, case: 'dat' } }
      : {}),
  };
}

export function conjugatePredicate(entry, features) {
  return entry.lexicalHead
    ? `${conjugate(entry.lexicalHead, features)} ${entry.definitionTail}`
    : conjugate(entry, features);
}
