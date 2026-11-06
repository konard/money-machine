/** Shared aspect choice; a Russian reading can retain its observed aspect. */
/** Adverbs and determiners that make an action habitual (imperfective). */
export const HABIT = new Set(
  'often always never sometimes usually again'.split(' ')
);
/** "often", or an adverb whose gloss repeats ("monthly": every month). */
export function habitualAdverb(concept, ctx) {
  return (
    HABIT.has(concept) ||
    /\b(?:every|each|regularly|repeatedly|once an?)\b/.test(
      ctx.lexicon.get(concept)?.gloss || ''
    )
  );
}

export function chooseAspect(entry, s, ctx, role) {
  // A Russian analysis knows the observed aspect even when its English
  // simple/perfect/progressive interpretation remains a range.
  if (s.russianAspect) {
    return s.russianAspect === 'perf' ? entry.perfective || entry : entry;
  }
  const mods = s.modifiers || [];
  const habitual = mods.some(
    (m) =>
      (m.kind === 'adverb' && habitualAdverb(m.concept, ctx)) ||
      (m.kind === 'time' && m.entity?.determiner === 'det.every')
  );
  const objects = s.objects || [];
  const specific = objects.some(
    (o) =>
      o.definiteness === 'definite' ||
      o.quantity !== undefined ||
      o.pronoun ||
      o.name ||
      (o.definiteness === 'indefinite' && o.number === 'singular')
  );
  const hasGoal =
    mods.some(
      (m) =>
        m.kind === 'relation' && ['rel.to', 'rel.into'].includes(m.relation)
    ) ||
    mods.some(
      (m) =>
        m.kind === 'adverb' && ['home.adv', 'there', 'here'].includes(m.concept)
    );
  const duration = lasting(s);
  const pick = (variant, why) => {
    if (variant !== entry && why) {
      ctx.notes.add(`${variant.lemma}: ${why}`);
    }
    return variant;
  };
  if (habitual && entry.habitual) {
    return pick(entry.habitual, 'habitual motion');
  }
  if (!entry.perfective) {
    return entry;
  }
  if (
    s.aspect === 'progressive' ||
    s.aspect === 'perfect-progressive' ||
    habitual ||
    (s.polarity === 'negative' && role !== 'finite')
  ) {
    return entry;
  }
  if (role === 'imperative') {
    return s.polarity === 'negative'
      ? entry
      : objects.length || entry.motion
        ? pick(entry.perfective, 'single completed action requested')
        : entry;
  }
  if (s.aspect === 'perfect') {
    if (duration && s.tense === 'present') {
      return entry;
    }
    return pick(entry.perfective, 'perfect aspect (completed result)');
  }
  if (role === 'finite' && s.tense === 'present') {
    return entry;
  }
  if (
    s.tense === 'past' &&
    entry.motion &&
    hasGoal &&
    entry.habitual &&
    mods.some((m) => m.kind === 'adverb' && m.concept === 'yesterday')
  ) {
    return pick(entry.habitual, 'round trip in the past');
  }
  if (s.polarity === 'negative' || duration) {
    return entry;
  }
  // "opened the door and saw a cat": a chain of completed past actions
  if (
    s.subject?.implicit &&
    s.tense === 'past' &&
    ctx.discourse?.lastAspect === 'perf'
  ) {
    return pick(
      entry.perfective,
      'next action in a sequence of completed actions'
    );
  }
  if (entry.prefer === 'impf') {
    return entry;
  }
  const classes = ctx.lexicon.get(ctx.predicate)?.classes || [];
  const activity = [
    'communication',
    'perception',
    'consumption',
    'art',
    'activity',
  ].some((c) => classes.includes(c));
  if (
    !specific &&
    !entry.motion &&
    !entry.subjectConcept &&
    (entry.perfective.lemma.startsWith('по') || activity)
  ) {
    return entry;
  }
  const why =
    role === 'infinitive'
      ? 'one completed action'
      : s.tense === 'future'
        ? 'single future action'
        : 'completed action';
  return pick(entry.perfective, why);
}

/** "for ten years", "since May": a state that still lasts. */
export function lasting(s) {
  return (s.modifiers || []).some(
    (m) =>
      m.kind === 'relation' && ['rel.for', 'rel.since'].includes(m.relation)
  );
}
