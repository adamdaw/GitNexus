/**
 * Apex (Salesforce) — WI-4: parity hardening & external handling.
 *
 * Gate-3 acceptance suite for SDD-004 (.vsdd/SDD.md "# SDD-004" §8). Tests are
 * authored BEFORE the WI-4 implementation (VSDD Phase 3, TDD). WI-1/2/3 are DONE
 * and green, so these tests RUN. The genuinely-new WI-4 behaviours go RED until the
 * pipeline reorder + nested-aware heritage-base seam + parameter-arg narrowing gate
 * + receiver-variable case-fold ship:
 *   - REQ-008 parameter-typed-argument narrowing (the WI-2-deferred sub-case);
 *   - the receiver-VARIABLE case-fold (§1(4));
 *   - the case-varied cross-file heritage cycle now formable (NFR-001 no-hang).
 * The BL-1…BL-8 heritage-limitation discharge fixtures are FLIPPED in place in
 * apex-cross-file.test.ts (SDD-004 §8 "flip from documented-limitation pins to
 * correct-resolution"); the BL-10 heritage-arm fixture is added to the collision
 * block there. Peers stay green (both WI-4 shared edits are provider-gated/hooked —
 * NFR-002, Gate-4-measured).
 *
 * Already-green anchors (no-red justification, WI-4-red-gate.md): the REQ-012 parity
 * cross-file call/ctor/field/extends/implements shapes already resolve via WI-3's
 * REQ-010 enabler — they are re-asserted here as the NFR-004 aggregate parity
 * evidence (REQ-012 leg), not as newly-red behaviour. The bare-declared-type
 * no-standalone-edge arm and the external no-edge/no-defect arm are host-default
 * behaviours pinned as parity evidence.
 *
 * Observability (unchanged from WI-2/WI-3):
 *   - resolved reference  -> a CALLS / ACCESSES / EXTENDS / IMPLEMENTS edge
 *   - lookup MISS          -> edge ABSENCE only
 *   - AMBIGUITY suppressed -> a { kind: 'suppressed', name } resolutionOutcome
 */
import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import {
  FIXTURES,
  getRelationships,
  getResolutionOutcomes,
  findDanglingEdges,
  runPipelineFromRepo,
  type PipelineResult,
} from './helpers.js';
import { isLanguageAvailable } from '../../../src/core/tree-sitter/parser-loader.js';
import { SupportedLanguages } from '../../../src/config/supported-languages.js';

const APEX = 'apex' as SupportedLanguages;

let apexAvailable = false;
try {
  apexAvailable = isLanguageAvailable(APEX);
} catch {
  apexAvailable = false;
}

const suppressed = (result: PipelineResult) =>
  getResolutionOutcomes(result).filter((o) => o.kind === 'suppressed');

const RESOLUTION_EDGE_TYPES = [
  'CALLS',
  'ACCESSES',
  'EXTENDS',
  'IMPLEMENTS',
  'HAS_METHOD',
  'HAS_PROPERTY',
  'DEFINES',
];

