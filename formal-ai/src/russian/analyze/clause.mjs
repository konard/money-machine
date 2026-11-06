/** Recover clause roles from agreement and case, independently of source meta. */
import { has, takeNP } from './phrase.mjs';
import { numberName, genderName } from './morphology.mjs';
import { prepositional } from './relations.mjs';
import { QUESTION_ADVERBS } from '../words.mjs';
import { lower } from './tokenizer.mjs';
import { modalGroup } from './nonfinite.mjs';

const finite = (r) => r.pos === 'verb' && (r.tense || r.mood === 'imperative');
const unused = (tokens, ctx) =>
  tokens
    .map((token, i) => ({ token, i }))
    .filter(({ token }) => !ctx.used.has(token));
function consume(ctx, items) {
  items.forEach((t) => ctx.used.add(t));
}
function attach(np) {
  if (np?.head.relative) {
    np.entity.relative = np.head.relative;
  }
  return np?.entity;
}
function findNP(tokens, ctx, kase, options = {}) {
  const candidates = unused(tokens, ctx);
  if (options.subject) {
    candidates.sort(
      (a, b) =>
        Number(has(a.token, (r) => r.pro?.startsWith('q.'))) -
        Number(has(b.token, (r) => r.pro?.startsWith('q.')))
    );
  }
  for (const { i } of candidates) {
    const np = takeNP(tokens, i, ctx, kase, options);
    if (np) {
      attach(np);
      return np;
    }
  }
  return null;
}

