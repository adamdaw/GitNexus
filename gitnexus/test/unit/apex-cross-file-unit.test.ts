/**
 * Apex (Salesforce) — WI-3: cross-file binding, main-thread UNIT anchors.
 *
 * SDD-003 §7 provisions main-thread unit anchors for the new pure function so the
 * cross-file logic is COVERAGE-ATTRIBUTABLE (dogfood #16): the hook runs inside the
 * resolution phase, invisible to main-thread v8 coverage. These anchors call
 * `populateApexNamespaceSiblings` directly with a minimal ParsedFile/indexes shape
 * and assert the §3 [structural] pins: def-kind predicate, top-level-by-qualifiedName
 * discriminant, `.trigger` exclusion, folded key, and the inject-none collision guard.
 *
 * Authored BEFORE implementation (VSDD Phase 3, TDD). RED until Step 3b:
 * `languages/apex/namespace-siblings.ts` does not exist yet -> the dynamic import
 * rejects and each anchor fails individually (the WI-2 pattern — the file still
 * collects pre-impl, giving clean per-test Red-Gate evidence).
 */
import { describe, it, expect } from 'vitest';
import type { ParsedFile } from 'gitnexus-shared';
import type { ScopeResolutionIndexes } from '../../src/core/ingestion/model/scope-resolution-indexes.js';

type PopulateFn = (
  parsedFiles: readonly ParsedFile[],
  indexes: ScopeResolutionIndexes,
  ctx: { fileContents: ReadonlyMap<string, string> },
) => void;

// `languages/apex/namespace-siblings.ts` is created in Step 3b. Imported dynamically so THIS
// file still collects pre-impl and each anchor below fails individually (the import rejects)
// instead of the whole file failing to load — clean per-test Red-Gate evidence.
const loadPopulate = async (): Promise<PopulateFn> => {
  const mod = await import('../../src/core/ingestion/languages/apex/namespace-siblings.js');
  return (mod as { populateApexNamespaceSiblings: PopulateFn }).populateApexNamespaceSiblings;
};

/** Minimal SymbolDefinition-shaped def (the §3 discriminant fields). */
const def = (
  nodeId: string,
  type: string,
  qualifiedName: string,
  filePath: string,
) => ({ nodeId, filePath, type, qualifiedName, name: qualifiedName.split('.').pop() });

/** Minimal ParsedFile carrying only what the §3 selection reads. */
const parsedFile = (filePath: string, localDefs: unknown[]): ParsedFile =>
  ({ filePath, localDefs, scopes: [] }) as unknown as ParsedFile;

/** Fresh indexes exposing the workspaceFqnBindings write target. */
const makeIndexes = () => {
  const workspaceFqnBindings = new Map<string, unknown[]>();
  return {
    indexes: { workspaceFqnBindings } as unknown as ScopeResolutionIndexes,
    workspaceFqnBindings,
  };
};

const run = async (files: ParsedFile[]) => {
  const populate = await loadPopulate();
  const { indexes, workspaceFqnBindings } = makeIndexes();
  populate(files, indexes, { fileContents: new Map() });
  return workspaceFqnBindings;
};

describe('Apex namespace-siblings injection (SDD-003 §3, pure def-selection + key-folding)', () => {
  it('injects a top-level class def under its normalizeIdentifier-folded simple name', async () => {
    const ws = await run([
      parsedFile('/repo/Engine.cls', [def('n1', 'Class', 'Engine', '/repo/Engine.cls')]),
    ]);
    const bucket = ws.get('engine') as Array<{ def: { nodeId: string } }> | undefined;
    expect(bucket, 'folded key present').toBeDefined();
    expect(bucket!.length, 'exactly one binding per unique key').toBe(1);
    expect(bucket![0].def.nodeId, 'case-preserving def carried').toBe('n1');
  });

  it('injects interface and enum defs (predicate 1 spans the three type kinds)', async () => {
    const ws = await run([
      parsedFile('/repo/Iface.cls', [def('n2', 'Interface', 'Iface', '/repo/Iface.cls')]),
      parsedFile('/repo/Color.cls', [def('n3', 'Enum', 'Color', '/repo/Color.cls')]),
    ]);
    expect(ws.get('iface')).toBeDefined();
    expect(ws.get('color')).toBeDefined();
  });

  it('never injects a member def (Method/Property) — predicate 1 (§3, no `new foo()` mis-bind)', async () => {
    const ws = await run([
      parsedFile('/repo/Engine.cls', [
        def('n1', 'Class', 'Engine', '/repo/Engine.cls'),
        def('n4', 'Method', 'start', '/repo/Engine.cls'),
        def('n5', 'Property', 'label', '/repo/Engine.cls'),
      ]),
    ]);
    expect(ws.get('start')).toBeUndefined();
    expect(ws.get('label')).toBeUndefined();
    expect(ws.size, 'only the type def injects').toBe(1);
  });

  it('excludes a nested type (qualifiedName contains a dot) — predicate 2 (§3)', async () => {
    const ws = await run([
      parsedFile('/repo/Outer.cls', [
        def('n1', 'Class', 'Outer', '/repo/Outer.cls'),
        def('n6', 'Class', 'Outer.Inner', '/repo/Outer.cls'),
      ]),
    ]);
    expect(ws.get('outer')).toBeDefined();
    expect(ws.get('inner'), 'a bare Inner reference must never bind a nested type').toBeUndefined();
    expect(ws.get('outer.inner')).toBeUndefined();
  });

  it('excludes a def sourced from a .trigger file (a trigger is never a referenced type) (§3)', async () => {
    const ws = await run([
      parsedFile('/repo/T.trigger', [def('n7', 'Class', 'T', '/repo/T.trigger')]),
    ]);
    expect(ws.get('t')).toBeUndefined();
    expect(ws.size).toBe(0);
  });

  it('injects NOTHING for a folded key with >1 distinct nodeId — the inject-none collision guard (§3)', async () => {
    const ws = await run([
      parsedFile('/repo/DupOne.cls', [def('n8', 'Class', 'Dupe', '/repo/DupOne.cls')]),
      parsedFile('/repo/DupTwo.cls', [def('n9', 'Class', 'DUPE', '/repo/DupTwo.cls')]),
    ]);
    // The key is never created — no 2-binding Apex bucket can reach the host lookup.
    expect(ws.get('dupe')).toBeUndefined();
    expect(ws.size).toBe(0);
  });

  it('dedups a def seen twice by nodeId — still exactly one binding (§3 dedup-by-nodeId)', async () => {
    const d = def('n10', 'Class', 'Solo', '/repo/Solo.cls');
    const ws = await run([
      parsedFile('/repo/Solo.cls', [d, d]),
    ]);
    const bucket = ws.get('solo') as unknown[] | undefined;
    expect(bucket).toBeDefined();
    expect(bucket!.length, 'same nodeId is one def, not a collision').toBe(1);
  });

  it('folds case-variants of one simple name to the same global key (§2.2 seam composition)', async () => {
    const ws = await run([
      parsedFile('/repo/MyType.cls', [def('n11', 'Class', 'MyType', '/repo/MyType.cls')]),
    ]);
    expect(ws.get('mytype'), 'insert under the folded key').toBeDefined();
    expect(ws.get('MyType'), 'no exact-case duplicate entry').toBeUndefined();
  });
});
