# WI-3 (Cross-file binding & trigger resolution) — Red-Gate record

*VSDD Phase 3, Step 3a. Records the Red-Gate state of the WI-3 cross-file suite
(`test/integration/resolvers/apex-cross-file.test.ts`, 48 tests, 6 multi-file fixtures under
`test/fixtures/lang-resolution/apex-cross-file*`) and the main-thread unit anchors
(`test/unit/apex-cross-file-unit.test.ts`, 8 tests) authored against SDD-003 §8 (as amended
2026-07-02), BEFORE the WI-3 implementation. The Gate-3 adversary verifies this record
against the tagged tests.*

## Suite state at authoring

WI-1 and WI-2 are DONE and green, so the WI-3 tests **run** (they do not skip). Measured
state on the pre-impl host: **31 red / 25 passed of 56**; the full pre-existing apex + peer
suites stay green (312/312 across apex.test, apex-resolution.test, apex-resolution-hardening,
apex-resolution-unit, java.test). No **test scaffolding** (`// vsdd:scaffold`) was needed —
grammar, provider, and registration all exist from WI-1/WI-2, so there is no scaffold ledger
for WI-3.

**Step-3a finding (Architect-dispositioned 2026-07-02 — see `WI-3-step3a-findings.md`):**
the host resolves several cross-file forms with NO WI-3 code, via the exact-case first-match
workspace fallback (`workspace-index.ts` `simpleName → first module-local callable def`,
consumed by `findExportedDefByName`) + the heritage pass. SDD-003 was amended (§1 two-channel
model; §2/§3/§4/§7(4)/§8 foreclosure-scoping + fallback-channel §A.13 limitation) and the
Gate-2 pass record `gate2-wi3.md` is superseded pending a cold re-review. The already-green
acceptance tests below are the direct consequence.

## Genuinely-RED assertions (fail now, no implementation) — the gate's red evidence

All bindings-channel targets: no Apex `populateNamespaceSiblings` is registered, so
`workspaceFqnBindings` holds no Apex entries and no cross-file declared-type binding forms.

- REQ-010 instance-receiver member forms: two-class call `e.start()`; bare declared-type
  binding via `held.label`; misfiled-type `h.assist()`; non-exported `hd.reveal()` (§7(7));
  collision-fixture anchor `s.ok()`; sObject-shadow `a.save()`; malformed-fixture anchor
  `s.fine()`.
- REQ-009 cross-file chain `h.leaf.value` (both segments); cross-file mutual/cyclic
  `x.b.a.b` (§7(9) — the no-hang half is enforced by the 120s timeout).
