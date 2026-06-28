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

  it('a pipeline run completes with apex files skipped under the opt-out (no crash, no apex code nodes)', async () => {
    // Pipeline-level proof of the §8 "grammar unavailable → recognised files
    // skipped, run completes" clause: force the opt-out via a fresh module load,
    // then run the real pipeline over Apex fixtures. Post-impl this exercises
    // recognised-then-skipped; pre-impl it proves the run completes with .cls
    // present and emits no Apex code nodes. (Degradation invariant — host opt-out
    // machinery; strengthens once recognition lands in 3b.)
    vi.resetModules();
    process.env.GITNEXUS_SKIP_OPTIONAL_GRAMMARS = 'apex';
    const pipeline = await import('../../src/core/ingestion/pipeline.js');
    const path = (await import('path')).default;
    const FIXTURES = path.resolve(__dirname, '..', 'fixtures', 'lang-resolution');
    const result = await pipeline.runPipelineFromRepo(path.join(FIXTURES, 'apex-types'), () => {});
    expect(result).toBeDefined();
    const CODE = new Set(['Class', 'Interface', 'Enum', 'Method', 'Constructor', 'Property']);
    const codeNodes: string[] = [];
    result.graph.forEachNode((n) => {
      if (CODE.has(n.label) && (n.properties.filePath as string | undefined)?.endsWith('.cls')) {
        codeNodes.push(n.properties.name);
      }
    });
    expect(codeNodes).toEqual([]);
  }, 60000);
});
