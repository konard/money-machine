/**
 * The translation agent behind the vendor-compatible endpoints.
 *
 * A client CLI (Claude Code, Codex, Link Assistant Agent) sends a normal
 * chat turn. The agent works out what to translate:
 *
 * - inline text ("Translate to Russian: …", or any English text);
 * - a file ("translate docs/guide.md"), read and written through the
 *   client's own tools so the client's permissions apply;
 * - part of a file ("translate the second paragraph of README.md",
 *   "sentence 3 of notes.txt", "lines 10-20 of a.md").
 *
 * It answers either with text or with one tool call; tool results come
 * back in the next request and continue the same plan.
 */

import { readFileSync, existsSync } from 'node:fs';
import {
  isAbsolute,
  resolve,
  join,
  dirname,
  basename,
  extname,
} from 'node:path';
import {
  translateDocument,
  splitBlocks,
  splitSentences,
} from '../document.mjs';

const ORDINALS = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  last: -1,
};
const FILE =
  /(?:^|[\s"'`(])((?:[~./\w-]+\/)*[\w.-]+\.(?:md|markdown|txt|text|rst))\b/gi;

/** Remove client-injected wrappers (system reminders, command tags). */
export function cleanUserText(text) {
  return String(text || '')
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
    .replace(
      /<(environment_context|user_instructions|command-[\w-]+)>[\s\S]*?<\/\1>/g,
      ''
    )
    .trim();
}

/** Working directory announced by the client, if any. */
export function clientCwd(conversation) {
  const all = [
    conversation.system || '',
    ...conversation.messages.flatMap((m) =>
      m.content.filter((c) => c.type === 'text').map((c) => c.text)
    ),
  ].join('\n');
  const m =
    /(?:Primary working directory|Working directory|<cwd>)\s*:?\s*([^\n<]+)/.exec(
      all
    );
  return m ? m[1].trim() : process.cwd();
}

/** Parse what the user asked for. */
export function parseRequest(text, cwd) {
  const files = [...text.matchAll(FILE)].map((m) => m[1]);
  const request = {
    cwd,
    input: null,
    output: null,
    selector: null,
    inline: null,
  };
  if (files.length) {
    request.input = absolute(files[0], cwd);
    const out =
      /\b(?:to|into|as|save(?:\s+it)?\s+(?:as|to|in))\s+["'`]?((?:[~./\w-]+\/)*[\w.-]+\.(?:md|markdown|txt|text|rst))/i.exec(
        text
      );
    if (out && out[1] !== files[0]) {
      request.output = absolute(out[1], cwd);
    } else if (files[1]) {
      request.output = absolute(files[1], cwd);
    }
  }
  request.selector = parseSelector(text);
  if (!request.input) {
    request.inline = inlineText(text);
  }
  return request;
}

function absolute(path, cwd) {
  const expanded = path.startsWith('~/')
    ? join(process.env.HOME || '', path.slice(2))
    : path;
  return isAbsolute(expanded) ? expanded : resolve(cwd, expanded);
}

/** "second paragraph", "paragraph 2", "sentence 3", "lines 4-9". */
export function parseSelector(text) {
  let m =
    /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last|(\d+)(?:st|nd|rd|th))\s+(paragraph|sentence)/i.exec(
      text
    );
  if (m) {
    return {
      unit: m[3].toLowerCase(),
      index: m[2] ? Number(m[2]) : ORDINALS[m[1].toLowerCase()],
    };
  }
  m = /\b(paragraph|sentence)\s+(?:no\.?\s*|#)?(\d+)/i.exec(text);
  if (m) {
    return { unit: m[1].toLowerCase(), index: Number(m[2]) };
  }
  m = /\blines?\s+(\d+)(?:\s*(?:-|to|–)\s*(\d+))?/i.exec(text);
  if (m) {
    return { unit: 'lines', from: Number(m[1]), to: Number(m[2] || m[1]) };
  }
  return null;
}

/** The text to translate when no file is named. */
export function inlineText(text) {
  const quoted = /["“«]([^"”»]{2,})["”»]/.exec(text);
  const instruction =
    /^\s*(?:please\s+)?(?:translate|translation of)\b[^:\n]*?(?:into|to)?\s*(?:russian)?\s*(?::|\n)\s*/i;
  if (instruction.test(text)) {
    return text.replace(instruction, '').trim();
  }
  if (/^\s*(?:please\s+)?translate\b/i.test(text) && quoted) {
    return quoted[1];
  }
  return text
    .replace(
      /^\s*(?:please\s+)?translate\s+(?:this|the following)?\s*(?:text|sentence|paragraph|document)?\s*(?:into|to)?\s*(?:russian)?\s*[:.-]?\s*/i,
      ''
    )
    .trim();
}

/** Select part of a document. */
export function selectPart(text, selector) {
  if (!selector) {
    return text;
  }
  if (selector.unit === 'lines') {
    return text
      .split(/\r?\n/)
      .slice(selector.from - 1, selector.to)
      .join('\n');
  }
  const paragraphs = splitBlocks(text)
    .filter((b) => b.kind === 'prose' && !/^\s*#/.test(b.text))
    .map((b) => b.text);
  if (selector.unit === 'paragraph') {
    const i =
      selector.index < 0
        ? paragraphs.length + selector.index
        : selector.index - 1;
    return paragraphs[i] ?? '';
  }
  const sentences = paragraphs.flatMap((p) =>
    splitSentences(p.replace(/\s*\n\s*/g, ' '))
  );
  const i =
    selector.index < 0 ? sentences.length + selector.index : selector.index - 1;
  return sentences[i] ?? '';
}

/** Default output path: guide.md → guide.ru.md */
export function defaultOutput(input) {
  const ext = extname(input);
  return join(dirname(input), `${basename(input, ext)}.ru${ext}`);
}

/** Strip line numbers and wrappers from a client's file-read result. */
export function fileFromToolResult(text) {
  let body = String(text || '');
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed?.output === 'string') {
      body = parsed.output;
    }
  } catch {
    // plain text
  }
  body = body.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '');
  const output = /(?:^|\n)Output:\n([\s\S]*)$/.exec(body);
  if (output && /Exit code:|Wall time:/.test(body)) {
    body = output[1];
  }
  body = body
    .replace(/^<file>\n|\n?\(End of file[^)]*\)\n?<\/file>\s*$/g, '')
    .replace(/<\/?file>/g, '');
  const lines = body.replace(/\n$/, '').split('\n');
  const numbered = lines.filter((l) => /^\s*\d+(?:→|\t|\| )/.test(l)).length;
  if (numbered >= Math.max(1, lines.length - 1)) {
    return lines.map((l) => l.replace(/^\s*\d+(?:→|\t|\| )/, '')).join('\n');
  }
  return body;
}

