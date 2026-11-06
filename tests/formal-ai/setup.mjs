/**
 * Test environment, imported first by every formal-ai test file: the
 * hand-written test vocabulary instead of the production overrides,
 * a private empty fixture directory and cache, and no network. Production
 * replay sets its own public fixture path in a separate process.
 * Values already set in the environment are kept.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const env = globalThis.process.env;
env.FORMAL_AI_DATA ||= join(here, 'fixtures', 'vocabulary');
env.FORMAL_AI_OFFLINE ??= '1';
env.FORMAL_AI_CACHE ||= mkdtempSync(join(tmpdir(), 'formal-ai-test-'));
env.FORMAL_AI_FIXTURES ||= join(env.FORMAL_AI_CACHE, 'fixtures');
