/**
 * Wire formats of the three vendor APIs that coding-agent CLIs speak.
 *
 * Each protocol has `normalize(body)` → `{system, messages, tools, stream,
 * model}` (the shape `agent.respond` reads) and `render(reply, request)` →
 * a JSON body or a list of SSE frames.
 *
 * Event shapes follow link-assistant/formal-ai `js/server/anthropic.mjs`,
 * `openai.mjs` and `responses-stream.mjs` (commit 99b00e4e).
 */

import { randomUUID } from 'node:crypto';

const id = (prefix) =>
  `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
const tokens = (text) => Math.max(1, Math.ceil(String(text || '').length / 4));

/** Flatten any content (string, array of parts) into text. */
export function textOf(content) {
  if (content === null || content === undefined) {
    return '';
  }
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === 'string' ? part : (part?.text ?? textOf(part?.content))
      )
      .join('\n');
  }
  return String(content.text ?? '');
}

function parseArguments(value) {
  if (typeof value !== 'string') {
    return value || {};
  }
  try {
    return JSON.parse(value);
  } catch {
    return { input: value };
  }
}

// ---------------------------------------------------------------- Anthropic

export const anthropic = {
  normalize(body) {
    const messages = (body.messages || []).map((m) => {
      const parts =
        typeof m.content === 'string'
          ? [{ type: 'text', text: m.content }]
          : m.content || [];
      return {
        role: m.role,
        content: parts.map((p) => {
          if (p.type === 'tool_use') {
            return {
              type: 'tool_call',
              id: p.id,
              name: p.name,
              input: p.input || {},
            };
          }
          if (p.type === 'tool_result') {
            return {
              type: 'tool_result',
              id: p.tool_use_id,
              text: textOf(p.content),
              isError: Boolean(p.is_error),
            };
          }
          return { type: 'text', text: textOf(p) };
        }),
      };
    });
    return {
      system: textOf(body.system),
      messages,
      tools: (body.tools || []).map((t) => ({
        name: t.name,
        schema: t.input_schema,
      })),
      stream: Boolean(body.stream),
      model: body.model || 'formal-ai',
    };
  },

  render(reply, request) {
    const content = reply.toolCall
      ? [
          ...(reply.text ? [{ type: 'text', text: reply.text }] : []),
          {
            type: 'tool_use',
            id: id('toolu'),
            name: reply.toolCall.name,
            input: reply.toolCall.input,
          },
        ]
      : [{ type: 'text', text: reply.text || '' }];
    const stopReason = reply.toolCall ? 'tool_use' : 'end_turn';
    const usage = {
      input_tokens: request.inputTokens || 1,
      output_tokens: tokens(JSON.stringify(content)),
    };
    const message = {
      id: id('msg'),
      type: 'message',
      role: 'assistant',
      model: request.model,
      content,
      stop_reason: stopReason,
      stop_sequence: null,
      usage,
    };
    if (!request.stream) {
      return { json: message };
    }
    const frames = [
      [
        'message_start',
        {
          type: 'message_start',
          message: {
            ...message,
            content: [],
            stop_reason: null,
            usage: { ...usage, output_tokens: 1 },
          },
        },
      ],
    ];
    content.forEach((block, index) => {
      if (block.type === 'text') {
        frames.push([
          'content_block_start',
          {
            type: 'content_block_start',
            index,
            content_block: { type: 'text', text: '' },
          },
        ]);
        frames.push([
          'content_block_delta',
          {
            type: 'content_block_delta',
            index,
            delta: { type: 'text_delta', text: block.text },
          },
        ]);
      } else {
        frames.push([
          'content_block_start',
          {
            type: 'content_block_start',
            index,
            content_block: { ...block, input: {} },
          },
        ]);
        frames.push([
          'content_block_delta',
          {
            type: 'content_block_delta',
            index,
            delta: {
              type: 'input_json_delta',
              partial_json: JSON.stringify(block.input),
            },
          },
        ]);
      }
      frames.push([
        'content_block_stop',
        { type: 'content_block_stop', index },
      ]);
    });
    frames.push([
      'message_delta',
      {
        type: 'message_delta',
        delta: { stop_reason: stopReason, stop_sequence: null },
        usage: { output_tokens: usage.output_tokens },
      },
    ]);
    frames.push(['message_stop', { type: 'message_stop' }]);
    return { frames };
  },
};

// ------------------------------------------------------- OpenAI chat completions

export const chat = {
  normalize(body) {
    const system = [];
    const messages = [];
    for (const m of body.messages || []) {
      if (m.role === 'system' || m.role === 'developer') {
        system.push(textOf(m.content));
      } else if (m.role === 'tool') {
        messages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              id: m.tool_call_id,
              text: textOf(m.content),
            },
          ],
        });
      } else {
        const content = [];
        const text = textOf(m.content);
        if (text) {
          content.push({ type: 'text', text });
        }
        for (const call of m.tool_calls || []) {
          content.push({
            type: 'tool_call',
            id: call.id,
            name: call.function?.name,
            input: parseArguments(call.function?.arguments),
          });
        }
        messages.push({ role: m.role, content });
      }
    }
    return {
      system: system.join('\n'),
      messages,
      tools: (body.tools || []).map((t) => ({
        name: t.function?.name || t.name,
        schema: t.function?.parameters || t.parameters,
      })),
      stream: Boolean(body.stream),
      model: body.model || 'formal-ai',
    };
  },

  render(reply, request) {
    const created = Math.floor(Date.now() / 1000);
    const completionId = id('chatcmpl');
    const toolCalls = reply.toolCall
      ? [
          {
            id: id('call'),
            type: 'function',
            function: {
              name: reply.toolCall.name,
              arguments: JSON.stringify(reply.toolCall.input),
            },
          },
        ]
      : undefined;
    const finish = toolCalls ? 'tool_calls' : 'stop';
    const text = reply.text || (toolCalls ? null : '');
    const usage = {
      prompt_tokens: request.inputTokens || 1,
      completion_tokens: tokens(text || JSON.stringify(toolCalls)),
      total_tokens: 0,
    };
    usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;
    if (!request.stream) {
      return {
        json: {
          id: completionId,
          object: 'chat.completion',
          created,
          model: request.model,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: text,
                ...(toolCalls ? { tool_calls: toolCalls } : {}),
              },
              finish_reason: finish,
            },
          ],
          usage,
        },
      };
    }
    const chunk = (delta, finishReason = null, extra = {}) => ({
      id: completionId,
      object: 'chat.completion.chunk',
      created,
      model: request.model,
      choices: [{ index: 0, delta, finish_reason: finishReason }],
      ...extra,
    });
    const frames = [[null, chunk({ role: 'assistant', content: '' })]];
    if (text) {
      frames.push([null, chunk({ content: text })]);
    }
    if (toolCalls) {
      frames.push([
        null,
        chunk({
          tool_calls: toolCalls.map((call, index) => ({ index, ...call })),
        }),
      ]);
    }
    frames.push([null, chunk({}, finish, { usage })]);
    frames.push([null, '[DONE]']);
    return { frames };
  },
};

// ------------------------------------------------------------ OpenAI Responses

export const responses = {
  normalize(body) {
    const messages = [];
    const push = (role, part) => {
      const last = messages[messages.length - 1];
      if (last && last.role === role && part.type !== 'text') {
        last.content.push(part);
      } else {
        messages.push({ role, content: [part] });
      }
    };
    const system = [textOf(body.instructions)];
    const input =
      typeof body.input === 'string'
        ? [{ role: 'user', content: body.input }]
        : body.input || [];
    for (const item of input) {
      const type = item.type || 'message';
      if (type === 'message') {
        if (item.role === 'system' || item.role === 'developer') {
          system.push(textOf(item.content));
        } else {
          push(item.role, { type: 'text', text: textOf(item.content) });
        }
      } else if (
        type === 'function_call' ||
        type === 'custom_tool_call' ||
        type === 'local_shell_call'
      ) {
        push('assistant', {
          type: 'tool_call',
          id: item.call_id,
          name: item.name || 'local_shell',
          input:
            type === 'custom_tool_call'
              ? { input: item.input }
              : type === 'local_shell_call'
                ? item.action || {}
                : parseArguments(item.arguments),
        });
      } else if (type.endsWith('_output')) {
        push('user', {
          type: 'tool_result',
          id: item.call_id,
          text: textOf(item.output?.content ?? item.output),
        });
      }
    }
    return {
      system: system.filter(Boolean).join('\n'),
      messages,
      tools: (body.tools || []).map((t) => ({
        name: t.name || t.type,
        schema: t.parameters,
        custom: t.type === 'custom',
      })),
      stream: Boolean(body.stream),
      model: body.model || 'formal-ai',
    };
  },

  render(reply, request) {
    const output = [];
    if (reply.text) {
      output.push({
        id: id('msg'),
        type: 'message',
        status: 'completed',
        role: 'assistant',
        content: [{ type: 'output_text', text: reply.text, annotations: [] }],
      });
    }
    if (reply.toolCall) {
      const callId = id('call');
      output.push(
        reply.toolCall.custom
          ? {
              id: id('ctc'),
              type: 'custom_tool_call',
              status: 'completed',
              call_id: callId,
              name: reply.toolCall.name,
              input: reply.toolCall.input,
            }
          : {
              id: id('fc'),
              type: 'function_call',
              status: 'completed',
              call_id: callId,
              name: reply.toolCall.name,
              arguments: JSON.stringify(reply.toolCall.input),
            }
      );
    }
    const outputTokens = tokens(JSON.stringify(output));
    const response = {
      id: id('resp'),
      object: 'response',
      created_at: Math.floor(Date.now() / 1000),
      status: 'completed',
      model: request.model,
      output,
      usage: {
        input_tokens: request.inputTokens || 1,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens: outputTokens,
        output_tokens_details: { reasoning_tokens: 0 },
        total_tokens: (request.inputTokens || 1) + outputTokens,
      },
    };
    if (!request.stream) {
      return { json: response };
    }
    let sequence = 0;
    const frames = [];
    const frame = (type, fields) =>
      frames.push([type, { type, sequence_number: sequence++, ...fields }]);
    const pending = { ...response, status: 'in_progress', output: [] };
    frame('response.created', { response: pending });
    frame('response.in_progress', { response: pending });
    output.forEach((item, outputIndex) => {
      frame('response.output_item.added', {
        output_index: outputIndex,
        item:
          item.type === 'message'
            ? {
                id: item.id,
                type: item.type,
                status: 'in_progress',
                role: item.role,
                content: [],
              }
            : item,
      });
      const at = { item_id: item.id, output_index: outputIndex };
      if (item.type === 'message') {
        item.content.forEach((part, contentIndex) => {
          frame('response.content_part.added', {
            ...at,
            content_index: contentIndex,
            part: { ...part, text: '' },
          });
          frame('response.output_text.delta', {
            ...at,
            content_index: contentIndex,
            delta: part.text,
          });
          frame('response.output_text.done', {
            ...at,
            content_index: contentIndex,
            text: part.text,
          });
          frame('response.content_part.done', {
            ...at,
            content_index: contentIndex,
            part,
          });
        });
      } else if (item.type === 'function_call') {
        frame('response.function_call_arguments.delta', {
          ...at,
          delta: item.arguments,
        });
        frame('response.function_call_arguments.done', {
          ...at,
          arguments: item.arguments,
        });
      } else {
        frame('response.custom_tool_call_input.delta', {
          ...at,
          delta: item.input,
        });
        frame('response.custom_tool_call_input.done', {
          ...at,
          input: item.input,
        });
      }
      frame('response.output_item.done', { output_index: outputIndex, item });
    });
    frame('response.completed', { response });
    return { frames };
  },
};

/** Serialize SSE frames. */
export function sse(frames) {
  return frames
    .map(
      ([event, data]) =>
        `${event ? `event: ${event}\n` : ''}data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`
    )
    .join('');
}
