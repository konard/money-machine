/** Where a relative clause without "that" ends. */

/**
 * First token in [from, to) that can be the finite verb of a clause whose
 * subject is `np` ("goes" after "the money we earn"), or -1.
 */
export function outerVerbAt(tokens, from, to, np) {
  for (let k = from; k < to; k += 1) {
    const forms = tokens[k].readings
      .filter((r) => r.pos === 'verb' || r.pos === 'modal')
      .map((r) => r.features?.form || (r.pos === 'modal' ? 'finite' : ''));
    if (
      forms.some(
        (f) =>
          f === 'finite' ||
          /past/.test(f) ||
          (np.number === 'pl' ? f === 'base' : f === '3sg')
      )
    ) {
      return k;
    }
  }
  return -1;
}
