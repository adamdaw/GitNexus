/**
 * Apex (Salesforce) — WI-2: resolution mechanics.
 *
 * Gate-3 acceptance suite for SDD-002 (.vsdd/SDD.md "# SDD-002" §8). Tests are
 * authored BEFORE the resolution implementation (VSDD Phase 3, TDD). The Apex
 * grammar is already vendored (WI-1, DONE), so these tests RUN and go RED: WI-1
 * emits container/member nodes but no resolution edges (callExtractor, the Ring-3
 * scope hooks, type-config and the normalizeIdentifier seam are unwired). Step 3b
 * wires them red->green. Peers stay green (the seam is identity for them).
 *
 * Acceptance boundary (SDD-002 §1/§8): every assertion is within a SINGLE
 * DECLARATION UNIT (one top-level type + its nested types). The inherently
 * cross-file epic §9 forms — top-level extends/implements, two-class calls,
 * cross-file chains — complete at WI-3 (REQ-010 enabler) and are NOT claimed here.
 *
 * Observability (the host mechanism SDD-002 §2 tagged [Gate-3 reliance], pinned
 * here at test-authoring time — validated against the real host at this gate):
 *   - resolved reference  -> a CALLS / ACCESSES / USES / EXTENDS / IMPLEMENTS edge
 *   - lookup MISS          -> edge ABSENCE only (ResolveStats.unresolved is logged,
 *                             not exposed on PipelineResult)
 *   - AMBIGUITY suppressed -> a positive record in result.resolutionOutcomes
 *                             ({ kind: 'suppressed', name, ... })
 * REQ-015's "recorded as unresolved" obligation is therefore observable as a
 * `suppressed` outcome ONLY for the ambiguous cases (case-only collision); plain
 * misses (absent member, unresolved receiver, external) are edge-absence only and
 * are documented as conservative-correctness guards in .vsdd/tdd/WI-2-red-gate.md.
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

// Resolution + structural edge types — the NFR-001 dangling check is scoped to
// these, excluding the downstream community-detection MEMBER_OF edges (a separate
// graph phase whose Community-node materialization is out of WI-2's scope).
const RESOLUTION_EDGE_TYPES = [
  'CALLS',
  'ACCESSES',
  'USES',
  'EXTENDS',
  'IMPLEMENTS',
  'HAS_METHOD',
  'HAS_PROPERTY',
  'DEFINES',
];

// ── REQ-005/006/007/009 — reference kinds, inheritance, chains, forward/self ──
describe.skipIf(!apexAvailable)('Apex resolution mechanics (REQ-005/006/007/009)', () => {
  let result: PipelineResult;

  beforeAll(async () => {
    result = await runPipelineFromRepo(path.join(FIXTURES, 'apex-resolution'), () => {});
  }, 120000);

  // REQ-005 — four reference kinds, each case-varied via the seam ───────────
  it('resolves a case-varied type usage (ACCOUNT a) — binds the variable type (REQ-005)', () => {
    // SDD-002 clarification (2026-06-30, Gate-3-reliance-found-false): the host emits
    // NO standalone USES edge for a plain declared type — no benchmark language does.
    // REQ-005 "type usage" resolution is exercised as the case-varied declared type
    // BINDING the variable's type, which is precisely what lets the case-varied member
    // access `a.NAME` (the ACCESSES assertion above) resolve. Asserting that effect is
    // the host-supported observable for type-usage resolution; a standalone USES edge
    // would exceed Java/Kotlin parity (REQ-012 scope).
    expect(
      getRelationships(result, 'ACCESSES').find((e) => e.target === 'name'),
      'the case-varied type usage ACCOUNT bound a -> resolves a.NAME',
    ).toBeDefined();
  });

  it('resolves a case-varied constructor (new account()) to the type via CALLS (REQ-005)', () => {
    expect(getRelationships(result, 'CALLS').find((e) => e.target === 'Account')).toBeDefined();
  });

  it('resolves a case-varied field/property access (a.NAME) via ACCESSES (REQ-005)', () => {
    expect(getRelationships(result, 'ACCESSES').find((e) => e.target === 'name')).toBeDefined();
  });

  it('resolves a case-varied method invocation (s.RUN()) via CALLS (REQ-005)', () => {
    expect(getRelationships(result, 'CALLS').find((e) => e.target === 'run')).toBeDefined();
  });

  // REQ-006 — no false unresolved record for references that resolve ─────────
  it('records no unresolved/suppressed outcome in an all-resolving unit (REQ-006)', () => {
    // Every reference in Refs/Calls resolves, so the suppressed set is empty.
    expect(suppressed(result)).toEqual([]);
  });

  // REQ-009 — per-segment field/property chain (a.b.c -> edge per access) ────
  it('resolves each segment of a property chain (i.leaf.value) via ACCESSES (REQ-009)', () => {
    const accesses = getRelationships(result, 'ACCESSES');
    expect(accesses.find((e) => e.target === 'leaf'), 'i.leaf').toBeDefined();
    expect(accesses.find((e) => e.target === 'value'), '(i.leaf).value').toBeDefined();
  });

  // REQ-005 — forward (out-of-order) + self/recursive reference ──────────────
  it('resolves a forward (out-of-source-order) reference (REQ-005, populate-then-resolve)', () => {
    expect(getRelationships(result, 'CALLS').find((e) => e.target === 'helper')).toBeDefined();
  });

  it('resolves a self/recursive reference (this.recurse()) to the enclosing type member (§4)', () => {
    expect(getRelationships(result, 'CALLS').find((e) => e.target === 'recurse')).toBeDefined();
  });

  // REQ-007 — nested-type extends/implements (the only in-unit inheritance) ──
  it('resolves nested-type class inheritance (Derived extends Base) via EXTENDS (REQ-007)', () => {
    expect(
      getRelationships(result, 'EXTENDS').find((e) => e.source === 'Derived' && e.target === 'Base'),
    ).toBeDefined();
  });

  it('resolves nested-type interface implementation (Impl implements Greeter) via IMPLEMENTS (REQ-007)', () => {
    expect(
      getRelationships(result, 'IMPLEMENTS').find(
        (e) => e.source === 'Impl' && e.target === 'Greeter',
      ),
    ).toBeDefined();
  });

  // REQ-005 delegation sub-clause — this()/super()/super.method() ────────────
  it('resolves BOTH constructor delegations this() and super() via CALLS (REQ-005)', () => {
    // this() in Base(Integer) -> Base(); super() in Derived() -> Base(). Both target the Base ctor,
    // so a single existence check would green if only one resolved — require both delegation sites.
    expect(
      getRelationships(result, 'CALLS').filter((e) => e.target === 'Base').length,
      'both this() and super() resolve',
    ).toBeGreaterThanOrEqual(2);
  });

  it('resolves a super.method() call (super.greet()) to the PARENT member, not the override (REQ-005)', () => {
    // Inh declares three greet nodes (Base.greet, Derived.greet — the caller, Greeter.greet), so a bare
    // target==='greet' check greens on a mis-bind to the self/override. Pin the resolved target to Base.
    const greetCall = getRelationships(result, 'CALLS').find((e) => e.target === 'greet');
    expect(greetCall, 'super.greet() resolves').toBeDefined();
    expect(greetCall!.rel.targetId, 'targets Base.greet, not Derived.greet').toContain('Base');
  });

  // REQ-009 §4 — cyclic type chain terminates (bounded fixpoint), no hang/throw
  it('terminates on a cyclic self-type chain and resolves the first segment (REQ-009/§4)', () => {
    // The 120s test timeout enforces "no hang"; the first n.self must still resolve.
    expect(result).toBeDefined();
    expect(getRelationships(result, 'ACCESSES').find((e) => e.target === 'self')).toBeDefined();
  });

  it('leaves no dangling resolution edges', () => {
    expect(findDanglingEdges(result)).toEqual([]);
  });
});

// ── REQ-008 — overload resolution (arity, then exact type; no assignability) ─
describe.skipIf(!apexAvailable)('Apex overload resolution (REQ-008)', () => {
  let result: PipelineResult;

  beforeAll(async () => {
    result = await runPipelineFromRepo(path.join(FIXTURES, 'apex-overload-resolution'), () => {});
  }, 120000);

  it('(i) resolves an exact-type overload f(Integer) over f(String) (REQ-008)', () => {
    const fCalls = getRelationships(result, 'CALLS').filter((e) => e.target === 'f');
    // Two f overloads exist (Integer/String); the Over.cls call site f(x:Integer) binds exactly one.
    const overFromOver = fCalls.filter((e) => e.rel.targetId.includes('Integer'));
    expect(overFromOver.length, 'f(Integer) resolved').toBeGreaterThanOrEqual(1);
    expect(
      fCalls.find((e) => e.rel.targetId.includes('String') && !e.rel.targetId.includes('Integer')),
      'must not bind f(String)',
    ).toBeUndefined();
  });

  it('(i-fold) resolves a competing same-arity overload f(Account) via the param-type case-fold (REQ-008)', () => {
    // OverFold: f(Account)/f(Contact), argument statically typed ACCOUNT (case-varied) -> f(Account).
    const fCalls = getRelationships(result, 'CALLS').filter((e) => e.target === 'f');
    expect(
      fCalls.find((e) => e.rel.targetId.includes('Account')),
      'f(Account) resolved via case-fold',
    ).toBeDefined();
    expect(
      fCalls.find((e) => e.rel.targetId.includes('Contact')),
      'must not bind f(Contact)',
    ).toBeUndefined();
  });

  it('(ii) resolves an assignable argument to the arity-1 overload, not the 2-param one (REQ-008)', () => {
    // OverArity: g(Base)/g(Base,Integer); g(s:Sub) has arity 1 -> resolves to g(Base). Assert the
    // resolved target is the arity-1 overload (id scheme owner+name+#arity, SDD-001 §2 / ids.ts:180),
    // so the test fails if a 1-arg call mis-binds to g(Base,Integer).
    const gCalls = getRelationships(result, 'CALLS').filter((e) => e.target === 'g');
    expect(gCalls.length).toBe(1);
    expect(gCalls[0]?.rel.targetId, 'binds g(Base) #1').toContain('#1');
    expect(gCalls[0]?.rel.targetId, 'must not bind g(Base,Integer) #2').not.toContain('#2');
  });

  it('(iv) resolves a multi-parameter overload identical at every position (REQ-008)', () => {
    // Over: m(Integer,String)/m(String,Integer). callMulti m(Integer,String) resolves; callMultiNeg
    // m(Integer,Boolean) matches neither overload at every position -> unresolved. So exactly one m binds.
    const mCalls = getRelationships(result, 'CALLS').filter((e) => e.target === 'm');
    expect(mCalls.length, 'exactly the all-positions-identical call resolves').toBe(1);
    expect(/Integer[\s\S]*String/.test(mCalls[0]?.rel.targetId ?? ''), 'binds m(Integer,String)').toBe(
      true,
    );
  });

  it('(iii) leaves a genuinely-undisambiguable assignable overload unresolved (REQ-008 -> REQ-015)', () => {
    // OverUndis: h(Base)/h(Other), h(s:Sub) assignable to Base but identical to neither -> no exact
    // match -> no edge. [conservative-negative; see .vsdd/tdd/WI-2-red-gate.md]
    expect(getRelationships(result, 'CALLS').filter((e) => e.target === 'h').length).toBe(0);
  });

  it('leaves an overload disambiguable only by an external arg type unresolved (REQ-008 §4 -> REQ-015)', () => {
    // OverExternalArg: k(Account)/k(Contact), arg statically typed external Account -> no user-defined
    // exact-type match -> unresolved, no throw. [conservative-negative; see WI-2-red-gate.md]
    expect(result).toBeDefined();
    expect(getRelationships(result, 'CALLS').filter((e) => e.target === 'k').length).toBe(0);
  });

  it('records no false unresolved/suppressed outcome for the resolving overload cases (REQ-006)', () => {
    // SDD-002 §8: the resolving overload references emit no unresolved record. Scope to the names that
    // resolve at EVERY call site — `f` (Over (i) + OverFold (i-fold)) and `g` (OverArity (ii)). `m` is
    // excluded (its callMultiNeg site legitimately misses) and the undisambiguable `h`/`k` cases are
    // REQ-015 references the host MAY record via an `overload-ambiguous` outcome — so a global
    // empty-set assertion would wrongly forbid REQ-015 obligation-2.
    const resolvingNames = new Set(['f', 'g']);
    expect(suppressed(result).filter((o) => resolvingNames.has(o.name))).toEqual([]);
  });
});

// ── REQ-015 — conservative skip of ambiguous / unresolvable references ───────
describe.skipIf(!apexAvailable)('Apex conservative resolution (REQ-015)', () => {
  let result: PipelineResult;

  beforeAll(async () => {
    result = await runPipelineFromRepo(path.join(FIXTURES, 'apex-unresolved'), () => {});
  }, 120000);

  it('leaves a case-only collision unresolved AND records it (REQ-015 two obligations)', () => {
    // CaseCollide: b.Value matches both `value` and `VALUE` case-insensitively -> ambiguous.
    const accesses = getRelationships(result, 'ACCESSES');
    expect(
      accesses.filter((e) => e.target === 'value' || e.target === 'VALUE').length,
      'obligation 1: no binding edge',
    ).toBe(0);
    // obligation 2: recorded as unresolved — bind the `suppressed` ResolutionOutcome to THIS reference
    // (b.Value -> the case-collision member `value`), so it cannot green on an unrelated suppression.
    expect(
      suppressed(result).some((o) => o.name.toLowerCase() === 'value'),
      'obligation 2: the b.Value reference is recorded unresolved',
    ).toBe(true);
  });

  it('resolves a present member but leaves an absent member unresolved (REQ-015 no-match)', () => {
    const calls = getRelationships(result, 'CALLS');
    // anchor (genuinely red until resolution is wired): the present member resolves.
    expect(calls.find((e) => e.target === 'real'), 't.real() resolves').toBeDefined();
    // absent member: no edge [conservative-negative; see WI-2-red-gate.md].
    expect(calls.filter((e) => e.target === 'missing').length, 't.missing() unresolved').toBe(0);
  });

  it('emits no edge for a call on an unresolved receiver type, without crashing (REQ-015/NFR-001)', () => {
    // [conservative-negative; see WI-2-red-gate.md] — value is no-throw + no mis-binding.
    expect(result).toBeDefined();
    expect(getRelationships(result, 'CALLS').filter((e) => e.target === 'foo').length).toBe(0);
  });

  it('treats an external (stdlib) reference as unresolved, not an Apex defect, without crashing (§4)', () => {
    // [conservative-negative; see WI-2-red-gate.md] — System.debug stays unresolved, run completes.
    expect(result).toBeDefined();
    expect(getRelationships(result, 'CALLS').filter((e) => e.target === 'debug').length).toBe(0);
  });
});

// ── NFR-001 (resolution-stage slice) — no crash on malformed / skipped files ─
describe.skipIf(!apexAvailable)('Apex resolution crash-safety (NFR-001 slice)', () => {
  let result: PipelineResult;

  beforeAll(async () => {
    result = await runPipelineFromRepo(path.join(FIXTURES, 'apex-resolution-malformed'), () => {});
  }, 120000);

  it('completes the run and resolves the valid unit despite a malformed sibling file', () => {
    expect(result).toBeDefined();
    // anchor (genuinely red until resolution is wired): the valid intra-unit call resolves.
    expect(getRelationships(result, 'CALLS').find((e) => e.target === 'help')).toBeDefined();
  });

  it('leaves a reference into the malformed/cross-file sibling unresolved, with no dangling edges', () => {
    // new Broken() is cross-file (separate top-level type) -> unresolved in WI-2 (the cross-file enabler
    // is WI-3); the malformed parse must not crash resolution. [conservative-negative on the no-bind half]
    expect(getRelationships(result, 'CALLS').filter((e) => e.target === 'Broken').length).toBe(0);
    expect(findDanglingEdges(result, RESOLUTION_EDGE_TYPES)).toEqual([]);
  });

  it('completes the run on empty and whitespace-only units without crashing (§4 null/empty)', () => {
    // Empty.cls (0 bytes) + Whitespace.cls sit beside the valid unit; resolution still completes.
    // [conservative-negative; no-crash is the value — see WI-2-red-gate.md]
    expect(result).toBeDefined();
  });

  it('conservatively skips a reference inside a malformed (error-recovery) unit, no throw (§4)', () => {
    // PartialRef.cls: x.d( is in an unterminated region -> skipped, no throw, no dangling edge. The
    // valid help() anchor (above) proves resolution still runs. [conservative-negative on the skip half]
    expect(result).toBeDefined();
    expect(findDanglingEdges(result, RESOLUTION_EDGE_TYPES)).toEqual([]);
  });
});
