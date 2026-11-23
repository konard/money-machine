/** Short form of a past passive participle: опубликованный → опубликована. */
export function shortParticiple(long, f) {
  const base = long.replace(/ый$/, '').replace(/нн$/, 'н');
  if (base === long) {
    return null;
  }
  if (f.number === 'pl') {
    return `${base.replace(/ё(?=[^ё]*$)/, 'е')}ы`;
  }
  const ending = { m: '', f: 'а', n: 'о' }[f.gender || 'm'];
  return ending ? `${base.replace(/ё(?=[^ё]*$)/, 'е')}${ending}` : base;
}

/** A result without a participle or imperfective still refers to the past. */
export function passiveFallbackTense(s, entry) {
  return s.tense === 'present' && entry.aspect === 'perf' && !s.modality
    ? 'past'
    : s.tense;
}