// ── REQ-008 completion — parameter-typed-argument narrowing (WI-2-deferred) ───
describe.skipIf(!apexAvailable)('Apex parameter-typed-argument narrowing (REQ-008 completion, SDD-004 §2/§8)', () => {
  let result: PipelineResult;

  beforeAll(async () => {
    result = await runPipelineFromRepo(path.join(FIXTURES, 'apex-param-arg'), () => {});
  }, 120000);

  it('narrows a cross-file overload by a USER-DEFINED top-level parameter type (b.f(p:Widget)) to f(Widget) (REQ-008)', () => {
    // §1(3)(a): the oracle recognizes Widget via workspaceFqnBindings folded membership -> narrows.
    // RED until WI-4 gates resolveVarTypeBindings on the oracle.
    const f = getRelationships(result, 'CALLS').find(
      (e) => e.target === 'f' && e.sourceFilePath.includes('ParamUserCaller'),
    );
    expect(f, 'b.f(p) narrows to an overload').toBeDefined();
    expect(f!.rel.targetId, 'f(Widget), the user-defined param type').toContain('Widget');
    expect(f!.rel.targetId, 'never f(String)').not.toContain('String');
  });

  it('leaves an EXTERNAL-typed parameter argument (b.f(s:String)) arity-only -> unresolved, never mis-bound (REQ-008 conservative)', () => {
    // §1(3)/§2 conservative arm: String is external -> no unique user-defined resolution -> narrowing
    // skipped -> two arity-1 overloads survive -> ambiguous -> no binding edge (never f(Widget)).
    expect(
      getRelationships(result, 'CALLS').filter(
        (e) => e.target === 'f' && e.sourceFilePath.includes('ParamExtCaller'),
      ),
      'no binding edge for the external-typed parameter arg',
    ).toEqual([]);
  });

  it('narrows by a DOTTED nested parameter type (b.g(p:NOuter.NInner)) to g(NOuter.NInner), never the same-tail decoy (REQ-008)', () => {
    // §1(3)(b): the inc-11 OUTER-first nested lookup resolves the dotted param type to the NESTED
    // NInner (decoy-safe — a mis-resolution to the top-level decoy NInner would not exact-match the
    // g(NOuter.NInner) overload, so it would fall to arity-only ambiguity). RED until WI-4.
    const g = getRelationships(result, 'CALLS').find(
      (e) => e.target === 'g' && e.sourceFilePath.includes('NestedParamCaller'),
    );
    expect(g, 'b.g(p) narrows to the nested-typed overload').toBeDefined();
    expect(g!.rel.targetId, 'the nested NOuter.NInner overload, not g(String)').not.toContain(
      'String',
    );
  });

  it('narrows by a SIMPLE-name nested parameter type referenced from within its enclosing class (NOuter.callInnerFromEnclosing(p:NInner)) (REQ-008 §1(3)(c))', () => {
    // §1(3)(c): the enclosing-scope owned-def lookup binds the unqualified NInner param type ->
    // narrows g(NOuter.NInner). [Gate-3 reliance] arm. RED until WI-4.
    const g = getRelationships(result, 'CALLS').find(
      (e) => e.target === 'g' && e.sourceFilePath.includes('NOuter'),
    );
    expect(g, 'the enclosing-scope nested param narrows').toBeDefined();
    expect(g!.rel.targetId, 'the nested overload, not g(String)').not.toContain('String');
  });

  it('records no false unresolved/suppressed outcome for the resolving parameter-arg cases (REQ-006)', () => {
    // The user-defined narrowing cases resolve, so `f`/`g` from the resolving callers emit no
    // suppressed record. (The external ParamExtCaller case is a conservative arity-only miss —
    // edge-absence, not a suppressed record.)
    const resolvingSites = getRelationships(result, 'CALLS').filter(
      (e) =>
        (e.target === 'f' && e.sourceFilePath.includes('ParamUserCaller')) ||
        (e.target === 'g' &&
          (e.sourceFilePath.includes('NestedParamCaller') || e.sourceFilePath.includes('NOuter'))),
    );
    // anchor: at least the three user-defined narrowing sites resolve (red until WI-4)
    expect(resolvingSites.length, 'the three user-defined narrowing sites resolve').toBe(3);
  });

  it('leaves no dangling resolution edges', () => {
    expect(findDanglingEdges(result, RESOLUTION_EDGE_TYPES)).toEqual([]);
  });
});

// ── REQ-013 — external references are benign, not defects ─────────────────────
describe.skipIf(!apexAvailable)('Apex external-reference handling (REQ-013, SDD-004 §2/§8)', () => {
  let result: PipelineResult;

  beforeAll(async () => {
    result = await runPipelineFromRepo(path.join(FIXTURES, 'apex-external'), () => {});
  }, 120000);

  it('emits NO edge for stdlib / sObject / managed-package references (System.debug, new Account(), a.Name, ExtNs.Svc.ping)', () => {
    // The host default on any unresolved reference: no edge (SDD-004 §2, finding 6).
    // [conservative-negative; see WI-4-red-gate.md] — anchored by the run-completes assertion below.
    expect(getRelationships(result, 'CALLS').filter((e) => e.target === 'debug'), 'no System.debug edge').toEqual([]);
    expect(getRelationships(result, 'CALLS').filter((e) => e.target === 'ping'), 'no ExtNs.Svc.ping edge').toEqual([]);
    expect(getRelationships(result, 'CALLS').filter((e) => e.target === 'Account'), 'no external sObject ctor edge').toEqual([]);
    expect(getRelationships(result, 'ACCESSES').filter((e) => e.target === 'Name'), 'no sObject field edge').toEqual([]);
  });

  it('records NO unresolved *defect* for the external references (REQ-013 observable acceptance)', () => {
    // REQ-013's observable acceptance is "no Apex-specific defect": a miss is not a defect, so no
    // suppressed resolutionOutcome names these external references.
    const externalNames = new Set(['debug', 'ping', 'Account', 'Name', 'System', 'ExtNs', 'Svc']);
    expect(
      suppressed(result).filter((o) => externalNames.has(o.name)),
      'no unresolved defect for external references',
    ).toEqual([]);
  });

  it('completes the run despite the external references, with no dangling edges (NFR-001)', () => {
    expect(result).toBeDefined();
    expect(findDanglingEdges(result, RESOLUTION_EDGE_TYPES)).toEqual([]);
  });
});

