import { has, reading, startsNP, personLike, head } from './token-readings.mjs';

/** True/false for attested public inventory; undefined when evidence is absent. */
export function infinitiveOf(lexicon) {
  return (reading) => {
    const concepts = reading.concepts.map((id) => lexicon.get(id));
    if (concepts.some((c) => c?.infinitiveComplement === true)) {
      return true;
    }
    if (concepts.some((c) => c?.infinitiveComplement === false)) {
      return false;
    }
    if (
      concepts.some(
        (c) =>
          c?.frames?.includes('to-infinitive') ||
          c?.classes?.some((cls) => ['desire', 'aspectual'].includes(cls))
      )
    ) {
      return true;
    }
    return undefined;
  };
}

/** Parse a complement or purpose infinitive, preserving attested noun uses of to. */
export function parseToInfinitive(c, frame, out, options, parseTail) {
  const t = c.peek;
  const takes = options.takes || [];
  const toVerb =
    t.lower === 'to' &&
    has(c.at(1), 'verb') &&
    reading(c.at(1), 'verb').features.form === 'base';
  const infinitive =
    out.complement?.type === 'adj'
      ? options.infinitiveOf?.({ concepts: out.complement.candidates })
      : options.infinitive;
  const [verbSenses, nounSenses] = ['verb', 'noun'].map(
    (p) => toVerb && has(c.at(1), p) && reading(c.at(1), p).concepts.length
  );
  const mostlyVerb =
    toVerb &&
    has(c.at(1), 'noun') &&
    (!takes.includes('prep:to') ||
      out.objects.length > 0 ||
      startsNP(c.at(2))) &&
    (out.objects.length > 0
      ? verbSenses >= nounSenses || startsNP(c.at(2))
      : verbSenses > 2 * nounSenses ||
        // After an adjunct, "to V the NP" supplies a purpose even when
        // the infinitive also names a thing (a match, a cut, a place).
        (out.mods.some((m) => m.type === 'pp') && has(c.at(2), 'det')));
  if (
    toVerb &&
    (infinitive || !has(c.at(1), 'noun') || mostlyVerb) &&
    !out.xcomp
  ) {
    c.next();
    const v = c.next();
    const r = reading(v, 'verb');
    const sub = parseTail(c, 'event', {
      ...options,
      takes: options.takesOf?.(r) || [],
      infinitive: options.infinitiveOf?.(r),
    });
    out.xcomp = { verb: head(v, r), ...sub };
    // "build ratings to get offers": after a thing, "to" states a goal;
    // after a person ("ask them to wait") it is what the person does
    const object = out.objects[out.objects.length - 1];
    if (
      (object && !personLike(object, options.lexicon)) ||
      (!object && frame === 'event' && infinitive === false)
    ) {
      out.xcomp.purpose = true;
    }
    return true;
  }
  return false;
}
