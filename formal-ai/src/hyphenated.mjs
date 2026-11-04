/** Productive hyphenated modifiers, after whole-word dictionary lookup. */
import { DocumentMemory, resolveSenses } from './senses.mjs';
import { readings } from './english/analyze.mjs';
import { RELATIONS } from './russian/words.mjs';
import {
  declineAdjective,
  declineNoun,
  verbForms,
} from './russian/morphology.mjs';

export function hyphenatedTitles(words) {
  return [
    ...new Set(
      words
        .filter((w) => /^[a-z]+(?:-[a-z]+)+$/.test(w))
        .flatMap((w) => {
          const parts = w.split('-');
          // "gift-card-only": shorter runs may be dictionary terms too
          const runs = [];
          for (let i = 0; i < parts.length; i += 1) {
            for (let j = i + 2; j <= parts.length - (i ? 0 : 1); j += 1) {
              runs.push(parts.slice(i, j).join(' '));
            }
          }
          return [w.replaceAll('-', ' '), ...runs, ...parts];
        })
    ),
  ];
}

function analyses(word, lexicon, context, neighbors) {
  const token = {
    text: word,
    lower: word,
    kind: 'word',
    first: true,
    index: 0,
  };
  return readings(token, lexicon)
    .flatMap((r) => {
      const own = (r.concepts || []).filter((id) => !lexicon.get(id)?.variant);
      const node = {
        pos: r.pos,
        token: 0,
        candidates: own.length ? own : r.concepts || [],
      };
      if (node.candidates.length > 1) {
        resolveSenses(
          {
            tokens: [
              token,
              ...neighbors
                .filter((w) => w !== word)
                .map((w, i) => ({
                  text: w,
                  lower: w,
                  kind: 'word',
                  index: i + 1,
                })),
            ],
            clauses: [{ subject: node }],
          },
          lexicon,
          context
        );
      }
      const ids = [...node.candidates].sort(
        (a, b) => (b === node.concept) - (a === node.concept)
      );
      return ids.map((id) => ({ ...r, ru: lexicon.get(id)?.ru }));
    })
    .filter((r) => r.ru);
}

function compose(parts, lexicon, context) {
  // "gift-card-only", "subject-matter-expert": a run of parts named by a
  // dictionary is one part
  for (let n = parts.length - 1; parts.length > 2 && n >= 2; n -= 1) {
    for (let i = 0; i + n <= parts.length; i += 1) {
      const run = parts.slice(i, i + n).join(' ');
      if (lexicon.lookup('noun', run).length) {
        return compose(
          [...parts.slice(0, i), run, ...parts.slice(i + n)],
          lexicon,
          context
        );
      }
    }
  }
  const found = parts.map((p) => analyses(p, lexicon, context, parts));
  const noun = (i) => found[i]?.find((r) => r.pos === 'noun')?.ru;
  const adjective = (i) => found[i]?.find((r) => r.pos === 'adj')?.ru;
  const last = parts.length - 1;
  const n = noun(0);
  if (last === 1 && parts[0] === 'per' && noun(1)) {
    return `за ${declineNoun(noun(1), 'acc')}`;
  }
  // A self-directed denominal modifier retains its nominal head.
  if (last === 1 && parts[0] === 'self') {
    const base = found[1]?.find(
      (r) => r.pos === 'verb' && /pp|past/.test(r.features.form)
    )?.lemma;
    const head =
      base &&
      analyses(base, lexicon, context, parts).find((r) => r.pos === 'noun')?.ru;
    if (head) {
      return `с ${declineAdjective('собственный', { gender: head.gender, case: 'ins' })} ${declineNoun(head, 'ins')}`;
    }
  }
  if (parts.length === 2 && parts[0] === 'all' && parts[1] === 'in') {
    return 'со всем включённым';
  }
  // These are productive grammatical constructions, independent of the noun.
  if (last === 1 && n && parts[1] === 'only') {
    return `только для ${declineNoun(n, 'gen')}`;
  }
  // "non-technical" → нетехнический: the negative prefix joins the adjective
  if (last === 1 && parts[0] === 'non' && adjective(1)) {
    return `не${adjective(1).lemma}`;
  }
  if (last === 1 && n && parts[1] === 'free') {
    return `без ${declineNoun(n, 'gen')}`;
  }
  if (last === 1 && n && parts[1] === 'heavy') {
    return `с упором на ${declineNoun(n, 'acc')}`;
  }
  // "in-world": a preposition and its noun
  const relation = readings(
    { text: parts[0], lower: parts[0], kind: 'word', index: 0 },
    lexicon
  ).find((r) => r.pos === 'prep')?.concepts?.[0];
  const place = RELATIONS[relation]?.place;
  if (last === 1 && place && noun(1)) {
    return `${place[0]} ${declineNoun(noun(1), place[1])}`;
  }
  const verb = found[last]?.find(
    (r) => r.pos === 'verb' && /ing|pp|past/.test(r.features.form)
  );
  if (verb) {
    const ru = /pp|past/.test(verb.features.form)
      ? verb.ru.perfective || verb.ru
      : verb.ru;
    const passive = /pp|past/.test(verb.features.form);
    const plural = verbForms(ru).present?.[5];
    const participle = passive
      ? ru.pastPassive
      : plural
          ?.replace(/([ую])т(ся)?$/, '$1щий$2')
          .replace(/([ая])т(ся)?$/, '$1щий$2');
    if (participle && last === 1 && n && parts[0] !== 'auto') {
      return `${participle} ${declineNoun(n, passive ? 'ins' : 'acc')}`;
    }
    // auto- is a productive bound prefix, not a lexical content-word exception.
    if (participle && last === 1 && parts[0] === 'auto') {
      return `автоматически ${participle}`;
    }
    const adverb = found[0]?.find((r) => r.pos === 'adv');
    if (participle && last === 1 && adverb) {
      return `${adverb.ru.lemma} ${participle}`;
    }
  }
  if (
    last === 1 &&
    noun(0) &&
    noun(1) &&
    found[0].filter((r) => r.pos === 'adj').length &&
    found[0]
      .filter((r) => r.pos === 'adj')
      .every((r) =>
        r.concepts.every((id) => lexicon.get(id)?.predicateEvidence?.restricted)
      )
  ) {
    return `с ${declineNoun(noun(1), 'ins')} ${declineNoun(noun(0), 'gen')}`;
  }
  if (last === 1 && adjective(0) && noun(1)) {
    const head = noun(1);
    return `с ${declineAdjective(adjective(0).lemma, { gender: head.gender, case: 'ins' })} ${declineNoun(head, 'ins')}`;
  }
  // "product-photo look", "subject-matter-expert notes": nouns modifying
  // the head follow it in the genitive, the last part first
  if (parts.length > 1 && parts.every((_, i) => noun(i))) {
    return {
      genitive: parts
        .map((_, i) => declineNoun(noun(i), 'gen'))
        .reverse()
        .join(' '),
    };
  }
  // A nominal/infinitival head followed by a prepositional complement.
  const prep = { on: ['по', 'dat'], per: ['за', 'acc'] };
  if (last === 2 && prep[parts[1]] && noun(2)) {
    const head =
      adjective(0) || n || found[0]?.find((r) => r.pos === 'verb')?.ru;
    if (head) {
      return `${head.pos === 'noun' ? `с ${declineNoun(head, 'ins')}` : head.lemma} ${prep[parts[1]][0]} ${declineNoun(noun(2), prep[parts[1]][1])}`;
    }
  }
  return null;
}

