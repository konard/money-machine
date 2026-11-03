/** Dictionary-derived evidence shared by the resolver and sense scorer. */
export function genus(definition = '') {
  const words = definition.toLowerCase().match(/[a-z]+/g) || [];
  return words.find((w) => !/^(the|a|an|any|one|some|of|to)$/.test(w));
}

/** Empty tables can inherit a sibling translation with the same genus. */
export function borrowGenus(senses) {
  return senses.map((s) => {
    if (s.russian.length || !s.definition) {
      return s;
    }
    const head = genus(s.definition);
    const sibling = senses.find(
      (x) =>
        x !== s &&
        x.russian.length &&
        !x.variant &&
        head &&
        genus(x.definition) === head
    );
    return sibling ? { ...s, russian: sibling.russian, borrowed: true } : s;
  });
}

export function usagePenalty(sense) {
  if (sense.rare) {
    return 1;
  }
  return 0;
}

/**
 * The head noun of a definition: the last word before its first
 * qualifier ("The first month of the Gregorian calendar" → month, "The
 * day after Sunday" → day, "A tool used for writing" → tool).
 */
export function hypernym(text = '') {
  const words = (text.toLowerCase().match(/[a-z]+|[,;.()]/g) || []).filter(
    (w) =>
      !/^(?:the|a|an|any|some|traditionally|usually|typically|often|especially)$/.test(
        w
      )
  );
  const stop = words.findIndex(
    (w, k) =>
      k > 0 &&
      /^(?:of|after|before|in|on|at|that|which|who|for|used|with|from|between|when|where|[,;.(])$/.test(
        w
      )
  );
  const head = (stop < 0 ? words : words.slice(0, stop)).filter((w) =>
    /^[a-z]{3,}$/.test(w)
  );
  const last = head[head.length - 1] || null;
  // "the second of the four seasons", "a kind of tree": the head is the
  // noun after "of"
  if (
    last &&
    words[stop] === 'of' &&
    /^(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|last|one|kind|type|sort|member|part|piece|any)$/.test(
      last
    )
  ) {
    const inner = hypernym(words.slice(stop + 1).join(' '));
    return inner?.replace(/(?<=[^s])s$/, '') || last;
  }
  return last;
}

const TIME_HYPERNYMS = new Set([
  'day',
  'month',
  'season',
  'year',
  'week',
  'period',
  'time',
  'hour',
  'minute',
]);

/**
 * Semantic classes of a dictionary sense from its definition and gloss:
 * the hypernym, and the time classes the grammar uses (a month takes
 * "в январе", a weekday "в понедельник").
 */
export function senseClasses(sense) {
  const text = `${sense.definition || ''} ${sense.gloss || ''}`.toLowerCase();
  const head = hypernym(sense.gloss) || hypernym(sense.definition);
  const classes = head ? [head] : [];
  if (TIME_HYPERNYMS.has(head) || /\bmonth\b|\bday of the week\b/.test(text)) {
    classes.push('time');
  }
  if (
    /\bday of the week\b|^(?:day|the day) (?:after|before) [a-z]+day\b/.test(
      text
    ) ||
    (head === 'day' && /\bweek\b/.test(text))
  ) {
    classes.push('weekday');
  } else if (
    head === 'month' ||
    /\bmonth of the (?:gregorian|julian) calendar\b/.test(text)
  ) {
    classes.push('month');
  } else if (head === 'season') {
    classes.push('season');
  }
  return [...new Set(classes)];
}
