/**
 * "lives in London and works in Paris": a later predicate shares the
 * previous clause's subject; and the options a verb gives its tail.
 */

import { clause } from './clause-node.mjs';
import { gerundOf } from './infinitive.mjs';
import { finiteComplementAhead } from './complements.mjs';
import { attachPhrases, subjectPhrases } from './subject-phrases.mjs';
import { has, reading, parseVerbGroup, parseTail } from './parser.mjs';

const AUX = ['be', 'do', 'have', 'modal'];

/**
 * "I came home and went to bed": a finite verb right after a coordinator
 * shares the previous clause's subject.
 */
export function ellipsis(c, ctx, previous, link) {
  const t = c.peek;
  // "you don't market yourself or set prices": a negation before "or"/"nor"
  // covers both predicates, ¬(A ∨ B); before "and" it often does not ("we
  // don't track you and respect your privacy")
  const sharesNegation =
    previous.polarity === 'negative' &&
    previous.mood === 'declarative' &&
    ['conj.or', 'conj.nor'].includes(link?.concept);
  const r = reading(t, 'verb');
  const subject = previous.subject;
  const third = subject.pronoun
    ? subject.pronoun.person === 3 && subject.number === 'sg'
    : subject.number !== 'pl' && (!subject.coord || subject.correlative);
  // a base form shares the previous modal, the future ("they will come and
  // help") or a do-support negation ("he doesn't read or write"), and then
  // agrees with nothing ("she can read and write")
  const bare = previous.modal || previous.tense === 'future' || sharesNegation;
  // "we live in London and work in Paris": a base verb shares the subject
  const finite =
    r &&
    (['past', 'past|pp', '3sg'].includes(r.features.form) ||
      (r.features.form === 'base' &&
        previous.mood === 'declarative' &&
        (bare || (!third && previous.tense === 'present'))));
  const auxiliary = AUX.some((p) => has(t, p)) && !has(c.at(1), 'pron');
  if (!finite && !auxiliary) {
    return null;
  }
  const save = c.i;
  const agree = third && !bare ? 'third' : null;
  let vg = parseVerbGroup(c, agree);
  if (!vg && has(c.peek, 'prep')) {
    const phrases = subjectPhrases(c, agree);
    if (phrases) {
      attachPhrases(subject, phrases.pps);
      vg = phrases.vg;
    }
  }
  if (!vg) {
    c.i = save;
    return null;
  }
  if (r?.features.form === 'base' && !auxiliary) {
    vg.tense = previous.tense;
    vg.modal = previous.modal;
    vg.sharedModal = Boolean(previous.modal);
    if (sharesNegation) {
      vg.polarity = 'negative';
      vg.sharedPolarity = true;
    }
  }
  const tail = parseTail(c, vg.frame, tailOptions(ctx, vg));
  return {
    ...clause('declarative', vg, {
      subject: { ...subject, implicit: true },
      ...tail,
    }),
    elided: true,
  };
}

export function tailOptions(ctx, vg) {
  const r = vg.verb && { concepts: vg.verb.candidates };
  return {
    takes: r ? ctx.takesOf(r) : [],
    infinitive: r ? ctx.infinitiveOf(r) : false,
    bareInfinitive: r ? ctx.bareInfinitiveOf(r) : false,
    bareInfinitiveOf: ctx.bareInfinitiveOf,
    gerund: r ? gerundOf(ctx.lexicon)(r) : undefined,
    takesOf: ctx.takesOf,
    infinitiveOf: ctx.infinitiveOf,
    lexicon: ctx.lexicon,
    verbConcepts: vg.verb?.candidates,
    finiteComplementAhead: (c) => finiteComplementAhead(c, vg.verb, ctx),
  };
}
