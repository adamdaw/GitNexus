import { afterEach, describe, expect, it } from 'vitest';

import {
  assertRunnerContract,
  NOT_INSTALLED_MESSAGE,
  resolveInvocationMode as tsResolveInvocationMode,
} from '../../src/cli/resolve-invocation.js';
import { readFileSync, mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';

const cjsRequire = createRequire(import.meta.url);
const CANONICAL_CJS = path.resolve(
  __dirname,
  '..',
  '..',
  'hooks',
  'claude',
  'resolve-analyze-cmd.cjs',
);
const PLUGIN_CJS = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'gitnexus-claude-plugin',
  'hooks',
  'resolve-analyze-cmd.cjs',
);

type InvocationMode = 'gitnexus' | 'unavailable';

interface CjsModule {
  formatAnalyzeCommand: (o?: { embeddings?: boolean; indexOnly?: boolean }) => string;
  resolveInvocationMode: (
    probe?: (command: string, gitnexusWrapper?: boolean) => string | null,
  ) => InvocationMode;
  resolveOnPath: (
    command: string,
    preferExecExt?: boolean,
    opts?: { platform?: NodeJS.Platform; env?: NodeJS.ProcessEnv },
  ) => string | null;
  buildRunnerArgv: (
    mode: InvocationMode,
    gitnexusArgs: string[],
  ) => { program: string; args: string[] } | null;
  NOT_INSTALLED_MESSAGE: string;
}

// Require the real shipped artifact — the hook runtime loads this exact file, so
// the tests exercise production code, not a TypeScript mirror of it.
//
// Determinism invariant: this module now spawns nothing during resolution. The
// only fallback rung is the PATH-resolved `gitnexus` binary, and resolveOnPath is
// a pure PATH scan, so tests pin it either by passing an injected `{ platform,
// env }` (never the host PATH) or by injecting a fake `probe`. Keep new tests on
// one of those paths so results never depend on the host.
const cjs = cjsRequire(CANONICAL_CJS) as CjsModule;

