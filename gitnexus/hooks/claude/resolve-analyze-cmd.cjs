/**
 * Single source of truth for how docs, hooks, and warnings invoke gitnexus.
 *
 * There is exactly one invocation path: the `gitnexus` binary on PATH.
 *
 * Upstream also resolves three install-free fallbacks that fetch the package
 * from the registry. Those rungs are removed here, because this build is
 * NOT published to npm: every one of them resolves to the published package,
 * which has no Apex support and returns nothing rather than erroring. A fallback
 * that silently produces empty results is worse than no fallback — and this
 * file is copied into `<repo>/.gitnexus/run.cjs` of every indexed repo, so a
 * wrong rung here propagates outward into other people's checkouts.
 *
 * So `gitnexus` on PATH or a loud failure. Install it by building from source
 * and `npm link` (see the setup guide); a missing binary now prints how, instead
 * of quietly fetching a different tool.
 *
 * This stays self-contained CJS because the Claude/Antigravity hooks run as
 * standalone files copied into the user's hook dir, where no package import is
 * available. The CLI reuses this module from src/cli/resolve-invocation.ts via
 * createRequire rather than re-implementing it. Two committed copies must stay
 * byte-identical (enforced by resolve-invocation.test.ts) — edit both together:
 * gitnexus/hooks/claude/ (the canonical copy the CLI and `gitnexus setup` read)
 * and gitnexus-claude-plugin/hooks/. A THIRD copy is written at runtime to
 * `<repo>/.gitnexus/run.cjs` by `gitnexus analyze` (ai-context.ts) so docs can
 * reference it directly via the `require.main === module` exec tail below; that
 * copy is gitignored and refreshed on every analyze, so it cannot drift for long.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Shown whenever the binary is absent. Names the failure mode explicitly: the
// tempting recovery (fetch it from npm) is the one that silently breaks Apex.
const NOT_INSTALLED_MESSAGE =
  'gitnexus is not on PATH. This build is not published to npm, so there is no ' +
  'install-free one-shot: clone the repo, build it, and `npm link`. Fetching the ' +
  'published package instead gives a build with no Apex support, which returns ' +
  'nothing rather than erroring.';

/**
 * Absolute path to `command` on PATH, or null — a pure-Node, spawn-free lookup
 * that mirrors how a shell resolves a bare command name: each PATH dir × the
 * platform's executable extensions (PATHEXT on Windows; the bare name + X_OK on
 * POSIX). This replaces the former `where`/`which` subprocess (#1938 "Option A"):
 * it is byte-for-byte identical on every OS, with no dependency on the probe
 * binary being reachable (a sanitized PATH that drops System32 / `/usr/bin` no
 * longer defeats detection), no shell-spawn surface (CVE-2024-27980), and no
 * spawn timeout to tune. On Windows it matches PATHEXT extensions ONLY — exactly
 * what `where`/cmd.exe resolve — so neither an un-spawnable `.ps1`-only shim (not
 * in default PATHEXT) nor a bare extensionless file (which the shell cannot launch
 * as `command`) is a false positive. `preferExecExt` returns a recognized
 * `.cmd`/`.bat`/`.exe` shim ahead of an exotic PATHEXT hit (e.g. `.COM`) when both
 * match, matching what a user would actually launch. Pure (platform/env injectable)
 * so it is unit-testable without touching the host PATH.
 */
function resolveOnPath(
  command,
  preferExecExt = false,
  { platform = process.platform, env = process.env } = {},
) {
  const pathValue = env.PATH || env.Path || env.path || '';
  if (!pathValue) return null;
  const isWin = platform === 'win32';
  const exts = isWin
    ? (env.PATHEXT || '.COM;.EXE;.BAT;.CMD')
        .split(';')
        .map((e) => e.trim())
        .filter(Boolean)
        .map((e) => (e.startsWith('.') ? e : `.${e}`))
    : [''];
  let weakHit = null;
  // Split on the host's PATH delimiter. `platform` is injected only to choose the
  // extension/exec-bit rules; the PATH string is always host-format, so it must
  // split on the host delimiter (`path.delimiter`) — in production `platform` IS
  // the host, so they coincide. (Deriving the delimiter from an injected platform
  // would split a Windows drive-letter path `C:\…` at its colon under a POSIX
  // injection.)
  for (const dir of pathValue.split(path.delimiter).filter(Boolean)) {
    for (const ext of exts) {
      const candidate = path.join(dir, `${command}${ext}`);
      try {
        if (!fs.statSync(candidate).isFile()) continue;
        if (!isWin) fs.accessSync(candidate, fs.constants.X_OK);
        // Prefer a runnable .cmd/.bat/.exe shim; remember an exotic PATHEXT hit
        // (e.g. .COM) only as a last resort if nothing better turns up.
        if (isWin && preferExecExt && !/\.(cmd|bat|exe)$/i.test(ext)) {
          weakHit = weakHit || candidate;
          continue;
        }
        return candidate;
      } catch {
        /* not a runnable file here — try the next candidate */
      }
    }
  }
  return weakHit;
}

