/**
 * CLI-side contract check for the canonical hook helper.
 *
 * The gitnexus-on-PATH decision lives in hooks/claude/resolve-analyze-cmd.cjs —
 * self-contained CJS because the copied hook runtime cannot import from the
 * package. We require() it here rather than re-implementing it, so there is one
 * source of truth for the invocation decision. The relative path resolves
 * identically from src/cli/ (tsx, vitest) and dist/cli/ (shipped), since both sit
 * one level under the package root and `hooks/` is published.
 *
 * Upstream carried an npm-11 npx-install-crash nudge here (#1939). It is gone:
 * this build is not published to npm, so the resolver has no npx rung left to
 * warn about, and reaching this module at all means the binary is installed.
 * What remains is worth more — `gitnexus analyze` copies that exact cjs into
 * `<repo>/.gitnexus/run.cjs`, so a drifted export ships a broken runner into
 * someone else's checkout.
 */

import { createRequire } from 'node:module';

type InvocationMode = 'gitnexus' | 'unavailable';

interface InvocationResolver {
  // `probe` is injectable in the cjs (defaults to the real PATH probe) so the
  // decision is unit-testable without spawning; the CLI calls it with no argument.
  resolveInvocationMode: (
    probe?: (command: string, gitnexusWrapper?: boolean) => string | null,
  ) => InvocationMode;
  buildRunnerArgv: (
    mode: InvocationMode,
    gitnexusArgs: string[],
  ) => { program: string; args: string[] } | null;
  NOT_INSTALLED_MESSAGE: string;
}

// `require()` returns `any`; go through `unknown` so the cast reads as an
// explicit narrowing to the subset this module uses, not a claim that the cjs's
// full export shape is known here. assertRunnerContract() verifies it.
//
// Destructure at the call rather than binding the module object: it keeps the
// specifier on the same line as the `)(` after prettier, which is the exact IIFE
// shape the Dockerfile asset-parity scanner matches to learn that `hooks/` is a
// module-load runtime asset (dockerfile-runtime-asset-parity.test.ts). A short
// `const x = createRequire(import.meta.url)('…')` gets reflowed with a trailing
// comma before the close paren, which silently defeats that scanner.
export const { resolveInvocationMode, buildRunnerArgv, NOT_INSTALLED_MESSAGE } = createRequire(
  import.meta.url,
)('../../hooks/claude/resolve-analyze-cmd.cjs') as unknown as InvocationResolver;

/**
 * Fail loud if the canonical cjs export shape has drifted (e.g. a renamed export
 * after an upstream merge), rather than as a late TypeError — or, worse, as a
 * runner copied into a consumer repo that cannot resolve its own exports.
 */
export function assertRunnerContract(): void {
  if (
    typeof resolveInvocationMode !== 'function' ||
    typeof buildRunnerArgv !== 'function' ||
    typeof NOT_INSTALLED_MESSAGE !== 'string'
  ) {
    throw new Error(
      'resolve-analyze-cmd.cjs must export resolveInvocationMode (function), buildRunnerArgv (function), and NOT_INSTALLED_MESSAGE (string)',
    );
  }
}
