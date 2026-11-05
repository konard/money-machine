import { eventiveParticiple } from './participle-evidence.mjs';
import { calendarAhead } from './calendar.mjs';
import { offsetAhead } from './time-phrase.mjs';
/** English auxiliary chains and finite verb groups. */
import { quantityDegree } from './quantity.mjs';
import { has, reading, startsNP, head } from './parser.mjs';

const isDegree = (id) => id === 'very' || id === 'too';

/**
 * Parse the verb group at the cursor: auxiliaries, negation, main verb.
 * @returns {object|null} `{tense, aspect, polarity, modal, verb, passive, frame}`
 */
export function parseVerbGroup(c, subject, subjectNP) {
  const vg = verbGroup(c, subject, subjectNP);
  const t = vg?.verb && c.tokens.find((x) => x.index === vg.verb.token);
  const form = t && reading(t, 'verb')?.features.form;
  if (
    form &&
    (/3sg|past/.test(form) ||
      // "we live in London and work in Paris": base is finite here
      (form === 'base' && subject !== 'third' && !vg.modal))
  ) {
    // remembered so "lives in London and works for Google" can be
    // read as two clauses rather than "London and works"
    c.finite = form;
  }
  return vg;
}

function verbGroup(c, subject, subjectNP) {
  const vg = {
    tense: 'present',
    aspect: 'simple',
    polarity: 'positive',
    modal: null,
    verb: null,
    adverbs: [],
  };
  let expect = 'finite';
  if (
    subjectNP &&
    ['all', 'both', 'each'].includes(c.peek?.lower) &&
    has(c.at(1), 'verb')
  ) {
    subjectNP.floatingQuantifier = c.next().lower;
  }
  // "is still rolling out": after an auxiliary, an adverb before an -ing
  // verb, whatever else the word may be ("a still")
  const beforeIng = () =>
    c
      .at(1)
      ?.readings.some((x) => x.pos === 'verb' && x.features.form === 'ing');
  // …and "You then fill": before a word that can only be a verb
  const beforeVerb = () =>
    c.at(1)?.readings.length && c.at(1).readings.every((x) => x.pos === 'verb');
  const skipAdverbs = (preverbal = false) => {
    while (
      c.peek &&
      has(c.peek, 'adv') &&
      !quantityDegree(c.peek) &&
      ((!preverbal && beforeIng()) ||
        (preverbal && beforeVerb()) ||
        adverbOnly(preverbal))
    ) {
      // "is still running" → всё ещё бежит: before the verb in Russian too
      vg.adverbs.push({
        ...head(c.peek, reading(c.peek, 'adv')),
        preverbal: preverbal || beforeIng(),
      });
      c.next();
    }
    skipNegation();
  };
  const adverbOnly = () =>
    !has(c.peek, 'verb') &&
    // "You then fill": an adverb that may be an adjective, before a verb
    (!has(c.peek, 'adj') || (has(c.at(1), 'verb') && !has(c.at(1), 'adj'))) &&
    !has(c.peek, 'noun') &&
    !(
      reading(c.peek, 'adv').concepts.some(isDegree) &&
      (has(c.at(1), 'adj') || has(c.at(1), 'adv'))
    );
  const skipNegation = () => {
    while (has(c.peek, 'neg')) {
      vg.polarity = 'negative';
      if (reading(c.peek, 'neg').lemma === 'never') {
        vg.adverbs.push({
          token: c.peek.index,
          text: c.peek.text,
          lemma: 'never',
          pos: 'adv',
          candidates: ['never'],
          concept: 'never',
        });
      }
      c.next();
    }
  };
  skipAdverbs(true);
  for (let guard = 0; guard < 6 && c.peek; guard += 1) {
    const t = c.peek;
    if (expect === 'finite' && has(t, 'modal')) {
      const r = reading(t, 'modal');
      vg.modal = r.features.modal;
      vg.tense = r.features.tense;
      c.next();
      expect = 'base';
      skipAdverbs();
      continue;
    }
    if (
      has(t, 'do') &&
      expect === 'finite' &&
      (has(c.at(1), 'neg') ||
        has(c.at(1), 'verb') ||
        subject === 'question' ||
        has(c.at(1), 'pron'))
    ) {
      const r = reading(t, 'do');
      if (
        has(c.at(1), 'neg') ||
        subject === 'question' ||
        (has(c.at(1), 'verb') && !startsNP(c.at(1)))
      ) {
        vg.tense = r.features.tense;
        vg.agree = r.features;
        c.next();
        expect = 'base';
        skipAdverbs();
        continue;
      }
    }
    if (has(t, 'have') && (expect === 'finite' || expect === 'base')) {
      const r = reading(t, 'have');
      const after = nextNonAdverb(c, 1);
      // "he's got a car" is "he has a car"
      const gotAt = after?.lower === 'got' ? c.tokens.indexOf(after) : -1;
      const owned = gotAt >= 0 && c.tokens[gotAt + 1];
      if (
        owned &&
        startsNP(owned) &&
        // "you have got paid" is a passive
        !owned.readings.some(
          (x) => x.pos === 'verb' && /pp/.test(x.features.form || '')
        )
      ) {
        if (expect === 'finite') {
          vg.tense = r.features.tense || vg.tense;
          vg.agree = r.features;
        }
        c.i = gotAt + 1;
        vg.verb = {
          token: t.index,
          text: t.text,
          lemma: 'have',
          pos: 'verb',
          candidates: ['have'],
          concept: 'have',
        };
        vg.frame = 'possession';
        return vg;
      }
      if (
        has(after, 'verb') &&
        after.readings.some(
          (x) => x.pos === 'verb' && x.features.form?.includes('pp')
        ) &&
        !(
          has(after, 'noun') &&
          !reading(after, 'verb').features.form.includes('past')
        )
      ) {
        if (expect === 'finite') {
          vg.tense = r.features.tense || vg.tense;
          vg.agree = r.features;
        }
        vg.aspect = 'perfect';
        c.next();
        expect = 'pp';
        skipAdverbs();
        continue;
      }
      if (has(after, 'be') && reading(after, 'be').features.form === 'pp') {
        if (expect === 'finite') {
          vg.tense = r.features.tense || vg.tense;
        }
        vg.aspect = 'perfect';
        c.next();
        expect = 'pp';
        skipAdverbs();
        continue;
      }
      if (c.at(1)?.lower === 'to' && has(c.at(2), 'verb')) {
        if (expect === 'finite') {
          vg.tense = r.features.tense || vg.tense;
          vg.agree = r.features;
        }
        vg.modal = 'modal.must';
        c.next();
        c.next();
        expect = 'base';
        continue;
      }
      if (expect === 'finite') {
        vg.tense = r.features.tense || vg.tense;
        vg.agree = r.features;
      }
      c.next();
      vg.verb = {
        token: t.index,
        text: t.text,
        lemma: 'have',
        pos: 'verb',
        candidates: ['have'],
        concept: 'have',
      };
      vg.frame = 'possession';
      return vg;
    }
    // "get paid", "got hired", "will get sent": get is a passive auxiliary
    // only when followed by a past participle (possibly after adverbs).
    const get = t.readings.find((r) => r.pos === 'verb' && r.lemma === 'get');
    const afterGet = get && nextNonAdverb(c, 1);
    const paid = afterGet?.readings.find(
      (r) => r.pos === 'verb' && /pp/.test(r.features.form || '')
    );
    if (get && paid) {
      if (expect === 'finite') {
        vg.tense = /past/.test(get.features.form) ? 'past' : vg.tense;
      }
      c.next();
      skipAdverbs();
      c.next();
      vg.passive = true;
      vg.verb = head(afterGet, paid);
      vg.frame = 'event';
      return vg;
    }
    if (has(t, 'be')) {
      const r = reading(t, 'be');
      if (expect === 'finite') {
        vg.tense = r.features.tense || vg.tense;
        vg.agree = r.features;
      }
      c.next();
      skipAdverbs();
      const after = c.peek;
      if (has(after, 'be') && reading(after, 'be').features.form === 'ing') {
        vg.aspect =
          vg.aspect === 'perfect' ? 'perfect-progressive' : 'progressive';
        expect = 'ing';
        continue;
      }
      if (
        has(after, 'verb') &&
        reading(after, 'verb').features.form === 'ing' &&
        !intransitiveAttribute(c)
      ) {
        vg.aspect =
          vg.aspect === 'perfect' ? 'perfect-progressive' : 'progressive';
        expect = 'ing';
        continue;
      }
      if (
        after?.lower === 'going' &&
        c.at(1)?.lower === 'to' &&
        has(c.at(2), 'verb')
      ) {
        vg.tense = 'future';
        c.next();
        c.next();
        expect = 'base';
        continue;
      }
      const participle = after?.readings.find(
        (x) => x.pos === 'verb' && /pp/.test(x.features.form || '')
      );
      // "fixed", "closed" are adjectives too; an agent ("fixed by the
      // app") or a following object of the participle makes it passive
      const agent = c.at(1)?.lower === 'by' && !has(c.at(2), 'verb');
      const repeated =
        has(c.at(1), 'adv') &&
        /(?:each|every|per|once|twice|daily|weekly|monthly|yearly)/i.test(
          `${c.at(1).lower} ${
            c.grammar?.lexicon?.get(reading(c.at(1), 'adv')?.concepts[0])
              ?.gloss || ''
          }`
        );
      // "is rated 2/10", "is rated highly": a value or a manner after
      // the participle is the verb's, not an adjective's
      const valued =
        c.at(1)?.kind === 'quantity' ||
        (has(c.at(1), 'adv') &&
          !has(c.at(1), 'adj') &&
          /ly$/.test(c.at(1).lower));
      // "is checked on 3 November 2026": a date marks an event
      const dated =
        calendarAhead(c, 1) || (has(c.at(1), 'prep') && calendarAhead(c, 2));
      if (
        participle &&
        (vg.modal ||
          !has(after, 'adj') ||
          agent ||
          dated ||
          offsetAhead(c, 1) ||
          repeated ||
          valued ||
          eventiveParticiple(c, participle, subjectNP))
      ) {
        vg.passive = true;
        const v = participle;
        c.next();
        vg.verb = head(after, v);
        vg.frame = 'event';
        return vg;
      }
      vg.verb = {
        token: t.index,
        text: t.text,
        lemma: 'be',
        pos: 'verb',
        candidates: ['be'],
        concept: 'be',
      };
      vg.frame = 'copula';
      return vg;
    }
    if (has(t, 'verb')) {
      let r = reading(t, 'verb');
      if (
        expect === 'finite' &&
        r.features.form === 'base' &&
        subject === 'third'
      ) {
        // "Stripe direct deposit", "Pick open dataset": a singular subject
        // never takes the base form, so this is no clause ("Stripe put" is
        // the past tense)
        r = t.readings.find(
          (x) => x.pos === 'verb' && /past/.test(x.features.form)
        );
        if (!r) {
          return null;
        }
      }
      const form = r.features.form;
      // "withdrawals to nostro accounts are": a plural subject never takes
      // the third-person singular, so "accounts" is no verb here
      if (expect === 'finite' && form === '3sg' && subject === 'other') {
        return null;
      }
      if (expect === 'finite') {
        if (/past/.test(form)) {
          vg.tense = 'past';
        } else if (form === 'ing' || form === 'pp') {
          return null;
        } else if (
          form === 'base' &&
          t.readings.some(
            (x) => x.pos === 'verb' && x.features.form === 'past'
          ) &&
          subject !== 'third'
        ) {
          // "I put", "we read": English does not say whether this is now or before
          vg.tense = 'present|past';
        }
      }
      c.next();
      vg.verb = head(t, r);
      vg.frame = 'event';
      return vg;
    }
    break;
  }
  return vg.verb ? vg : null;
}

function nextNonAdverb(c, k) {
  let j = k;
  while (
    (has(c.at(j), 'adv') && !has(c.at(j), 'verb')) ||
    has(c.at(j), 'neg')
  ) {
    j += 1;
  }
  return c.at(j);
}

/**
 * "is recurring income": an -ing word that is also an adjective, before a
 * bare noun, is that noun's attribute when its verb takes no object.
 */
export function intransitiveAttribute(c) {
  const [t, next] = [c.peek, c.at(1)];
  const lexicon = c.grammar?.lexicon;
  if (!lexicon || !has(t, 'adj') || !has(next, 'noun') || has(next, 'det')) {
    return false;
  }
  const frames = reading(t, 'verb').concepts.map(
    (id) => lexicon.get(id)?.frames || []
  );
  return (
    frames.some((f) => f.includes('intransitive')) &&
    !frames.some((f) => f.includes('transitive'))
  );
}
