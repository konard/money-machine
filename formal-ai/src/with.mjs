/**
 * `formal-ai with claude|codex|agent "<request>"`
 *
 * Starts the local translation server on a free port and runs a coding-agent
 * CLI against it, so the agent's own tools (and permission checks) read and
 * write the files. Mirrors link-assistant/formal-ai `js/with.mjs`
 * (commit 99b00e4e), reduced to the three clients this copy supports.
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { startServer } from './server/server.mjs';

const MODEL = 'formal-ai';

/**
 * Command line and environment for a client.
 * @param {string} client - claude, codex or agent
 * @param {string} prompt
 * @param {{url: string, cwd: string, model?: string, home: string}} settings
 * @returns {{command: string, args: string[], env: object}}
 */
export function clientCommand(
  client,
  prompt,
  { url, cwd, model = MODEL, home }
) {
  if (client === 'claude') {
    const configDir = join(home, 'claude');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, '.claude.json'),
      JSON.stringify({
        hasCompletedOnboarding: true,
        projects: { [cwd]: { hasTrustDialogAccepted: true } },
      })
    );
    return {
      command: 'claude',
      args: [
        '-p',
        prompt,
        '--model',
        model,
        '--permission-mode',
        'acceptEdits',
        '--allowedTools',
        'Read',
        'Write',
      ],
      env: {
        CLAUDE_CONFIG_DIR: configDir,
        ANTHROPIC_BASE_URL: url,
        ANTHROPIC_AUTH_TOKEN: 'formal-ai',
        ANTHROPIC_API_KEY: '',
        ANTHROPIC_SMALL_FAST_MODEL: model,
        ANTHROPIC_DEFAULT_HAIKU_MODEL: model,
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
        DISABLE_AUTOUPDATER: '1',
      },
    };
  }
  if (client === 'codex') {
    const codexHome = join(home, 'codex');
    mkdirSync(codexHome, { recursive: true });
    writeFileSync(
      join(codexHome, 'config.toml'),
      [
        `model = "${model}"`,
        'model_provider = "formalai"',
        '',
        '[model_providers.formalai]',
        'name = "Formal AI"',
        `base_url = "${url}/v1"`,
        'env_key = "FORMAL_AI_API_KEY"',
        'wire_api = "responses"',
        '',
      ].join('\n')
    );
    return {
      command: 'codex',
      args: [
        'exec',
        '--skip-git-repo-check',
        '--sandbox',
        'workspace-write',
        '-C',
        cwd,
        prompt,
      ],
      env: { CODEX_HOME: codexHome, FORMAL_AI_API_KEY: 'formal-ai' },
    };
  }
  if (client === 'agent') {
    const config = {
      provider: {
        formalai: {
          name: 'Formal AI',
          npm: '@ai-sdk/openai-compatible',
          options: { baseURL: `${url}/v1`, apiKey: 'formal-ai' },
          models: { [model]: { name: model } },
        },
      },
      model: `formalai/${model}`,
    };
    return {
      command: 'agent',
      args: ['-p', prompt, '--model', `formalai/${model}`],
      env: { LINK_ASSISTANT_AGENT_CONFIG_CONTENT: JSON.stringify(config) },
    };
  }
  throw new Error(`unknown client "${client}" (use claude, codex or agent)`);
}

/**
 * Run a client against a fresh local server.
 * @param {string} client
 * @param {string} prompt
 * @param {{cwd?: string, model?: string, log?: string, port?: string|number, options?: object, 'dry-run'?: boolean}} args
 * @returns {Promise<number>} exit code
 */
export async function runWith(client, prompt, args = {}) {
  if (!prompt.trim()) {
    throw new Error(
      'usage: formal-ai with claude|codex|agent "translate docs/guide.md"'
    );
  }
  const cwd = resolve(args.cwd || process.cwd());
  const server = await startServer({
    port: Number(args.port || 0),
    options: args.options || {},
    log: args.log,
  });
  const home = mkdtempSync(join(tmpdir(), 'formal-ai-with-'));
  try {
    const {
      command,
      args: argv,
      env,
    } = clientCommand(client, prompt, {
      url: server.url,
      cwd,
      model: args.model,
      home,
    });
    if (args['dry-run']) {
      process.stdout.write(
        `${Object.entries(env)
          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
          .join(
            ' '
          )} ${command} ${argv.map((a) => JSON.stringify(a)).join(' ')}\n`
      );
      return 0;
    }
    return await new Promise((done, fail) => {
      const child = spawn(command, argv, {
        cwd,
        env: { ...process.env, ...env },
        stdio: ['ignore', 'inherit', 'inherit'],
      });
      child.on('error', fail);
      child.on('exit', (code) => done(code ?? 1));
    });
  } finally {
    await server.close();
    rmSync(home, { recursive: true, force: true });
  }
}
