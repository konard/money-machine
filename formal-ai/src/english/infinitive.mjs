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

/** "let you sell", "help you reproduce": an object, then a bare verb. */
export function bareInfinitiveOf(lexicon) {
  return (reading) =>
    reading.concepts.some((id) => {
      const c = lexicon?.get(id);
      return c?.bareInfinitive || c?.frames?.includes('bare-infinitive');
    });
}

/** "make the agent write tests": after a verb taking a bare infinitive,
 * the object ends before a base verb instead of compounding with it. */
export function objectBeforeBareVerb(c, start, np, parse, options) {
  if (!np || !options.bareInfinitive) {
    return np;
  }
  for (let k = start + 1; k < c.i; k += 1) {
    const t = c.tokens[k];
    if (
      reading(t, 'verb')?.features.form === 'base' &&
      has(c.tokens[k - 1], 'noun')
    ) {
      const shorter = new c.constructor(c.tokens.slice(0, k));
      shorter.i = start;
      const object = parse(shorter);
      if (object && shorter.i === k) {
        c.i = k;
        return object;
      }
    }
  }
  return np;
}

/** "lets you sell items": the object does what the bare verb says. */
export function parseBareInfinitive(c, out, options, parseTail) {
  const t = c.peek;
  const r = reading(t, 'verb');
  if (
    !options.bareInfinitive ||
    out.xcomp ||
    out.objects.length !== 1 ||
    out.objects[0].type !== 'np' ||
    r?.features.form !== 'base' ||
    // "make the free version": the noun continues the object
    (has(t, 'noun') && !startsNP(c.at(1)) && c.at(1)?.kind === 'word')
  ) {
    return false;
  }
  c.next();
  // "help you reproduce bugs, write fixes…": the series is of base verbs
  const finite = c.finite;
  c.finite = 'base';
  const sub = parseTail(c, 'event', {
    ...options,
    bareInfinitive: options.bareInfinitiveOf?.(r),
    takes: options.takesOf?.(r) || [],
    infinitive: options.infinitiveOf?.(r),
    verbConcepts: r.concepts,
  });
  c.finite = finite;
  out.xcomp = { verb: head(t, r), ...sub, bare: true };
  return true;
}

/** Does the verb take a gerund ("enjoy reading")? undefined when unknown. */
export function gerundOf(lexicon) {
  return (reading) => {
    const flags = reading.concepts.map(
      (id) => lexicon?.get(id)?.gerundComplement
    );
    return flags.includes(true)
      ? true
      : flags.includes(false)
        ? false
        : undefined;
  };
}

/** Parse a complement or purpose infinitive, preserving attested noun uses of to. */
export function parseToInfinitive(c, frame, out, options, parseTail) {
  const t = c.peek;
  const takes = options.takes || [];
  // Passive object-control: "require the files to be checked". The noun
  // before "to" is the passive clause's subject, not an object of "be".
  if (t.lower === 'to' && c.at(1)?.lower === 'be' && out.objects.length) {
    let offset = 2;
    const adverbs = [];
    while (has(c.at(offset), 'adv') && !has(c.at(offset), 'verb')) {
      const token = c.at(offset++);
      adverbs.push({ type: 'adv', ...head(token, reading(token, 'adv')) });
    }
    const token = c.at(offset);
    const r = token?.readings.find(
      (r) => r.pos === 'verb' && /pp/.test(r.features.form || '')
    );
    if (r && !out.xcomp) {
      c.i += offset + 1;
      const sub = parseTail(c, 'event', {
        ...options,
        nonfinite: true,
        takes: options.takesOf?.(r) || [],
      });
      out.xcomp = {
        verb: head(token, r),
        ...sub,
        subject: out.objects.pop(),
        passive: true,
      };
      out.xcomp.mods.unshift(...adverbs);
      return true;
    }
  }
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
        // "pay to support you": a noun after "to" takes no pronoun after it
        has(c.at(2), 'pron') ||
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
      bareInfinitive: r && options.bareInfinitiveOf?.(r),
      verbConcepts: r?.concepts,
    });
    out.xcomp = { verb: head(v, r), ...sub };
    // "build ratings to get offers": after a thing, "to" states a goal;
    // after a person ("ask them to wait") it is what the person does
    const object = out.objects[out.objects.length - 1];
    if (
      (object && infinitive !== true && !personLike(object, options.lexicon)) ||
      (!object && frame === 'event' && infinitive === false)
    ) {
      out.xcomp.purpose = true;
    }
    return true;
  }
  return false;
}
