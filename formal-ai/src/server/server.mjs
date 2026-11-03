/**
 * HTTP server exposing the translator through the Anthropic Messages, OpenAI
 * Chat Completions and OpenAI Responses APIs, so Claude Code, Codex and Link
 * Assistant Agent can drive it (see `src/with.mjs`). Uses only `node:http`.
 *
 * Routes (also under `/api/anthropic` and `/api/openai` prefixes):
 *   POST /v1/messages              Anthropic
 *   POST /v1/messages/count_tokens Anthropic
 *   POST /v1/chat/completions      OpenAI chat
 *   POST /v1/responses             OpenAI Responses
 *   GET  /v1/models
 *   POST /translate                {text} → translateDocument result
 *   GET  /health
 */

import { createServer } from 'node:http';
import { appendFileSync } from 'node:fs';
import { anthropic, chat, responses, sse, textOf } from './protocols.mjs';
import { respond, cleanUserText } from './agent.mjs';
import { translateDocument } from '../document.mjs';

const MODELS = ['formal-ai', 'formal-ai-en-ru'];

function route(pathname) {
  const path = pathname
    .replace(/^\/api\/(?:anthropic|openai)/, '')
    .replace(/\/+$/, '');
  const normalized = path.startsWith('/v1') ? path : `/v1${path}`;
  if (pathname === '/health' || pathname === '/translate') {
    return pathname;
  }
  return normalized;
}

/**
 * Client CLIs send side requests (titles, topic detection, quota probes)
 * that carry no tools. Answer them briefly instead of translating.
 */
export function auxiliaryReply(conversation) {
  const system = conversation.system || '';
  if (conversation.tools?.length) {
    return null;
  }
  if (
    /\b(title|topic|summar(?:y|ize)|isNewTopic|commit message|branch name)\b/i.test(
      system
    ) &&
    !/translat/i.test(system)
  ) {
    if (/json/i.test(system)) {
      return { text: '{"isNewTopic": false, "title": "Translation"}' };
    }
    return { text: 'Translation into Russian' };
  }
  const last = conversation.messages.at(-1);
  const text = cleanUserText(textOf(last?.content?.map((c) => c.text || '')));
  if (/^quota$/i.test(text)) {
    return { text: 'ok' };
  }
  return null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

/**
 * Start the server.
 * @param {{port?: number, host?: string, options?: object, log?: string}} settings
 * @returns {Promise<{url: string, port: number, close: () => Promise<void>}>}
 */
export function startServer({
  port = 8765,
  host = '127.0.0.1',
  options = {},
  log = process.env.FORMAL_AI_LOG,
} = {}) {
  const protocols = {
    '/v1/messages': anthropic,
    '/v1/chat/completions': chat,
    '/v1/responses': responses,
  };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const path = route(url.pathname);
    try {
      if (req.method === 'GET' && path === '/health') {
        return send(res, 200, { ok: true });
      }
      if (req.method === 'GET' && path === '/v1/models') {
        return send(res, 200, {
          object: 'list',
          data: MODELS.map((m) => ({
            id: m,
            object: 'model',
            type: 'model',
            display_name: m,
            created: 0,
            owned_by: 'formal-ai',
          })),
        });
      }
      if (req.method !== 'POST') {
        return send(res, 404, {
          error: {
            type: 'not_found',
            message: `${req.method} ${url.pathname}`,
          },
        });
      }
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      if (log) {
        appendFileSync(
          log,
          `${JSON.stringify({ at: new Date().toISOString(), path: url.pathname, body })}\n`
        );
      }
      if (path === '/translate') {
        return send(
          res,
          200,
          translateDocument(String(body.text || ''), {
            ...options,
            ...(body.options || {}),
          })
        );
      }
      if (path === '/v1/messages/count_tokens') {
        return send(res, 200, { input_tokens: Math.ceil(raw.length / 4) });
      }
      const protocol = protocols[path];
      if (!protocol) {
        return send(res, 404, {
          error: { type: 'not_found', message: url.pathname },
        });
      }
      const conversation = protocol.normalize(body);
      const reply =
        auxiliaryReply(conversation) || respond(conversation, options);
      const rendered = protocol.render(reply, {
        model: conversation.model,
        stream: conversation.stream,
        inputTokens: Math.ceil(raw.length / 4),
      });
      if (log) {
        appendFileSync(
          log,
          `${JSON.stringify({ at: new Date().toISOString(), reply })}\n`
        );
      }
      if (rendered.json) {
        return send(res, 200, rendered.json);
      }
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      res.end(sse(rendered.frames));
    } catch (error) {
      send(res, 500, {
        type: 'error',
        error: { type: 'api_error', message: error.message },
      });
    }
    return undefined;
  });
  return new Promise((resolve, reject) => {
    // a busy port or a denied socket rejects instead of hanging
    server.once('error', reject);
    server.listen(port, host, () => {
      const actual = server.address().port;
      resolve({
        url: `http://${host}:${actual}`,
        port: actual,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}
