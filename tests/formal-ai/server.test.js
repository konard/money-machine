/**
 * The model server behind `formal-ai with claude/codex/agent`: protocol
 * adapters, request parsing and the read → translate → write tool loop.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { startServer } from '../../formal-ai/src/server/server.mjs';
import {
  parseRequest,
  parseSelector,
  selectPart,
  defaultOutput,
  fileFromToolResult,
  heredoc,
  toolPlan,
  respond,
} from '../../formal-ai/src/server/agent.mjs';
import { clientCommand } from '../../formal-ai/src/with.mjs';

/**
 * Sockets, temp files and the environment need permissions that
 * `deno test --allow-read` does not grant; those tests skip there and run
 * under node and bun (and deno with --allow-all).
 */
function missingPermissions() {
  const permissions = globalThis.Deno?.permissions;
  if (!permissions) {
    return false;
  }
  const missing = ['net', 'write', 'env'].filter(
    (name) => permissions.querySync({ name }).state !== 'granted'
  );
  return missing.length
    ? `needs deno --allow-${missing.join(' --allow-')}`
    : false;
}
const skip = missingPermissions();

const READ = {
  name: 'Read',
  input_schema: {
    type: 'object',
    properties: { file_path: { type: 'string' } },
  },
};
const WRITE = {
  name: 'Write',
  input_schema: {
    type: 'object',
    properties: { file_path: { type: 'string' }, content: { type: 'string' } },
  },
};

async function withServer(fn) {
  const server = await startServer({ port: 0, log: '' });
  try {
    return await fn(server.url);
  } finally {
    await server.close();
  }
}

const post = (url, body) =>
  fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

/** Data payloads of a server-sent event stream. */
async function events(response) {
  const text = await response.text();
  return text
    .split('\n')
    .filter((l) => l.startsWith('data: '))
    .map((l) => l.slice(6))
    .filter((d) => d !== '[DONE]')
    .map((d) => JSON.parse(d));
}

test('requests name a file, a part of it and an output', () => {
  const r = parseRequest(
    'Translate the second paragraph of notes.md into out.md',
    '/work'
  );
  assert.equal(r.input, resolve('/work', 'notes.md'));
  assert.equal(r.output, resolve('/work', 'out.md'));
  assert.deepEqual(parseSelector('translate sentence 3 of a.md'), {
    unit: 'sentence',
    index: 3,
  });
  assert.deepEqual(parseSelector('the second paragraph'), {
    unit: 'paragraph',
    index: 2,
  });
  assert.equal(defaultOutput('/work/notes.md'), join('/work', 'notes.ru.md'));
});

test('parts of a document are selected without counting headings', () => {
  const doc =
    '# Title\n\nFirst paragraph. It has two sentences.\n\nSecond paragraph.';
  assert.equal(
    selectPart(doc, { unit: 'paragraph', index: 2 }),
    'Second paragraph.'
  );
  assert.equal(
    selectPart(doc, { unit: 'sentence', index: 2 }),
    'It has two sentences.'
  );
});

test('file text is recovered from each client tool result format', () => {
  assert.equal(
    fileFromToolResult('     1→Hello.\n     2→World.'),
    'Hello.\nWorld.'
  );
  assert.equal(fileFromToolResult('1\tHello.\n2\tWorld.'), 'Hello.\nWorld.');
  assert.equal(
    fileFromToolResult(JSON.stringify({ output: 'Hello.' })),
    'Hello.'
  );
});

test('a heredoc delimiter never occurs in the content', () => {
  const command = heredoc('/a b.md', 'x\nFORMAL_AI_EOF\n');
  assert.match(command, /^cat > '\/a b\.md' <<'FORMAL_AI_EOF_'\n/);
  assert.ok(command.endsWith('\nFORMAL_AI_EOF_'));
});

test('tool plans adapt to Read/Write, read/write and shell-only clients', () => {
  const claude = toolPlan([
    { name: 'Read', schema: READ.input_schema },
    { name: 'Write', schema: WRITE.input_schema },
  ]);
  assert.deepEqual(claude.read('/a.md'), {
    name: 'Read',
    input: { file_path: '/a.md' },
  });
  const agent = toolPlan([
    { name: 'read', schema: { properties: { filePath: {} } } },
    { name: 'write', schema: { properties: { filePath: {}, content: {} } } },
  ]);
  assert.deepEqual(agent.write('/b.md', 'x'), {
    name: 'write',
    input: { filePath: '/b.md', content: 'x' },
  });
  const codex = toolPlan([
    { name: 'exec_command', schema: { properties: { cmd: {} } } },
  ]);
  assert.deepEqual(codex.read('/a.md'), {
    name: 'exec_command',
    input: { cmd: "cat '/a.md'" },
  });
  assert.match(
    codex.write('/b.md', 'Привет.').input.cmd,
    /^cat > '\/b\.md' <<'FORMAL_AI_EOF'\nПривет\.\nFORMAL_AI_EOF$/
  );
});

