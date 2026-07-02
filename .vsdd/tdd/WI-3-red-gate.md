# WI-3 (Cross-file binding & trigger resolution) — Red-Gate record

*VSDD Phase 3, Step 3a. Records the Red-Gate state of the WI-3 cross-file suite
(`test/integration/resolvers/apex-cross-file.test.ts`, 48 tests, 6 multi-file fixtures under
`test/fixtures/lang-resolution/apex-cross-file*`) and the main-thread unit anchors
(`test/unit/apex-cross-file-unit.test.ts`, 8 tests) authored against SDD-003 §8 (as amended
2026-07-02), BEFORE the WI-3 implementation. The Gate-3 adversary verifies this record
against the tagged tests.*

## Suite state at authoring

WI-1 and WI-2 are DONE and green, so the WI-3 tests **run** (they do not skip). Measured
state on the pre-impl host after the Gate-2 round-1 fixes (findings F1–F4, all
Architect-dispositioned 2026-07-02 — SRS v1.5, the trigger-in-`.cls` limitation, the
trigger-body overload composition, the IMPORTS-absence assertion) and round-2 fixes
(SRS v1.6 misfile exceptions, the valid-twin fixture, the non-existent-type fixture,
purity/field-name/observability corrections) and round-3 fixes (case-varied static
type-name-receiver fixtures — CONSTS.FLOOR, ACCOUNTHANDLER.notify(); §8 bullets for the
sObject-shadow and bare-Inner fixtures; the single record-observability rule; the
discharged source-attribution contingency excised) and round-4 fixes (Addendum-5 mechanism
correction — the exact-case channel is `findClassBindingInScope`'s QualifiedNameIndex
single-match fallback; SRS v1.5/v1.6 probe-driven text corrections re-ratified; single-registry
pin §7(12); callsite-folding reliance §7(11) with case-varied ctor/heritage fixtures;
implicit-this inherited-member form; same-case-duplicate + lone-trigger pins) and round-5/6
fixes (trigger externals incl. Trigger.new; declaration-only typed trigger variable
`d.size`; dotted-tail-decoy fixture — probed no-mis-bind, Addendum 6; observability
honest-wording) and round-7 fixes (SRS v1.7 REQ-015 observability interpretation
ratified; case-folded extension discriminant — .CLS injected / .TRIGGER excluded,
fixtures + unit anchor; coverage-map completion notes; RESEARCH-003 made
self-contained) and round-8 fixes (Predicate 2 re-grounded on OWNING-SCOPE shape —
Addendum 7, the qualifiedName discriminant was structurally false on localDefs; unit
anchors rebuilt on the scope shape; valid nested/top-level name-share fixtures; case-
varied nested-qualified fixture; mixed-language §7(8) fixture — Apex 'Motor' vs Python
'motor', Apex ref red / Python-unchanged pin green; §1/§3-vs-§7(7) contradiction
qualified): **48 red / 32 passed of 80** (70 integration + 10 unit); the full
pre-existing apex + peer
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
- Case-varied forms (the exact-case channel does not fold): `ENGINE e; e.STOP()`; the
  case-varied static type-name receivers `CONSTS.FLOOR` (cross-file field) and
  `ACCOUNTHANDLER.notify()` (trigger-body call) — the §7(3) arms' folded-key completion;
  the case-varied constructor `new ENGINE()` and heritage `CaseKid extends BASE implements
  IFACE` — the §7(11) callsite-folding reliance arms.
- Implicit-this inherited member (`inherited()` inside Child, the own-scope-MRO form) —
  red alongside the typed-receiver form `c.inherited()`.
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
- Trigger-body overload composition (REQ-011 ∘ REQ-008, Gate-2 F3): `AccountHandler.log(7)`
  → log(Integer) narrowing fails pre-impl (red); the trigger fixture's scoped REQ-006
  assertion is red WITH it (the host currently mis-records the resolvable `log` call as a
  `suppressed` ambiguity — Step 3b must make trigger-scope argument typing narrow it).
- Trigger-misfiled-in-`.cls` limitation pin (Gate-2 F2, SRS v1.6): case-varied `new PHANTOM()`
  resolves only via the folded-key injection — red until the hook injects the misfiled trigger def.
- Valid twin (Gate-2 R2-2): `t.spin()` resolves to Twin.cls with Twin.trigger present — red
  until the class-only injection lands (probed: the fallback channel resolves neither twin
  form pre-impl); its REQ-004 no-edge-into-the-trigger guard is the paired negative.
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
- Undisambiguable trigger-body overload (`AccountHandler.pick('x')` → 0 CALLS + a
  `suppressed` outcome named `pick`): already green — the fallback-channel static receiver
  reaches the host's overload-ambiguity path pre-hook, which records the suppression. Kept
  as REQ-015 acceptance + regression guard (both obligations asserted); must stay green at
  Step 3b.
- IMPORTS-absence (Gate-2 F4): zero IMPORTS edges in the main cross-file fixture — a
  conservative-negative guard (Apex has no import machinery to emit; fails if cross-file
  support ever synthesizes one). Anchored red by the resolving its in its describe.
- Non-existent type (Gate-2 R2-7): `new Missing(); m.poke()` → zero edges, run completes —
  a conservative-negative (a miss pre- and post-impl); anchored red by its describe's
  resolving its.
- Same-case duplicate (`class Samey` ×2, R4): zero edges — the exact-case channel's
  single-match guard (probed) + the §3 inject-none guard; a conservative-negative pin that
  must STAY green at Step 3b (the injection must not create a bindable key for the tie).
- Lone-trigger reference (`new Lone()`, R4): binds the trigger def via the exact-case
  channel's unique key — already-green pin of the REQ-004 v1.6 corrected-exception
  behaviour (probed + re-ratified 2026-07-02); must stay green at Step 3b (the exclusion
  keeps it off the bindings channel; the exact-case channel is untouched).

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
