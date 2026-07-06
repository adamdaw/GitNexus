# WI-3 (Cross-file binding & trigger resolution) — Red-Gate record

*VSDD Phase 3, Step 3a. Records the Red-Gate state of the WI-3 cross-file suite
(`test/integration/resolvers/apex-cross-file.test.ts`, 7 multi-file fixture dirs under
`test/fixtures/lang-resolution/apex-cross-file*`) and the main-thread unit anchors
(`test/unit/apex-cross-file-unit.test.ts`) authored against SDD-003 §8 (as amended
2026-07-02), BEFORE the WI-3 implementation. Initially 48+8 tests at first authoring; the
Gate-2 re-review rounds grew the suite — the FINAL certified tally is the one in the
suite-state paragraph below (the Gate-3 adversary verifies against the tagged tests at
that final state). The Gate-3 adversary verifies this record
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
qualified) and round-9/10 fixes (header v1.7 pin; §7 approval recorded; twin-ctor
assertion policy; case-variant trigger/class twin — probed TRIGGER-bind on valid source,
committed-to-fix, v1.6 boundary wording corrected to exact-case, Addendum 8) and round-11
fixes (heritage pre-emit pass is PRE-hook — Addendum 9; SRS v1.8 heritage limitations
ratified: case-varied heritage pinned UNRESOLVED (i), twin heritage arm pinned
trigger-bind (ii); §7(11) rescoped to the ctor arm with escalation-only remediation;
SDD-003 §7 approval recorded on the correct section):
**48 red / 34 passed of 82**, then round-12/13 fixes (v1.5 second-Then acceptance;
edge-source discharge scoped; §7(13) qualified-outer arm; SRS v1.9 fragment-collision
promotion; Addendum 10 — nested bare qualifiedName DIRECTLY confirmed and the bare
cross-file reference probed no-bind in BOTH shapes; cross-file member case-collision
fixture (red); C# peer-ENTRY arm in the mixed fixture (green pin)) → final
**49 red / 35 passed of 84**, then rounds 14–17 (twin-heritage §8 pin; tail-varied
Outer.INNER fixture (red); §7(11) shape-split; enum-constant arm disposition; third
heritage surface recorded; SRS v1.10 nested-parent heritage limitations — probed:
no-decoy unresolved (iii, pin green), decoy MIS-BOUND (iv, pin green, Addendum 11);
qualified fixtures enumerate both post-hook reference kinds) → final
**50 red / 37 passed of 87**, then rounds 18–19 (SRS v1.10(v) same-case-twin heritage
pin; §7(8) RETIRED — workspaceFqnBindings is a per-language-run instance, Addendum 12,
mixed fixture downgraded to an NFR-002 regression pin; v1.9 fragment-collision mechanism
re-derived on the owning-scope discriminant and probe-confirmed, fixture pinned green;
§7(14) plain-miss-record reliance enumerated; WI-2 Broken.cls watch item settled — the
malformed outer yields no def) → final
**50 red / 39 passed of 89**, then rounds 20–33 (behavioural channel re-grounding —
Addendum 13; §7(11) sharpening — Addendum 14; v1.5 per-pass arm + twin static probes —
Addendum 15; SRS v1.11 heritage-downstream/misfiled-collision family with probe
corrections — Addenda 16/17 incl. the super self-loop pin; Interface declaration-only
observable; trigger-scope composition fixtures (chain, nested-qualified, instance
overload, inherited member, case-varied declared type, case-varied enum); mixed-fixture
C# arm; Poison/Victim/Twin-family pins) → final
**60 red / 44 passed of 104** (93 integration + 11 unit); the full
pre-existing apex + peer
suites stay green (312/312 across apex.test, apex-resolution.test, apex-resolution-hardening,
apex-resolution-unit, java.test). No **test scaffolding** (`// vsdd:scaffold`) was needed —
grammar, provider, and registration all exist from WI-1/WI-2, so there is no scaffold ledger
for WI-3.

**Current certified tally (post Gate-3 round-1 fixes F1/F2, 2026-07-02):** **111 tests
(101 integration + 10 unit) — 65 red / 46 pass**; peers 312/312 green. Gate-3 F1 added the
`new Outer.Inner()` constructor-edge assertion to the four nested-qualified `it`s (they were
already red on the `i.ping()` arm; the ctor arm is red too — §8 requires both reference kinds).
Gate-3 F2 strengthened the interface declaration-only `it` from a single `find()` to a
count===2 assertion over both the exact-case `v.act()` and the case-varied `w.act()` arms
(measured 0 edges pre-impl → red; a single-arm resolution now fails rather than greening). No
`it` count change — both fixes tightened existing red tests.

**Phase-5 v1.28 re-arm (2026-07-06):** the SRS-v1.28 F1/F2 corrections (BL-12 same-case type
duplicate = NO record; BL-5 same-case twin super arms RESOLVE to the parent, re-attributed
BL-7→BL-8, BL-7 now the BL-3 dotted shape only) required NEW behavioural coverage the suite
lacked — the NestSub/TwinSub fixtures were empty-bodied and the Samey fixtures were unexercised.
**5 pins added** (`apex-cross-file.test.ts`: **106 integration + 10 unit = 116**; peers 312/312):
two NestSub super arms (BL-7 self-loop / no-ctor), two TwinSub super arms (BL-8 resolve to parent
member + ctor), one Samey same-case no-record. All assert already-implemented, **probe-verified
(2026-07-06)** behaviour — they are ratified regression pins, green by construction (Step 3b is
DONE at 111/111; there is no pre-impl red state for a Phase-5 addition to a shipped work item —
the inc-14 CaseKid-super precedent). No impl touched; no `it` regressed. See the dedicated
subsection below for their no-red justifications.

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
  the case-varied constructor `new ENGINE()` — the §7(11) callsite-folding reliance arm.
  (The case-varied HERITAGE arm `CaseKid extends BASE implements IFACE` is NOT a red arm —
  §7(11) declares it moot (pre-hook pass, workspace keys unreachable) and SRS v1.8(i)
  ratifies it UNRESOLVED; its test asserts EXTENDS/IMPLEMENTS absence and is a green
  limitation pin, listed under the conservative-negative section — Gate-3 R2-F2 correction.)
- Implicit-this inherited member (`inherited()` inside Child, the own-scope-MRO form) —
  red alongside the typed-receiver form `c.inherited()`.
- Enum-constant access via type-name receiver: `Color.RED`, trigger `Level.HIGH` (unlike
  static Property access, which the fallback channel provides).
- Nested-type qualified access `Outer.Inner` — BOTH the `new Outer.Inner()` constructor edge
  AND the `i.ping()` instance-member edge (§7(5), §8 two-kind requirement; Gate-3 F1), across
  the exact / outer-varied / tail-varied / doubly-varied fixtures.
- Interface declaration-only typed variables — BOTH `Iface v; v.act()` AND case-varied
  `IFACE w; w.act()` resolve to `Iface.act` (§3 Interface arm, §8 both arms; Gate-3 F2 —
  asserted as count===2 so a single-arm miss fails).
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
- Cross-file constructor overload, exact-case positive (`new CtorTarget(7)` → the Integer
  Constructor node): already green — the exact-case channel resolves declared-ctor classes
  with Constructor-node refinement pre-hook (the Addendum-4 `super()` analog). Kept as
  acceptance + regression guard; its undisambiguable arm is genuinely red.
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
- Same-case duplicate (`class Samey` ×2, R4 / v1.28-F1): zero edges from SameCaller AND no
  `suppressed` record — the exact-case channel's single-match guard (probed) + the §3
  inject-none guard bind nothing, and a same-case TYPE-name collision is discharged by
  EDGE-ABSENCE ALONE (BL-12 same-case arm; distinct from the member-name case-collision, which
  DOES record). The assertion was added in the v1.28 re-arm (2026-07-06) — see the Phase-5
  subsection; must STAY green at any future change (the injection must not create a bindable
  key for the tie, and the tie must not manufacture a REQ-015 record).
- Lone-trigger reference (`new Lone()`, R4): binds the trigger def via the exact-case
  channel's unique key — already-green pin of the REQ-004 v1.6 corrected-exception
  behaviour (probed + re-ratified 2026-07-02); must stay green at Step 3b (the exclusion
  keeps it off the bindings channel; the exact-case channel is untouched).

## Phase-5 v1.28 heritage-super pins (2026-07-06 re-arm — no-red justification)

SRS v1.28 (F2/F3) split the heritage-downstream super arms by superclass SHAPE, and the suite
had no assertion exercising the split — the NestSub/TwinSub fixtures carried only an
EXTENDS-absence pin over an empty body. These 5 pins assert already-implemented,
**probe-verified (2026-07-06)** behaviour; there is no pre-impl red state because Step 3b is
DONE (111/111) — a Phase-5 addition to a shipped work item is green by construction (the same
category as inc-14's CaseKid super pins and the dogfood-#20 fallback-channel greens). Exemption
ladder: rung (1) — behaviourally consequential AND tested; the failing state is a regression
(a future mis-attribution of a super arm), not a pre-impl red. Each is a regression guard that
fails if the BL-7/BL-8 distinction is ever collapsed. No impl was touched to add them.

- **NestSub super.ping() SELF-LOOPS (BL-7, SRS v1.10(iii)).** The dotted `Outer.Inner`
  superclass folds to `outer.inner` — no simple-name workspace key — so the super-receiver
  synthesis misses the bindings channel and falls back to the enclosing class: `super.ping()`
  binds `Method:NestSub.cls:NestSub.ping` (its OWN override), NEVER `Outer.Inner.ping`. Probe:
  `CALLS callPing -> ping @ NestSub.cls`. Fails if a future change resolves the dotted super
  arm to the nested parent (which would silently contradict the pinned BL-3 limitation).
- **NestSub super() resolves NOTHING (BL-7, SRS v1.10(iii)).** No ctor CALLS edge from NestSub
  to a parent type — edge-absence, consistent with the unresolved dotted heritage. Probe: no
  `NestSub -> Inner/Outer` edge. Fails if super() ever manufactures a ctor edge to the
  unreachable nested parent.
- **TwinSub super.spin() RESOLVES to the parent (BL-8, SRS v1.10(v)).** Unlike the dotted
  shape, the same-case twin's SIMPLE-NAME superclass `Twin` folds to a single bindings-channel
  hit (the twin trigger is §3-excluded), so `super.spin()` binds `Method:Twin.cls:Twin.spin`
  (the parent), NOT TwinSub's own override — the two channels have independent reach (the
  heritage EXTENDS edge still refuses, per the v1.10(v) pin above). Probe: `CALLS callSpin ->
  spin @ Twin.cls`. Fails if the twin super arm self-loops (the BL-7 behaviour) or stays
  unresolved.
- **TwinSub super() RESOLVES to the parent ctor (BL-8, SRS v1.10(v)).** `super()` binds
  `Constructor:Twin.cls:Twin.Twin`. Probe: `CALLS TwinSub -> Twin @ Twin.cls`. Fails if the
  twin super() ctor arm stops resolving.

(These required minimal fixture bodies: NestSub/TwinSub gained a ctor `super()`, an own-method
override, and a `super.<m>()` call site; Twin gained an explicit ctor + `virtual` on `spin` so
the override/super distinction is expressible. The pre-existing EXTENDS-absence pins over these
fixtures stay green — the bodies do not change heritage resolution.)

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
- Scoped REQ-006 no-false-suppressed assertions: the **main** fixture assertion passes now
  (its resolving names — including the Gate-3 R2-F1 additions Inner/ping/UP/DOWN/act/BLUE —
  are plain-misses or resolves, so nothing is suppressed) and is a regression guard; the
  **trigger** fixture assertion is genuinely RED now (the `log` overload is mis-recorded as
  `overload-ambiguous` pre-impl — see the trigger-body overload item above), and its R2-F1
  additions ring/snap/next/LOW/size are plain-misses that add no suppression. Both become
  fully meaningful at Step 3b.
- Case-varied HERITAGE `CaseKid extends BASE implements IFACE` → 0 EXTENDS / 0 IMPLEMENTS
  from CaseKid (ratified SRS **v1.8(i)** limitation pin; §7(11) declares the heritage arm
  moot — the pre-hook inheritance pass runs before the injection and its workspace keys are
  unreachable, Addendum 9). Green pre- AND post-impl (pure registration cannot serve
  heritage); a regression guard that fails if a future change ever mis-binds the case-varied
  clause. Gate-3 R2-F2 moved this here from the genuinely-RED inventory (it was mis-filed as
  a §7(11) red arm; the `new ENGINE()` ctor is the only §7(11) red arm).

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

## Planned manual-acceptance (§A.10) — Gate-3 F3 disposition (Architect-signed 2026-07-02)

SDD-003 **§7(14) — Plain-miss internal record** is a `[Gate-3 reliance]` whose validation
vehicle is environment-visible (an internal host counter/log, not a graph edge), so it is not
discharged by an automated assertion. The black-box contract IS automated (edge absence — the
conservative-negative collision/misfile assertions above); this record covers the residual
internal-record question that §7(14) raises. Gate-3 F3 (test-validator, 2026-07-02):
Architect-dispositioned route **(a) — record a planned manual-acceptance entry**.

- **MA-WI3-001 (planned).** *Obligation:* confirm whether the host's internal unresolved
  counter fires for a pass-level typed-receiver guard-miss (the §2 plain-miss path), by
  inspecting the host's resolve stats / log output during Step-3b validation.
  *Vehicle:* environment-visible inspection (resolve-stats dump / debug log at a plain-miss
  callsite — e.g. the collision `d.hit()` or misfile `r.sneak()` fixtures, whose keys the §3
  inject-none guard never creates).
  *Pass condition:* NON-BLOCKING for the WI-3 black-box contract — the SRS v1.7 observable is
  edge absence, already automated. This MA only settles the internal-record question.
  *Named escalation (§7(14)):* **if no internal record fires**, the disposition is a named
  escalation to re-ratify the SRS v1.7 interpretation as "no record exists for plain misses" —
  never a silent discharge. Recorded here so the inspection is tracked, not assumed.
  *Status:* `planned` (to be executed and recorded at Step-3b validation).