// ── REQ-012 / NFR-004 parity + bare-decl no-edge + implements + receiver-var ──
describe.skipIf(!apexAvailable)('Apex resolution parity (REQ-012 / NFR-004, SDD-004 §2/§8)', () => {
  let result: PipelineResult;

  beforeAll(async () => {
    result = await runPipelineFromRepo(path.join(FIXTURES, 'apex-parity'), () => {});
  }, 120000);

  // Peer-equivalent resolution shapes (already-green anchors via WI-3's REQ-010 enabler;
  // re-asserted as the REQ-012 parity leg of the NFR-004 aggregate — no-red justification).
  it('resolves a cross-file method call at Java/Kotlin tier (e.start()) via CALLS (REQ-012)', () => {
    expect(
      getRelationships(result, 'CALLS').find(
        (e) => e.target === 'start' && e.sourceFilePath.includes('PApp'),
      ),
    ).toBeDefined();
  });

  it('resolves a cross-file constructor at parity (new PEngine()) via CALLS (REQ-012)', () => {
    expect(
      getRelationships(result, 'CALLS').find(
        (e) => e.target === 'PEngine' && e.sourceFilePath.includes('PApp'),
      ),
    ).toBeDefined();
  });

  it('resolves a cross-file field access at parity (held.label) via ACCESSES (REQ-012/REQ-009)', () => {
    expect(
      getRelationships(result, 'ACCESSES').find(
        (e) => e.target === 'label' && e.targetFilePath.includes('PEngine'),
      ),
    ).toBeDefined();
  });

  it('resolves cross-file class inheritance at parity (PDerived extends PBase) via EXTENDS (REQ-012/REQ-007)', () => {
    expect(
      getRelationships(result, 'EXTENDS').find(
        (e) => e.source === 'PDerived' && e.target === 'PBase',
      ),
    ).toBeDefined();
  });

  it('resolves an EXACT-CASE cross-file interface implementation at parity (PApp implements PIface) via IMPLEMENTS (REQ-012/REQ-007)', () => {
    // The exact-case cross-file `implements` parity fixture (SDD-004 §8) — the symmetric counterpart
    // of the case-varied `implements` discharged within BL-1 (CaseKid, apex-cross-file.test.ts).
    expect(
      getRelationships(result, 'IMPLEMENTS').find(
        (e) => e.source === 'PApp' && e.target === 'PIface',
      ),
    ).toBeDefined();
  });

  it('emits NO standalone edge for a bare declared-type usage (PEngine held) — REQ-012 no-edge arm (REQ-005/REQ-011 v1.3/v1.4)', () => {
    // The binding enables held.label (asserted above) but emits no standalone USES edge — parity
    // with Java/Kotlin, which emit none for a bare declaration. [conservative-negative]
    expect(getRelationships(result, 'USES').filter((e) => e.target === 'PEngine')).toEqual([]);
  });

  it('folds a case-varied receiver VARIABLE name (Widget a; A.foo()) to its declaration -> Widget.foo (WI-4 §1(4) hardening)', () => {
    // The receiver-variable case-fold: `A` refers to the local variable `a` (Widget-typed), so
    // A.foo() resolves Widget.foo. Apex-local case-insensitivity completeness (no governing
    // SHALL/parity/NFR-004 — a defensive hardening fixture). RED until WI-4 folds the receiver var.
    const foo = getRelationships(result, 'CALLS').find(
      (e) => e.target === 'foo' && e.sourceFilePath.includes('PApp'),
    );
    expect(foo, 'A.foo() resolves via the receiver-variable fold').toBeDefined();
    expect(foo!.targetFilePath, 'targets Widget.foo').toContain('Widget.cls');
  });

  it('records no unresolved/suppressed outcome for the resolving parity references (REQ-006)', () => {
    const resolvingNames = new Set(['start', 'PEngine', 'label', 'PBase', 'PIface', 'foo']);
    expect(suppressed(result).filter((o) => resolvingNames.has(o.name))).toEqual([]);
  });

  it('leaves no dangling resolution edges', () => {
    expect(findDanglingEdges(result, RESOLUTION_EDGE_TYPES)).toEqual([]);
  });
});

// ── NFR-001 — case-varied cross-file heritage cycle: bounded, no hang ─────────
describe.skipIf(!apexAvailable)('Apex cross-file heritage cycle (NFR-001, SDD-004 §4/§6)', () => {
  let result: PipelineResult;

  beforeAll(async () => {
    result = await runPipelineFromRepo(path.join(FIXTURES, 'apex-heritage-cycle'), () => {});
  }, 120000);

  it('resolves both case-varied cross-file heritage arms and TERMINATES (buildMro cap bounds the cycle)', () => {
    // The 120s timeout enforces "no hang" on the newly-formable case-varied cross-file cycle.
    // Both EXTENDS arms resolve (RED until the reorder resolves case-varied cross-file bases);
    // buildMro's existing bounded-iteration cap must terminate the cycle without hanging.
    expect(result).toBeDefined();
    const exts = getRelationships(result, 'EXTENDS');
    expect(
      exts.find((e) => e.source === 'CycloneA' && e.target === 'CycloneB'),
      'CycloneA extends CYCLONEB resolves (case-varied, folded)',
    ).toBeDefined();
    expect(
      exts.find((e) => e.source === 'CycloneB' && e.target === 'CycloneA'),
      'CycloneB extends CYCLONEA resolves (case-varied, folded)',
    ).toBeDefined();
  });

  it('leaves no dangling resolution edges', () => {
    expect(findDanglingEdges(result, RESOLUTION_EDGE_TYPES)).toEqual([]);
  });
});