/** Tool adapters: which client tool reads and writes files. */
export function toolPlan(tools) {
  const byName = new Map(tools.map((t) => [t.name, t]));
  const prop = (tool, re) =>
    Object.keys(tool?.schema?.properties || {}).find((k) => re.test(k));
  const read = byName.get('Read') || byName.get('read');
  const write = byName.get('Write') || byName.get('write');
  const shell =
    byName.get('shell') ||
    byName.get('exec_command') ||
    byName.get('shell_command') ||
    byName.get('local_shell') ||
    byName.get('bash') ||
    byName.get('Bash');
  const patch = byName.get('apply_patch');
  const readTool = read || shell;
  const writeTool = write || patch || shell;
  return {
    readName: readTool?.name,
    writeName: writeTool?.name,
    read: read
      ? (path) => ({
          name: read.name,
          input: { [prop(read, /path/i) || 'file_path']: path },
        })
      : shell
        ? (path) => ({
            name: shell.name,
            input: shellInput(shell, `cat ${quotePath(path)}`),
          })
        : null,
    write: write
      ? (path, content) => ({
          name: write.name,
          input: {
            [prop(write, /path/i) || 'file_path']: path,
            [prop(write, /content/i) || 'content']: content,
          },
        })
      : patch
        ? (path, content) => ({
            name: patch.name,
            custom: patch.custom,
            input: patch.custom
              ? addFilePatch(path, content)
              : { input: addFilePatch(path, content) },
          })
        : shell
          ? (path, content) => ({
              name: shell.name,
              input: shellInput(shell, heredoc(path, content)),
            })
          : null,
  };
}

function quotePath(path) {
  return `'${path.replace(/'/g, "'\\''")}'`;
}

/** `cat > file <<'EOF'` with a delimiter that does not occur in the text. */
export function heredoc(path, content) {
  let tag = 'FORMAL_AI_EOF';
  while (content.includes(tag)) {
    tag += '_';
  }
  return `cat > ${quotePath(path)} <<'${tag}'\n${content.replace(/\n$/, '')}\n${tag}`;
}

function shellInput(tool, command) {
  const props = tool.schema?.properties || {};
  if (props.command?.type === 'array') {
    return { command: ['bash', '-lc', command] };
  }
  if (props.cmd) {
    return { cmd: command };
  }
  return { command };
}

function addFilePatch(path, content) {
  const body = content
    .split('\n')
    .map((l) => `+${l}`)
    .join('\n');
  return `*** Begin Patch\n*** Add File: ${path}\n${body}\n*** End Patch`;
}

