/**
 * Tests: GitNexus Factory AI (Droid) plugin
 *
 * Covers the standalone `gitnexus-factory-plugin/` used by `droid plugin
 * install`:
 * - manifest + hook wiring (plugin.json / mcp.json / hooks.json)
 * - the PostToolUse search-augment hook's guard reuse and early-exit behavior
 * - a drift guard proving the bundled guard modules are byte-identical to the
 *   canonical Claude-adapter copies (so a fix to one can't silently skip the
 *   other)
 *
 * The augment fan-out guard (acquireHookSlot) and the LadybugDB owner probe are
 * the exact modules the Claude/Codex adapter ships; their internals are covered
 * by hooks.test.ts and hook-db-lock-probe.test.ts. Here we assert the Factory
 * hook WIRES them and behaves correctly on the Factory-specific paths.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  runHook,
  parseHookOutput,
  createHookToolDir,
  hookEnv,
} from '../utils/hook-test-helpers.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const PLUGIN_DIR = path.join(REPO_ROOT, 'gitnexus-factory-plugin');
const HOOK = path.join(PLUGIN_DIR, 'hooks', 'gitnexus-hook.js');
const HOOKS_JSON = path.join(PLUGIN_DIR, 'hooks', 'hooks.json');
const PLUGIN_JSON = path.join(PLUGIN_DIR, '.factory-plugin', 'plugin.json');
const MCP_JSON = path.join(PLUGIN_DIR, 'mcp.json');
const CLAUDE_HOOKS = path.join(REPO_ROOT, 'gitnexus-claude-plugin', 'hooks');

// Guard and repo-lookup modules bundled into the Factory plugin, kept
// byte-identical to the canonical Claude-adapter copies.
const BUNDLED_GUARDS = [
  'hook-lock.js',
  'hook-db-lock-probe.cjs',
  'win-rm-list-json.ps1',
  'registry-query.cjs',
] as const;

// Empty GITNEXUS_HOME and no storage overrides, so behavior tests never pick
// up the developer's real registry or storage config.
// Unset means absent: an empty-string override is set-but-invalid (the hook,
// like the CLI, then resolves no storage), so the keys are removed, not blanked.
function isolatedEnv(binDir: string, home: string) {
  const env: NodeJS.ProcessEnv = { ...hookEnv(binDir), GITNEXUS_HOME: home };
  delete env.GITNEXUS_STORAGE_PATH;
  delete env.GITNEXUS_STORAGE_ROOT;
  return env;
}

/** Source text of top-level `function <name>(` through its closing brace. */
function fnSource(file: string, name: string): string {
  const src = fs.readFileSync(file, 'utf-8');
  const start = src.indexOf(`function ${name}(`);
  const end = start < 0 ? -1 : src.indexOf('\n}\n', start);
  if (end < 0) throw new Error(`${name} not found in ${file}`);
  return src.slice(start, end + 3);
}

const require_ = createRequire(import.meta.url);
const { parseRgGrepPattern } = require_(HOOK) as {
  parseRgGrepPattern: (command: string) => string | null;
};

// ─── Manifest / file presence ───────────────────────────────────────

describe('Factory plugin files', () => {
  it('ships the hook, its guards, and both manifests', () => {
    for (const p of [
      HOOK,
      HOOKS_JSON,
      PLUGIN_JSON,
      MCP_JSON,
      ...BUNDLED_GUARDS.map((f) => path.join(PLUGIN_DIR, 'hooks', f)),
    ]) {
      expect(fs.existsSync(p), `${p} should exist`).toBe(true);
    }
  });

  it('.factory-plugin holds only plugin.json (Factory manifest contract)', () => {
    expect(fs.readdirSync(path.join(PLUGIN_DIR, '.factory-plugin'))).toEqual(['plugin.json']);
  });
});

// ─── Marketplace wiring ─────────────────────────────────────────────

