/**
 * Links Notation (indented form) parser.
 *
 * Ported from link-assistant/formal-ai `js/seed_loader.js`
 * (`parseLinoUncached`, `parseLinoLine`, `stripComment`, `unescapeQuoted`)
 * at commit 99b00e4e. The browser/worker plumbing, the regex-effect hooks and
 * the shared-lexeme lowering were dropped: this copy only needs the plain
 * tree. Each node is `{name, value, children}`.
 *
 * Mutation for the translator: a parenthesised value such as
 * `cues (money loan)` is kept as raw text; callers split it with `words()`.
 */

/**
 * Remove a trailing `# comment` that is outside quotes.
 * @param {string} line
 * @returns {string}
 */
export function stripComment(line) {
  let quote = null;
  let escaped = false;
  let previousWasSpace = true;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quote !== null) {
      if (escaped) {
        escaped = false;
      } else if ((quote === '"' || quote === '`') && ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      previousWasSpace = false;
      continue;
    }
    if (ch === '#' && previousWasSpace) {
      return line.slice(0, i);
    }
    previousWasSpace = /\s/.test(ch);
  }
  return line;
}

/**
 * Undo backslash escapes and doubled delimiters inside a quoted scalar.
 * @param {string} value
 * @param {string} doubled - the delimiter that may appear doubled
 * @returns {string}
 */
export function unescapeQuoted(value, doubled) {
  const source = String(value || '');
  let out = '';
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (doubled && ch === doubled && source[i + 1] === doubled) {
      out += doubled;
      i += 1;
      continue;
    }
    if (ch !== '\\') {
      out += ch;
      continue;
    }
    const next = source[i + 1];
    if (next === undefined) {
      out += '\\';
      continue;
    }
    i += 1;
    out += next === 'n' ? '\n' : next === 't' ? '\t' : next;
  }
  return out;
}

/**
 * Parse one content line into a node.
 * @param {string} content
 * @returns {{name: string, value: string, children: object[]}}
 */
function parseLine(content) {
  const node = { name: '', value: '', children: [] };
  const parts = /^(\S+)(?:\s+([\s\S]*))?$/.exec(content.trim());
  if (!parts) {
    return node;
  }
  node.name = parts[1];
  const rest = (parts[2] || '').trim();
  const delimiter = rest[0];
  if (delimiter === '"' || delimiter === "'" || delimiter === '`') {
    let closing = -1;
    for (let i = 1; i < rest.length; i += 1) {
      if (rest[i] === '\\') {
        i += 1;
        continue;
      }
      if (rest[i] === delimiter) {
        if (rest[i + 1] === delimiter) {
          i += 1;
          continue;
        }
        closing = i;
        break;
      }
    }
    if (closing !== -1 && rest.slice(closing + 1).trim().length === 0) {
      node.value = unescapeQuoted(
        rest.slice(1, closing),
        delimiter === "'" ? "'" : '"'
      );
      return node;
    }
  }
  node.value = rest;
  return node;
}

/**
 * Parse an indented Links Notation document.
 * @param {string} text
 * @returns {{name: string, value: string, children: object[]}} a synthetic root
 */
export function parseLino(text) {
  const root = { name: '', value: '', children: [], indent: -1 };
  const stack = [root];
  for (const line of String(text).split(/\r?\n/)) {
    if (!line || /^\s*$/.test(stripComment(line))) {
      continue;
    }
    if (/^[ ]*\t/.test(line)) {
      throw new Error('Links Notation indentation must use spaces');
    }
    const indent = /^( *)/.exec(line)[1].length;
    const content = stripComment(line.slice(indent)).trim();
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    const node = parseLine(content);
    node.indent = indent;
    stack[stack.length - 1].children.push(node);
    stack.push(node);
  }
  return root;
}

/**
 * Children of `node` with the given name.
 * @param {object} node
 * @param {string} name
 * @returns {object[]}
 */
export function childrenNamed(node, name) {
  return (node?.children || []).filter((child) => child.name === name);
}

/**
 * Value of the first child with the given name.
 * @param {object} node
 * @param {string} name
 * @returns {string|undefined}
 */
export function field(node, name) {
  return childrenNamed(node, name)[0]?.value;
}

/**
 * Split a value into words, ignoring one level of parentheses.
 * @param {string|undefined} value
 * @returns {string[]}
 */
export function words(value) {
  return String(value || '')
    .replace(/[()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Quote a scalar for Links Notation output when needed.
 * @param {string} value
 * @returns {string}
 */
export function quote(value) {
  const text = String(value);
  if (text !== '' && /^[^\s"'`#()]+$/.test(text)) {
    return text;
  }
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