- REQ-005/007 cross-file inherited member `c.inherited()` (§7(10) — the MRO walk needs the
  parent's binding).
- Case-varied forms (the fallback channel is exact-case): `ENGINE e; e.STOP()`.
- Enum-constant access via type-name receiver: `Color.RED`, trigger `Level.HIGH` (unlike
  static Property access, which the fallback channel provides).
- Nested-type qualified access `Outer.Inner → i.ping()` (§7(5)).
- REQ-008 ∘ REQ-010 overloads — all five resolving forms (local / literal / ctor-expression /
  field-typed argument; static type-name receiver `Target.sf(7)`, §7(3)); the undisambiguable
  `t.amb(o)` **recorded** obligation (a `suppressed` outcome named `amb` — red until the
  cross-file receiver resolves and the ambiguity is reachable); the scoped REQ-006
  no-false-suppressed assertion for the overload fixture (red: asserts against outcomes that
  only exist once resolution runs — anchored by the resolving its).
- REQ-011 trigger instance-receiver forms (§7(3b)): `h.process()`, `h.name`.
- §7 unit anchors (`apex-cross-file-unit.test.ts`, coverage-attributable per dogfood #16):
  all 8 fail via dynamic-import rejection — `languages/apex/namespace-siblings.ts` does not
  exist. They pin the §3 [structural] selection/folding/guard behaviour directly.

## Already-green acceptance (no-red justification — SDD-003 §1 fallback channel)

These §8 acceptance tests pass with NO WI-3 implementation because the pre-existing,
language-uniform host fallback channel provides the behaviour (reliance-found-true-early —
the mirror of dogfood #20). Exemption ladder: (1) behaviourally consequential → they ARE and
they ARE tested — but no failing pre-impl state exists because the host already ships the
behaviour; they are kept as acceptance + regression guards (Architect-approved 2026-07-02);
(2) enables a target test → no; (3) build/infra → no; (4) manual-only → no.

- Cross-file constructor `new Engine()` → CALLS `Class:Engine.cls:Engine`.
- Top-level `Derived extends Base` → EXTENDS; `Derived implements Iface` → IMPLEMENTS;
  `SubIface extends Iface` → IMPLEMENTS (§7(6) edge-label selection — validated TRUE).
- `super()` → `Constructor:Base.cls:Base.Base#0`; `super.greet()` → `Method:Base.cls:Base.greet#0`
  (parent, not override).
- Static Property via type-name receiver: `Consts.MAX_SIZE` → ACCESSES.
- Trigger static arms (§7(3) call + field): `AccountHandler.handle()` → CALLS from `T`;
  `new AccountHandler()` → CALLS from `T`; `AccountHandler.MAX_SIZE` → ACCESSES from `T` —
  including the REQ-011 **edge-from-trigger [structural obligation]**: the host natively
  attributes the source to the trigger container node (the Architect-held edge-source
  reliance is validated TRUE; no source-attribution seam needed).
- Fallback-channel limitation pins (authored post-disposition, green by design):
  duplicate-name ctor binds exact-case-first (`new Dupe()` → DupOne.cls); misfiled-class
  ctor binds into the `.trigger` file (`new Rogue()`).

## Conservative-negative assertions (no-red justification — Principle 3 residual)

Absence-of-binding assertions that pass pre-impl because the asserted miss is a miss both
before and after Step 3b. Each is paired with a genuinely-RED positive anchor in its
describe and fails if a future change mis-binds — regression guards, not red evidence.

- Bare `Inner` from another file → 0 CALLS `ping` from BareInner.cls (nested types are never
  injected by simple name; anchored red by the qualified-access positive).
- Collision member path `d.hit()` → 0 CALLS (the §3 inject-none guard keeps `Dupe d`
  unbound; observable as plain-miss edge absence — the REQ-015 "recorded" obligation is NOT
  observable here because the key is never created, so no ambiguity reaches the host;
  mirrors the WI-2 plain-miss discipline).
- Misfiled-in-`.trigger` member path `r.sneak()` → 0 CALLS (injection exclusion; same
  plain-miss observability note).
- Trigger external `System.debug` → 0 CALLS `debug` (no-throw is the value).
- Reference into a garbage sibling `w.crash()` → 0 CALLS + no dangling (NFR-001; anchored
  red by `s.fine()`).
- Malformed trigger body (`Bad.trigger`) → run completes (pure no-crash).
- `USES`-absence guards (main + trigger fixtures) and the three `findDanglingEdges` guards —
  pass now, meaningful as regression guards once edges exist.
- Scoped REQ-006 no-false-suppressed assertions (main + trigger fixtures) — pass trivially
  now (no outcomes exist); become meaningful at Step 3b. Anchored red by the resolving its.

**Local-shadows-global (`s.ping()` targets the nested Shadow)** — a POSITIVE assertion that
passes pre-impl because in-unit nested resolution is WI-2 behaviour. Its WI-3 value is the
mis-bind guard: once the global channel is populated, an edge into `Shadow.cls` from
ShadowUser would fail it (§7(2) precedence reliance). No-red justification: rung (1) —
behaviourally consequential and tested; the failing state only becomes reachable at Step 3b.

## [Gate-3 reliance] observations pinned at authoring (finding #13)

- REQ-015 "recorded" is observable as a `suppressed` outcome ONLY where an ambiguity
  *reaches the host resolver* (the overload-ambiguous case `amb`). The §3 inject-none guard
  intercepts collisions **before** the host lookup, so duplicate/misfile cases surface as
  plain misses (edge absence) — the WI-2 observability model, unchanged.
- **Step-3b watch item:** WI-2's `apex-resolution-malformed` test asserts `new Broken()` →
  0 CALLS. Broken.cls is malformed and currently yields no def; if Step 3b's injection (or
  the fallback channel) ever sees a `Broken` def emerge from error recovery, that WI-2 test
  goes red → Phase 5, not a silent weakening.
- **Step-3b watch item:** the already-green fallback-channel tests must STAY green after the
  hook registers (the two channels must compose, not fight — e.g. the ctor path must not
  degrade when `workspaceFqnBindings` gains Apex keys).