export function parseClause(tokens, ctx, options = {}) {
  const s = {
    type: 'statement',
    mood: options.question ? 'question' : 'declarative',
    frame: 'event',
    tense: 'present',
    aspect: 'simple',
    polarity: 'positive',
  };
  const verbAt = tokens.findIndex(
    (t) =>
      !ctx.used.has(t) &&
      has(
        t,
        (r) =>
          finite(r) ||
          (options.nonfinite && r.pos === 'verb' && r.mood === 'infinitive')
      )
  );
  const verbReadings =
    verbAt < 0
      ? []
      : tokens[verbAt].readings
          .filter(
            (r) =>
              finite(r) ||
              (options.nonfinite && r.pos === 'verb' && r.mood === 'infinitive')
          )
          .filter((r) =>
            (r.fixed || []).every(
              (word, j) => tokens[verbAt + j + 1]?.lower === lower(word)
            )
          )
          .sort((a, b) => (b.fixed?.length || 0) - (a.fixed?.length || 0));
  let verb = verbReadings[0] || null;
  let at = verbAt;
  const copulaAt = tokens.findIndex(
    (t) => has(t, (r) => r.copula) || t.lower === 'нет'
  );
  const copula = tokens[copulaAt]?.readings.find((r) => r.copula);
  if (copulaAt === verbAt && copula) {
    verb = null;
  }
  const imperative = verbReadings.find((r) => r.mood === 'imperative');
  const expressedSubject = tokens.some(
    (t, i) => i !== verbAt && has(t, (r) => r.pronoun && r.case === 'nom')
  );
  if (imperative && !expressedSubject && !options.question) {
    verb = imperative;
  }
  if (!verb && copula?.tense === 'future') {
    at = tokens.findIndex(
      (t, i) =>
        i > copulaAt &&
        has(t, (r) => r.pos === 'verb' && r.mood === 'infinitive')
    );
    if (at >= 0) {
      verb = tokens[at].readings.find(
        (r) => r.pos === 'verb' && r.mood === 'infinitive'
      );
    }
  }
  const modal = options.nonfinite ? null : modalGroup(tokens);
  if (modal) {
    at = modal.infinitiveAt;
    verb = tokens[at].readings.find(
      (r) => r.pos === 'verb' && r.mood === 'infinitive'
    );
    s.modality = modal.modalities[0];
    if (modal.modalities.length > 1) {
      s.modalityRange = modal.modalities;
    }
    consume(ctx, tokens.slice(modal.at, modal.at + modal.length));
  }
  const entry = (verb && ctx.lexicon.get(verb.concept)?.ru) || {};
  if (verb) {
    s.predicate = verb.concept;
    const alternatives = [
      ...new Set(tokens[at].readings.filter(finite).map((r) => r.concept)),
    ];
    s.candidates = alternatives.length ? alternatives : [verb.concept];
    s.tense =
      copula?.tense === 'future' && verb.mood === 'infinitive'
        ? 'future'
        : verb.tense || 'present';
    if ((entry.datPredicate || verb.voice === 'passive') && copula) {
      s.tense = copula.tense;
    }
    if (modal) {
      s.tense = modal.tense;
    }
    // Russian imperfective does not distinguish English simple/progressive;
    // perfective does not distinguish simple/perfect. Keep both readings.
    s.aspect = verb.aspect === 'perf' ? 'simple perfect' : 'simple progressive';
    s.russianAspect = verb.aspect;
    if (verb.mood === 'imperative') {
      s.mood = 'imperative';
      s.tense = 'present';
      s.aspect = 'simple';
    }
    if (verb.voice) {
      s.voice = verb.voice;
    }
    consume(ctx, [tokens[at]]);
    consume(ctx, tokens.slice(at + 1, at + 1 + (verb.fixed?.length || 0)));
    if (modal && tokens[modal.at - 1]?.lower === 'не') {
      s.polarity = 'negative';
      consume(ctx, [tokens[modal.at - 1]]);
    }
    if (
      copulaAt >= 0 &&
      (verb.mood === 'infinitive' || verb.voice === 'passive')
    ) {
      consume(ctx, [tokens[copulaAt]]);
    }
    if (
      tokens[at - 1]?.lower === 'не' ||
      (verb.mood === 'infinitive' && tokens[copulaAt - 1]?.lower === 'не')
    ) {
      s.polarity = 'negative';
      consume(ctx, [
        tokens[at - 1]?.lower === 'не' ? tokens[at - 1] : tokens[copulaAt - 1],
      ]);
    }
  } else {
    s.frame = 'copula';
    s.predicate = 'be';
    s.candidates = ['be'];
    s.tense = copula?.tense || 'present';
    if (copulaAt >= 0) {
      consume(ctx, [tokens[copulaAt]]);
      if (
        tokens[copulaAt].lower === 'нет' ||
        tokens[copulaAt - 1]?.lower === 'не'
      ) {
        s.polarity = 'negative';
        if (tokens[copulaAt - 1]?.lower === 'не') {
          consume(ctx, [tokens[copulaAt - 1]]);
        }
      }
    }
  }
  if (verb && !options.nonfinite) {
    const infinitiveAt = tokens.findIndex(
      (t, i) =>
        i > at &&
        !ctx.used.has(t) &&
        has(t, (r) => r.pos === 'verb' && r.mood === 'infinitive')
    );
    if (infinitiveAt >= 0) {
      const inner = parseClause(tokens.slice(infinitiveAt), ctx, {
        nonfinite: true,
      });
      s.complementClause = {
        predicate: inner.predicate,
        candidates: inner.candidates,
        russianAspect: inner.russianAspect,
        objects: inner.objects || [],
        modifiers: inner.modifiers || [],
        ...(inner.complementClause
          ? { complementClause: inner.complementClause }
          : {}),
      };
      if (tokens[infinitiveAt - 1]?.lower === 'чтобы') {
        s.complementClause.purpose = true;
        consume(ctx, [tokens[infinitiveAt - 1]]);
      }
    }
  }
  // Mark PPs before looking for nominatives: indeclinable names in a PP
  // are not nominative subjects. Possession is the special у + gen frame.
  const pps = [];
  const fixedAdjectives = new Set();
  tokens.forEach((t, i) => {
    const r = t.readings.find(
      (r) =>
        ['adj', 'participle'].includes(r.pos) &&
        r.fixed?.length &&
        r.fixed.every((w, j) => tokens[i + j + 1]?.lower === lower(w))
    );
    if (r) {
      tokens
        .slice(i, i + r.fixed.length + 1)
        .forEach((token) => fixedAdjectives.add(token));
    }
  });
  for (const { token, i } of unused(tokens, ctx)) {
    if (ctx.used.has(token) || fixedAdjectives.has(token)) {
      continue;
    }
    const pp = prepositional(tokens, i, ctx, entry);
    if (pp) {
      consume(ctx, pp.consumed);
      pps.push({ ...pp, at: i });
    }
  }
  const owner =
    !verb &&
    pps.find((p) => tokens[p.at].lower === 'у' && p.at === 0 && copulaAt >= 0);
  if (owner) {
    s.frame = 'possession';
    s.predicate = 'have';
    s.candidates = ['have'];
    s.subject = owner.np.entity;
    const theme = findNP(
      tokens,
      ctx,
      s.polarity === 'negative' ? 'gen' : 'nom'
    );
    if (theme) {
      s.objects = [theme.entity];
    }
    pps.splice(pps.indexOf(owner), 1);
  } else {
    const subjectCase =
      entry?.experiencer || entry?.datPredicate ? 'dat' : 'nom';
    const subject =
      (s.mood === 'imperative' && !expressedSubject) || options.nonfinite
        ? null
        : findNP(tokens, ctx, subjectCase, {
            subject: true,
            person: verb?.person,
            number: verb?.number,
            gender: verb?.gender,
            antecedent: options.antecedent,
          });
    s.subject = subject?.entity || null;
    if (verb?.gender && s.subject?.pronoun && s.subject.number === 'singular') {
      s.subject.pronoun.gender = genderName(verb.gender);
    }
    if (!subject && s.mood === 'imperative') {
      const number =
        verb.number === 'pl' ? 'singular plural' : numberName(verb.number);
      s.subject = { pronoun: { person: 2, number }, implicit: true, number };
    }
    if (!s.subject && verb?.person && verb.person !== 3 && !options.nonfinite) {
      const number =
        verb.person === 2 && verb.number === 'pl'
          ? 'singular plural'
          : numberName(verb.number);
      s.subject = {
        pronoun: { person: verb.person, number },
        number,
        implicit: true,
      };
    }
    ctx.subject = s.subject;
    if (verb) {
      const objects = [];
      const gov = entry?.government || { case: 'acc' };
      const objectCase =
        entry?.experiencer || entry?.datPredicate ? 'nom' : gov.case;
      const recipient = entry?.recipient;
      if (recipient) {
        const np = findNP(tokens, ctx, recipient);
        if (np) {
          objects.push(np.entity);
        }
      }
      if (!gov.preposition || entry?.experiencer) {
        let np;
        while ((np = findNP(tokens, ctx, objectCase))) {
          objects.push(np.entity);
        }
      }
      for (const pp of pps.filter((p) => p.object)) {
        objects.push(pp.np.entity);
      }
      if (objects.length) {
        const takes = ctx.lexicon.get(s.predicate)?.takes;
        if (takes?.length === 1) {
          objects.forEach((e) => {
            e.marker = takes[0];
          });
        }
        s.objects = objects;
      }
    } else {
      const property = unused(tokens, ctx).find(({ token }) =>
        has(token, (r) => r.pos === 'adj')
      );
      if (property) {
        const r = property.token.readings.find((r) => r.pos === 'adj');
        s.complement = {
          kind: 'property',
          concept: r.concept,
          candidates: [
            ...new Set(
              property.token.readings
                .filter((x) => x.pos === 'adj')
                .map((x) => x.concept)
            ),
          ],
        };
        consume(ctx, [property.token]);
        let next = property.i + 1;
        while (
          ['и', 'или'].includes(tokens[next]?.lower) &&
          !ctx.used.has(tokens[next])
        ) {
          const adjective = tokens[next + 1]?.readings.find(
            (r) => r.pos === 'adj'
          );
          if (!adjective) {
            break;
          }
          s.complement.also ||= [];
          s.complement.also.push({
            link: tokens[next].lower === 'или' ? 'conj.or' : 'conj.and',
            kind: 'property',
            concept: adjective.concept,
            candidates: [
              ...new Set(
                tokens[next + 1].readings
                  .filter((r) => r.pos === 'adj')
                  .map((r) => r.concept)
              ),
            ],
          });
          consume(ctx, tokens.slice(next, next + 2));
          next += 2;
        }
        if (tokens[property.i - 1]?.lower === 'не') {
          s.polarity = 'negative';
          consume(ctx, [tokens[property.i - 1]]);
        }
      } else if (pps.length && s.subject && copulaAt >= 0 && pps[0].at === 0) {
        s.frame = 'existence';
      } else if (pps.length && s.subject) {
        s.complement = pps.shift().modifier;
        if (s.complement.polarity === 'negative') {
          s.polarity = 'negative';
          delete s.complement.polarity;
        }
      } else {
        const np = findNP(tokens, ctx, copulaAt >= 0 ? 'ins' : 'nom');
        if (np) {
          s.complement = { kind: 'entity', entity: np.entity };
        }
        if (copulaAt >= 0 && !s.complement && s.subject) {
          s.frame = 'existence';
        }
      }
    }
  }
  const mods = pps.filter((p) => !p.object).map((p) => p.modifier);
  // Negation is local: an adjective's не never changes verb polarity.
  for (const { token, i } of unused(tokens, ctx)) {
    const adv = token.readings.find((r) => r.pos === 'adv');
    const temporal = token.readings.find((r) => r.temporal);
    const q = token.readings.find((r) => r.question);
    if (temporal) {
      mods.push({
        kind: 'relation',
        relation: 'rel.in',
        relationRange: ['rel.in', 'rel.at', 'rel.on', 'rel.during'],
        entity: {
          concept: temporal.concept,
          candidates: [temporal.concept],
          number: 'singular',
          definiteness: 'definite indefinite',
        },
      });
      consume(ctx, [token]);
    } else if (q) {
      s.question = {
        concept: q.question,
        slot: Object.hasOwn(QUESTION_ADVERBS, q.question) ? 'adverb' : 'object',
      };
      s.mood = 'question';
      consume(ctx, [token]);
    } else if (adv) {
      mods.push({
        kind: 'adverb',
        concept: adv.concept,
        ...(i < at ? { position: 'preverbal' } : {}),
      });
      consume(ctx, [token]);
    } else if (token.lower === 'ли') {
      s.mood = 'question';
      consume(ctx, [token]);
    }
  }
  if (s.subject?.question) {
    s.question = { concept: s.subject.question, slot: 'subject' };
    s.mood = 'question';
  }
  const wh = s.objects?.find((e) => e.question);
  if (wh) {
    s.question = { concept: wh.question, slot: 'object' };
    s.mood = 'question';
  }
  if (mods.length) {
    s.modifiers = mods;
  }
  if (!verb && copulaAt < 0 && s.subject && !s.complement && !mods.length) {
    return { type: 'fragment', entity: s.subject, modifiers: [] };
  }
  return s;
}
