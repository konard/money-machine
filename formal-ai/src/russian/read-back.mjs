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
import { shortFrom } from './copula.mjs';
import { MODAL_FORMS } from './modal.mjs';
import { passiveOf } from './nonfinite.mjs';

const { PERSONAL, RELATIONS, ONE, cardinal } = WORDS;

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
// the words a coordination of entities is said with (phrase.mjs)
const COORDINATION = {
  'conj.and': { word: 'и', times: 1 },
  'conj.or': { word: 'или', times: 1 },
  'conj.nor': { word: 'ни', times: 2 },
  correlative: { word: 'либо', times: 2 },
};
// grammatical words the generator writes outside the word tables
const GRAMMATICAL =
  'и или либо но а что чтобы потому поэтому как также тоже бы ли это так то того без для из от до при через'.split(
    ' '
  );

const lower = (s) => s.toLowerCase().replace(/ё/g, 'е');
const MODAL_RANGE = new Set(MODAL_FORMS.flatMap(([, modal]) => modal));
const wordsOf = (v) =>
  typeof v === 'string'
    ? v.split(' ')
    : Object.values(v || {}).flatMap((x) => wordsOf(x));
// «ни одна страница»: "neither page"
const ONE_FORMS = new Set(wordsOf(ONE).map(lower));
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
  if (entry.locative) {
    push(index, entry.locative, {
      concept: id,
      pos: 'noun',
      number: 'sg',
      case: 'prep',
    });
  }
  for (const [cell, form] of Object.entries(cells)) {
    const [number, kase] = cell.split('.');
    // each word of a multiword lemma (малый бизнес) reads as the concept
    for (const word of form.split(' ')) {
      push(index, word, {
        concept: id,
        pos: 'noun',
        number,
        case: kase,
        gender: number === 'pl' ? undefined : entry.gender,
      });
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
    push(index, head, {
      concept: id,
      pos: 'verb',
      aspect,
      fixed: [...tail, ...fixed],
      ...features,
    });
    fixed.forEach((word) => push(index, word, { concept: id, pos: 'part' }));
    // the reflexive passive of an imperfective (посылается счёт)
    if (aspect === 'impf' && !/с[яь]$/.test(head) && features.tense) {
      push(index, `${head}${/[аеиоуыэюя]$/.test(head) ? 'сь' : 'ся'}`, {
        concept: id,
        pos: 'verb',
        aspect,
        voice: 'passive',
        fixed: [...tail, ...fixed],
        ...features,
      });
    }
  };
  const derivedPassive = safe(() => passiveOf(original));
  if (derivedPassive && derivedPassive !== entry.pastPassive) {
    indexAdjective(index, id, derivedPassive, 'participle');
  }
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
      add(form, {
        mood: 'participle',
        voice: 'passive',
        tense: 'present',
        number: gender === 'pl' ? 'pl' : 'sg',
        gender: gender === 'pl' ? undefined : gender,
      });
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

function indexAdjective(index, id, lemma, pos = 'adj', extra = {}) {
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
            gender: number === 'pl' ? undefined : gender,
            fixed: lemma.split(' ').slice(1),
            ...extra,
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
      if (ru.datPredicate) {
        for (const gender of [...GENDERS, 'pl']) {
          const number = gender === 'pl' ? 'pl' : 'sg';
          push(
            index,
            safe(() =>
              shortFrom({ short: ru.datPredicate }, { gender, number })
            ),
            {
              concept: id,
              pos: 'verb',
              tense: 'present',
              aspect: 'impf',
              number,
            }
          );
        }
      }
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
      if (ru.predicateShort || ru.short || ru.shortForms) {
        for (const gender of [...GENDERS, 'pl']) {
          const form = safe(() =>
            shortFrom(ru, { gender, number: gender === 'pl' ? 'pl' : 'sg' })
          );
          push(index, form, {
            concept: id,
            pos: 'adj',
            short: true,
            number: gender === 'pl' ? 'pl' : 'sg',
          });
        }
      }
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
      const gender = key.startsWith('3sg') ? key.at(-1) : undefined;
      push(index, form, {
        pronoun: true,
        person,
        number,
        gender,
        reflexive: key === 'refl' || undefined,
        case: CASES[i],
      });
      if (/^[её]/.test(form) || /^(им|ими|ему)$/.test(form)) {
        push(index, `н${form}`, {
          pronoun: true,
          person,
          number,
          gender,
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
  // «никакая кошка не …»: "no cat"
  indexAdjective(index, null, 'никакой', 'determiner', {
    determiner: 'det.no',
  });
  for (const [forms, modal] of MODAL_FORMS) {
    forms.split(' ').forEach((form) => push(index, form, { modal }));
  }
  for (const [form, tense] of Object.entries(BYT)) {
    push(index, form, { copula: true, tense });
  }
  for (const [relation, uses] of Object.entries(RELATIONS)) {
    for (const [prep] of Object.values(uses)) {
      push(index, prep, { relation });
    }
  }
  indexRussianNames(index, lexicon);
  return index;
}

/** Names may acquire a declension during document translation, after indexing. */
export function indexRussianNames(index, lexicon) {
  const add = (form, reading) => {
    if (!form) {
      return;
    }
    if (
      !(index.get(lower(form)) || []).some(
        (r) =>
          r.name === reading.name &&
          r.case === reading.case &&
          r.number === reading.number
      )
    ) {
      push(index, form, reading);
    }
  };
  for (const name of new Set([
    ...(lexicon.names?.keys() || []),
    ...(lexicon.nameEntries?.keys() || []),
  ])) {
    const label = lexicon.nameLabel?.(name) || name;
    const entry = lexicon.nameEntry?.(name);
    const forms = entry ? safe(() => nounParadigm(entry)) || {} : {};
    for (const [cell, form] of Object.entries(forms)) {
      const [number, kase] = cell.split('.');
      add(form, { name, number, case: kase });
    }
    add(label, { name, ...(entry ? { case: 'nom' } : {}) });
    add(name, { name, ...(entry ? { case: 'nom' } : {}) });
  }
}

/** The meta links a translation must keep: concepts with their grammar. */
export function sourceLinks(formal) {
  const links = [];
  // a gerund's noun reading is an alternative realization of its action
  // (sharing → делиться or a noun): the Russian may carry either one
  let optional = false;
  const bare = new WeakSet();
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
          modality: node.modality,
          // said once for a coordination: «не могу читать или писать»
          sharedPolarity: node.sharedPolarity,
          sharedModality: node.sharedModality,
        });
      }
      // "no capital is required": the passive's generic patient may go
      // without its quantifier, «капитал не требуется»
      if (node.voice === 'passive' && node.subject) {
        bare.add(node.subject);
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
    if (node.coordination && Array.isArray(node.items)) {
      links.push({
        kind: 'coordination',
        coordination: node.coordination,
        correlative: node.correlative,
        optional: optional || undefined,
      });
    }
    if (node.concept && typeof node.concept === 'string') {
      links.push({
        kind: 'entity',
        concept: node.concept,
        number: node.number,
        quantity: node.quantity,
        ...(['det.no', 'det.neither'].includes(node.determiner)
          ? { determiner: node.determiner, bare: bare.has(node) || undefined }
          : {}),
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
    if (link.kind === 'coordination') {
      return coordinationLink(link, tokens, used);
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
    if (
      link.determiner &&
      !link.bare &&
      !determinerRead(link.determiner, tokens, used)
    ) {
      changes.push(`determiner ${link.determiner} lost`);
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
      if (MODAL_RANGE.has(link.modality) && !link.sharedModality) {
        // «может читать»: the modal verb before the infinitive
        const j = tokens.findIndex(
          (t, k) => k < i && !used.has(k) && t.readings.some((r) => r.modal)
        );
        const modal =
          j >= 0 ? tokens[j].readings.find((r) => r.modal).modal : [];
        if (!modal.includes(link.modality)) {
          changes.push(`modality ${link.modality} lost`);
        } else {
          used.add(j);
          // «может» is "can" or "may": a wider range than the link
          modal.forEach((m) => range.add(m));
        }
      }
      const negated = Boolean(
        negatedAt(i) ||
        (link.frame && negatedAt(i - 1)) ||
        // a shared negation is said once, before the first predicate
        (link.sharedPolarity &&
          tokens.slice(0, i).some((_, k) => is(k, NEGATION)))
      );
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

/** "A or B", "neither A nor B": the coordinating words are read back. */
function coordinationLink(link, tokens, used) {
  const how =
    COORDINATION[
      link.correlative && link.coordination === 'conj.or'
        ? 'correlative'
        : link.coordination
    ];
  if (!how) {
    return { ...link, status: 'kept', unchecked: true };
  }
  const at = tokens
    .map((t, i) => i)
    .filter((i) => !used.has(i) && lower(tokens[i].text) === how.word);
  if (at.length < how.times) {
    return { ...link, status: 'lost' };
  }
  // «ни» also negates: it stays readable as a negation
  if (how.word !== 'ни') {
    at.slice(0, how.times).forEach((i) => used.add(i));
  }
  return { ...link, word: how.word, status: 'kept' };
}

/**
 * «никакая», «ни одна»: a negative determiner is read back once; "no X" is
 * also «без X» (a fragment) or «нет X» (absence).
 */
function determinerRead(determiner, tokens, used) {
  const word = (k) => lower(tokens[k]?.text || '');
  const i = tokens.findIndex((t, k) =>
    determiner === 'det.no'
      ? !used.has(k) &&
        (t.readings.some((r) => r.determiner === determiner) ||
          ['без', 'нет'].includes(word(k)))
      : word(k) === 'ни' && !used.has(k + 1) && ONE_FORMS.has(word(k + 1))
  );
  if (i < 0) {
    return false;
  }
  used.add(i);
  if (determiner === 'det.neither') {
    used.add(i + 1);
  }
  return true;
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
