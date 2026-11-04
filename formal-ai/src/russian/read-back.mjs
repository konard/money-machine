/**
 * Russian → meta read-back: every Russian word of a translation is read
 * back to the range of meanings it can carry (the concepts whose Russian
 * forms it is, with case/number/tense features), and that range is checked
 * against the meta links the translation came from. A translation keeps the
 * text's precision when each source link is still readable from the Russian
 * — the same concept, number, tense and polarity — and no content word
 * reads as a meaning the source did not have (docs/meaning-context-vision.md
 * §0, the EN → meta → RU → meta round trip).
 *
 * The form index is built from the same lexicon entries the generator
 * inflects (morphology.mjs), so it reads exactly what can be written.
 */
import {
  CASES,
  nounParadigm,
  verbForms,
  declineAdjective,
} from './morphology.mjs';
import * as WORDS from './words.mjs';
import { shortParticiple } from './passive.mjs';

const { PERSONAL, RELATIONS, cardinal } = WORDS;

const NEGATION = new Set(['не', 'нет', 'ни']);
const FUTURE = new Set(['буду', 'будешь', 'будет', 'будем', 'будете', 'будут']);
const GENDERS = ['m', 'f', 'n'];
// быть: the copula and possession frames (zero in the present)
const BYT = {
  был: 'past',
  была: 'past',
  было: 'past',
  были: 'past',
  есть: 'present',
  ...Object.fromEntries([...FUTURE].map((f) => [f, 'future'])),
};
const FRAMES = new Set(['copula', 'possession', 'existence', 'location']);
// grammatical words the generator writes outside the word tables
const GRAMMATICAL =
  'и или но а что чтобы потому поэтому как также тоже бы ли это так то того без для из от до при через'.split(
    ' '
  );

const lower = (s) => s.toLowerCase().replace(/ё/g, 'е');
const push = (map, key, value) => {
  if (!key) {
    return;
  }
  const k = lower(key);
  if (!map.has(k)) {
    map.set(k, []);
  }
  map.get(k).push(value);
};

/** A failed paradigm (a malformed public entry) reads nothing. */
const safe = (fn) => {
  try {
    return fn();
  } catch {
    return null;
  }
};

function indexNoun(index, id, entry) {
  const cells = safe(() => nounParadigm(entry)) || {};
  for (const [cell, form] of Object.entries(cells)) {
    const [number, kase] = cell.split('.');
    // each word of a multiword lemma (малый бизнес) reads as the concept
    for (const word of form.split(' ')) {
      push(index, word, { concept: id, pos: 'noun', number, case: kase });
    }
  }
}

/** «посылать счёт»: conjugate the head verb, the tail stays as it is. */
function headVerb(entry) {
  const tail = entry.lemma.split(' ').slice(1).join(' ');
  if (!tail) {
    return { entry, tail: [] };
  }
  const strip = (form) =>
    typeof form === 'string' ? form.replace(` ${tail}`, '') : form;
  return {
    entry: {
      ...entry,
      lemma: strip(entry.lemma),
      present: entry.present?.map(strip),
      past: entry.past?.map(strip),
      imperative: strip(entry.imperative),
      pastPassive: strip(entry.pastPassive),
    },
    tail: tail.split(' '),
  };
}

function indexVerb(index, id, original, aspect) {
  const { entry, tail } = headVerb(original);
  tail.forEach((word) => push(index, word, { concept: id, pos: 'part' }));
  const forms = safe(() => verbForms(entry));
  if (!forms) {
    return;
  }
  // «регистрирует как товарный знак»: the verb is the first word, the rest
  // are fixed words of the same meaning
  const add = (form, features) => {
    if (!form) {
      return;
    }
    const [head, ...fixed] = form.split(' ');
    push(index, head, { concept: id, pos: 'verb', aspect, ...features });
    fixed.forEach((word) => push(index, word, { concept: id, pos: 'part' }));
    // the reflexive passive of an imperfective (посылается счёт)
    if (aspect === 'impf' && !/с[яь]$/.test(head) && features.tense) {
      push(index, `${head}${/[аеиоуыэюя]$/.test(head) ? 'сь' : 'ся'}`, {
        concept: id,
        pos: 'verb',
        aspect,
        voice: 'passive',
        ...features,
      });
    }
  };
  if (entry.pastPassive) {
    // the participle agrees as an adjective, long or short (оплачен)
    indexAdjective(index, id, entry.pastPassive, 'participle');
    for (const gender of [...GENDERS, 'pl']) {
      const form = safe(() =>
        shortParticiple(entry.pastPassive, {
          gender: gender === 'pl' ? undefined : gender,
          number: gender === 'pl' ? 'pl' : 'sg',
        })
      );
      add(form, { mood: 'participle' });
    }
  }
  add(forms.infinitive, { mood: 'infinitive' });
  forms.present.forEach((form, i) =>
    add(form, {
      // a perfective present form is the future
      tense: aspect === 'perf' ? 'future' : 'present',
      person: (i % 3) + 1,
      number: i < 3 ? 'sg' : 'pl',
    })
  );
  for (const [key, form] of Object.entries(forms.past)) {
    add(form, {
      tense: 'past',
      number: key === 'pl' ? 'pl' : 'sg',
      gender: key === 'pl' ? undefined : key,
    });
  }
  add(forms.imperative.sg, { mood: 'imperative', number: 'sg' });
  add(forms.imperative.pl, { mood: 'imperative', number: 'pl' });
}

