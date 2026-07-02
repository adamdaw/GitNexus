/**
 * Apex (Salesforce) — WI-3: cross-file binding & trigger resolution.
 *
 * Gate-3 acceptance suite for SDD-003 (.vsdd/SDD.md "# SDD-003" §8). Tests are
 * authored BEFORE the cross-file implementation (VSDD Phase 3, TDD). WI-1 (parse)
 * and WI-2 (resolution mechanics) are DONE and green, so these tests RUN and the
 * cross-file positives go RED: the Apex resolver registers no
 * `populateNamespaceSiblings` hook yet, so `workspaceFqnBindings` holds no Apex
 * entries and every cross-file lookup misses. Step 3b registers the hook (plus
 * committed fallbacks ONLY where their fixture stays red) red→green. Peers stay
 * green (NFR-002 — the hook is Apex-only).
 *
 * Acceptance boundary (SDD-003 §1/§8): every fixture is MULTI-FILE — ≥2 top-level
 * types in separate files (and a trigger file). These complete the epic §9
 * cross-file forms WI-2 verified only same-unit; WI-3 adds no resolution
 * algorithm, only the REQ-010 enabler + REQ-011 trigger resolution.
 *
 * Observability (pinned at WI-2 Gate 3, unchanged here):
 *   - resolved reference  -> a CALLS / ACCESSES / EXTENDS / IMPLEMENTS edge
 *     (bare declared-type usage resolves as a BINDING, not a standalone edge —
 *      REQ-005 v1.3 / REQ-011 v1.4; observable via the member access it enables)
 *   - lookup MISS          -> edge ABSENCE only (ResolveStats.unresolved is logged,
 *                             not exposed on PipelineResult)
 *   - AMBIGUITY suppressed -> a positive record in result.resolutionOutcomes
 *                             ({ kind: 'suppressed', name, ... })
 * The §3 collision guard injects NOTHING for a colliding folded key, so the
 * cross-file duplicate case surfaces to the host as a plain MISS (edge absence),
 * not a suppressed record — the REQ-015 "recorded" obligation for that case is
 * documented as a conservative-negative in .vsdd/tdd/WI-3-red-gate.md (mirroring
 * the WI-2 discipline). The overload-ambiguous case (equal-arity candidates
 * surviving) IS recorded via a `suppressed` outcome, as validated at WI-2.
 *
 * TWO HOST CHANNELS (SDD-003 §1, validated 2026-07-02, Architect-accepted): the
 * pre-existing exact-case first-match workspace fallback (workspace-index /
 * findExportedDefByName + the heritage pass) already resolves cross-file ctor,
 * top-level extends/implements, super-delegation, and static type-name-receiver
 * Property access with NO WI-3 code — those acceptance tests are ALREADY-GREEN
 * with committed no-red justifications in WI-3-red-gate.md. Everything routed
 * through the bindings channel (instance receivers, case-folding, enum constants,
 * overloads, nested types, trigger instance receivers) is genuinely RED.
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

// Same scoping as the WI-2 suite: the NFR-001 dangling check excludes the
// downstream community-detection MEMBER_OF edges (a separate graph phase).
const RESOLUTION_EDGE_TYPES = [
  'CALLS',
  'ACCESSES',
  'EXTENDS',
  'IMPLEMENTS',
  'HAS_METHOD',
  'HAS_PROPERTY',
  'DEFINES',
];

// ── REQ-010 — the cross-file enabler, completing WI-2's §9 forms ─────────────
describe.skipIf(!apexAvailable)('Apex cross-file binding (REQ-010, SDD-003 §8)', () => {
  let result: PipelineResult;

  beforeAll(async () => {
    result = await runPipelineFromRepo(path.join(FIXTURES, 'apex-cross-file'), () => {});
  }, 120000);

  // two-class call (REQ-005 cross-file form) ─────────────────────────────────
  it('resolves a two-class cross-file method call (e.start()) via CALLS (REQ-010/REQ-005)', () => {
    const call = getRelationships(result, 'CALLS').find(
      (e) => e.target === 'start' && e.targetFilePath.includes('Engine'),
    );
    expect(call, 'App.run -> Engine.start across files').toBeDefined();
  });

  it('resolves a cross-file constructor (new Engine()) to the type via CALLS (REQ-010/REQ-005)', () => {
    expect(
      getRelationships(result, 'CALLS').find(
        (e) => e.target === 'Engine' && e.sourceFilePath.includes('App'),
      ),
    ).toBeDefined();
  });

  // bare declared-type usage binds — no standalone edge (REQ-005 v1.3) ───────
  it('binds a cross-file bare declared-type usage (Engine held) — observable via held.label → ACCESSES (REQ-010)', () => {
    expect(
      getRelationships(result, 'ACCESSES').find(
        (e) => e.target === 'label' && e.targetFilePath.includes('Engine'),
      ),
      'the binding enables the member access',
    ).toBeDefined();
    // the binding itself emits NO standalone edge (REQ-005 v1.3 parity)
    expect(
      getRelationships(result, 'USES').filter((e) => e.target === 'Engine'),
    ).toEqual([]);
  });

  // cross-file chain (REQ-009 cross-file form) ────────────────────────────────
  it('resolves each segment of a cross-file property chain (h.leaf.value) via ACCESSES (REQ-009)', () => {
    const accesses = getRelationships(result, 'ACCESSES');
    expect(
      accesses.find((e) => e.target === 'leaf' && e.targetFilePath.includes('Holder')),
      'h.leaf (declared on Holder)',
    ).toBeDefined();
    expect(
      accesses.find((e) => e.target === 'value' && e.targetFilePath.includes('Leaf')),
      '(h.leaf).value (declared on Leaf)',
    ).toBeDefined();
  });

  // top-level inheritance (REQ-007 cross-file form) ───────────────────────────
  it('resolves top-level class inheritance (Derived extends Base) across files via EXTENDS (REQ-007)', () => {
    expect(
      getRelationships(result, 'EXTENDS').find(
        (e) => e.source === 'Derived' && e.target === 'Base',
      ),
    ).toBeDefined();
  });

  it('resolves top-level interface implementation (Derived implements Iface) across files via IMPLEMENTS (REQ-007)', () => {
    expect(
      getRelationships(result, 'IMPLEMENTS').find(
        (e) => e.source === 'Derived' && e.target === 'Iface',
      ),
    ).toBeDefined();
  });

  it('resolves top-level interface-extends-interface (SubIface extends Iface) via IMPLEMENTS (REQ-007 parity)', () => {
    // The host's edge-label selection on target kind (the REQ-012-parity behaviour
    // SDD-002 established) — a [Gate-3 reliance], validated here for the cross-file source.
    expect(
      getRelationships(result, 'IMPLEMENTS').find(
        (e) => e.source === 'SubIface' && e.target === 'Iface',
      ),
    ).toBeDefined();
  });

  // top-level-parent super delegation (REQ-005 sub-clause, cross-file form) ───
  it('resolves super() to a top-level parent constructor in another file via CALLS (REQ-005)', () => {
    expect(
      getRelationships(result, 'CALLS').find(
        (e) => e.target === 'Base' && e.sourceFilePath.includes('Derived'),
      ),
      'Derived() super() -> Base()',
    ).toBeDefined();
  });

  it('resolves super.greet() to the PARENT member in another file, not the override (REQ-005)', () => {
    // Derived.greet overrides Base.greet; a bare target==='greet' check would green
    // on a self/override mis-bind. Pin the resolved target to the Base file.
    const greetCall = getRelationships(result, 'CALLS').find(
      (e) => e.target === 'greet' && e.sourceFilePath.includes('Derived'),
    );
    expect(greetCall, 'super.greet() resolves').toBeDefined();
    expect(greetCall!.rel.targetId, 'targets Base.greet across files').toContain('Base');
  });

  // cross-file inherited member (REQ-005/007 ∘ member lookup) ────────────────
  it('resolves a member declared on a cross-file parent (c.inherited() via Child extends Base) (REQ-005/007)', () => {
    const call = getRelationships(result, 'CALLS').find(
      (e) => e.target === 'inherited' && e.targetFilePath.includes('Base'),
    );
    expect(call, 'the MRO walks the cross-file parent').toBeDefined();
  });

  it('resolves an implicit-this inherited member (inherited() inside Child) to the cross-file parent (REQ-005/007)', () => {
    // The unqualified own-scope-MRO form — a materially different path from the
    // typed-receiver form asserted above (§8 names both).
    const call = getRelationships(result, 'CALLS').find(
      (e) => e.target === 'inherited' && e.sourceFilePath.includes('Child.cls'),
    );
    expect(call, 'callUp() -> Base.inherited across files').toBeDefined();
    expect(call!.targetFilePath, 'declared on the cross-file parent').toContain('Base');
  });

  // case-varied cross-file (§2.2 seam ∘ REQ-010) ─────────────────────────────
  it('resolves a case-varied cross-file reference (ENGINE e; e.STOP()) via the folded global key (REQ-010)', () => {
    expect(
      getRelationships(result, 'CALLS').find((e) => e.target === 'stop'),
    ).toBeDefined();
  });

  it('resolves a CASE-VARIED cross-file constructor (new ENGINE()) via the folded key (REQ-010/§7(11))', () => {
    // The ctor callsite-folding reliance: red until the injection lands AND the free-call
    // path reaches the folded workspace key.
    expect(
      getRelationships(result, 'CALLS').find(
        (e) => e.target === 'Engine' && e.sourceFilePath.includes('CaseRef'),
      ),
    ).toBeDefined();
  });

  it('leaves CASE-VARIED heritage (CaseKid extends BASE implements IFACE) unresolved — SRS v1.8(i) limitation', () => {
    // The heritage pre-emit pass runs BEFORE the hook and suppresses retry (Addendum 9):
    // the workspace keys are unreachable for heritage clauses, so the case-varied forms
    // stay unresolved — ratified valid-source liveness limitation, pinned here.
    // [conservative pin — green pre- and post-impl; see WI-3-red-gate.md]
    expect(
      getRelationships(result, 'EXTENDS').filter((e) => e.source === 'CaseKid'),
    ).toEqual([]);
    expect(
      getRelationships(result, 'IMPLEMENTS').filter((e) => e.source === 'CaseKid'),
    ).toEqual([]);
  });

  // nested-type qualified access (REQ-010 SHALL) ─────────────────────────────
  it('resolves qualified nested-type access (Outer.Inner from another file) — i.ping() via CALLS (REQ-010)', () => {
    expect(
      getRelationships(result, 'CALLS').find(
        (e) => e.target === 'ping' && e.sourceFilePath.includes('NestedCaller'),
      ),
    ).toBeDefined();
  });

  it('resolves CASE-VARIED qualified nested access (OUTER.Inner → c.ping()) via the folded outer key (REQ-010)', () => {
    // The case-varied completion of the nested-qualified form (§8): OUTER must reach
    // Outer's folded workspace key before .Inner member lookup can run.
    expect(
      getRelationships(result, 'CALLS').find(
        (e) => e.target === 'ping' && e.sourceFilePath.includes('CaseNested'),
      ),
    ).toBeDefined();
  });

  it('keeps a valid nested/top-level name share collision-free — h.assist() still resolves (§4)', () => {
    // Outer declares a NESTED class Helper; Utils.cls declares the top-level class Helper.
    // The owning-scope discriminant selects only the top-level def, so no false collision
    // strips it of REQ-010 (this strengthens the misfiled-type test above: with the v1
    // qualifiedName discriminant this fixture WOULD collide, since the nested def's
    // resolution-side qualifiedName is bare — Addendum 7).
    expect(
      getRelationships(result, 'CALLS').find(
        (e) => e.target === 'assist' && e.targetFilePath.includes('Utils'),
      ),
    ).toBeDefined();
    // and the nested Helper's member is never bound from the misfile caller
    expect(
      getRelationships(result, 'CALLS').filter(
        (e) => e.target === 'fake' && e.sourceFilePath.includes('MisfileCaller'),
      ),
    ).toEqual([]);
  });

  it('resolves TAIL-VARIED qualified nested access (Outer.INNER → d.ping()) via the folded member segment (REQ-010/§7(5))', () => {
    // The third case dimension of the qualified form: the outer is exact-case, the member
    // segment case-varied — rides §7(5)'s fold-extended nested-member fallback.
    expect(
      getRelationships(result, 'CALLS').find(
        (e) => e.target === 'ping' && e.sourceFilePath.includes('TailCase'),
      ),
    ).toBeDefined();
  });

  it('leaves nested-parent heritage (NestSub extends Outer.Inner) unresolved — SRS v1.10(iii) limitation', () => {
    // The pre-hook heritage pass cannot reach the nested parent (bare-keyed index, no
    // injection interception — Addendum 11). Pinned limitation, green pre- and post-impl.
    // [conservative pin; see WI-3-red-gate.md]
    expect(
      getRelationships(result, 'EXTENDS').filter((e) => e.source === 'NestSub'),
    ).toEqual([]);
  });

  it('resolves DOUBLY-VARIED qualified nested access (OUTER.INNER → e.ping()) (REQ-010/§7(13)∘§7(5))', () => {
    // The composition of the outer-folding and tail-folding mechanisms — fixtured because
    // compositions are not assumed free.
    expect(
      getRelationships(result, 'CALLS').find(
        (e) => e.target === 'ping' && e.sourceFilePath.includes('DoubleCase'),
      ),
    ).toBeDefined();
  });

  it('does NOT inject a nested type by bare simple name — bare Inner stays unresolved (REQ-015)', () => {
    // [conservative-negative; see WI-3-red-gate.md] — never mis-binds; anchored red
    // by the qualified-access positive above.
    expect(
      getRelationships(result, 'CALLS').filter(
        (e) => e.target === 'ping' && e.sourceFilePath.includes('BareInner'),
      ),
    ).toEqual([]);
  });

  // misfiled + non-exported top-level types (§3 inject-all) ──────────────────
  it('injects a misfiled top-level type (class Helper in Utils.cls) — h.assist() resolves (REQ-010/§3)', () => {
    expect(
      getRelationships(result, 'CALLS').find((e) => e.target === 'assist'),
    ).toBeDefined();
  });

  it('resolves a cross-file reference to a non-exported top-level type (hd.reveal()) (REQ-010/§7(7))', () => {
    // Black-box form of the §7(7) [Gate-3 reliance]: the host global lookup must not
    // visibility-filter the injected user-defined binding. Parity (whether it SHOULD
    // resolve) is WI-4 REQ-012 — not asserted here.
    expect(
      getRelationships(result, 'CALLS').find((e) => e.target === 'reveal'),
    ).toBeDefined();
  });

  // static field / enum-constant via a type-name receiver (§2 static-receiver arm)
  it('resolves a cross-file static field via a type-name receiver (Consts.MAX_SIZE) via ACCESSES (REQ-010)', () => {
    expect(
      getRelationships(result, 'ACCESSES').find(
        (e) => e.target === 'MAX_SIZE' && e.targetFilePath.includes('Consts'),
      ),
    ).toBeDefined();
  });

  it('resolves a cross-file interface-typed declared variable (Iface v; v.act()) — the Interface injection arm (REQ-010/§3)', () => {
    // The only acceptance observing an Interface def's workspace entry doing work (the
    // heritage fixtures ride the pre-hook channel). Both exact and case-varied (IFACE)
    // declarations bind; at least one act() call from IfaceUser must resolve to Derived's
    // implementation via the interface-typed receiver.
    expect(
      getRelationships(result, 'CALLS').find(
        (e) => e.target === 'act' && e.sourceFilePath.includes('IfaceUser'),
      ),
    ).toBeDefined();
  });

  it('resolves a CASE-VARIED cross-file static field via a type-name receiver (CONSTS.FLOOR) (REQ-010/§7(3))', () => {
    // The §7(3) static-field arm's folded-key completion: the exact-case form is fallback-
    // channel already-green; the case-varied receiver resolves only via the bindings channel.
    expect(
      getRelationships(result, 'ACCESSES').find(
        (e) => e.target === 'FLOOR' && e.targetFilePath.includes('Consts'),
      ),
    ).toBeDefined();
  });

  it('resolves a CASE-VARIED enum-constant receiver (COLOR.BLUE) via the folded key (REQ-010/§2 enum arm)', () => {
    // The weakest arm's case dimension: folded workspace key ∘ the enum-constant
    // member-lookup fallback (§2 arm-specific disposition).
    expect(
      getRelationships(result, 'ACCESSES').find(
        (e) => e.target === 'BLUE' && e.targetFilePath.includes('Color'),
      ),
    ).toBeDefined();
  });

  it('resolves a cross-file enum constant via a type-name receiver (Color.RED) via ACCESSES (REQ-010)', () => {
    expect(
      getRelationships(result, 'ACCESSES').find(
        (e) => e.target === 'RED' && e.targetFilePath.includes('Color'),
      ),
    ).toBeDefined();
  });

  // REQ-006 — no false unresolved record on ANY resolving cross-file reference
  it('records no unresolved/suppressed outcome for the resolving cross-file references (REQ-006)', () => {
    // Scoped to the names this fixture resolves (BareInner's bare-Inner miss is a
    // legitimate plain miss and plain misses emit no record — so a global empty-set
    // assertion is equivalent today, but the scoped set is the SDD-003 §8 obligation).
    const resolvingNames = new Set([
      'start', 'stop', 'label', 'leaf', 'value', 'greet', 'inherited', 'Base',
      'Engine', 'assist', 'reveal', 'MAX_SIZE', 'FLOOR', 'RED', 'Iface',
    ]);
    expect(suppressed(result).filter((o) => resolvingNames.has(o.name))).toEqual([]);
  });

  it('leaves a cross-file reference to a non-existent type unresolved, no throw (REQ-015/NFR-001)', () => {
    // NoTarget references `Missing`, declared nowhere. [conservative-negative; see
    // WI-3-red-gate.md] — value is no-throw + no phantom binding; anchored red by the
    // resolving its in this describe.
    expect(result).toBeDefined();
    const calls = getRelationships(result, 'CALLS');
    expect(calls.filter((e) => e.target === 'poke' && e.sourceFilePath.includes('NoTarget'))).toEqual([]);
    expect(calls.filter((e) => e.target === 'Missing')).toEqual([]);
  });

  it('emits no synthetic IMPORTS edge for Apex cross-file resolution (REQ-010 Seam-B observable)', () => {
    // The §2 postcondition "no import statement and no synthetic IMPORTS edge": Apex has no
    // imports, so cross-file resolution must add zero import machinery to the graph.
    // [conservative-negative; see WI-3-red-gate.md] — anchored red by the resolving its above.
    expect(getRelationships(result, 'IMPORTS')).toEqual([]);
  });

  it('leaves no dangling resolution edges', () => {
    expect(findDanglingEdges(result, RESOLUTION_EDGE_TYPES)).toEqual([]);
  });
});

// ── REQ-008 ∘ REQ-010 — cross-file overloads (the dominant real-world case) ──
describe.skipIf(!apexAvailable)('Apex cross-file overload resolution (REQ-008 ∘ REQ-010)', () => {
  let result: PipelineResult;

  beforeAll(async () => {
    result = await runPipelineFromRepo(
      path.join(FIXTURES, 'apex-cross-file-overload'),
      () => {},
    );
  }, 120000);

  const resolvesExactly = (name: string, mustInclude: string, mustExclude: string) => {
    const calls = getRelationships(result, 'CALLS').filter((e) => e.target === name);
    expect(
      calls.find((e) => e.rel.targetId.includes(mustInclude)),
      `${name}(${mustInclude}) resolved`,
    ).toBeDefined();
    expect(
      calls.find(
        (e) => e.rel.targetId.includes(mustExclude) && !e.rel.targetId.includes(mustInclude),
      ),
      `must not bind ${name}(${mustExclude})`,
    ).toBeUndefined();
  };

  it('narrows a cross-file overload by a LOCAL-variable argument (t.fLocal(x:Integer)) (REQ-008)', () => {
    resolvesExactly('fLocal', 'Integer', 'String');
  });

  it('narrows a cross-file overload by a LITERAL argument (new Target().fLit(42)) (REQ-008)', () => {
    resolvesExactly('fLit', 'Integer', 'String');
  });

  it('narrows a cross-file overload by a CONSTRUCTOR-expression argument (t.fCtor(new Widget())) (REQ-008)', () => {
    resolvesExactly('fCtor', 'Widget', 'Gadget');
  });

  it('narrows a cross-file overload by a FIELD-typed argument (t.fField(this.w:Widget)) (REQ-008)', () => {
    resolvesExactly('fField', 'Widget', 'Gadget');
  });

  it('resolves a STATIC type-name-receiver cross-file overload (Target.sf(7)) (REQ-008/§2 static-receiver)', () => {
    // The shared static-type-name-receiver reliance (§2/§4/§7(3)) — the same shape as
    // the trigger static call; carries its one committed fallback if red at Step 3b.
    resolvesExactly('sf', 'Integer', 'String');
  });

  it('leaves an undisambiguable cross-file overload unresolved AND records it (REQ-015 ∘ REQ-010)', () => {
    expect(
      getRelationships(result, 'CALLS').filter((e) => e.target === 'amb').length,
      'obligation 1: no binding edge',
    ).toBe(0);
    expect(
      suppressed(result).some((o) => o.name === 'amb'),
      'obligation 2: the undisambiguable t.amb(o) call is recorded unresolved',
    ).toBe(true);
  });

  it('records no false unresolved/suppressed outcome for the resolving overload cases (REQ-006)', () => {
    const resolvingNames = new Set(['fLocal', 'fLit', 'fCtor', 'fField', 'sf']);
    expect(suppressed(result).filter((o) => resolvingNames.has(o.name))).toEqual([]);
  });
});

// ── REQ-009/§4 — cross-file mutual/cyclic chain terminates ───────────────────
describe.skipIf(!apexAvailable)('Apex cross-file cyclic chain (REQ-009/§4)', () => {
  let result: PipelineResult;

  beforeAll(async () => {
    result = await runPipelineFromRepo(path.join(FIXTURES, 'apex-cross-file-cyclic'), () => {});
  }, 120000);

  it('terminates on a cross-file mutual type cycle and resolves the reachable segments (x.b.a.b)', () => {
    // The 120s timeout enforces "no hang" on the host field-access fixpoint (§7(9));
    // the reachable segments still resolve per-segment (REQ-009).
    expect(result).toBeDefined();
    const accesses = getRelationships(result, 'ACCESSES');
    expect(accesses.find((e) => e.target === 'b'), 'x.b (CycA.b)').toBeDefined();
    expect(accesses.find((e) => e.target === 'a'), '(x.b).a (CycB.a)').toBeDefined();
  });
});

// ── REQ-015 — cross-file conservatism: collisions, shadowing, exclusions ─────
describe.skipIf(!apexAvailable)('Apex cross-file conservatism (REQ-015, SDD-003 §3/§4)', () => {
  let result: PipelineResult;

  beforeAll(async () => {
    result = await runPipelineFromRepo(
      path.join(FIXTURES, 'apex-cross-file-collision'),
      () => {},
    );
  }, 120000);

  it('resolves the unique-key sibling (s.ok()) — the fixture red anchor (REQ-010)', () => {
    expect(getRelationships(result, 'CALLS').find((e) => e.target === 'ok')).toBeDefined();
  });

  it('injects NOTHING for a colliding folded key (Dupe/DUPE) — the typed-receiver member stays unresolved (REQ-015/§3)', () => {
    // The §3 inject-none guard governs the bindings channel: `Dupe d` gets no declared-type
    // binding, so d.hit() plain-misses (edge ABSENCE — no suppressed record, see header note).
    // [conservative-negative; see WI-3-red-gate.md] — anchored red by s.ok() above.
    expect(
      getRelationships(result, 'CALLS').filter((e) => e.target === 'hit'),
      'no member edge to either duplicate',
    ).toEqual([]);
  });

  it('binds a duplicate-name constructor only on its unique exact-case key (§3/v1.5 limitation, both Then-clauses)', () => {
    // PINNED HOST BEHAVIOUR, not a WI-3 resolution claim: the exact-case single-match
    // channel resolves `new Dupe()` to DupOne's Dupe despite the DUPE duplicate (unique
    // exact-case key — the ratified v1.5 exception). The case-varied form `new dupe()`
    // misses both exact-case keys and the folded key is guard-suppressed -> exactly ONE
    // ctor edge to the pair (v1.5 scenario's second Then-clause).
    // [already-green; see WI-3-red-gate.md]
    const ctors = getRelationships(result, 'CALLS').filter(
      (e) => (e.target === 'Dupe' || e.target === 'DUPE') && e.sourceFilePath.includes('DupCaller'),
    );
    expect(ctors.length, 'exactly the exact-case bind, nothing for the case-varied form').toBe(1);
    expect(ctors[0]!.targetFilePath, 'exact-case target, not the case-variant').toContain('DupOne.cls');
  });

  it('lets a same-unit declaration shadow a same-named global (local-over-global precedence) (§4)', () => {
    // ShadowUser declares a NESTED Shadow; a top-level Shadow exists in another file.
    // The nested (local) one must win — an edge into Shadow.cls from ShadowUser is a mis-bind.
    // The positive half is WI-2 behaviour (in-unit nested resolution) and may pass pre-impl;
    // the mis-bind guard is the WI-3 value once the global channel is populated.
    // [no-red justification recorded in WI-3-red-gate.md]
    const pings = getRelationships(result, 'CALLS').filter(
      (e) => e.target === 'ping' && e.sourceFilePath.includes('ShadowUser'),
    );
    expect(pings.length, 's.ping() resolves').toBeGreaterThanOrEqual(1);
    expect(
      pings.filter((e) => e.targetFilePath.includes('ShadowUser.cls')).length,
      'targets the nested (local) Shadow',
    ).toBe(pings.length);
  });

  it('resolves a user-defined type over a same-named external/sObject (Account) (§4 precedence)', () => {
    const save = getRelationships(result, 'CALLS').find((e) => e.target === 'save');
    expect(save, 'a.save() resolves to the user-defined Account').toBeDefined();
    expect(save!.targetFilePath, 'targets the user-defined node').toContain('Account.cls');
  });

  it('excludes a class misfiled in a .trigger file from injection — the typed-receiver member stays unresolved (§4/§A.13)', () => {
    // The .trigger-extension discriminant governs the INJECTION channel: `Rogue r` gets no
    // declared-type binding, so r.sneak() misses (invalid-source-only limitation,
    // Architect-accepted). [conservative-negative; see WI-3-red-gate.md]
    expect(
      getRelationships(result, 'CALLS').filter((e) => e.target === 'sneak'),
    ).toEqual([]);
  });

  it('binds the misfiled class ctor via the host fallback channel (§4 documented limitation)', () => {
    // PINNED HOST BEHAVIOUR: the exact-case fallback channel binds `new Rogue()` to the
    // class def wherever it parses — including a .trigger file. The injection exclusion
    // does not (and cannot) govern this channel. [already-green; see WI-3-red-gate.md]
    expect(
      getRelationships(result, 'CALLS').find(
        (e) => e.target === 'Rogue' && e.targetFilePath.endsWith('.trigger'),
      ),
    ).toBeDefined();
  });

  it('resolves qualified nested access to the NESTED type despite a same-tail top-level decoy (§4/§7(5))', () => {
    // TOuter.TInner referenced qualified; an unrelated top-level TInner exists. Post-impl
    // the outer's global binding + member lookup targets the NESTED type (red pre-impl).
    const call = getRelationships(result, 'CALLS').find(
      (e) => e.target === 'tping' && e.sourceFilePath.includes('TailCaller'),
    );
    expect(call, 'TOuter.TInner resolves via the outer binding').toBeDefined();
    expect(call!.targetFilePath, 'targets the nested type, not the decoy').toContain('TOuter.cls');
  });

  it('pins the fragment-collision limitation — the valid Frag stays unresolved (SRS v1.9)', () => {
    // FragBroken's error-recovery re-parents nested Frag to Module scope (Addendum 12), so
    // the injection sees two 'frag' defs and registers neither: the VALID top-level Frag's
    // typed-receiver form stays unresolved — liveness-only, no mis-bind (the ratified v1.9
    // exception). [conservative pin; see WI-3-red-gate.md]
    expect(
      getRelationships(result, 'CALLS').filter(
        (e) => (e.target === 'real' || e.target === 'fake') && e.sourceFilePath.includes('FragCaller'),
      ),
    ).toEqual([]);
  });

  it('pins the same-case twin heritage clause unresolved (SRS v1.10(v) documented limitation)', () => {
    // TwinSub extends Twin with Twin.trigger + Twin.cls present: the pre-hook pass sees two
    // defs under the exact-case key and refuses — liveness-only, no mis-bind.
    // [conservative pin; see WI-3-red-gate.md]
    expect(
      getRelationships(result, 'EXTENDS').filter((e) => e.source === 'TwinSub'),
    ).toEqual([]);
  });

  it('pins nested-parent heritage mis-binding the same-tail decoy (SRS v1.10(iv) documented limitation)', () => {
    // TailSub extends TOuter.TInner with top-level TInner present: the pre-hook pass binds
    // the DECOY (probed, Addendum 11) — pinned as the ratified limitation, never as correct
    // resolution. [already-green pin; see WI-3-red-gate.md]
    expect(
      getRelationships(result, 'EXTENDS').find(
        (e) => e.source === 'TailSub' && e.targetFilePath.endsWith('TInner.cls'),
      ),
    ).toBeDefined();
  });

  it('never tail-binds a dotted reference to the same-tail top-level decoy (§4 dotted-tail guard)', () => {
    // Probed 2026-07-02 (Addendum 6): both defs index under the tail key -> the single-match
    // guard binds nothing into the decoy for the post-hook kinds. (The HERITAGE kind is the
    // pinned v1.10(iv) mis-bind above — excluded here.)
    // [conservative-negative; see WI-3-red-gate.md]
    for (const type of ['CALLS', 'ACCESSES']) {
      expect(
        getRelationships(result, type).filter(
          (e) => e.targetFilePath.endsWith('TInner.cls') && e.sourceFilePath.includes('TailCaller'),
        ),
        `no ${type} edge into the decoy`,
      ).toEqual([]);
    }
  });

  it('injects a class from a case-varied .CLS file — l.shout() resolves (§4 case-folded extension)', () => {
    // The host classifies extensions case-insensitively; the §3 comparison must too, or a
    // .CLS-filed class silently loses REQ-010. Red until the injection lands.
    expect(getRelationships(result, 'CALLS').find((e) => e.target === 'shout')).toBeDefined();
  });

  it('excludes a trigger in a case-varied .TRIGGER file from injection (§4 case-folded extension)', () => {
    // BOOM (case-varied) resolves only via the folded key, which must never contain the
    // .TRIGGER-filed trigger. [conservative-negative; see WI-3-red-gate.md]
    expect(
      getRelationships(result, 'CALLS').filter(
        (e) => e.target === 'Boom' && e.sourceFilePath.includes('BoomCaller'),
      ),
    ).toEqual([]);
  });

  it('resolves the CASE-VARIANT trigger/class twin to the CLASS, never the trigger (§4/§7(11) safety)', () => {
    // Twist.trigger + class TWIST (valid Apex). Pre-impl the exact-case channel binds the
    // TRIGGER (probed, Addendum 8); post-injection the folded key 'twist' holds the class
    // alone and MUST win before the exact-case channel — the committed-to-fix shape.
    const turn = getRelationships(result, 'CALLS').find((e) => e.target === 'turn');
    expect(turn, 'w.turn() resolves to the class member').toBeDefined();
    expect(turn!.targetFilePath).toContain('TWIST.cls');
    const ctor = getRelationships(result, 'CALLS').find(
      (e) => e.target === 'Twist' && e.sourceFilePath.includes('TwistCaller'),
    );
    expect(ctor, 'new Twist() binds the class').toBeDefined();
    expect(ctor!.targetFilePath, 'never the trigger').toContain('TWIST.cls');
    // ctor/member forms only: the HERITAGE arm is the ratified v1.8(ii) limitation (below),
    // so the no-edge-into-the-trigger sweep here is scoped to CALLS/ACCESSES.
    for (const type of ['CALLS', 'ACCESSES']) {
      expect(
        getRelationships(result, type).filter((e) => e.targetFilePath.endsWith('Twist.trigger')),
        `no ${type} edge into the trigger def`,
      ).toEqual([]);
    }
  });

  it('pins the twin HERITAGE arm binding the trigger (SRS v1.8(ii) documented limitation)', () => {
    // TwistSub extends Twist: the PRE-hook heritage pass binds the trigger's unique
    // exact-case key (Addendum 9; the Addendum-5 lone-trigger analog) — pinned as the
    // ratified valid-source safety limitation, NOT as correct resolution.
    // [already-green pin; see WI-3-red-gate.md]
    expect(
      getRelationships(result, 'EXTENDS').find(
        (e) => e.source === 'TwistSub' && e.targetFilePath.endsWith('Twist.trigger'),
      ),
    ).toBeDefined();
  });

  it('resolves a valid same-name trigger+class twin to the CLASS, never the trigger (§4/REQ-004)', () => {
    // Twin.trigger + Twin.cls are VALID Apex. The §3 exclusion keeps the trigger out of the
    // injection, so `Twin t = new Twin(); t.spin()` resolves to the class (genuinely red
    // pre-impl — probed 2026-07-02: the fallback channel resolves neither twin form).
    const spin = getRelationships(result, 'CALLS').find((e) => e.target === 'spin');
    expect(spin, 't.spin() resolves to the class member').toBeDefined();
    expect(spin!.targetFilePath, 'declared in Twin.cls').toContain('Twin.cls');
    // The ctor arm — asserted under the §7(11) callsite-folding reliance (same policy as
    // the new ENGINE() fixture): an unambiguous valid-source REQ-005/REQ-010 SHALL.
    const ctor = getRelationships(result, 'CALLS').find(
      (e) => e.target === 'Twin' && e.sourceFilePath.includes('TwinCaller'),
    );
    expect(ctor, 'new Twin() binds the class (§7(11))').toBeDefined();
    expect(ctor!.targetFilePath, 'the class, never the trigger').toContain('Twin.cls');
    // REQ-004 guard: no resolution edge ever targets the trigger def.
    for (const type of ['CALLS', 'ACCESSES', 'EXTENDS', 'IMPLEMENTS']) {
      expect(
        getRelationships(result, type).filter((e) => e.targetFilePath.endsWith('Twin.trigger')),
        `no ${type} edge into the trigger def`,
      ).toEqual([]);
    }
  });

  it('binds NOTHING for a SAME-case duplicate (class Samey ×2) — single-match guard + inject-none (§4/REQ-015)', () => {
    // Probed 2026-07-02: the exact-case channel's single-match guard binds nothing on a true
    // tie, and the §3 guard keeps the folded key out of the bindings channel. The v1.5
    // exception does NOT fire here — the main REQ-015 scenario governs.
    // [conservative-negative; see WI-3-red-gate.md] — anchored red by s.ok().
    const calls = getRelationships(result, 'CALLS');
    expect(
      calls.filter((e) => e.target === 'Samey' && e.sourceFilePath.includes('SameCaller')),
      'no constructor edge to either duplicate',
    ).toEqual([]);
    expect(calls.filter((e) => e.target === 'hitA' || e.target === 'hitB')).toEqual([]);
  });

  it('binds a LONE correctly-filed trigger referenced as a type (§4/REQ-004 v1.6 corrected exception)', () => {
    // PINNED LIMITATION BEHAVIOUR (probed + re-ratified 2026-07-02): only Lone.trigger
    // declares `Lone`, so the exact-case channel's unique key admits the trigger def.
    // [already-green; see WI-3-red-gate.md]
    expect(
      getRelationships(result, 'CALLS').find(
        (e) => e.target === 'Lone' && e.targetFilePath.endsWith('Lone.trigger'),
      ),
    ).toBeDefined();
  });

  it('injects a trigger misfiled in a .cls file — a case-varied reference binds it (§4/§A.13 limitation)', () => {
    // PINNED LIMITATION BEHAVIOUR (Architect-accepted 2026-07-02): the .cls extension is the
    // only resolution-side discriminant, so the misfiled trigger def passes the §3 predicates
    // and IS injected under its folded key — the case-varied `new PHANTOM()` resolves only via
    // that injection (genuinely red pre-impl). Asserted as the documented limitation, not as
    // correct resolution (REQ-004 non-referenceability breach, invalid-source-only).
    expect(
      getRelationships(result, 'CALLS').find(
        (e) => e.target === 'Phantom' && e.sourceFilePath.includes('PhantomCaller'),
      ),
    ).toBeDefined();
  });

  it('leaves a cross-file member case-collision unresolved AND records it (REQ-015 two obligations)', () => {
    // CaseColl declares act/ACT; the cross-file c.Act() matches both case-insensitively —
    // the ambiguity REACHES the resolver (assertable positive record per SRS v1.7), unlike
    // the guard-miss shapes. Red until the cross-file receiver binding lands.
    expect(
      getRelationships(result, 'CALLS').filter(
        (e) => (e.target === 'act' || e.target === 'ACT') && e.sourceFilePath.includes('CaseCollCaller'),
      ),
      'obligation 1: no binding edge',
    ).toEqual([]);
    expect(
      suppressed(result).some((o) => o.name.toLowerCase() === 'act'),
      'obligation 2: the c.Act() reference is recorded unresolved',
    ).toBe(true);
  });

  it('leaves no dangling resolution edges', () => {
    expect(findDanglingEdges(result, RESOLUTION_EDGE_TYPES)).toEqual([]);
  });
});

// ── REQ-011 — trigger-body resolution, each edge FROM the trigger container ──
describe.skipIf(!apexAvailable)('Apex trigger-body resolution (REQ-011, SDD-003 §8)', () => {
  let result: PipelineResult;

  beforeAll(async () => {
    result = await runPipelineFromRepo(path.join(FIXTURES, 'apex-cross-file-trigger'), () => {});
  }, 120000);

  // Every REQ-011 edge must originate from the trigger CONTAINER node T (the
  // [structural obligation] "from the trigger", REQ-011 v1.4) — asserted as
  // source name T + source in the .trigger file.
  const fromTrigger = (e: { source: string; sourceFilePath: string }) =>
    e.source === 'T' && e.sourceFilePath.endsWith('.trigger');

  it('resolves a trigger-body static handler call (AccountHandler.handle()) via CALLS from the trigger (REQ-011)', () => {
    const call = getRelationships(result, 'CALLS').find((e) => e.target === 'handle');
    expect(call, 'the canonical REQ-011 form resolves').toBeDefined();
    expect(fromTrigger(call!), 'edge originates from the trigger container node').toBe(true);
  });

  it('resolves a trigger-body constructor (new AccountHandler()) via CALLS from the trigger (REQ-011)', () => {
    const call = getRelationships(result, 'CALLS').find((e) => e.target === 'AccountHandler');
    expect(call).toBeDefined();
    expect(fromTrigger(call!)).toBe(true);
  });

  it('resolves a trigger-scope instance-receiver method call (h.process()) from the trigger (REQ-011/§2)', () => {
    // The trigger-body local-variable receiver reliance (§7(3b)) — trigger-scope
    // instance typing is NOT free fallout of WI-2 (which excluded triggers).
    const call = getRelationships(result, 'CALLS').find((e) => e.target === 'process');
    expect(call).toBeDefined();
    expect(fromTrigger(call!)).toBe(true);
  });

  it('resolves a member via a DECLARATION-ONLY typed trigger variable (AccountHandler d; d.size) (REQ-011 v1.4)', () => {
    // Isolates trigger-scope DECLARED-type binding (interpretApexTypeBinding) from
    // constructor-type inference — d has no initializer (§8 discriminating acceptance).
    const access = getRelationships(result, 'ACCESSES').find((e) => e.target === 'size');
    expect(access).toBeDefined();
    expect(fromTrigger(access!)).toBe(true);
  });

  it('resolves a trigger-body instance field access (h.name) via ACCESSES from the trigger (REQ-011)', () => {
    const access = getRelationships(result, 'ACCESSES').find((e) => e.target === 'name');
    expect(access).toBeDefined();
    expect(fromTrigger(access!)).toBe(true);
  });

  it('resolves a trigger-body static field access (AccountHandler.MAX_SIZE) via ACCESSES from the trigger (REQ-011)', () => {
    // The static-receiver FIELD arm (§2) — same reliance + fallback as the static call.
    const access = getRelationships(result, 'ACCESSES').find((e) => e.target === 'MAX_SIZE');
    expect(access).toBeDefined();
    expect(fromTrigger(access!)).toBe(true);
  });

  it('resolves trigger-body nested-qualified access (Kit.Part p; p.snap()) from the trigger (REQ-011 ∘ §7(5)/(13))', () => {
    // The trigger-scope ∘ qualified-resolution composition — not assumed free.
    const call = getRelationships(result, 'CALLS').find((e) => e.target === 'snap');
    expect(call).toBeDefined();
    expect(fromTrigger(call!)).toBe(true);
  });

  it('resolves a trigger-body cross-file chain (h.next.name) per segment from the trigger (REQ-011 ∘ REQ-009)', () => {
    // The field-access fixpoint operating from trigger scope (§7(3b) — not free fallout of
    // WI-2). `next` is AccountHandler's self-typed field; both segments must resolve.
    const accesses = getRelationships(result, 'ACCESSES');
    const next = accesses.find((e) => e.target === 'next');
    expect(next, 'h.next resolves').toBeDefined();
    expect(fromTrigger(next!), 'chain root originates from the trigger container').toBe(true);
    // second segment: (h.next).name — at least one ACCESSES 'name' beyond the direct h.name
    expect(
      accesses.filter((e) => e.target === 'name' && fromTrigger(e)).length,
      'both name accesses (h.name and h.next.name) resolve from the trigger',
    ).toBeGreaterThanOrEqual(2);
  });

  it('resolves a trigger-body enum-constant access (Level.HIGH) via ACCESSES from the trigger (REQ-011)', () => {
    const access = getRelationships(result, 'ACCESSES').find((e) => e.target === 'HIGH');
    expect(access).toBeDefined();
    expect(fromTrigger(access!)).toBe(true);
  });

  it('resolves a CASE-VARIED trigger-body static call (ACCOUNTHANDLER.notify()) from the trigger (REQ-011/§7(3))', () => {
    // The §7(3) static-call arm's folded-key completion: exact-case handle() is fallback-
    // channel already-green; the case-varied receiver resolves only via the bindings channel.
    const call = getRelationships(result, 'CALLS').find((e) => e.target === 'notify');
    expect(call).toBeDefined();
    expect(fromTrigger(call!), 'edge originates from the trigger container node').toBe(true);
  });

  it('narrows a trigger-body overloaded static call (AccountHandler.log(7)) to log(Integer) (REQ-011 ∘ REQ-008)', () => {
    // The §4 trigger-body overload composition: REQ-008 narrowing over a cross-file overload
    // set, with the disambiguating argument typed in TRIGGER scope (§7(3b) — not free fallout
    // of WI-2, which excluded triggers).
    const logCalls = getRelationships(result, 'CALLS').filter((e) => e.target === 'log');
    const exact = logCalls.find((e) => e.rel.targetId.includes('Integer'));
    expect(exact, 'log(Integer) resolved from the trigger').toBeDefined();
    expect(fromTrigger(exact!), 'edge originates from the trigger container node').toBe(true);
    expect(
      logCalls.find(
        (e) => e.rel.targetId.includes('String') && !e.rel.targetId.includes('Integer'),
      ),
      'must not bind log(String)',
    ).toBeUndefined();
  });

  it('leaves an undisambiguable trigger-body overload unresolved AND records it (REQ-011 ∘ REQ-015)', () => {
    // pick(AccountHandler)/pick(Level) called with a String literal: equal arity, no exact
    // match -> ambiguous. REQ-015's two obligations, from trigger scope.
    expect(
      getRelationships(result, 'CALLS').filter((e) => e.target === 'pick').length,
      'obligation 1: no binding edge',
    ).toBe(0);
    expect(
      suppressed(result).some((o) => o.name === 'pick'),
      'obligation 2: the undisambiguable pick call is recorded unresolved',
    ).toBe(true);
  });

  it('binds a bare declared-type usage in a trigger body with NO standalone edge (REQ-011 v1.4)', () => {
    // `AccountHandler h` / `Level v` bind (proven by h.process()/h.name/Level.HIGH
    // resolving above); the binding itself emits no USES edge (REQ-005 v1.3 parity).
    expect(getRelationships(result, 'USES')).toEqual([]);
  });

  it('leaves trigger-body external references (System.debug, Trigger.new) unresolved, no throw (§2 invariant/NFR-001)', () => {
    // [conservative-negative; see WI-3-red-gate.md] — value is no-throw + no Apex defect.
    expect(result).toBeDefined();
    expect(
      getRelationships(result, 'CALLS').filter((e) => e.target === 'debug'),
    ).toEqual([]);
    // Trigger.new: the external context-variable member access emits no edge.
    expect(
      getRelationships(result, 'ACCESSES').filter((e) => e.target === 'new'),
    ).toEqual([]);
  });

  it('records no unresolved/suppressed outcome for the resolving trigger references (REQ-006)', () => {
    // `pick` is excluded: its undisambiguable call is a REQ-015 reference the host records.
    const resolvingNames = new Set([
      'handle', 'process', 'name', 'MAX_SIZE', 'HIGH', 'AccountHandler', 'log', 'notify',
    ]);
    expect(suppressed(result).filter((o) => resolvingNames.has(o.name))).toEqual([]);
  });

  it('leaves no dangling resolution edges', () => {
    expect(findDanglingEdges(result, RESOLUTION_EDGE_TYPES)).toEqual([]);
  });
});

// ── NFR-002 — cross-language folded-key share: REGRESSION PIN (the former §7(8)
// reliance is retired — workspaceFqnBindings is a per-language-run instance,
// Addendum 12; this guards the structurally foreclosed surface, it validates no reliance) ──
describe.skipIf(!apexAvailable)('Apex cross-language registry partitioning (NFR-002 regression pin)', () => {
  let result: PipelineResult;

  beforeAll(async () => {
    result = await runPipelineFromRepo(path.join(FIXTURES, 'apex-cross-file-mixed'), () => {});
  }, 120000);

  it('resolves the Apex reference only to the Apex def despite a peer symbol on the same folded key (§7(8))', () => {
    // Motor folds to 'motor'; mod.py declares class motor. The Apex m.rev() must bind
    // the Apex member (red until the injection lands; a bind into mod.py is a §7(8) FAIL).
    const rev = getRelationships(result, 'CALLS').find((e) => e.target === 'rev');
    expect(rev, 'm.rev() resolves').toBeDefined();
    expect(rev!.targetFilePath, 'targets the Apex def').toContain('Motor.cls');
  });

  it('partitions the peer-ENTRY direction: C# and Apex each bind only their own def (§7(8))', () => {
    // motor.cs is a GLOBAL-namespace C# type: its hook WRITES workspaceFqnBindings, so a
    // peer entry genuinely occupies the folded key 'motor'. The C# m.Whir() must bind the
    // C# member, and no Apex-sourced edge may land on the .cs def (nor C#-sourced on .cls).
    const whir = getRelationships(result, 'CALLS').find((e) => e.target === 'Whir');
    expect(whir, 'C# m.Whir() resolves').toBeDefined();
    expect(whir!.targetFilePath, 'targets the C# def').toContain('motor.cs');
    expect(
      getRelationships(result, 'CALLS').filter(
        (e) => e.sourceFilePath.endsWith('.cls') && e.targetFilePath.endsWith('.cs'),
      ),
      'no Apex-sourced edge into the C# def',
    ).toEqual([]);
    expect(
      getRelationships(result, 'CALLS').filter(
        (e) => e.sourceFilePath.endsWith('.cs') && e.targetFilePath.endsWith('.cls'),
      ),
      'no C#-sourced edge into the Apex def',
    ).toEqual([]);
  });

  it('leaves the peer-language resolution unchanged (Python binds only the Python def) (NFR-002)', () => {
    // The Python use.py -> mod.motor().spin() path must be untouched by Apex keys.
    // [already-green regression pin; see WI-3-red-gate.md]
    const spin = getRelationships(result, 'CALLS').find((e) => e.target === 'spin');
    expect(spin, 'python m.spin() resolves').toBeDefined();
    expect(spin!.targetFilePath, 'targets the Python def').toContain('mod.py');
    // and no Python-sourced edge ever lands on the Apex def
    expect(
      getRelationships(result, 'CALLS').filter(
        (e) => e.sourceFilePath.endsWith('.py') && e.targetFilePath.endsWith('.cls'),
      ),
    ).toEqual([]);
  });
});

// ── NFR-001 (cross-file slice) — no crash on garbage / partial trees ─────────
describe.skipIf(!apexAvailable)('Apex cross-file crash-safety (NFR-001 slice)', () => {
  let result: PipelineResult;

  beforeAll(async () => {
    result = await runPipelineFromRepo(
      path.join(FIXTURES, 'apex-cross-file-malformed'),
      () => {},
    );
  }, 120000);

  it('completes the run and resolves the valid cross-file reference despite a garbage sibling', () => {
    expect(result).toBeDefined();
    // anchor (genuinely red until the enabler is wired): s.fine() resolves across files.
    expect(getRelationships(result, 'CALLS').find((e) => e.target === 'fine')).toBeDefined();
  });

  it('leaves a reference into the skipped/garbage sibling unresolved, with no dangling edges', () => {
    // Wreck.cls is unparseable garbage -> no def, no injection -> w.crash() misses.
    // [conservative-negative; see WI-3-red-gate.md] — anchored red by s.fine().
    expect(
      getRelationships(result, 'CALLS').filter((e) => e.target === 'crash'),
    ).toEqual([]);
    expect(findDanglingEdges(result, RESOLUTION_EDGE_TYPES)).toEqual([]);
  });

  it('completes on a trigger with a partial / error-recovery body, no throw (NFR-001)', () => {
    // Bad.trigger's unterminated `s2.` region is conservatively skipped.
    // [conservative-negative; no-crash is the value — see WI-3-red-gate.md]
    expect(result).toBeDefined();
  });
});
