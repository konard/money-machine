/** Case-constrained noun phrases. No English vocabulary participates. */
import { numberName, genderName } from './morphology.mjs';
import { lower } from './tokenizer.mjs';
import { QUANTIFIERS } from '../words.mjs';

export const has = (token, test) => token?.readings.some(test);
export const content = (r) =>
  r.pos === 'noun' || r.pronoun || r.name || r.pro || r.pos === 'relative';
const unique = (values) => [...new Set(values)];

export function nounPhrase(tokens, start, ctx, kase = 'nom', options = {}) {
  let i = start;
  const properties = [];
  let det;
  let owner;
  let quantity;
  let digits;
  let negative = false;
  while (i < tokens.length) {
    const t = tokens[i];
    if (ctx.used.has(t)) {
      return null;
    }
    if (t.lower === 'не') {
      negative = true;
      i += 1;
      continue;
    }
    if (t.lower === 'ни' && has(tokens[i + 1], (r) => r.quantity === 1)) {
      det = { determiner: 'det.neither' };
      i += 2;
      continue;
    }
    const d = t.readings.find(
      (r) => r.determiner && (!r.case || r.case === kase)
    );
    const p = t.readings.find((r) => r.owner);
    const q = /^\d+$/.test(t.text)
      ? { quantity: Number(t.text) }
      : t.readings.find((r) => r.quantity !== undefined && r.case === kase);
    const adj = t.readings.filter(
      (r) =>
        ['adj', 'participle'].includes(r.pos) &&
        !r.short &&
        r.case === kase &&
        (r.fixed || []).every(
          (word, j) => tokens[i + j + 1]?.lower === lower(word)
        )
    );
    if (q) {
      quantity = q.quantity;
      digits = /^\d/.test(t.text);
      i += 1;
    } else if (d && !has(t, (r) => r.pronoun || r.pos === 'relative')) {
      det = d;
      i += 1;
    } else if (
      p &&
      has(tokens[i + 1], (r) => r.pos === 'noun' || r.pos === 'adj')
    ) {
      owner = p.owner;
      i += 1;
    } else if (adj.length && !has(t, (r) => r.pos === 'noun')) {
      const ids = unique(adj.map((r) => r.concept).filter(Boolean));
      properties.push({
        concept: ids[0],
        candidates: ids,
        ...(adj[0].pos === 'participle' ? { participle: 'past-passive' } : {}),
        ...(negative ? { polarity: 'negative' } : {}),
      });
      negative = false;
      i += 1 + (adj[0]?.fixed?.length || 0);
      if (['/', 'и', 'или'].includes(tokens[i]?.lower)) {
        const alternative = tokens[i + 1]?.readings.filter(
          (r) => ['adj', 'participle'].includes(r.pos) && r.case === kase
        );
        if (alternative?.length) {
          const ids = unique(alternative.map((r) => r.concept));
          properties.at(-1).alternative = {
            concept: ids[0],
            candidates: ids,
            ...(tokens[i].lower !== '/'
              ? { join: tokens[i].lower === 'и' ? 'conj.and' : 'conj.or' }
              : {}),
            ...(alternative[0].pos === 'participle'
              ? { participle: 'past-passive' }
              : {}),
          };
          i += 2 + (alternative[0].fixed?.length || 0);
        }
      }
    } else {
      break;
    }
  }
  const head = tokens[i];
  if (!head || ctx.used.has(head)) {
    if (quantity !== undefined) {
      return {
        entity: {
          numeral: true,
          quantity,
          number: quantity === 1 ? 'singular' : 'plural',
          ...(digits ? { digits: true } : {}),
        },
        end: i,
        consumed: tokens.slice(start, i),
        readings: [],
        head: tokens[i - 1],
      };
    }
    return null;
  }
  const headCase =
    det?.determiner &&
    det.determiner in QUANTIFIERS &&
    (kase === 'nom' || kase === 'acc')
      ? 'gen'
      : quantity !== undefined && (kase === 'nom' || kase === 'acc')
        ? quantity % 10 === 1 && quantity % 100 !== 11
          ? kase
          : 'gen'
        : kase;
  let rs = head.readings.filter(
    (r) => content(r) && (!r.case || r.case === headCase)
  );
  if (options.person && options.person !== 3) {
    rs = rs.filter((r) => r.pronoun && r.person === options.person);
  }
  if (options.number && quantity === undefined) {
    const agreed = rs.filter((r) => !r.number || r.number === options.number);
    if (agreed.length) {
      rs = agreed;
    }
  }
  if (options.gender) {
    const agreed = rs.filter((r) => !r.gender || r.gender === options.gender);
    if (agreed.length) {
      rs = agreed;
    }
  }
  let e;
  const r = rs[0];
  if (r?.pos === 'relative') {
    e = {
      relativePronoun: true,
      number: numberName(r.number) || options.antecedent?.number || 'singular',
    };
  } else if (r?.pronoun) {
    const ps = rs.filter((x) => x.pronoun);
    const genders = unique(ps.map((x) => genderName(x.gender)).filter(Boolean));
    const number =
      r.person === 2 && r.number === 'pl'
        ? 'singular plural'
        : numberName(r.number);
    e = {
      pronoun: {
        person: r.person,
        number,
        ...(genders.length === 1 ? { gender: genders[0] } : {}),
        ...(r.reflexive ? { reflexive: true } : {}),
      },
      number,
    };
    if (genders.length > 1) {
      e.pronoun.gender = genders.join(' ');
    }
  } else if (r?.name) {
    e = {
      concept: null,
      untranslated: r.name,
      name: r.name,
      number: 'singular',
    };
  } else if (r?.pro) {
    e = r.pro.startsWith('q.')
      ? { question: r.pro, number: 'singular' }
      : r.pro === 'this'
        ? { demonstrative: 'this', number: 'singular' }
        : { concept: r.pro, number: 'singular' };
  } else if (r?.concept) {
    const ids = unique(
      rs.filter((x) => x.pos === 'noun').map((x) => x.concept)
    );
    e = {
      concept: r.concept,
      candidates: ids,
      number:
        quantity !== undefined
          ? quantity === 1
            ? 'singular'
            : 'plural'
          : unique(
              rs
                .filter((x) => x.pos === 'noun')
                .map((x) => numberName(x.number))
                .filter(Boolean)
            ).join(' '),
      definiteness: det?.definiteness || 'definite indefinite',
    };
  } else if (
    (/^\p{Lu}|^[A-Za-z]/u.test(head.text) || /^[$€£]\d/.test(head.text)) &&
    !head.readings.length &&
    !options.person
  ) {
    e = {
      concept: null,
      untranslated: head.text,
      name: head.text,
      number: 'singular',
    };
  } else if (quantity !== undefined) {
    e = {
      numeral: true,
      quantity,
      number: quantity === 1 ? 'singular' : 'plural',
      ...(digits ? { digits: true } : {}),
    };
    i -= 1;
  } else {
    return null;
  }
  if (det?.determiner.startsWith('det.')) {
    e.determiner = det.determiner;
  }
  if (det?.determiner.startsWith('q.')) {
    e.question = det.determiner;
  }
  if (quantity !== undefined) {
    e.quantity = quantity;
    if (digits) {
      e.digits = true;
    }
    // A lexical one explicitly fixes indefiniteness, without implying that
    // all English indefinite articles must have had a Russian numeral.
    if (quantity === 1 && !digits) {
      e.definiteness = 'indefinite';
    }
  }
  if (owner) {
    const p = owner.reflexive ? ctx.subject?.pronoun || owner : owner;
    e.possessor = { pronoun: { ...p }, number: p.number };
  }
  if (properties.length) {
    e.properties = properties;
  }
  if (negative) {
    e.polarity = 'negative';
  }
  i += 1;
  const consumed = tokens.slice(start, i);
  if (
    options.coordination !== false &&
    ['и', 'или'].includes(tokens[i]?.lower)
  ) {
    const next = nounPhrase(tokens, i + 1, ctx, kase, {
      ...options,
      coordination: false,
    });
    if (next) {
      e = {
        coordination: tokens[i].lower === 'или' ? 'conj.or' : 'conj.and',
        items: [e, next.entity],
        number: 'plural',
      };
      consumed.push(tokens[i], ...next.consumed);
      i = next.end;
    }
  }
  return { entity: e, end: i, consumed, readings: rs, head };
}

export function takeNP(tokens, start, ctx, kase, options) {
  const np = nounPhrase(tokens, start, ctx, kase, options);
  if (np) {
    np.consumed.forEach((t) => ctx.used.add(t));
  }
  return np;
}