export function learnHyphenated(words, lexicon, topic = '') {
  const context = new DocumentMemory();
  context.setTopic(topic.replaceAll('-', ' '));
  const resolved = [];
  for (const word of words.filter((w) => w.includes('-'))) {
    if (lexicon.lookup('adj', word).length) {
      continue;
    }
    const spaced = word.replaceAll('-', ' ');
    const parts = word.split('-');
    const people = parts.map((p) =>
      analyses(p, lexicon, context, parts).find(
        (r) => r.pos === 'noun' && r.ru.animate
      )
    );
    if (
      parts.length === 2 &&
      people.every(Boolean) &&
      !lexicon.lookup('noun', word).length
    ) {
      const lemma = people.map((r) => r.lemma).join('-');
      const id = `compound:${lemma}:noun`;
      if (!lexicon.get(id)) {
        const forms = {};
        for (const number of ['sg', 'pl']) {
          for (const kase of ['nom', 'gen', 'dat', 'acc', 'ins', 'prep']) {
            forms[`${number}.${kase}`] = people
              .map((r) => declineNoun(r.ru, kase, number))
              .join('-');
          }
        }
        lexicon.add({
          id,
          en: [{ pos: 'noun', lemma, words: [lemma] }],
          prior: 0.3,
          classes: ['person'],
          ru: {
            ...people[1].ru,
            lemma: people.map((r) => r.ru.lemma).join('-'),
            forms,
          },
          source: 'compound',
        });
        resolved.push(id);
      }
      if (people[1].features?.number === 'pl') {
        lexicon.addForm(word, { pos: 'noun', lemma, feature: 'plural' });
      }
      continue;
    }
    const dictionary = ['adj', 'noun', 'adv']
      .flatMap((pos) => [word, spaced].flatMap((w) => lexicon.lookup(pos, w)))
      .map((id) => lexicon.get(id));
    const translations = dictionary.length
      ? dictionary
          .map((c) =>
            c.ru?.pos === 'noun' ? `с ${declineNoun(c.ru, 'ins')}` : c.ru?.lemma
          )
          .filter(Boolean)
      : [compose(word.split('-'), lexicon, context)].filter(Boolean);
    for (const [i, lemma] of translations.entries()) {
      const id = `compound:${word}:adj:${i}`;
      if (lexicon.get(id)) {
        continue;
      }
      lexicon.add({
        id,
        gloss: spaced,
        grounding: null,
        excludedGroundings: [],
        classes: [],
        cues: [],
        objectClasses: [],
        syntax: null,
        takes: [],
        prior: 0.3,
        en: [{ pos: 'adj', lemma: word, words: [word] }],
        ru: {
          pos: 'adj',
          lemma: lemma.genitive || lemma,
          postpositive:
            Boolean(lemma.genitive) ||
            /^(?:без|только для|с|со|за|в|на|по) /.test(lemma),
        },
        source: 'compound',
      });
      resolved.push(id);
    }
  }
  return resolved;
}
