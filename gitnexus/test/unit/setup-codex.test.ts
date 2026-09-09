import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';

// The MCP fallback when no `gitnexus` launcher is on PATH. This build is not
// published to npm, so upstream's `npx -y gitnexus@<version> mcp` fallback would
// persist an upstream-pointing server into the user's editor config — silently, and
// on every MCP connect. `gitnexus setup` runs from this build, so its own
// entrypoint is always a valid launch path. Platform-independent: there is no cmd
// wrapper to add, because there is no npx shim to wrap.
const SELF_MCP_ARRAY = [process.execPath, path.resolve(process.argv[1]!), 'mcp'];

const PKG_VERSION = (createRequire(import.meta.url)('../../package.json') as { version: string })
  .version;
const NPX_REF = `gitnexus@${PKG_VERSION}`;

const execFileMock = vi.fn((...args: any[]) => {
  const callback = args.at(-1);
  if (typeof callback === 'function') {
    callback(null, '', '');
  }
});

const execFileSyncMock = vi.fn(() => {
  throw new Error('not found');
});

vi.mock('child_process', () => ({
  execFile: execFileMock,
  execFileSync: execFileSyncMock,
}));

describe('setupCommand codex execution', () => {
  let tempHome: string;
  let originalHome: string | undefined;
  let originalUserProfile: string | undefined;
  let platformDescriptor: PropertyDescriptor | undefined;

  const setPlatform = (value: NodeJS.Platform) => {
    Object.defineProperty(process, 'platform', {
      value,
      configurable: true,
    });
  };

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    originalHome = process.env.HOME;
    originalUserProfile = process.env.USERPROFILE;
    tempHome = await fs.mkdtemp(path.join(os.tmpdir(), 'gn-codex-setup-'));
    process.env.HOME = tempHome;
    process.env.USERPROFILE = tempHome;

    await fs.mkdir(path.join(tempHome, '.codex'), { recursive: true });

    platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform');
    setPlatform('win32');
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();

    if (platformDescriptor) {
      Object.defineProperty(process, 'platform', platformDescriptor);
    }

    process.env.HOME = originalHome;
    process.env.USERPROFILE = originalUserProfile;
    await fs.rm(tempHome, { recursive: true, force: true });
  });

  it('invokes codex mcp add with shell enabled on Windows', async () => {
    const { setupCommand } = await import('../../src/cli/setup.js');

    await setupCommand();

    expect(execFileMock).toHaveBeenCalledWith(
      'codex',
      ['mcp', 'add', 'gitnexus', '--', ...SELF_MCP_ARRAY],
      { shell: true, windowsHide: true },
      expect.any(Function),
    );
  });

  it('uses Windows npx fallback arguments when where returns only a non-wrapper shim', async () => {
    execFileSyncMock.mockReturnValueOnce('C:\\Users\\dev\\AppData\\Roaming\\npm\\gitnexus\n');

    const { setupCommand } = await import('../../src/cli/setup.js');

    await setupCommand();

    expect(execFileMock).toHaveBeenCalledWith(
      'codex',
      ['mcp', 'add', 'gitnexus', '--', ...SELF_MCP_ARRAY],
      { shell: true, windowsHide: true },
      expect.any(Function),
    );
  });

  it('invokes codex mcp add without shell on non-Windows and does not write fallback config', async () => {
    setPlatform('darwin');

    const { setupCommand } = await import('../../src/cli/setup.js');

    await setupCommand();

    expect(execFileMock).toHaveBeenCalledWith(
      'codex',
      ['mcp', 'add', 'gitnexus', '--', ...SELF_MCP_ARRAY],
      { shell: false, windowsHide: true },
      expect.any(Function),
    );

    await expect(fs.access(path.join(tempHome, '.codex', 'config.toml'))).rejects.toThrow();
  });

  it('skips Codex setup entirely when ~/.codex is missing', async () => {
    await fs.rm(path.join(tempHome, '.codex'), { recursive: true, force: true });

    const { setupCommand } = await import('../../src/cli/setup.js');

    await setupCommand();

    expect(execFileMock).not.toHaveBeenCalled();
    await expect(fs.access(path.join(tempHome, '.agents', 'skills'))).rejects.toThrow();
  });
});