function indexAdjective(index, id, lemma, pos = 'adj') {
  // «покрытый авторским правом»: the fixed words read as the same meaning
  lemma
    .split(' ')
    .slice(1)
    .forEach((word) => push(index, word, { concept: id, pos: 'part' }));
  for (const kase of CASES) {
    for (const number of ['sg', 'pl']) {
      for (const gender of number === 'pl' ? ['m'] : GENDERS) {
        for (const animate of [false, true]) {
          const form = safe(() =>
            declineAdjective(lemma, { gender, number, case: kase, animate })
          );
          push(index, form?.split(' ')[0], {
            concept: id,
            pos,
            number,
            case: kase,
          });
        }
      }
    }
  }
}

/**
 * Russian form → readings, for every concept of the lexicon that has a
 * Russian entry, plus personal pronouns, prepositions and names.
 * @param {import('../lexicon.mjs').Lexicon} lexicon
 */
export function russianFormIndex(lexicon) {
  const index = new Map();
  for (const [id, concept] of lexicon.concepts) {
    const ru = concept.ru;
    if (ru?.pos === 'phrase' && ru.text) {
      for (const word of ru.text.match(/[\p{L}]+/gu) || []) {
        push(index, word, { concept: id, pos: 'phrase' });
      }
      continue;
    }
    if (!ru?.lemma) {
      continue;
    }
    if (ru.pos === 'noun') {
      indexNoun(index, id, ru);
      // the agreeing adjective of a compound (малый бизнес → малые бизнесы)
      const [first, ...rest] = ru.lemma.split(' ');
      if (rest.length && /(?:ый|ий|ой)$/.test(first)) {
        indexAdjective(index, id, first);
      }
    } else if (ru.pos === 'verb') {
      // the verb, its aspect partners and its anticausative (началось)
      for (const verb of [ru, ru.intransitive].filter(
        (v) => v && typeof v === 'object'
      )) {
        indexVerb(index, id, verb, verb.aspect || 'impf');
        if (verb.perfective) {
          indexVerb(index, id, verb.perfective, 'perf');
        }
        if (verb.habitual) {
          indexVerb(index, id, verb.habitual, 'impf');
        }
      }
    } else if (ru.pos === 'adj') {
      indexAdjective(index, id, ru.lemma);
      // a predicate adjective is short (нудна); the neuter short form is
      // also the adverb (медленно)
      for (const form of Object.values(ru.shortForms || {})) {
        push(index, form, { concept: id, pos: 'adj', short: true });
      }
    } else {
      push(index, ru.lemma.split(' ')[0], { concept: id, pos: ru.pos });
    }
  }
  for (const [key, forms] of Object.entries(PERSONAL)) {
    const person = Number(key[0]) || null;
    const number = /pl$/.test(key) ? 'pl' : 'sg';
    forms.forEach((form, i) => {
      push(index, form, { pronoun: true, person, number, case: CASES[i] });
      if (/^[её]/.test(form) || /^(им|ими|ему)$/.test(form)) {
        push(index, `н${form}`, {
          pronoun: true,
          person,
          number,
          case: CASES[i],
        });
      }
    });
  }
  const closed = (value) => {
    if (typeof value === 'string') {
      value.split(' ').forEach((w) => push(index, w, { closed: true }));
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(closed);
    }
  };
  Object.values(WORDS)
    .filter((v) => typeof v === 'object')
    .forEach(closed);
  GRAMMATICAL.forEach((w) => push(index, w, { closed: true }));
  indexAdjective(index, null, 'который', 'relative');
  indexAdjective(index, null, 'каждый', 'determiner');
  for (const [form, tense] of Object.entries(BYT)) {
    push(index, form, { copula: true, tense });
  }
  for (const [relation, uses] of Object.entries(RELATIONS)) {
    for (const [prep] of Object.values(uses)) {
      push(index, prep, { relation });
    }
  }
  for (const [name, label] of lexicon.names || []) {
    const entry = lexicon.nameEntry?.(name);
    const forms = entry
      ? Object.values(safe(() => nounParadigm(entry)) || {})
      : [];
    for (const form of new Set([label, name, ...forms])) {
      push(index, form, { name });
    }
  }
  return index;
}