test('plain text is translated without tools', () => {
  const reply = respond({
    messages: [
      { role: 'user', content: [{ type: 'text', text: 'I read a book.' }] },
    ],
    tools: [],
  });
  assert.equal(reply.text, 'Я прочитал книгу.');
});

test('anthropic messages: JSON and streamed replies', { skip }, async () => {
  await withServer(async (url) => {
    const body = {
      model: 'formal-ai',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Where do you live?' }],
    };
    const json = await (await post(`${url}/v1/messages`, body)).json();
    assert.equal(json.type, 'message');
    assert.equal(json.content[0].text, 'Где вы живёте?');
    const stream = await events(
      await post(`${url}/v1/messages`, { ...body, stream: true })
    );
    assert.equal(stream[0].type, 'message_start');
    assert.equal(stream.at(-1).type, 'message_stop');
    const text = stream
      .filter((e) => e.delta?.type === 'text_delta')
      .map((e) => e.delta.text)
      .join('');
    assert.equal(text, 'Где вы живёте?');
  });
});

test(
  'openai chat completions and responses stream the translation',
  { skip },
  async () => {
    await withServer(async (url) => {
      const chat = await events(
        await post(`${url}/v1/chat/completions`, {
          model: 'formal-ai',
          stream: true,
          messages: [{ role: 'user', content: 'Who lives here?' }],
        })
      );
      assert.equal(
        chat.map((c) => c.choices[0]?.delta?.content || '').join(''),
        'Кто живёт здесь?'
      );
      const responses = await events(
        await post(`${url}/v1/responses`, {
          model: 'formal-ai',
          stream: true,
          input: [
            {
              role: 'user',
              content: [{ type: 'input_text', text: 'Who lives here?' }],
            },
          ],
        })
      );
      assert.equal(responses[0].type, 'response.created');
      assert.equal(responses.at(-1).type, 'response.completed');
      const text = responses
        .filter((e) => e.type === 'response.output_text.delta')
        .map((e) => e.delta)
        .join('');
      assert.equal(text, 'Кто живёт здесь?');
    });
  }
);

test(
  'a file is read, translated and written through client tools',
  { skip },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), 'formal-ai-'));
    try {
      const source = join(dir, 'notes.md');
      writeFileSync(source, '# Notes\n\nI read a book.\n');
      await withServer(async (url) => {
        const system = `Primary working directory: ${dir}`;
        const user = { role: 'user', content: 'Translate notes.md' };
        const ask = async (messages) =>
          (
            await post(`${url}/v1/messages`, {
              model: 'formal-ai',
              max_tokens: 100,
              system,
              tools: [READ, WRITE],
              messages,
            })
          ).json();
        const first = await ask([user]);
        const read = first.content.find((c) => c.type === 'tool_use');
        assert.deepEqual(
          [read.name, read.input],
          ['Read', { file_path: source }]
        );
        const afterRead = [
          user,
          { role: 'assistant', content: first.content },
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: read.id,
                content: '     1→# Notes\n     2→\n     3→I read a book.\n',
              },
            ],
          },
        ];
        const second = await ask(afterRead);
        const write = second.content.find((c) => c.type === 'tool_use');
        assert.equal(write.name, 'Write');
        assert.equal(write.input.file_path, join(dir, 'notes.ru.md'));
        assert.match(write.input.content, /Я прочитал книгу\./);
        const third = await ask([
          ...afterRead,
          { role: 'assistant', content: second.content },
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: write.id,
                content: 'File created',
              },
            ],
          },
        ]);
        assert.match(
          third.content[0].text,
          /^Translated .*notes\.md → .*notes\.ru\.md\.\n2\/2 sentences translated completely\./
        );
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
);

test(
  'client commands point each agent CLI at the local server',
  { skip },
  () => {
    const home = mkdtempSync(join(tmpdir(), 'formal-ai-home-'));
    try {
      const settings = { url: 'http://127.0.0.1:9999', cwd: '/work', home };
      const claude = clientCommand('claude', 'Translate a.md', settings);
      assert.equal(claude.env.ANTHROPIC_BASE_URL, settings.url);
      assert.deepEqual(claude.args.slice(0, 4), [
        '-p',
        'Translate a.md',
        '--model',
        'formal-ai',
      ]);
      const codex = clientCommand('codex', 'Translate a.md', settings);
      assert.ok(codex.args.includes('exec'));
      assert.ok(codex.env.CODEX_HOME.startsWith(home));
      const agent = clientCommand('agent', 'Translate a.md', settings);
      assert.equal(
        JSON.parse(agent.env.LINK_ASSISTANT_AGENT_CONFIG_CONTENT).provider
          .formalai.options.baseURL,
        `${settings.url}/v1`
      );
      assert.throws(
        () => clientCommand('other', 'x', settings),
        /unknown client/
      );
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  }
);
