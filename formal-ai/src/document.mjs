/**
 * Document structure: split text into blocks, paragraphs and sentences,
 * translate the translatable parts and reassemble the document.
 *
 * Markdown is respected: fenced code, inline code, URLs, headings markers,
 * list markers, block quotes and table pipes are kept as they are; only the
 * prose is translated. Sentence boundaries ignore common abbreviations.
 */

import { parseSentence } from './english/clause.mjs';
import { translateSentence, TranslationContext } from './translate.mjs';

const ABBREVIATIONS =
  /\b(?:Mr|Mrs|Ms|Dr|Prof|St|vs|etc|e\.g|i\.e|No|Jr|Sr|Inc|Ltd)\.$/i;

/**
 * Split a paragraph of prose into sentences.
 * @param {string} text
 * @returns {string[]}
 */
export function splitSentences(text) {
  const out = [];
  let current = '';
  const chars = [...text];
  for (let i = 0; i < chars.length; i += 1) {
    current += chars[i];
    if (/[.!?]/.test(chars[i])) {
      while (/[.!?"')\]]/.test(chars[i + 1] || '')) {
        i += 1;
        current += chars[i];
      }
      const next = chars[i + 1];
      const after = chars[i + 2];
      if (
        (next === undefined || /\s/.test(next)) &&
        (after === undefined ||
          /[A-Z0-9"'([]/.test(after) ||
          /\s/.test(after)) &&
        !ABBREVIATIONS.test(current.trim())
      ) {
        out.push(current.trim());
        current = '';
      }
    }
  }
  if (current.trim()) {
    out.push(current.trim());
  }
  return out;
}

/**
 * Split a document into blocks separated by blank lines; fenced code
 * blocks are a single untranslatable block.
 * @param {string} text
 * @returns {{kind: 'prose'|'code'|'blank', text: string}[]}
 */
export function splitBlocks(text) {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let buffer = [];
  let fence = null;
  const flush = () => {
    if (buffer.length) {
      blocks.push({ kind: 'prose', text: buffer.join('\n') });
      buffer = [];
    }
  };
  for (const line of lines) {
    const f = /^\s*(```|~~~)/.exec(line);
    if (fence) {
      blocks[blocks.length - 1].text += `\n${line}`;
      if (f && f[1] === fence) {
        fence = null;
      }
      continue;
    }
    if (f) {
      flush();
      fence = f[1];
      blocks.push({ kind: 'code', text: line });
      continue;
    }
    if (line.trim() === '') {
      flush();
      blocks.push({ kind: 'blank', text: '' });
      continue;
    }
    buffer.push(line);
  }
  flush();
  return blocks;
}

const LINE_PREFIX =
  /^(\s*(?:#{1,6}\s+|>\s*|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)?)(.*)$/;
const PROTECTED = /(`[^`]*`|https?:\/\/\S+|\[[^\]]*\]\([^)]*\)|<[^>]+>)/g;

/**
 * Translate one line of prose, keeping its markdown prefix and protected
 * spans (inline code, links, URLs, HTML) unchanged.
 */
function translateLine(line, context, report) {
  if (/^\s*\|/.test(line)) {
    return line
      .split('|')
      .map((cell) =>
        /^\s*:?-+:?\s*$/.test(cell) || !cell.trim()
          ? cell
          : ` ${translateProse(cell.trim(), context, report)} `
      )
      .join('|');
  }
  const [, prefix, body] = LINE_PREFIX.exec(line);
  if (!body.trim()) {
    return line;
  }
  return prefix + translateProse(body, context, report);
}

// "**Minimum payout:** $1", "**Tax.** Corporate 22%" — a bold label is a
// unit of its own, read like a heading
const LABEL = /(\*\*[^*]+?[:.]\*\*|__[^_]+?[:.]__)/;
const EMPHASIS = /\*\*|__|(?<![\w*])[*_](?=\S)|(?<=\S)[*_](?![\w*])/g;

function translateProse(text, context, report) {
  if (LABEL.test(text)) {
    return text
      .split(LABEL)
      .map((piece) => {
        const label = /^(\*\*|__)(.+?)([:.])\1$/.exec(piece);
        if (label) {
          const ru = translateProse(label[2], context, report).replace(
            /[.!]$/,
            ''
          );
          return `${label[1]}${ru}${label[3]}${label[1]}`;
        }
        return piece.trim() ? translateProse(piece, context, report) : piece;
      })
      .join('');
  }
  // inline emphasis is dropped: its span rarely maps onto Russian words
  text = text.replace(EMPHASIS, '');
  // protected spans become opaque name-like tokens so the sentence around
  // them is parsed as one sentence, then they are put back unchanged
  const spans = [];
  const masked = text.replace(PROTECTED, (span) => {
    spans.push(span);
    return placeholder(spans.length - 1, span.startsWith('`'));
  });
  if (!/[A-Za-z]/.test(masked.replace(/Xp[ch][a-j]+Q/g, ''))) {
    return text;
  }
  const lead = /^\s*/.exec(masked)[0];
  const trail = /\s*$/.exec(masked)[0];
  const translated = splitSentences(masked.trim())
    .map((s) => translateOne(s, context, report))
    .join(' ');
  return (
    lead +
    translated.replace(
      /Xp[ch]([a-j]+)Q/g,
      (_, code) => spans[fromLetters(code)]
    ) +
    trail
  );
}

/** Letters-only token (digits would split it): 12 → "Xphbc" + "Q". */
function placeholder(index, code) {
  const letters = String(index)
    .split('')
    .map((d) => String.fromCharCode(97 + Number(d)))
    .join('');
  return `Xp${code ? 'c' : 'h'}${letters}Q`;
}

function fromLetters(code) {
  return Number(
    code
      .split('')
      .map((ch) => ch.charCodeAt(0) - 97)
      .join('')
  );
}

function translateOne(sentence, context, report) {
  let r;
  try {
    r = translateSentence(sentence, context);
  } catch (error) {
    // one broken sentence must not abort the document: keep the source
    r = {
      source: sentence,
      text: `[${sentence}]`,
      complete: false,
      notes: [`internal error: ${error.message}`],
      unknown: [],
      leftover: [],
      senses: [],
    };
  }
  report.sentences.push(r);
  return r.text;
}

/**
 * Words the document writes capitalized inside sentences and never in
 * lowercase: its names ("Stripe pays…" is the company, as "via Stripe"
 * elsewhere shows), even where a sentence starts with them.
 */
export function documentNames(text) {
  const lower = documentWords(text);
  const plain = text.replace(/```[\s\S]*?```|`[^`]*`|\]\([^)]*\)/g, ' ');
  const names = new Set();
  for (const m of plain.matchAll(/[a-z,;] +([A-Z][a-zA-Z-]+)/g)) {
    if (!lower.has(m[1].toLowerCase())) {
      names.add(m[1]);
    }
  }
  return names;
}

/** Words the document writes in lowercase somewhere in its prose. */
export function documentWords(text) {
  const plain = text.replace(/```[\s\S]*?```|`[^`]*`|\]\([^)]*\)/g, ' ');
  return new Set(plain.match(/\b[a-z][a-z-]+\b/g) || []);
}

/**
 * Translate a whole document (plain text or markdown).
 * @param {string} text
 * @param {object} [options] - translation options (`you`, `speakerGender`)
 * @returns {{text: string, sentences: object[], stats: object}}
 */
export function translateDocument(text, options = {}) {
  const context = options.context || new TranslationContext(options);
  if (options.field && !context.memory.families) {
    context.memory.setField(options.field);
  }
  if (!context.memory.topic) {
    context.memory.setTopic(options.topic || text);
    context.lexicon.setDocumentNames?.(
      documentNames(options.topic || text),
      documentWords(options.topic || text)
    );
  }
  const report = { sentences: [] };
  const out = splitBlocks(text).map((block) => {
    if (block.kind !== 'prose') {
      return block.text;
    }
    // a paragraph wrapped over several lines is one unit of prose
    const lines = block.text.split('\n');
    const structured = lines.some(
      (l) => LINE_PREFIX.exec(l)[1].trim() || /^\s*\|/.test(l)
    );
    const fragmentLines =
      lines.length > 1 &&
      lines.every((line) => {
        const parsed = parseSentence(line, context.lexicon);
        return (
          !parsed.leftover.length &&
          parsed.clauses.length &&
          parsed.clauses.every((c) => c.type === 'fragment')
        );
      });
    if (!structured && !fragmentLines) {
      return translateProse(lines.join(' '), context, report);
    }
    return lines.map((l) => translateLine(l, context, report)).join('\n');
  });
  const complete = report.sentences.filter((s) => s.complete).length;
  return {
    text: out.join('\n'),
    sentences: report.sentences,
    stats: {
      sentences: report.sentences.length,
      complete,
      incomplete: report.sentences.length - complete,
    },
  };
}

/** Translate a single paragraph (sentences share context). */
export function translateParagraph(text, options = {}) {
  return translateDocument(text.replace(/\s*\n\s*/g, ' '), options);
}
