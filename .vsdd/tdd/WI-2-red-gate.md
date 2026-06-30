# WI-2 (Resolution mechanics) — Red-Gate record

*VSDD Phase 3, Step 3a. Records the Red-Gate state of the WI-2 resolution suite
(`test/integration/resolvers/apex-resolution.test.ts`) authored against SDD-002 §8,
BEFORE the resolution implementation. The Gate-3 adversary verifies this record
against the tagged tests.*

## Suite state at authoring

The Apex grammar is already vendored (WI-1 DONE), so the WI-2 tests **run** (they do
not skip) and go **RED**: WI-1 emits container/member nodes but **no resolution edges**
(`callExtractor`, the Ring-3 scope hooks, `type-config`, and the `normalizeIdentifier`
§2.2 seam are all unwired). Step 3b wires them red→green. No **test scaffolding**
(`// vsdd:scaffold`) was needed — the grammar/provider registration already exists from
WI-1, so there is no scaffold ledger for WI-2.

## Genuinely-RED assertions (fail now, no implementation)

Every positive-resolution assertion is red until Step 3b: each `expect(... edge ...).toBeDefined()`
/ `.toBe(1)` / `.toBeGreaterThan(0)` fails because no Apex resolution edge or `suppressed`
outcome is emitted yet. These anchor every describe block:

- REQ-005 — USES (type usage), CALLS (constructor, method invocation), ACCESSES (field/property).
- REQ-006 — *(passes trivially now; see below — but its describe is anchored red by the REQ-005 its).*
- REQ-007 — EXTENDS / IMPLEMENTS (nested types); REQ-005 delegation (this()/super()/super.method()).
- REQ-008 — (i) exact-type, (i-fold) param-type case-fold, (ii) arity selection, (iv) multi-parameter.
- REQ-009 — per-segment ACCESSES chain; cyclic first-segment resolve.
- REQ-015 — case-only collision **recorded** — a `suppressed` outcome named `value` — genuinely red.
- NFR-001 slice — the valid-unit `help()` resolve anchor.
- §7 main-thread unit anchors (`test/unit/apex-resolution-unit.test.ts`, coverage-attributable per
  dogfood #16): `apexProvider.normalizeIdentifier` (undefined pre-impl → red) and `normalizeApexParamType`
  from `languages/apex/arity-metadata.ts` (module absent pre-impl → import-error red). Both go green when
  Step 3b adds the §2.2 seam + the Apex param-type case-fold.

## Conservative-negative assertions (no-red justification — Principle 3 residual)

These assert the ABSENCE of a (wrong) binding. They can pass before implementation because
**nothing binds at all pre-impl** — "does not mis-bind" is vacuously true until resolution
exists. Exemption ladder ruled out in order: (1) behaviourally consequential → they ARE, but
have no failing state pre-impl (no binding occurs to be wrong); (2) enables a target test → no;
(3) build/infra/proof → no; (4) manual-only → no. They are a **conservative-correctness residual**:
each is paired with a genuinely-RED positive anchor in the same describe, and each will fail if a
future change mis-binds the reference (regression guard). They are NOT the gate's red evidence.

- REQ-008 (iii) — `h(s)` undisambiguable assignable → 0 CALLS to `h` (no exact match is a miss, not
  an ambiguity, so the host emits no `suppressed` record; edge-absence only).
- REQ-008 §4 — external-arg overload `k(x:Account)` → 0 CALLS to `k` (external arg type, no user-defined
  exact match; miss, no `suppressed` record). Anchored red by the other overload describe its.
- REQ-015 — absent member `t.missing()` → 0 CALLS (anchored red by `t.real()` resolving).
- REQ-015 — unresolved receiver `x.foo()` → 0 CALLS (pure-negative fixture; value = no-throw).
- REQ-015/§4 — external `System.debug` → 0 CALLS (pure-negative; value = no-throw, no Apex defect).
- REQ-006 — "no suppressed outcome in an all-resolving unit" (and the overload describe's no-false-
  suppressed): pass now (no outcomes at all); become meaningful once resolution emits
  edges-without-false-suppressions. Anchored red by the REQ-005/REQ-008 resolve its.
- NFR-001 slice — `new Broken()` cross-file → 0 CALLS (cross-file is WI-3; anchored red by `help()`).
- NFR-001 §4 — empty/whitespace-only unit → run completes (no-crash is the value); reference inside a
  malformed (error-recovery) unit `x.d(` → no throw. Pure no-crash negatives; anchored red by `help()`.
- Two `expect(findDanglingEdges(result)).toEqual([])` lines (the REQ-005/009 describe and the NFR-001
  slice describe) pass now (no resolution edges exist to dangle); they are conservative-correctness
  regression guards that fail if a future change emits a dangling resolution edge. Anchored red by the
  resolving its in their describes.

## [Gate-3 reliance] pinned at authoring (finding #13)

The REQ-015 "**recorded** as unresolved" obligation is observed via `result.resolutionOutcomes`
(`{ kind: 'suppressed' }`) — the only readable positive unresolved record (`ResolveStats.unresolved`
is logged, not exposed). SDD-002 §2 left the concrete host mechanism to Gate-3 discovery; this is
that discovery. If Step 3b finds the host does not route Apex ambiguity through a `suppressed`
outcome, the case-only-collision test loops back (Phase 5) rather than being silently weakened.

**Param-type rendering asymmetry (SDD-002 §4 / §2 REQ-008) — Gate-3 reliance, no behavioural test.**
SDD-002 §4 lists "param-type rendering asymmetry → conservative REQ-015 unresolved": if the
argument-side type token renders differently from WI-1's declared `formal_parameter.type` id segment
(whitespace, generic-arg spelling, qualification), the comparison degrades to a false non-match →
conservative unresolved, never a mis-binding. This is **not exercised by a behavioural assertion**:
forcing a rendering mismatch requires a contrived divergence between the host's argument-token renderer
and WI-1's declared-segment renderer that cannot be expressed from Apex source alone. The POSITIVE
rendering-match path IS exercised (the i-fold case `OverFold`, where the case-fold makes a case-varied
arg compare equal). The asymmetry's safety is therefore a **comparison-symmetry [Gate-3 reliance]**:
Step 3b must render the argument-side token via the SAME raw `formal_parameter.type` path (case-fold on
both sides) as the declared segment; if it diverges, the failure mode is a false REQ-015 unresolved
(conservative), caught by the resolving overload cases (i)/(i-fold) going red, not a mis-binding.
