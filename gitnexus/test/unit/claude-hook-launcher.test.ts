import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

const launcher = path.resolve(__dirname, '../../../gitnexus-claude-plugin/hooks/gitnexus-hook.js');
const source = fs.readFileSync(launcher, 'utf8');
const realRequire = createRequire(import.meta.url);
const fixtures: string[] = [];
const children: ChildProcess[] = [];
const version = '1.6.12';

afterEach(() => {
  for (const child of children.splice(0)) if (child.exitCode === null) child.kill();
  for (const fixture of fixtures.splice(0)) fs.rmSync(fixture, { recursive: true, force: true });
});

function fixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gitnexus-launcher-')));
  fixtures.push(root);
  return root;
}

function installedPackage(root: string, metadata: Record<string, unknown> = {}) {
  const cli = path.join(root, 'dist', 'cli', 'index.js');
  const hook = path.join(root, 'hooks', 'claude', 'gitnexus-hook.cjs');
  const marker = path.join(root, 'loaded');
  fs.mkdirSync(path.dirname(cli), { recursive: true });
  fs.mkdirSync(path.dirname(hook), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'gitnexus', version, ...metadata }),
  );
  fs.writeFileSync(cli, '// CLI entry\n');
  fs.writeFileSync(
    hook,
    `require('fs').writeFileSync(${JSON.stringify(marker)}, String(process.pid));\n`,
  );
  return { root, cli, hook, marker };
}

type Config = { cliPath: string; version: string };
type Api = {
  exactVersion: (version: unknown) => string;
  resolveRuntime: (config?: Config) => string | null;
  launcherConfig: () => Config;
  main: () => Promise<void>;
};

function load(
  options: {
    env?: NodeJS.ProcessEnv;
    platform?: string;
    directory?: string;
    resolvedHook?: string;
    filesystem?: object;
    childProcess?: object;
    kill?: (pid: number, signal?: string | number) => void;
    setTimeout?: typeof setTimeout;
    clearTimeout?: typeof clearTimeout;
  } = {},
) {
  const events = new EventEmitter();
  const resolve = vi.fn(() => {
    if (options.resolvedHook) return options.resolvedHook;
    throw Object.assign(new Error('missing'), { code: 'MODULE_NOT_FOUND' });
  });
  const api: Api = vm.runInNewContext(
    source.slice(0, source.lastIndexOf('\nmain().catch')) +
      '\n({exactVersion, resolveRuntime, launcherConfig, main});',
    {
      require: Object.assign(
        (id: string) => {
          if (id === 'fs') return { ...fs, ...options.filesystem };
          if (id === 'child_process') return options.childProcess ?? { spawn };
          return realRequire(id);
        },
        { resolve },
      ),
      Buffer,
      __dirname: options.directory ?? path.dirname(launcher),
      __filename: launcher,
      setTimeout: options.setTimeout ?? setTimeout,
      clearTimeout: options.clearTimeout ?? clearTimeout,
      process: {
        argv: [process.execPath, launcher],
        pid: process.pid,
        platform: options.platform ?? process.platform,
        execPath: process.execPath,
        env: options.env ?? {},
        kill: options.kill ?? process.kill,
        once: events.once.bind(events),
        removeListener: events.removeListener.bind(events),
      },
    },
  );
  return { api, resolve, events };
}

