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

  // case-varied cross-file (§2.2 seam ∘ REQ-010) ─────────────────────────────
  it('resolves a case-varied cross-file reference (ENGINE e; e.STOP()) via the folded global key (REQ-010)', () => {
    expect(
      getRelationships(result, 'CALLS').find((e) => e.target === 'stop'),
    ).toBeDefined();
  });

  // nested-type qualified access (REQ-010 SHALL) ─────────────────────────────
  it('resolves qualified nested-type access (Outer.Inner from another file) — i.ping() via CALLS (REQ-010)', () => {
    expect(
      getRelationships(result, 'CALLS').find(
        (e) => e.target === 'ping' && e.sourceFilePath.includes('NestedCaller'),
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

  it('resolves a CASE-VARIED cross-file static field via a type-name receiver (CONSTS.FLOOR) (REQ-010/§7(3))', () => {
    // The §7(3) static-field arm's folded-key completion: the exact-case form is fallback-
    // channel already-green; the case-varied receiver resolves only via the bindings channel.
    expect(
      getRelationships(result, 'ACCESSES').find(
        (e) => e.target === 'FLOOR' && e.targetFilePath.includes('Consts'),
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

  it('binds a duplicate-name constructor exact-case-first via the host fallback channel (§3 documented limitation)', () => {
    // PINNED HOST BEHAVIOUR, not a WI-3 resolution claim: the pre-existing exact-case
    // first-match workspace fallback (workspace-index/findExportedDefByName) resolves
    // `new Dupe()` to DupOne's Dupe despite the DUPE duplicate. Parity-accepted §A.13-style
    // limitation (Architect-accepted 2026-07-02). [already-green; see WI-3-red-gate.md]
    const ctor = getRelationships(result, 'CALLS').find(
      (e) => e.target === 'Dupe' && e.sourceFilePath.includes('DupCaller'),
    );
    expect(ctor, 'the fallback channel binds the exact-case match').toBeDefined();
    expect(ctor!.targetFilePath, 'exact-case target, not the case-variant').toContain('DupOne.cls');
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

  it('resolves a valid same-name trigger+class twin to the CLASS, never the trigger (§4/REQ-004)', () => {
    // Twin.trigger + Twin.cls are VALID Apex. The §3 exclusion keeps the trigger out of the
    // injection, so `Twin t = new Twin(); t.spin()` resolves to the class (genuinely red
    // pre-impl — probed 2026-07-02: the fallback channel resolves neither twin form).
    const spin = getRelationships(result, 'CALLS').find((e) => e.target === 'spin');
    expect(spin, 't.spin() resolves to the class member').toBeDefined();
    expect(spin!.targetFilePath, 'declared in Twin.cls').toContain('Twin.cls');
    // REQ-004 guard: no resolution edge ever targets the trigger def.
    for (const type of ['CALLS', 'ACCESSES', 'EXTENDS', 'IMPLEMENTS']) {
      expect(
        getRelationships(result, type).filter((e) => e.targetFilePath.endsWith('Twin.trigger')),
        `no ${type} edge into the trigger def`,
      ).toEqual([]);
    }
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

  it('leaves a trigger-body external reference (System.debug) unresolved, no throw (§2 invariant/NFR-001)', () => {
    // [conservative-negative; see WI-3-red-gate.md] — value is no-throw + no Apex defect.
    expect(result).toBeDefined();
    expect(
      getRelationships(result, 'CALLS').filter((e) => e.target === 'debug'),
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
