#!/usr/bin/env node
/**
 * Launch the installed package's hook. Hook behavior and helpers live only there.
 * This fork is not published to npm: there is no download/recovery fallback.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const HOOK_PATH = 'hooks/claude/gitnexus-hook.cjs';

function exactVersion(version) {
  const numeric = '(?:0|[1-9][0-9]*)';
  const prerelease = '(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)';
  const semver = new RegExp(
    `^${numeric}\\.${numeric}\\.${numeric}(?:-${prerelease}(?:\\.${prerelease})*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`,
  );
  if (typeof version !== 'string' || version.trim() !== version || !semver.test(version)) {
    throw new Error('GitNexus hook launcher must contain an exact package version');
  }
  return version;
}

function runtimeAtRoot(root, version) {
  try {
    root = fs.realpathSync(root);
    const metadata = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const entry = path.join(root, HOOK_PATH);
    const cli = path.join(root, 'dist', 'cli', 'index.js');
    if (metadata.name !== 'gitnexus') return null;
    exactVersion(metadata.version);
    if (version && metadata.version !== version) return null;
    // Both entrypoints must belong to this package, including symlinked installs.
    return fs.statSync(cli).isFile() &&
      fs.realpathSync(cli) === cli &&
      fs.statSync(entry).isFile() &&
      fs.realpathSync(entry) === entry
      ? entry
      : null;
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
    throw error;
  }
}

function runtimeForCli(cli, version) {
  try {
    const real = fs.realpathSync(cli);
    const root = path.resolve(path.dirname(real), '..', '..');
    return real === path.join(root, 'dist', 'cli', 'index.js')
      ? runtimeAtRoot(root, version)
      : null;
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
    throw error;
  }
}

function runtimeForHook(hook, version) {
  try {
    const real = fs.realpathSync(hook);
    const root = path.resolve(path.dirname(real), '..', '..');
    return real === path.join(root, HOOK_PATH) ? runtimeAtRoot(root, version) : null;
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
    throw error;
  }
}

function findOnPath(name) {
  const suffixes = process.platform === 'win32' ? ['.cmd', '.exe', '.bat', ''] : [''];
  const searchPath = process.env.PATH || process.env.Path || process.env.path || '';
  for (const directory of searchPath.split(path.delimiter).filter(Boolean)) {
    for (const suffix of suffixes) {
      const candidate = path.resolve(directory, name + suffix);
      try {
        if (!fs.statSync(candidate).isFile()) continue;
        if (process.platform !== 'win32') fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      } catch {
        /* try the next launcher */
      }
    }
  }
  return null;
}

function runtimeOnPath(version) {
  const launcher = findOnPath('gitnexus');
  if (!launcher) return null;
  // npm's Unix symlinks and Windows prefix/local .bin layouts.
  return (
    runtimeForCli(launcher, version) ||
    runtimeAtRoot(path.join(path.dirname(launcher), 'node_modules', 'gitnexus'), version) ||
    runtimeAtRoot(path.resolve(path.dirname(launcher), '..', 'gitnexus'), version)
  );
}

function launcherConfig() {
  let raw;
  try {
    raw = fs.readFileSync(path.join(__dirname, 'gitnexus-hook.json'), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  const config = JSON.parse(raw);
  if (!config || typeof config.cliPath !== 'string' || !path.isAbsolute(config.cliPath)) {
    throw new Error('Invalid GitNexus hook launcher configuration');
  }
  exactVersion(config.version);
  return config;
}

function resolveRuntime(config) {
  for (const cli of [process.env.GITNEXUS_HOOK_CLI_PATH, config && config.cliPath]) {
    const runtime = cli && runtimeForCli(cli);
    if (runtime) return runtime;
  }
  try {
    const runtime = runtimeForHook(require.resolve(`gitnexus/${HOOK_PATH}`));
    if (runtime) return runtime;
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND' && error.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') {
      throw error;
    }
  }
  return runtimeOnPath();
}

function nodeEnvironment() {
  const env = { ...process.env };
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') || 'PATH';
  env[pathKey] = path.dirname(process.execPath) + path.delimiter + (env[pathKey] || '');
  return env;
}

function runShim(shim) {
  let command = shim;
  let args = [];
  const env = nodeEnvironment();
  let windowsVerbatimArguments = false;
  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(shim)) {
    env.__GITNEXUS_HOOK_SHIM = shim;
    command =
      process.env.ComSpec ||
      path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'cmd.exe');
    args = ['/d', '/s', '/c', '""%__GITNEXUS_HOOK_SHIM%""'];
    windowsVerbatimArguments = true;
  }
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: 'inherit',
      windowsHide: true,
      windowsVerbatimArguments,
    });
    child.once('error', reject);
    child.once('close', (status) =>
      status === 0 ? resolve() : reject(new Error('Installed GitNexus hook failed')),
    );
  });
}

function isDebugEnabled() {
  return process.env.GITNEXUS_DEBUG === '1' || process.env.GITNEXUS_DEBUG === 'true';
}

async function main() {
  const config = launcherConfig();
  const runtime = resolveRuntime(config);
  if (runtime) require(runtime);
  else {
    // No npm-fetch rung: this fork is not published to npm, so fetching
    // the published package would run upstream's build (no Apex support).
    // With no installed runtime the hook skips quietly.
    const shim = findOnPath('gitnexus-hook');
    if (shim) await runShim(shim);
    else if (isDebugEnabled()) {
      process.stderr.write('GitNexus hook launcher: no installed GitNexus runtime found\n');
    }
  }
}

main().catch((error) => {
  if (isDebugEnabled()) {
    process.stderr.write(
      `GitNexus hook launcher: ${String(error.message || error).slice(0, 200)}\n`,
    );
  }
});