// npm quotes arguments but treats the command itself as shell source. Use its
// actual shell executor: shell-less spawn fakes cannot catch path quoting bugs.
describe('Claude plugin package launcher validation', () => {
  it('loads a validated package without consuming stdin or starting npm', async () => {
    const pkg = installedPackage(fixture());
    const spawn = vi.fn();
    const readFileSync = vi.fn(fs.readFileSync);
    const { api, resolve } = load({
      resolvedHook: pkg.hook,
      filesystem: { readFileSync },
      childProcess: { spawn },
    });
    await api.main();
    expect(fs.existsSync(pkg.marker)).toBe(true);
    expect(resolve).toHaveBeenCalledWith('gitnexus/hooks/claude/gitnexus-hook.cjs');
    expect(readFileSync.mock.calls.some((args) => args[0] === 0)).toBe(false);
    expect(spawn).not.toHaveBeenCalled();
  });
  it('validates require.resolve package name, metadata and canonical layout', () => {
    const pkg = installedPackage(fixture(), { name: 'other-package' });
    expect(load({ resolvedHook: pkg.hook }).api.resolveRuntime()).toBeNull();
    fs.writeFileSync(
      path.join(pkg.root, 'package.json'),
      JSON.stringify({ name: 'gitnexus', version: 'latest' }),
    );
    expect(() => load({ resolvedHook: pkg.hook }).api.resolveRuntime()).toThrow(
      'exact package version',
    );
    const arbitrary = path.join(pkg.root, 'arbitrary.cjs');
    fs.writeFileSync(arbitrary, '');
    expect(load({ resolvedHook: arbitrary }).api.resolveRuntime()).toBeNull();
  });
  it('uses a real environment override before configuration and ignores augment fixtures', () => {
    const configured = installedPackage(fixture());
    const override = installedPackage(fixture());
    const { api, resolve } = load({ env: { GITNEXUS_HOOK_CLI_PATH: override.cli } });
    expect(api.resolveRuntime({ cliPath: configured.cli, version })).toBe(override.hook);
    expect(resolve).not.toHaveBeenCalled();
    const augment = path.join(override.root, 'augment.cjs');
    fs.writeFileSync(augment, '');
    expect(
      load({ env: { GITNEXUS_HOOK_CLI_PATH: augment } }).api.resolveRuntime({
        cliPath: configured.cli,
        version,
      }),
    ).toBe(configured.hook);
  });
  it.each([{}, { cliPath: 'relative', version }, { cliPath: '/absolute', version: 'latest' }])(
    'rejects invalid configuration %j',
    (config) => {
      const directory = fixture();
      fs.writeFileSync(path.join(directory, 'gitnexus-hook.json'), JSON.stringify(config));
      expect(() => load({ directory }).api.launcherConfig()).toThrow();
    },
  );
  it('does not replace a corrupt installed package', async () => {
    const pkg = installedPackage(fixture());
    fs.writeFileSync(path.join(pkg.root, 'package.json'), '{broken');
    const spawn = vi.fn();
    await expect(
      load({ env: { GITNEXUS_HOOK_CLI_PATH: pkg.cli }, childProcess: { spawn } }).api.main(),
    ).rejects.toThrow();
    expect(spawn).not.toHaveBeenCalled();
  });
  it.skipIf(process.platform === 'win32')('resolves Unix npm symlinks', () => {
    const root = fixture();
    const pkg = installedPackage(path.join(root, 'package'));
    const bin = path.join(root, 'bin');
    fs.mkdirSync(bin);
    fs.chmodSync(pkg.cli, 0o755);
    fs.symlinkSync(pkg.cli, path.join(bin, 'gitnexus'));
    expect(load({ env: { PATH: bin } }).api.resolveRuntime()).toBe(pkg.hook);
  });
  it('resolves Windows npm prefix shims without executing them', () => {
    const root = fixture();
    const pkg = installedPackage(path.join(root, 'node_modules', 'gitnexus'));
    fs.writeFileSync(path.join(root, 'gitnexus.cmd'), '@echo shim\n');
    expect(load({ platform: 'win32', env: { PATH: root } }).api.resolveRuntime()).toBe(pkg.hook);
  });
  it.each([undefined, '', 'latest', '^1.7.0', '01.7.0', '1.7.0\n', '1.7.0 & echo injected'])(
    'rejects non-exact version %j',
    (invalid) => {
      expect(() => load().api.exactVersion(invalid)).toThrow('exact package version');
    },
  );

  it('never fetches a package when no runtime is installed', async () => {
    // This fork is not published to npm: an `npx gitnexus@<version>` recovery
    // would run upstream's package, which has no Apex support.
    const directory = fixture();
    fs.writeFileSync(
      path.join(directory, 'gitnexus-hook.json'),
      JSON.stringify({ version, cliPath: path.join(directory, 'deleted') }),
    );
    const spawn = vi.fn();
    await load({ directory, env: { PATH: fixture() }, childProcess: { spawn } }).api.main();
    expect(spawn).not.toHaveBeenCalled();
  });
  it('contains no npm fetch machinery', () => {
    expect(source).not.toMatch(/npx|bunx|dlx|gitnexus@|recover-package/);
  });
});
