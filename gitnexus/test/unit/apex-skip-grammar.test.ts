import { describe, it, expect, afterEach, vi } from 'vitest';
import { SupportedLanguages } from 'gitnexus-shared';

/**
 * §4/§8 — graceful degradation via the runtime opt-out. The Apex grammar is
 * registered as optional + userSkippable, so GITNEXUS_SKIP_OPTIONAL_GRAMMARS
 * makes `isLanguageAvailable('apex')` report false at analyze time and the
 * pipeline skips `.cls`/`.trigger` files instead of loading the grammar — the
 * loader-level gate that drives file-skipping. (The pipeline-level
 * "recognised → skipped" surface lands with recognition in Step 3b.)
 *
 * This is a degradation/host-integration invariant (host opt-out machinery +
 * the scaffold's `userSkippable` flag), not a forceable-red behavioural target.
 * The skip directive is memoised once per module load, so each case re-imports
 * the loader fresh after stubbing the env. Apex is keyed by the literal 'apex'
 * (the enum value) pre-implementation.
 */
const APEX = 'apex' as SupportedLanguages;

describe('Apex runtime opt-out via GITNEXUS_SKIP_OPTIONAL_GRAMMARS (§4/§8)', () => {
  const prev = process.env.GITNEXUS_SKIP_OPTIONAL_GRAMMARS;
  afterEach(() => {
    if (prev === undefined) delete process.env.GITNEXUS_SKIP_OPTIONAL_GRAMMARS;
    else process.env.GITNEXUS_SKIP_OPTIONAL_GRAMMARS = prev;
    vi.resetModules();
  });

  it('reports apex unavailable when skipped by name', async () => {
    vi.resetModules();
    process.env.GITNEXUS_SKIP_OPTIONAL_GRAMMARS = 'apex';
    const { isLanguageAvailable } = await import('../../src/core/tree-sitter/parser-loader.js');
    expect(isLanguageAvailable(APEX)).toBe(false);
  });

  it('reports apex unavailable when all optional grammars are skipped', async () => {
    vi.resetModules();
    process.env.GITNEXUS_SKIP_OPTIONAL_GRAMMARS = '1';
    const { isLanguageAvailable } = await import('../../src/core/tree-sitter/parser-loader.js');
    expect(isLanguageAvailable(APEX)).toBe(false);
  });

  it('apex is available when the env is unset (control — grammar vendored)', async () => {
    vi.resetModules();
    delete process.env.GITNEXUS_SKIP_OPTIONAL_GRAMMARS;
    const { isLanguageAvailable } = await import('../../src/core/tree-sitter/parser-loader.js');
    expect(isLanguageAvailable(APEX)).toBe(true);
  });
});