function summary(result) {
  const { sentences, complete } = result.stats;
  const lines = [`${complete}/${sentences} sentences translated completely.`];
  for (const s of result.sentences.filter((x) => !x.complete).slice(0, 10)) {
    const why = [
      s.unknown.length ? `unknown: ${s.unknown.join(', ')}` : '',
      s.leftover.length ? `not parsed: ${s.leftover.join(' ')}` : '',
    ]
      .filter(Boolean)
      .join('; ');
    lines.push(`- "${s.source}" → "${s.text}"${why ? ` (${why})` : ''}`);
  }
  return lines.join('\n');
}

/**
 * Decide the next assistant turn.
 * @param {{system: string, messages: object[], tools: object[]}} conversation
 *   normalized conversation: content items are `{type:'text', text}`,
 *   `{type:'tool_call', id, name, input}`, `{type:'tool_result', id, text}`
 * @param {object} options - translation options
 * @returns {{text?: string, toolCall?: {name: string, input: object}}}
 */
export function respond(conversation, options = {}) {
  const messages = conversation.messages;
  const lastUserIndex = findLastIndex(
    messages,
    (m) =>
      m.role === 'user' &&
      m.content.some((c) => c.type === 'text' && cleanUserText(c.text))
  );
  const userText =
    lastUserIndex >= 0
      ? messages[lastUserIndex].content
          .filter((c) => c.type === 'text')
          .map((c) => cleanUserText(c.text))
          .join('\n')
          .trim()
      : '';
  const cwd = clientCwd(conversation);
  const request = parseRequest(userText, cwd);
  const plan = toolPlan(conversation.tools || []);
  const after = messages.slice(lastUserIndex + 1);
  const calls = after.flatMap((m) =>
    m.content.filter((c) => c.type === 'tool_call')
  );
  const results = after.flatMap((m) =>
    m.content.filter((c) => c.type === 'tool_result')
  );
  if (!userText) {
    return {
      text: 'Send English text, or name a file to translate into Russian.',
    };
  }
  if (!request.input) {
    const result = translateDocument(request.inline || userText, options);
    return {
      text: result.stats.incomplete
        ? `${result.text}\n\n---\n${summary(result)}`
        : result.text,
    };
  }
  const output =
    request.output || (request.selector ? null : defaultOutput(request.input));
  const resultFor = (call) =>
    results.find((r) => r.id === call.id) || results[calls.indexOf(call)];
  const readCall = calls.find((c) => c.name === plan.readName);
  const writeCall = calls.find(
    (c) => c.name === plan.writeName && c !== readCall
  );
  if (writeCall) {
    const written = resultFor(writeCall);
    if (written?.isError) {
      return {
        text: `Writing ${output} failed: ${written.text.slice(0, 300)}`,
      };
    }
    const source = readCall
      ? fileFromToolResult(resultFor(readCall)?.text)
      : existsSync(request.input)
        ? readFileSync(request.input, 'utf8')
        : '';
    const result = translateDocument(
      selectPart(source, request.selector),
      options
    );
    return {
      text: `Translated ${request.input} → ${output}.\n${summary(result)}`,
    };
  }
  if (readCall) {
    const read = resultFor(readCall);
    if (!read) {
      return { text: `No result came back for reading ${request.input}.` };
    }
    if (
      read.isError ||
      /^(Error|File does not exist|cat: )/i.test(read.text) ||
      /No such file/.test(read.text)
    ) {
      return {
        text: `Could not read ${request.input}: ${read.text.slice(0, 300)}`,
      };
    }
    return finish(
      fileFromToolResult(read.text),
      request,
      output,
      plan,
      options
    );
  }
  if (plan.read) {
    return { toolCall: plan.read(request.input) };
  }
  if (existsSync(request.input)) {
    return finish(
      readFileSync(request.input, 'utf8'),
      request,
      output,
      plan,
      options
    );
  }
  return {
    text: `Cannot read ${request.input}: this client offers no file-reading tool.`,
  };
}

function finish(source, request, output, plan, options) {
  const part = selectPart(source, request.selector);
  if (!part.trim()) {
    return {
      text: `Nothing selected in ${request.input} for ${JSON.stringify(request.selector)}.`,
    };
  }
  const result = translateDocument(part, options);
  if (!output || !plan.write) {
    const note =
      output && !plan.write
        ? `\n\n(This client offers no file-writing tool, so the translation is shown instead of being saved to ${output}.)`
        : '';
    return {
      text: `${result.text}${note}${result.stats.incomplete ? `\n\n---\n${summary(result)}` : ''}`,
    };
  }
  return {
    toolCall: plan.write(
      output,
      result.text.endsWith('\n') ? result.text : `${result.text}\n`
    ),
  };
}

function findLastIndex(list, predicate) {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (predicate(list[i])) {
      return i;
    }
  }
  return -1;
}