/** The meta links a translation must keep: concepts with their grammar. */
export function sourceLinks(formal) {
  const links = [];
  // a gerund's noun reading is an alternative realization of its action
  // (sharing → делиться or a noun): the Russian may carry either one
  let optional = false;
  const visit = (node, statement) => {
    if (!node || typeof node !== 'object') {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((n) => visit(n, statement));
      return;
    }
    if (node.action && node.nominalization) {
      visit(node.action, statement);
      const outer = optional;
      optional = true;
      visit(node.nominalization, statement);
      optional = outer;
      return;
    }
    if (node.type === 'statement') {
      statement = node;
      if (node.predicate) {
        links.push({
          kind: 'predicate',
          concept: node.predicate,
          tense: node.tense,
          polarity: node.polarity,
          mood: node.mood,
          frame: node.frame,
        });
      }
    }
    if (
      node.type !== 'statement' &&
      typeof node.predicate === 'string' &&
      !FRAMES.has(node.frame)
    ) {
      // a non-finite action (to reach, sharing): its verb, without tense
      links.push({ kind: 'action', concept: node.predicate, optional });
    }
    if (node.concept && typeof node.concept === 'string') {
      links.push({
        kind: 'entity',
        concept: node.concept,
        number: node.number,
        quantity: node.quantity,
        optional: optional || undefined,
      });
    } else if (node.name && node.untranslated) {
      links.push({ kind: 'name', name: node.name });
    }
    for (const [key, child] of Object.entries(node)) {
      if (!['concept', 'predicate', 'senses'].includes(key)) {
        visit(child, statement);
      }
    }
  };
  visit(formal.statements || formal);
  return links;
}

const NUMBER = { singular: 'sg', plural: 'pl' };

/**
 * Read a Russian translation back and compare it with its meta links.
 * @returns {{tokens: object[], links: object[], added: string[],
 *   unread: string[], survives: boolean}}
 */
