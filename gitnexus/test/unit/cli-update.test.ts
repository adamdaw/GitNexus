import { describe, expect, it, vi } from 'vitest';

import { NOT_PUBLISHED_MESSAGE, updateCommand } from '../../src/cli/update.js';

/**
 * Upstream's `gitnexus update` spawns `npm i -g gitnexus@<version>`. In this
 * fork that installs UPSTREAM's package, which has no Apex parser, so the
 * command is closed rather than gated: the passive notifier's eligibility check
 * does not cover it (`update` asserted `eligible: true` instead of measuring).
 *
 * These are the two properties that matter, and they are asserted against the
 * real module rather than a stub — no npm subprocess is reachable from it, and
 * the refusal is loud enough for a `&&` chain to stop on.
 */
describe('gitnexus update (fork: refuses, never installs)', () => {
  it('prints the fork message and exits non-zero', async () => {
    const writeStdout = vi.fn();
    const setExitCode = vi.fn();

    await updateCommand({ writeStdout, setExitCode });

    expect(writeStdout).toHaveBeenCalledWith(NOT_PUBLISHED_MESSAGE);
    expect(setExitCode).toHaveBeenCalledWith(1);
  });

  it('names the failure mode, not just the refusal', () => {
    // A bare "not supported" would leave the reader to discover the silent
    // skip themselves, which is the whole defect.
    expect(NOT_PUBLISHED_MESSAGE).toMatch(/npm i -g gitnexus/);
    expect(NOT_PUBLISHED_MESSAGE).toMatch(/no Apex parser/);
    expect(NOT_PUBLISHED_MESSAGE).toMatch(/npm ci && npm run build/);
  });

  it('carries no npm-install path at all', async () => {
    const mod = await import('../../src/cli/update.js');
    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('../../src/cli/update.ts', import.meta.url), 'utf-8'),
    );

    // The export surface upstream used to build the install command is gone,
    // so a future sync that reintroduces it reddens here rather than shipping.
    expect(Object.keys(mod).sort()).toEqual(['NOT_PUBLISHED_MESSAGE', 'updateCommand']);
    // `spawn` only appears in the comment's prose, never as an import or call.
    expect(source).not.toMatch(/from 'node:child_process'/);
    expect(source).not.toMatch(/\bspawn\s*\(/);
  });

  it('is invoked by commander with an options object and still refuses', async () => {
    // `createLazyAction` hands the action commander's own arguments, not the
    // test-deps shape — the guard must not mistake one for the other.
    const logged: string[] = [];
    const log = vi.spyOn(console, 'log').mockImplementation((line: string) => {
      logged.push(line);
    });
    const previousExitCode = process.exitCode;
    try {
      await updateCommand({ someCommanderOption: true });
      expect(logged).toEqual([NOT_PUBLISHED_MESSAGE]);
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = previousExitCode;
      log.mockRestore();
    }
  });
});
