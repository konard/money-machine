/** A parenthesis right after a noun: "Upwork (pre-May contracts 10%)". */

let parentheticalParser = null;

/** The clause parser registers how to read the inside of "( … )". */
export function setParentheticalParser(fn) {
  parentheticalParser = fn;
}

/** "Upwork (pre-May contracts 10%)": the parenthesis belongs to the noun. */
export function attachParenthesis(c, np) {
  if (!parentheticalParser || c.peek?.text !== '(') {
    return;
  }
  let depth = 0;
  for (let j = c.i; j < c.tokens.length; j += 1) {
    depth += c.tokens[j].text === '(' ? 1 : c.tokens[j].text === ')' ? -1 : 0;
    if (depth === 0) {
      const inside = c.tokens.slice(c.i + 1, j);
      const parsed = inside.length ? parentheticalParser(inside) : null;
      if (parsed && !parsed.leftover.length) {
        np.parenthetical = parsed.list;
        np.parentheticalFinal = c.tokens
          .slice(j + 1)
          .every((t) => /^[.!?;]$/.test(t.text));
        c.i = j + 1;
      }
      return;
    }
  }
}