describe('resolve-analyze-cmd.cjs (canonical invocation resolver)', () => {
  afterEach(() => {
    delete process.env.GITNEXUS_INVOCATION;
  });

  // The whole point of the fork's divergence from upstream. Upstream resolves
  // `pnpm dlx` / `bunx` / `npx gitnexus@latest` when the binary is absent; each
  // of those fetches the published package, which has no Apex support and returns
  // nothing rather than erroring. This file is copied into `.gitnexus/run.cjs` of
  // every indexed repo, so a reintroduced rung propagates into other checkouts.
  it('names no npm package reference anywhere in the shipped resolver', () => {
    const source = readFileSync(CANONICAL_CJS, 'utf-8');
    expect(source).not.toMatch(/gitnexus@/);
    expect(source).not.toMatch(/\b(?:npx|bunx|dlx)\b\s+\S*gitnexus/);
  });

  // The resolver above was corrected, but four sibling hooks kept their own
  // fetch rung and are copied outward by `analyze` just the same: three spawned
  // `npx -y gitnexus` when the CLI path did not resolve, and the shell adapter
  // invoked it unconditionally. Assert on the SPAWN, not on the word — an
  // explanatory comment naming npx is fine, an argv carrying it is not.
  it.each([
    ['claude hook', path.resolve(__dirname, '..', '..', 'hooks', 'claude', 'gitnexus-hook.cjs')],
    [
      'antigravity hook',
      path.resolve(__dirname, '..', '..', 'hooks', 'antigravity', 'gitnexus-antigravity-hook.cjs'),
    ],
    [
      'pre-tool-use adapter',
      path.resolve(__dirname, '..', '..', 'hooks', 'claude', 'pre-tool-use.sh'),
    ],
    [
      'plugin hook',
      path.resolve(
        __dirname,
        '..',
        '..',
        '..',
        'gitnexus-claude-plugin',
        'hooks',
        'gitnexus-hook.js',
      ),
    ],
  ])('spawns no npm fetch in the %s', (_name, file) => {
    const source = readFileSync(file, 'utf-8');
    // argv forms: `'npx'` / `'npx.cmd'` array entries, and a bare shell call.
    expect(source).not.toMatch(/'npx(?:\.cmd)?'/);
    expect(source).not.toMatch(/^\s*[^#*/\n]*\bnpx\b\s+-y\s+gitnexus/m);
    expect(source).not.toMatch(/gitnexus@/);
  });

  it('appends --index-only for the routine stale-index nudge (#2907)', () => {
    process.env.GITNEXUS_INVOCATION = 'gitnexus';
    expect(cjs.formatAnalyzeCommand({ indexOnly: true })).toBe('gitnexus analyze --index-only');
    expect(cjs.formatAnalyzeCommand({ indexOnly: true, embeddings: true })).toBe(
      'gitnexus analyze --index-only --embeddings',
    );
    // Absent/false leaves the doc-refreshing form untouched.
    expect(cjs.formatAnalyzeCommand({ indexOnly: false })).toBe('gitnexus analyze');
  });

  it('auto-selects the global gitnexus binary when it is on PATH', () => {
    expect(cjs.resolveInvocationMode(() => '/usr/local/bin/gitnexus')).toBe('gitnexus');
  });

  it('reports unavailable — never an npm fetch — when the binary is absent', () => {
    expect(cjs.resolveInvocationMode(() => null)).toBe('unavailable');
  });

  it('lets GITNEXUS_INVOCATION=gitnexus force the binary without consulting the probe', () => {
    process.env.GITNEXUS_INVOCATION = 'gitnexus';
    let probed = false;
    const mode = cjs.resolveInvocationMode(() => {
      probed = true;
      return null;
    });
    expect(mode).toBe('gitnexus');
    expect(probed).toBe(false);
  });

  // Upstream accepted `pnpm`/`npx`/`bun` here. Honoring them now would hand back
  // a mode whose only meaning was "fetch from npm", so they must not resurrect an
  // npm path through the escape hatch.
  it('ignores upstream pnpm/npx/bun forced modes rather than honoring them', () => {
    for (const forced of ['pnpm', 'npx', 'bun']) {
      process.env.GITNEXUS_INVOCATION = forced;
      expect(cjs.resolveInvocationMode(() => null)).toBe('unavailable');
    }
  });

  it('formats the one analyze command, with and without --embeddings', () => {
    expect(cjs.formatAnalyzeCommand()).toBe('gitnexus analyze');
    expect(cjs.formatAnalyzeCommand({ embeddings: true })).toBe('gitnexus analyze --embeddings');
  });

  // formatAnalyzeCommand is called by the stale-index hook, which runs under a
  // 10s Claude Code budget. With the fetch rungs gone there is nothing to probe,
  // so it must not consult PATH at all.
  it('formats the analyze command without probing PATH (hook time budget)', () => {
    const savedPath = process.env.PATH;
    try {
      delete process.env.PATH;
      expect(cjs.formatAnalyzeCommand()).toBe('gitnexus analyze');
    } finally {
      if (savedPath === undefined) delete process.env.PATH;
      else process.env.PATH = savedPath;
    }
  });

  it('explains how to install in the not-installed message, without naming npm as the cure', () => {
    expect(cjs.NOT_INSTALLED_MESSAGE).toMatch(/not published to npm/);
    expect(cjs.NOT_INSTALLED_MESSAGE).toMatch(/npm link/);
    expect(cjs.NOT_INSTALLED_MESSAGE).not.toMatch(/\b(?:npx|bunx|dlx)\b/);
  });
});

describe('buildRunnerArgv (project-local runner exec, #1945)', () => {
  it('passes gitnexus args straight through for the binary mode', () => {
    expect(cjs.buildRunnerArgv('gitnexus', ['analyze', '--embeddings'])).toEqual({
      program: 'gitnexus',
      args: ['analyze', '--embeddings'],
    });
  });

  // Returning null (rather than an npm-fetch argv) is what makes the missing
  // binary a loud failure in the exec tail instead of a silent wrong-tool run.
  it('returns null for unavailable so callers cannot substitute a fetch', () => {
    expect(cjs.buildRunnerArgv('unavailable', ['analyze'])).toBeNull();
  });

  it('copies the args array rather than aliasing the caller’s', () => {
    const args = ['analyze'];
    const argv = cjs.buildRunnerArgv('gitnexus', args);
    args.push('--mutated');
    expect(argv?.args).toEqual(['analyze']);
  });
});

describe('assertRunnerContract (CLI ↔ cjs export shape)', () => {
  it('passes against the real shipped cjs', () => {
    expect(() => assertRunnerContract()).not.toThrow();
  });

  it('re-exports the resolver and message the CLI narrows to', () => {
    expect(typeof tsResolveInvocationMode).toBe('function');
    expect(NOT_INSTALLED_MESSAGE).toBe(cjs.NOT_INSTALLED_MESSAGE);
  });
});

describe('resolveOnPath — pure-Node PATH scan (#1938, all-OS, spawn-free)', () => {
  const tmpDirs: string[] = [];
  const mkBinDir = (): string => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'resolve-path-'));
    tmpDirs.push(dir);
    return dir;
  };
  afterEach(() => {
    while (tmpDirs.length) rmSync(tmpDirs.pop() as string, { recursive: true, force: true });
  });

  it('finds an executable launcher on a POSIX PATH', () => {
    const dir = mkBinDir();
    const bin = path.join(dir, 'gitnexus');
    writeFileSync(bin, '#!/bin/sh\nexit 0\n');
    chmodSync(bin, 0o755);
    expect(cjs.resolveOnPath('gitnexus', true, { platform: 'linux', env: { PATH: dir } })).toBe(
      bin,
    );
  });

  // X_OK is meaningless on Windows (every file reads as accessible), so this
  // POSIX-only guarantee can only be asserted on a POSIX host.
  it.skipIf(process.platform === 'win32')(
    'skips a non-executable file on POSIX (requires X_OK)',
    () => {
      const dir = mkBinDir();
      writeFileSync(path.join(dir, 'gitnexus'), 'not executable'); // intentionally no chmod +x
      expect(
        cjs.resolveOnPath('gitnexus', true, { platform: 'linux', env: { PATH: dir } }),
      ).toBeNull();
    },
  );

  it('returns null when the launcher is absent or PATH is empty', () => {
    const dir = mkBinDir();
    expect(
      cjs.resolveOnPath('gitnexus', true, { platform: 'linux', env: { PATH: dir } }),
    ).toBeNull();
    expect(cjs.resolveOnPath('gitnexus', true, { platform: 'linux', env: {} })).toBeNull();
  });

  it('honors PATHEXT on Windows (a .cmd shim is detected)', () => {
    const dir = mkBinDir();
    const bin = path.join(dir, 'gitnexus.cmd');
    writeFileSync(bin, '@echo off\r\n');
    // The PATHEXT entry case matches the fixture so the assertion is deterministic
    // on case-sensitive CI filesystems; real Windows is case-insensitive, so the
    // casing of PATHEXT vs the on-disk shim never matters there.
    expect(
      cjs.resolveOnPath('gitnexus', true, {
        platform: 'win32',
        env: { PATH: dir, PATHEXT: '.COM;.EXE;.BAT;.cmd' },
      }),
    ).toBe(bin);
  });

  it('does not treat a .ps1-only shim as on PATH when PATHEXT excludes .PS1', () => {
    // A .ps1 is not launchable as `gitnexus` without a shell and is absent from
    // default PATHEXT, so mirroring `where`/cmd.exe (PATHEXT-driven) avoids a hint
    // that would fail when run.
    const dir = mkBinDir();
    writeFileSync(path.join(dir, 'gitnexus.ps1'), 'exit 0');
    expect(
      cjs.resolveOnPath('gitnexus', true, {
        platform: 'win32',
        env: { PATH: dir, PATHEXT: '.COM;.EXE;.BAT;.CMD' },
      }),
    ).toBeNull();
  });

  it('on Windows ignores a bare extensionless file and returns the PATHEXT shim', () => {
    // Windows matches PATHEXT extensions only — an extensionless `gitnexus` is not
    // launchable as `gitnexus` from a shell, so when both exist the .cmd shim wins
    // and the bare file is never the result (it would be an un-spawnable hint).
    const dir = mkBinDir();
    writeFileSync(path.join(dir, 'gitnexus'), 'not a shim');
    const cmd = path.join(dir, 'gitnexus.cmd');
    writeFileSync(cmd, '@echo off\r\n');
    expect(
      cjs.resolveOnPath('gitnexus', true, {
        platform: 'win32',
        env: { PATH: dir, PATHEXT: '.COM;.EXE;.BAT;.cmd' },
      }),
    ).toBe(cmd);
  });

  it('on Windows returns null for an extensionless-only file (not in PATHEXT)', () => {
    const dir = mkBinDir();
    writeFileSync(path.join(dir, 'gitnexus'), 'not a shim');
    expect(
      cjs.resolveOnPath('gitnexus', true, {
        platform: 'win32',
        env: { PATH: dir, PATHEXT: '.COM;.EXE;.BAT;.CMD' },
      }),
    ).toBeNull();
  });

  it('with preferExecExt, prefers a .cmd/.exe shim over an exotic .COM hit, but accepts .COM alone', () => {
    // preferExecExt mirrors the old `where` wrapper preference: a recognized
    // .cmd/.bat/.exe wins over a .COM, yet a lone .COM is still detected (better a
    // resolvable hint than none). Fixture/PATHEXT cases match for CI determinism.
    const both = mkBinDir();
    writeFileSync(path.join(both, 'gitnexus.com'), 'x');
    const cmd = path.join(both, 'gitnexus.cmd');
    writeFileSync(cmd, '@echo off\r\n');
    expect(
      cjs.resolveOnPath('gitnexus', true, {
        platform: 'win32',
        env: { PATH: both, PATHEXT: '.com;.cmd' },
      }),
    ).toBe(cmd);

    const comOnly = mkBinDir();
    const com = path.join(comOnly, 'gitnexus.com');
    writeFileSync(com, 'x');
    expect(
      cjs.resolveOnPath('gitnexus', true, {
        platform: 'win32',
        env: { PATH: comOnly, PATHEXT: '.com;.cmd' },
      }),
    ).toBe(com);
  });
});