export function readBack(
  russian,
  formal,
  lexicon,
  index = russianFormIndex(lexicon)
) {
  const words = russian.match(/[$€£]?[\p{L}\d]+(?:[.,'’-][\p{L}\d]+)*/gu) || [];
  const tokens = words.map((text) => ({
    text,
    readings: index.get(lower(text)) || [],
  }));
  const is = (i, set) => i >= 0 && set.has(lower(tokens[i]?.text || ''));
  // Russian «не» stands right before what it negates
  const negatedAt = (i) => is(i - 1, NEGATION);
  const used = new Set();
  const links = sourceLinks(formal).map((link) => {
    if (link.kind === 'name') {
      const i = tokens.findIndex(
        (t, j) =>
          !used.has(j) &&
          (t.text === link.name || t.readings.some((r) => r.name === link.name))
      );
      if (i >= 0) {
        used.add(i);
      }
      return { ...link, status: i >= 0 ? 'kept' : 'lost' };
    }
    const at = tokens
      .map((t, i) => ({
        i,
        readings: t.readings.filter((r) => r.concept === link.concept),
      }))
      .filter((t) => t.readings.length && !used.has(t.i));
    if (!at.length && FRAMES.has(link.frame)) {
      return frameLink(link, tokens);
    }
    if (!at.length) {
      return { ...link, status: 'lost' };
    }
    const { i, readings } = at[0];
    used.add(i);
    const range = new Set(
      tokens[i].readings.map((r) => r.concept).filter(Boolean)
    );
    const out = {
      ...link,
      word: tokens[i].text,
      range: [...range],
      status: 'kept',
    };
    const changes = [];
    if (link.kind === 'entity' && NUMBER[link.number] && !link.quantity) {
      const numbers = new Set(readings.map((r) => r.number));
      if (
        !numbers.has(NUMBER[link.number]) &&
        !lexicon.get(link.concept)?.ru?.pluraliaTantum
      ) {
        changes.push(`number ${link.number} → ${[...numbers].join('/')}`);
      }
    }
    if (link.quantity) {
      const forms = cardinalForms(link.quantity);
      if (
        !tokens.some(
          (t) => forms.has(lower(t.text)) || t.text === String(link.quantity)
        )
      ) {
        changes.push(`quantity ${link.quantity} lost`);
      }
    }
    if (link.kind === 'predicate') {
      const tenses = new Set(
        readings.map((r) =>
          // «буду читать»: an infinitive after a future form of быть
          r.mood === 'infinitive' && is(i - 1, FUTURE) ? 'future' : r.tense
        )
      );
      const check = tenseChange(link, tenses);
      if (check?.change) {
        changes.push(check.change);
      } else if (check?.narrowed) {
        out.narrowed = check.narrowed;
      }
      const negated = negatedAt(i) || (link.frame && negatedAt(i - 1));
      if ((link.polarity === 'negative') !== negated) {
        changes.push(
          `polarity ${link.polarity} → ${negated ? 'negative' : 'positive'}`
        );
      }
    }
    if (changes.length) {
      out.status = 'changed';
      out.changes = changes;
    } else if (range.size > 1) {
      // the Russian word is vaguer than the meta link: still readable, but
      // the meaning stands in a wider range
      out.status = 'widened';
    }
    return out;
  });
  const sourceConcepts = new Set(links.map((l) => l.concept).filter(Boolean));
  const added = [];
  const unread = [];
  tokens.forEach((t, i) => {
    if (used.has(i)) {
      return;
    }
    const content = t.readings.filter(
      (r) => r.concept && ['noun', 'verb', 'adj', 'adv', 'part'].includes(r.pos)
    );
    if (!t.readings.length) {
      if (!/^\d/.test(t.text) && !/^[a-z]/i.test(t.text) && t.text.length > 3) {
        unread.push(t.text);
      }
    } else if (
      content.length &&
      content.length === t.readings.length &&
      !content.some((r) => sourceConcepts.has(r.concept))
    ) {
      added.push(t.text);
    }
  });
  return {
    tokens,
    links,
    added,
    unread,
    survives:
      links.every(
        (l) => l.optional || l.status === 'kept' || l.status === 'widened'
      ) && !added.length,
  };
}

/**
 * A tense range of the meta language ("I read": present or past) is kept
 * when the Russian form is one of its tenses; choosing one narrows it (a
 * Russian verb must have a tense), which is reported but not a loss.
 */
function tenseChange(link, read) {
  // an ambiguous tense is a range: ["present", "past"] or "(present past)"
  const range = [link.tense]
    .flat()
    .flatMap((t) => String(t ?? '').match(/[a-z]+/g) || []);
  const known = [...read].filter(Boolean);
  if (link.mood !== 'declarative' || !range.length || !known.length) {
    return null;
  }
  if (!known.some((t) => range.includes(t))) {
    return { change: `tense ${range.join('/')} → ${known.join('/')}` };
  }
  return range.length > 1 && known.length < range.length
    ? { narrowed: `tense ${range.join('/')} → ${known.join('/')}` }
    : null;
}

/** The copula and possession frames: быть, zero in the present. */
function frameLink(link, tokens) {
  const at = tokens.findIndex((t) => t.readings.some((r) => r.copula));
  const read = new Set([
    at >= 0 ? tokens[at].readings.find((r) => r.copula).tense : 'present',
  ]);
  const changes = [];
  const check = tenseChange(link, read);
  if (check?.change) {
    changes.push(check.change);
  }
  const negated = tokens.some((t) => NEGATION.has(lower(t.text)));
  if ((link.polarity === 'negative') !== negated) {
    changes.push(
      `polarity ${link.polarity} → ${negated ? 'negative' : 'positive'}`
    );
  }
  return {
    ...link,
    word: at >= 0 ? tokens[at].text : '∅',
    status: changes.length ? 'changed' : 'kept',
    changes: changes.length ? changes : undefined,
  };
}

/** Cardinal forms of a number, for quantity links. */
export const cardinalForms = (n) =>
  new Set(
    CASES.flatMap((kase) =>
      GENDERS.map((g) => safe(() => cardinal(n, kase, g)))
    )
      .filter(Boolean)
      .map(lower)
  );
