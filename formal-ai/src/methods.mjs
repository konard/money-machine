/**
 * Sense and context methods, each with a weight (see
 * docs/meaning-context-vision.md §6). A method that does not measurably
 * improve translation is turned off here, with its measurement recorded,
 * not deleted from the code.
 *
 * Override per call (`options.methods`), per process
 * (`FORMAL_AI_METHODS="documentTopic=0.5,roundTrip=off"`) or from the CLI
 * (`--methods documentTopic=off`).
 */
export const METHODS = {
  // distinctive definition words of the whole document vote for a sense
  // (topic-context.mjs). Measured on the 30 site fixture sentences against
  // no page topic: weight 1 changes 13 (4 better, 5 worse), 0.5 changes 9
  // (4 better, 4 worse), 0.3 changes 8 (3 better, 4 worse). Too few to
  // decide: kept at 0.5 until the evaluation harness measures it at scale.
  documentTopic: 0.5,
};

/** "a=off,b=0.5" → { a: 0, b: 0.5 } */
export function parseMethods(spec = '') {
  return Object.fromEntries(
    spec
      .split(',')
      .map((part) => part.trim().split('='))
      .filter(([name]) => name)
      .map(([name, value = 'on']) => [
        name,
        /^(?:off|false|no)$/i.test(value)
          ? 0
          : /^(?:on|true|yes)$/i.test(value)
            ? 1
            : Number(value),
      ])
      .filter(([, weight]) => Number.isFinite(weight))
  );
}

let fromEnv;

/** The weight of a method: call options, then environment, then default. */
export function methodWeight(methods, name) {
  fromEnv ??= parseMethods(process.env.FORMAL_AI_METHODS || '');
  return methods?.[name] ?? fromEnv[name] ?? METHODS[name] ?? 1;
}
