/**
 * `gitnexus update` refuses in this fork, and never spawns npm.
 *
 * Upstream's version installs `gitnexus@<latest>` from the npm registry
 * (abhigyanpatwari/GitNexus#3175). That package is UPSTREAM's, and this fork is
 * not published to it — so the install replaces an Apex-capable build with one
 * that has no Apex parser and reports no error. It is the same silent-wrong-tool
 * trap the persisted `npx -y gitnexus@<version> mcp` fallback was, and worse:
 * that one wrote a config entry, this one overwrites a working install.
 *
 * The PASSIVE notifier needs no change. `updateEligibleInstall` already returns
 * false for a source checkout, which is the only shape this fork is installed
 * in, so no notice fires. `update` was the one path that bypassed that gate, by
 * asserting `eligible: true` rather than measuring it — which is why the gate
 * alone was not enough and this command had to be closed on its own terms.
 *
 * The message is a plain constant rather than an i18n key, matching
 * `MISSING_BIN_MESSAGE` in `setup.ts`: both state this fork's distribution
 * policy, and neither has an upstream counterpart to stay in parity with.
 *
 * Exits non-zero, so a script running `gitnexus update && …` cannot read a
 * refusal as an update.
 */

export const NOT_PUBLISHED_MESSAGE =
  'gitnexus update is disabled in this fork. `npm i -g gitnexus` installs ' +
  "UPSTREAM's package, which has no Apex parser and reports no error when it " +
  'skips .cls and .trigger files — so the update would silently replace this ' +
  'build with one that answers Apex queries with nothing. Update from source ' +
  'instead: git pull, then `npm ci && npm run build` in gitnexus/.';

interface UpdateCommandDependencies {
  writeStdout: (line: string) => void;
  setExitCode: (code: number) => void;
}

function isTestDeps(value: unknown): value is Partial<UpdateCommandDependencies> {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('writeStdout' in value || 'setExitCode' in value)
  );
}

export async function updateCommand(maybeDeps?: unknown): Promise<void> {
  const deps = isTestDeps(maybeDeps) ? maybeDeps : {};
  const writeStdout = deps.writeStdout ?? ((line: string) => console.log(line));
  const setExitCode =
    deps.setExitCode ??
    ((code: number) => {
      process.exitCode = code;
    });

  writeStdout(NOT_PUBLISHED_MESSAGE);
  setExitCode(1);
}