describe('formatAnalyzeCommand end-to-end via the pure scan (#1938)', () => {
  // Exercises the public entry through resolveOnPath against a real PATH (no
  // GITNEXUS_INVOCATION): with a launcher on PATH the mode resolves to the
  // binary. Because resolveOnPath is spawn-free, this works identically on every
  // OS — there is no `where`/`which` reachability caveat.
  const savedPath = process.env.PATH;
  let binDir: string | undefined;
  afterEach(() => {
    if (savedPath === undefined) delete process.env.PATH;
    else process.env.PATH = savedPath;
    if (binDir) rmSync(binDir, { recursive: true, force: true });
    binDir = undefined;
    delete process.env.GITNEXUS_INVOCATION;
  });

  it('resolves the binary mode when a launcher is the only thing on PATH', () => {
    binDir = mkdtempSync(path.join(os.tmpdir(), 'gn-e2e-'));
    const isWin = process.platform === 'win32';
    const launcher = path.join(binDir, isWin ? 'gitnexus.cmd' : 'gitnexus');
    writeFileSync(launcher, isWin ? '@echo off\r\nexit /b 0\r\n' : '#!/bin/sh\nexit 0\n');
    if (!isWin) chmodSync(launcher, 0o755);
    // PATH reduced to just the launcher dir — the former `where`/`which` resolver
    // would have ENOENT'd here; the pure scan finds the launcher directly.
    process.env.PATH = binDir;
    expect(cjs.resolveInvocationMode()).toBe('gitnexus');
    expect(cjs.formatAnalyzeCommand()).toBe('gitnexus analyze');
  });

  it('resolves unavailable when PATH holds no launcher', () => {
    binDir = mkdtempSync(path.join(os.tmpdir(), 'gn-e2e-empty-'));
    process.env.PATH = binDir;
    expect(cjs.resolveInvocationMode()).toBe('unavailable');
  });
});

describe('resolve-analyze-cmd.cjs parity', () => {
  it('keeps the two CJS hook copies byte-identical', () => {
    expect(readFileSync(CANONICAL_CJS, 'utf-8')).toBe(readFileSync(PLUGIN_CJS, 'utf-8'));
  });
});

describe('CLI module-load posture (R3/R4 regression guard)', () => {
  const cliDir = path.resolve(__dirname, '..', '..', 'src', 'cli');

  it('does not probe invocation hints at index.ts module load (#207/#1383)', () => {
    const indexSrc = readFileSync(path.join(cliDir, 'index.ts'), 'utf-8');
    // Every command — including the `gitnexus mcp` stdio server — pays index.ts
    // module load. The runner contract check / PATH probing must stay out of
    // module scope, or it reintroduces the startup-spawn regression (#207, #1383).
    expect(indexSrc).not.toMatch(/assertRunnerContract/);
    expect(indexSrc).not.toMatch(/resolve-invocation/);
  });

  it('wires the runner contract check into the analyze command instead', () => {
    const analyzeSrc = readFileSync(path.join(cliDir, 'analyze.ts'), 'utf-8');
    expect(analyzeSrc).toMatch(/assertRunnerContract\(\)/);
  });
});