// Droid reads .factory-plugin/marketplace.json before .claude-plugin's, so this
// is what makes `droid plugin install` deliver this Factory plugin instead of
// the translated Claude one (Bash matcher, gitnexus@latest MCP).
describe('Factory marketplace wiring', () => {
  const marketplace = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, '.factory-plugin', 'marketplace.json'), 'utf-8'),
  );

  it('exposes a single gitnexus plugin sourced from ./gitnexus-factory-plugin', () => {
    const entries = marketplace.plugins.filter((p: { name: string }) => p.name === 'gitnexus');
    expect(entries).toHaveLength(1);
    expect(entries[0].source).toBe('./gitnexus-factory-plugin');
  });
});

// ─── Drift guard: bundled guards === canonical Claude copies ─────────

describe('Factory plugin bundled guards stay in lockstep with the Claude adapter', () => {
  for (const f of BUNDLED_GUARDS) {
    it(`${f} is byte-identical to the canonical copy`, () => {
      const bundled = fs.readFileSync(path.join(PLUGIN_DIR, 'hooks', f));
      const canonical = fs.readFileSync(path.join(CLAUDE_HOOKS, f));
      expect(bundled.equals(canonical)).toBe(true);
    });
  }
});

// ─── plugin.json ────────────────────────────────────────────────────

describe('Factory plugin.json', () => {
  const manifest = JSON.parse(fs.readFileSync(PLUGIN_JSON, 'utf-8'));

  it('is named gitnexus', () => {
    expect(manifest.name).toBe('gitnexus');
  });

  it('version matches gitnexus/package.json (single source of truth)', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'gitnexus', 'package.json'), 'utf-8'),
    );
    expect(manifest.version).toBe(pkg.version);
  });
});

// ─── mcp.json ───────────────────────────────────────────────────────

describe('Factory mcp.json', () => {
  const mcp = JSON.parse(fs.readFileSync(MCP_JSON, 'utf-8'));

  // This build is not published to npm: any `npx -y gitnexus@<version>` entry
  // resolves to the upstream package, which has no Apex support. The entry
  // launches the PATH-resolved binary instead, like the Claude plugin's skills.
  it('registers the PATH-resolved gitnexus binary under mcpServers', () => {
    expect(mcp.mcpServers?.gitnexus?.command).toBe('gitnexus');
    expect(mcp.mcpServers.gitnexus.args).toEqual(['mcp']);
  });

  it('carries no npm package reference', () => {
    expect(JSON.stringify(mcp)).not.toContain('npx');
    expect(JSON.stringify(mcp)).not.toContain('gitnexus@');
  });
});

// ─── hooks.json wiring ──────────────────────────────────────────────

describe('Factory hooks.json wiring', () => {
  const manifest = JSON.parse(fs.readFileSync(HOOKS_JSON, 'utf-8'));
  const entry = manifest.PostToolUse[0];

  it('registers a PostToolUse hook', () => {
    expect(Array.isArray(manifest.PostToolUse)).toBe(true);
  });

  it('matches Factory search tools (Grep, Glob, Execute — not Bash)', () => {
    expect(entry.matcher).toBe('Grep|Glob|Execute');
    expect(entry.matcher).not.toMatch(/\bBash\b/);
  });

  it('invokes the hook via the quoted ${DROID_PLUGIN_ROOT} plugin-root path', () => {
    // The path must be quoted so a plugin root containing spaces (e.g.
    // `C:\Users\First Last\...`) stays one argv word — mirrors the Claude plugin.
    const command: string = entry.hooks[0].command;
    expect(command).toBe('node "${DROID_PLUGIN_ROOT}/hooks/gitnexus-hook.js"');
  });

  it('declares timeout in seconds (not milliseconds)', () => {
    const timeout: number = entry.hooks[0].timeout;
    expect(typeof timeout).toBe('number');
    expect(timeout).toBeGreaterThan(0);
    expect(timeout).toBeLessThan(120);
  });
});