/**
 * Resolve `gitnexus` | `unavailable`. `GITNEXUS_INVOCATION=gitnexus` forces the
 * binary without a PATH scan (test/escape hatch); upstream's other mode values
 * are ignored, since each named an npm fetch that no longer exists here. `probe`
 * is injectable so the decision is unit-testable without touching host PATH.
 */
function resolveInvocationMode(probe = resolveOnPath) {
  if (process.env.GITNEXUS_INVOCATION?.trim().toLowerCase() === 'gitnexus') return 'gitnexus';
  return probe('gitnexus', true) ? 'gitnexus' : 'unavailable';
}

/**
 * The analyze command to show a user. Always the same string — there is only one
 * runner — so this needs no probing and stays inside any hook time budget. An
 * absent binary is not a different command, it is a missing install, which
 * `NOT_INSTALLED_MESSAGE` covers at execution time.
 */
function formatAnalyzeCommand(options = {}) {
  // `--index-only` is what a routine "your index is stale" nudge wants: it
  // reindexes without rewriting AGENTS.md / CLAUDE.md / skills, so an agent
  // following the nudge on every commit cannot churn the tracked agent guides
  // (#2907). Callers that actually want the docs refreshed omit it.
  const suffix = `${options.indexOnly ? ' --index-only' : ''}${
    options.embeddings ? ' --embeddings' : ''
  }`;
  return `gitnexus analyze${suffix}`;
}

/**
 * Resolve `mode` into a concrete { program, args } pair, or null when no runner
 * is available. Pure (no spawn) so it is unit-testable. Callers MUST treat null
 * as fatal rather than substituting a fetch.
 */
function buildRunnerArgv(mode, gitnexusArgs) {
  if (mode !== 'gitnexus') return null;
  return { program: 'gitnexus', args: [...gitnexusArgs] };
}

module.exports = {
  formatAnalyzeCommand,
  resolveInvocationMode,
  buildRunnerArgv,
  resolveOnPath,
  NOT_INSTALLED_MESSAGE,
};

// Direct-exec entrypoint (#1945): `node run.cjs <gitnexus args…>` runs the
// PATH-resolved `gitnexus` and propagates its exit code, inheriting stdio. This
// lets the committed skills and generated AGENTS.md/CLAUDE.md reference ONE
// stable command. `gitnexus analyze` drops a copy of this file at
// `.gitnexus/run.cjs`. Skipped on require() (the CLI and tests reuse the exports
// above), so it runs only when invoked as a script.
if (require.main === module) {
  const gitnexusArgs = process.argv.slice(2);
  const argv = buildRunnerArgv(resolveInvocationMode(), gitnexusArgs);
  if (argv === null) {
    process.stderr.write(`gitnexus runner: ${NOT_INSTALLED_MESSAGE}\n`);
    process.exit(1);
  }
  const { program, args } = argv;
  try {
    execFileSync(program, args, {
      stdio: 'inherit',
      windowsHide: true,
      // On Windows, `gitnexus` resolves to a `.cmd`/`.ps1`/`.exe` shim (npm,
      // Volta, Corepack, scoop). execFileSync does not do PATHEXT resolution and
      // Node refuses to spawn `.cmd`/`.bat` without a shell (CVE-2024-27980), so
      // a bare program name ENOENTs. A shell lets the OS resolve the shim; POSIX
      // needs no shell (direct PATH lookup works).
      shell: process.platform === 'win32',
    });
  } catch (err) {
    // Make spawn failures (binary vanished between the probe and the spawn)
    // self-explanatory instead of a silent exit 1, then propagate the runner's
    // own exit code.
    if (typeof err.status !== 'number') {
      process.stderr.write(`gitnexus runner: could not launch \`${program}\` — ${err.message}\n`);
    }
    process.exit(typeof err.status === 'number' ? err.status : 1);
  }
}