// ─── Source regressions ─────────────────────────────────────────────

describe('Factory hook source regressions', () => {
  const source = fs.readFileSync(HOOK, 'utf-8');

  it('wires the augment fan-out guard (acquireHookSlot + finally release)', () => {
    expect(source).toContain("require('./hook-lock.js')");
    expect(source).toContain('acquireHookSlot(');
    expect(source).toMatch(/finally\s*\{[^}]*release\(\)/s);
  });

  it('wires the LadybugDB owner probe before running augment', () => {
    expect(source).toContain("require('./hook-db-lock-probe.cjs')");
    expect(source).toContain('hasGitNexusDbLockedByGitNexusServer(');
  });

  it('never passes shell: true / shell: isWin to spawnSync (injection risk)', () => {
    const codeLines = source
      .split('\n')
      .map((line) => line.trim())
      .filter((t) => !t.startsWith('//') && !t.startsWith('*'));
    for (const t of codeLines) {
      expect(/shell:\s*(true|isWin)/.test(t), `injection risk: ${t}`).toBe(false);
    }
  });

  // Upstream falls back to `npx -y gitnexus@<version>` when no CLI is found.
  // Here that would fetch the upstream package, which indexes a Salesforce repo
  // without Apex and without an error. Keyed on the argv, not the word: the
  // grep tokenizer legitimately lists `'npx'` as a wrapper to strip, and a
  // comment explaining the absence still passes.
  it('has no npm fetch fallback', () => {
    expect(source).not.toContain('npx.cmd');
    expect(source).not.toMatch(/['"]-y['"]/);
    expect(source).not.toMatch(/['"`]gitnexus@/);
    expect(source).not.toContain('.factory-plugin/plugin.json');
  });

  // Windows regression: Node refuses to spawn the .cmd launcher shims without a
  // shell (CVE-2024-27980), so `node <cliPath>` is the only branch that runs
  // there. Same escape hatch the Claude adapter honors.
  it('prefers GITNEXUS_HOOK_CLI_PATH via process.execPath', () => {
    expect(source).toContain('GITNEXUS_HOOK_CLI_PATH');
    expect(source).toMatch(/spawnAugment\(\s*process\.execPath/);
    expect(source).toContain('spawnSync(file, fileArgs, spawnOpts)');
  });

  // #2163: the augment child runs under the bundled probe's timeout guard,
  // TERM-first. With no npx grandchild there is no group-SIGKILL arm.
  it('wraps the augment child in the resolved Unix timeout guard', () => {
    expect(source).toContain('resolveUnixGuardTimeout()');
    expect(source).toMatch(/\['-k', '1', guardSecs, cmd, \.\.\.argv\]/);
    expect(source).not.toContain("'-s', 'KILL'");
  });

  it('passes the pattern after the -- end-of-options marker', () => {
    expect(source).toMatch(/'augment',\s*'--',\s*pattern/);
  });

  it('validates cwd is absolute and resolves the repo via the shared registry lookup', () => {
    expect(source).toMatch(/path\.isAbsolute\(cwd\)/);
    expect(source).toContain("require('./registry-query.cjs')");
    expect(source).toContain('resolveHookRepo(cwd)');
  });

  // #3060: indexes can live outside the repo, so the slot and the DB-owner
  // probe must target the resolved storage, not a hardcoded `<cwd>/.gitnexus`.
  it('keys the slot and DB-owner probe on the resolved storage', () => {
    expect(source).toContain('acquireHookSlot(repo.storagePath)');
    expect(source).toContain('hasGitNexusDbLockedByGitNexusServer(repo.lbugPath');
  });

  it('emits Factory-shape hookSpecificOutput.additionalContext', () => {
    expect(source).toContain('hookSpecificOutput');
    expect(source).toContain('additionalContext');
  });

  it('rejects patterns shorter than 3 chars', () => {
    expect(source).toMatch(/length\s*<\s*3/);
  });
});

// ─── Execute pattern parsing (shares the Cursor adapter's #2938 matrix) ─

describe('Factory Execute pattern parser', () => {
  it.each([
    ['rg "User Service" src/', 'User Service'],
    ["grep 'error boundary' -- src/", 'error boundary'],
    ['rg User\\ Service src/', 'User Service'],
    [String.raw`rg "C:\Users" src/`, String.raw`C:\Users`],
    ['rg -e "User Service" src/', 'User Service'],
    ['rg --regexp=UserService src/', 'UserService'],
    ['grep -eUserService src/', 'UserService'],
    ['/usr/bin/rg -- "User Service" src/', 'User Service'],
    ['rg -- -error src/', '-error'],
    ['rg "validateUser"', 'validateUser'],
    ['rg -t ts UserService src/', 'UserService'],
    ['rg --glob "*.ts" UserService', 'UserService'],
    ['rg ab src/', null],
    // rg/grep only counts at command position, not as an argument.
    ['echo rg UserService', null],
    // -f reads patterns from a file; later positionals are paths.
    ['rg -f patterns.txt src/', null],
    ['grep --file=patterns.txt src/', null],
  ])('extracts %j from %j', (command, expected) => {
    expect(parseRgGrepPattern(command)).toBe(expected);
  });

  // Same parser as the Cursor adapter; fails if either copy drifts.
  it.each(['tokenizeShellWords', 'parseRgGrepPattern'])(
    '%s is identical to the Cursor adapter',
    (name) => {
      const cursor = path.join(
        REPO_ROOT,
        'gitnexus-cursor-integration',
        'hooks',
        'gitnexus-hook.cjs',
      );
      expect(fnSource(HOOK, name)).toBe(fnSource(cursor, name));
    },
  );
});

// Same augment-stderr filter as the Claude adapter; fails if either copy drifts.
describe('Factory augment stderr filter', () => {
  it.each(['extractAugmentContext', 'isDebugEnabled'])(
    '%s is identical to the Claude adapter',
    (name) => {
      const claude = path.join(CLAUDE_HOOKS, 'gitnexus-hook.js');
      expect(fnSource(HOOK, name)).toBe(fnSource(claude, name));
    },
  );
});

// ─── Behavior: early-exit paths (no augment spawned) ────────────────

describe('Factory hook behavior — early exits', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitnexus-factory-early-'));
  });
  afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  it('exits cleanly on empty stdin', () => {
    const r = spawnSync(process.execPath, [HOOK], {
      input: '',
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });

  it('exits cleanly on invalid JSON stdin', () => {
    const r = spawnSync(process.execPath, [HOOK], {
      input: 'not json',
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });

  it('ignores non-PostToolUse events', () => {
    const r = runHook(HOOK, {
      hook_event_name: 'PreToolUse',
      tool_name: 'Grep',
      tool_input: { pattern: 'validateUser' },
      cwd: tmpDir,
    });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });

  it('produces no output when cwd is relative', () => {
    const r = runHook(HOOK, {
      hook_event_name: 'PostToolUse',
      tool_name: 'Grep',
      tool_input: { pattern: 'validateUser' },
      cwd: 'relative/path',
    });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });

  it('produces no output when cwd has no .gitnexus index', () => {
    const r = runHook(HOOK, {
      hook_event_name: 'PostToolUse',
      tool_name: 'Grep',
      tool_input: { pattern: 'validateUser' },
      cwd: tmpDir,
    });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });

  it('produces no output for unmatched tools or Execute without rg/grep', () => {
    for (const input of [
      { tool_name: 'MadeUpTool', tool_input: { foo: 'bar' } },
      { tool_name: 'Execute', tool_input: { command: 'ls -la' } },
      { tool_name: 'Grep', tool_input: { pattern: 'is' } }, // < 3 chars
    ]) {
      const r = runHook(HOOK, { hook_event_name: 'PostToolUse', cwd: tmpDir, ...input });
      expect(r.status).toBe(0);
      expect(r.stdout.trim()).toBe('');
    }
  });
});

// ─── Behavior: happy path (augment via a fake gitnexus on PATH) ─────

describe('Factory hook behavior — augment', () => {
  let repoDir: string;
  let binDir: string;
  let home: string;

  beforeAll(() => {
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitnexus-factory-repo-'));
    // Repo-local index metadata → resolved as a local owned index; no `lbug`
    // file → the DB-owner probe short-circuits false and augment runs.
    fs.mkdirSync(path.join(repoDir, '.gitnexus'), { recursive: true });
    fs.writeFileSync(path.join(repoDir, '.gitnexus', 'gitnexus.json'), '{}');
    binDir = createHookToolDir({ gitnexusStderr: '[GitNexus] graph context for validateUser' });
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'gitnexus-factory-home-'));
  });
  afterAll(() => {
    fs.rmSync(repoDir, { recursive: true, force: true });
    fs.rmSync(binDir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  });

  it('emits augment stderr as additionalContext for a Grep search', () => {
    const r = runHook(
      HOOK,
      {
        hook_event_name: 'PostToolUse',
        tool_name: 'Grep',
        tool_input: { pattern: 'validateUser' },
        cwd: repoDir,
      },
      undefined,
      { env: isolatedEnv(binDir, home) },
    );
    expect(r.status).toBe(0);
    const out = parseHookOutput(r.stdout);
    expect(out?.hookEventName).toBe('PostToolUse');
    expect(out?.additionalContext).toContain('graph context for validateUser');
  });

  it('augments against an external index registered in GITNEXUS_HOME (#3060)', () => {
    const extRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'gitnexus-factory-extrepo-'));
    const storage = fs.mkdtempSync(path.join(os.tmpdir(), 'gitnexus-factory-storage-'));
    const extHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gitnexus-factory-exthome-'));
    try {
      // No repo-local .gitnexus: only the registry row points at the index.
      fs.writeFileSync(
        path.join(storage, 'gitnexus.json'),
        JSON.stringify({ repoPath: extRepo, storagePath: storage }),
      );
      fs.writeFileSync(
        path.join(extHome, 'registry.json'),
        JSON.stringify([{ name: 'ext', path: extRepo, storagePath: storage }]),
      );

      const r = runHook(
        HOOK,
        {
          hook_event_name: 'PostToolUse',
          tool_name: 'Grep',
          tool_input: { pattern: 'validateUser' },
          cwd: extRepo,
        },
        undefined,
        { env: isolatedEnv(binDir, extHome) },
      );
      expect(r.status).toBe(0);
      expect(parseHookOutput(r.stdout)?.additionalContext).toContain(
        'graph context for validateUser',
      );
      // The fan-out slot lives in the resolved storage, not the repo.
      expect(fs.existsSync(path.join(storage, '.hook-locks'))).toBe(true);
      expect(fs.existsSync(path.join(extRepo, '.gitnexus'))).toBe(false);
    } finally {
      for (const d of [extRepo, storage, extHome]) fs.rmSync(d, { recursive: true, force: true });
    }
  });
});

// ─── Behavior: fan-out guard skips when all slots are held ──────────

describe('Factory hook behavior — augment fan-out guard', () => {
  it('exits silently when all MAX_INFLIGHT slots hold live pids', async () => {
    const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitnexus-factory-slots-'));
    const lockDir = path.join(repoDir, '.gitnexus', '.hook-locks');
    fs.mkdirSync(lockDir, { recursive: true });
    // Index metadata so the hook resolves the repo and reaches the slot guard,
    // rather than exiting early for having no index.
    fs.writeFileSync(path.join(repoDir, '.gitnexus', 'gitnexus.json'), '{}');
    const binDir = createHookToolDir({ gitnexusStderr: 'should never be emitted' });
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gitnexus-factory-home-'));

    const { spawn } = await import('child_process');
    const sleepers = [0, 1, 2].map(() =>
      spawn(process.execPath, ['-e', 'setTimeout(()=>{},60000)'], { stdio: 'ignore' }),
    );
    try {
      sleepers.forEach((s, i) =>
        fs.writeFileSync(path.join(lockDir, `slot-${i}.lock`), String(s.pid)),
      );

      const r = runHook(
        HOOK,
        {
          hook_event_name: 'PostToolUse',
          tool_name: 'Grep',
          tool_input: { pattern: 'validateUser' },
          cwd: repoDir,
        },
        undefined,
        { env: isolatedEnv(binDir, home) },
      );

      expect(r.status).toBe(0);
      expect(r.stdout.trim()).toBe('');
    } finally {
      for (const s of sleepers) {
        try {
          s.kill();
        } catch {
          /* ignore */
        }
      }
      fs.rmSync(repoDir, { recursive: true, force: true });
      fs.rmSync(binDir, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});

// ─── Behavior: PATH tier, no GITNEXUS_HOOK_CLI_PATH ─────────────────
//
// PATH holds only the fake launchers written here (`#!/bin/sh` shebangs resolve
// by absolute path, so no other PATH entry is needed), which keeps any real
// `gitnexus` or `npx` on the host out of the result.

describe.skipIf(process.platform === 'win32')('Factory hook behavior — PATH augment tier', () => {
  let repoDir: string;
  let toolsDir: string;
  let home: string;

  beforeAll(() => {
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitnexus-factory-pathrepo-'));
    fs.mkdirSync(path.join(repoDir, '.gitnexus'), { recursive: true });
    fs.writeFileSync(path.join(repoDir, '.gitnexus', 'gitnexus.json'), '{}');
    toolsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitnexus-factory-pathtools-'));
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'gitnexus-factory-pathhome-'));
  });
  afterAll(() => {
    for (const d of [repoDir, toolsDir, home]) fs.rmSync(d, { recursive: true, force: true });
  });

  function makeBinDir(name: string, scripts: Record<string, string>): string {
    const dir = path.join(toolsDir, name);
    fs.mkdirSync(dir);
    for (const [file, body] of Object.entries(scripts)) {
      fs.writeFileSync(path.join(dir, file), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
    }
    return dir;
  }

  // Default: the guard disabled, so the host's coreutils cannot change which arm
  // runs; the guarded arm is pinned explicitly below with a logging fake guard.
  function runGrepHook(binDir: string, timeoutPath = 'disabled') {
    return runHook(
      HOOK,
      {
        hook_event_name: 'PostToolUse',
        tool_name: 'Grep',
        tool_input: { pattern: 'validateUser' },
        cwd: repoDir,
      },
      undefined,
      {
        env: {
          ...isolatedEnv(binDir, home),
          PATH: binDir,
          GITNEXUS_HOOK_CLI_PATH: '',
          GITNEXUS_HOOK_TIMEOUT_PATH: timeoutPath,
        },
      },
    );
  }

  /**
   * A coreutils-shaped `timeout` stand-in: appends its argv to `log`, drops the
   * `-s SIG` / `-k N` options and the duration, then execs the command, so it
   * passes the probe's `-k 1 1 /bin/sh -c 'exit 42'` self-test.
   */
  function writeLoggingGuard(name: string): { guard: string; log: string } {
    const log = path.join(toolsDir, `${name}.log`);
    const guard = path.join(toolsDir, `${name}-guard`);
    fs.writeFileSync(
      guard,
      `#!/bin/sh\necho "$*" >> '${log}'\n` +
        `while [ "$1" = -s ] || [ "$1" = -k ]; do shift 2; done\nshift\nexec "$@"\n`,
      { mode: 0o755 },
    );
    return { guard, log };
  }

  function augmentGuardCalls(log: string): string[] {
    return fs
      .readFileSync(log, 'utf-8')
      .split('\n')
      .filter((line) => line.includes('augment'));
  }

  for (const guarded of [false, true]) {
    const arm = guarded ? 'guarded' : 'unguarded';

    it(`${arm}: does not re-run augment via npx when the PATH binary finds no match`, () => {
      const marker = path.join(toolsDir, `npx-called-${arm}`);
      const binDir = makeBinDir(`no-match-${arm}`, {
        gitnexus: 'exit 0',
        npx: `: > '${marker}'\nprintf '[GitNexus] from npx' >&2`,
      });
      const r = runGrepHook(
        binDir,
        guarded ? writeLoggingGuard(`no-match-${arm}`).guard : 'disabled',
      );
      expect(r.status).toBe(0);
      expect(r.stdout.trim()).toBe('');
      expect(fs.existsSync(marker)).toBe(false);
    });

    it(`${arm}: adds no context and never runs npx when no gitnexus launcher is on PATH`, () => {
      const marker = path.join(toolsDir, `npx-only-called-${arm}`);
      const binDir = makeBinDir(`npx-only-${arm}`, {
        npx: `: > '${marker}'\nprintf '[GitNexus] graph context via npx' >&2`,
      });
      const r = runGrepHook(
        binDir,
        guarded ? writeLoggingGuard(`npx-only-${arm}`).guard : 'disabled',
      );
      expect(r.status).toBe(0);
      expect(r.stdout.trim()).toBe('');
      expect(fs.existsSync(marker)).toBe(false);
    });
  }

  // #2163: direct children get TERM-first `-k 1`; the budget is ceil(8000/1000)+1.
  it('runs the PATH binary under the timeout guard (TERM-first)', () => {
    const binDir = makeBinDir('guarded-path', {
      gitnexus: "printf '[GitNexus] graph context via guarded PATH' >&2",
    });
    const { guard, log } = writeLoggingGuard('guarded-path');
    const r = runGrepHook(binDir, guard);
    expect(parseHookOutput(r.stdout)?.additionalContext).toContain('via guarded PATH');
    expect(augmentGuardCalls(log)).toEqual([
      `-k 1 9 ${path.join(binDir, 'gitnexus')} augment -- validateUser`,
    ]);
  });

  it('drops launcher noise ahead of the [GitNexus] block', () => {
    const binDir = makeBinDir('noisy-match', {
      gitnexus:
        "printf 'npm warn config production\\n(node:42) ExperimentalWarning: noise\\n[GitNexus] graph context for validateUser\\n' >&2",
    });
    const r = runGrepHook(binDir);
    expect(r.status).toBe(0);
    const context = parseHookOutput(r.stdout)?.additionalContext;
    expect(context).toBe('[GitNexus] graph context for validateUser');
    expect(context).not.toContain('npm warn');
    expect(context).not.toContain('ExperimentalWarning');
  });

  it('emits nothing when augment stderr is only noise (no [GitNexus] marker)', () => {
    const binDir = makeBinDir('noise-only', {
      gitnexus: "printf 'npm warn config production\\n(node:42) ExperimentalWarning: noise\\n' >&2",
    });
    const r = runGrepHook(binDir);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });
});

// ─── Behavior: a SIGKILLed hook cannot strand the augment CLI (#2163) ──
//
// Real coreutils `timeout` (the path under test): the fake CLI is SIGTERM-immune
// and sleeps 30s, so only the guard can end it once the hook is gone. Direct
// tier: TERM at 9s (= ceil(8000/1000)+1) is ignored, the `-k 1` KILL lands at
// 10s. With the guard wrap reverted nothing reaps the CLI and the poll times out.
// There is no npx tier to reap: this build has no npm fetch fallback.

const factoryProbe = require_(path.join(PLUGIN_DIR, 'hooks', 'hook-db-lock-probe.cjs')) as {
  resolveUnixGuardTimeout: () => string | null;
};

describe.skipIf(process.platform !== 'linux')(
  'Factory hook behavior — orphaned augment CLI is reaped by the timeout guard (#2163)',
  () => {
    let repoDir: string;
    let home: string;

    beforeAll(() => {
      repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitnexus-factory-reaprepo-'));
      fs.mkdirSync(path.join(repoDir, '.gitnexus'), { recursive: true });
      fs.writeFileSync(path.join(repoDir, '.gitnexus', 'gitnexus.json'), '{}');
      home = fs.mkdtempSync(path.join(os.tmpdir(), 'gitnexus-factory-reaphome-'));
    });
    afterAll(() => {
      for (const d of [repoDir, home]) fs.rmSync(d, { recursive: true, force: true });
    });

    const isAlive = (pid: number, binDir: string): boolean => {
      try {
        process.kill(pid, 0);
        // PID-reuse guard: alive only while the cmdline is still our fake CLI.
        return fs.readFileSync(`/proc/${pid}/cmdline`, 'utf-8').includes(binDir);
      } catch {
        return false;
      }
    };

    async function killHookMidAugment(): Promise<boolean> {
      const { spawn } = await import('child_process');
      const pidFile = path.join(os.tmpdir(), `gn-factory-clipid-${process.pid}-direct`);
      fs.rmSync(pidFile, { force: true });
      const binDir = createHookToolDir({
        gitnexusPidFile: pidFile,
        gitnexusSleepMs: 30000,
        gitnexusIgnoreSigterm: true,
      });
      let cliPid = 0;
      const hook = spawn(process.execPath, [HOOK], {
        stdio: ['pipe', 'ignore', 'ignore'],
        env: { ...isolatedEnv(binDir, home), GITNEXUS_HOOK_TIMEOUT_PATH: '', PATH: binDir },
      });
      try {
        hook.stdin?.end(
          JSON.stringify({
            hook_event_name: 'PostToolUse',
            tool_name: 'Grep',
            tool_input: { pattern: 'validateUser' },
            cwd: repoDir,
          }),
        );
        const spawnDeadline = Date.now() + 8000;
        while (cliPid === 0 && Date.now() < spawnDeadline) {
          cliPid =
            Number.parseInt(fs.existsSync(pidFile) ? fs.readFileSync(pidFile, 'utf-8') : '', 10) ||
            0;
          await new Promise((r) => setTimeout(r, 10));
        }
        expect(cliPid).toBeGreaterThan(0);
        hook.kill('SIGKILL');

        const reapDeadline = Date.now() + 14000;
        let alive = isAlive(cliPid, binDir);
        while (alive && Date.now() < reapDeadline) {
          await new Promise((r) => setTimeout(r, 100));
          alive = isAlive(cliPid, binDir);
        }
        return alive;
      } finally {
        hook.kill('SIGKILL');
        for (const pid of [cliPid].filter((p) => p > 0 && isAlive(p, binDir))) {
          process.kill(pid, 'SIGKILL');
        }
        fs.rmSync(path.join(repoDir, '.gitnexus', '.hook-locks'), { recursive: true, force: true });
        fs.rmSync(pidFile, { force: true });
        fs.rmSync(binDir, { recursive: true, force: true });
      }
    }

    it('host exposes a self-testing timeout guard (precondition)', () => {
      vi.stubEnv('GITNEXUS_HOOK_TIMEOUT_PATH', '');
      try {
        expect(
          factoryProbe.resolveUnixGuardTimeout(),
          'install coreutils `timeout`',
        ).not.toBeNull();
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('direct tier: SIGKILLed hook leaves no SIGTERM-immune CLI child', async () => {
      expect(await killHookMidAugment()).toBe(false);
    }, 30000);
  },
);
