# Work-Item Decomposition — Apex Support (SRS-001)

*VSDD §A.9 (work items) + §A.14 (light-SRS slices). The formal cut of epic SRS-001 into atomic,
independently-deployable work items, reviewed **as a set** at the Gate 1 decomposition checkpoint
(Phase 1 decomposition bridge) before any item enters Phase 2: slice fidelity, coverage of every
epic REQ-NNN, dependency acyclicity, criticality correctness (Core Principle 9).*

- **Parent epic:** SRS-001 (INTENT-001) · **Constitution:** CONST-gitnexus-apex v1.1.0
- **Status:** **Gate 1 decomposition checkpoint CLEARED (PASS_CLEAN, 2026-06-28)** — 3 fresh-context
  adversary rounds (FAIL→FAIL→PASS_CLEAN); pass record `.vsdd/pass-records/gate1-decomposition.md`,
  findings `.vsdd/findings/gate1-decomposition.md`. Work items valid for Phase 2 entry.
- **Execution mode (Architect-chosen, 2026-06-28):** **per-item / vertical** — host-API uncertainty
  dominates, so build WI-1 first to validate the foundation, then design WI-2…4 on validated ground.

## Per-item state ledger (the authoritative per-WI tracker)

*The project `state.json` is project-level and tracks only the **active/lead** item (a known plugin
limitation — fold-back #8). This table is the authoritative per-item state until the plugin gains a
per-item state machine. Keep it current as each item advances.*

| Item | WI | Status | Phase | Gates cleared | Artifacts |
|---|---|---|---|---|---|
| ITEM-001 | WI-1 parse & graph | **DONE** (Gates 1–5) | 6→done | 1, 1-decomp, 2, 3, 4, 5 | light-SRS ✓, SDD-001 v1.2.1 ✓, pass-records gate1/decomp/2/3/4/5 ✓; impl green |
| ITEM-002 | WI-2 resolution mechanics | **DONE** (Gates 1–5) | 6→done | 1, 1-decomp, 2, 3, 4, **5** | light-SRS ✓, SDD-002 ✓ (+ USES clarification #20; REQ-008 param-arg narrowing → WI-4), SRS v1.3, Constitution v1.1.1, pass-records gate2-wi2/gate3-wi2/gate4-wi2/**gate5-wi2** ✓; **impl GREEN — 29 integration + 7 unit anchors + 25 Gate-5 hardening; full resolver surface + peers green (NFR-002 holds)**. Gate 4: Pass 1 PASS_FIXED (8 cold rounds), Pass 2 PASS_ACCEPTED (2 cold rounds), Adam-signed 2026-06-30. Gate 5 (Phase 6): fuzz (24-input corpus + 10k smoke-fuzz, 0 crashes) + 8/8 mutants killed + purity audit, all PASS, Adam-signed 2026-06-30 |
| ITEM-003 | WI-3 cross-file & trigger | **active** | **Step 3b DONE (111/111 green); Gate-1 Phase-5 cascade re-CLEARED (PASS_CLEAN 2026-07-06, `gate1-wi3-phase5`); NEXT = Gate 2** | 1, 1-decomp, **1-phase5-recleared**, 2 (re-cleared), 3 | **Step 3b DONE 2026-07-04 (incs 13–16, 111/111; HEAD was `40e54caa`).** **Gate-1 Phase-5 cascade CLEAR (`30b2701d`, 2026-07-06):** the Step-3b SRS edits (v1.12 super→Base ratify, v1.13 poisoned-MRO ratify) cascade-invalidated Gate 1; re-armed → **15 cold context-free rounds → PASS_CLEAN**; **SRS v1.13→v1.27, Constitution v1.1.1→v1.1.3**; new **§5.1 Bounded Limitations Register BL-1…BL-14** (single source of truth); Constitution v1.1.2 §1.2 admits (a) valid-source false edges + (b) invalid-source channel binds, v1.1.3 register re-point; §A.8 REQ-015 consolidation (R3) + Register (R4) Architect-elected; heritage limits = WI-4-deferred shortfalls; case-insensitivity scope corrected (case-varied non-heritage resolves, verified green). Pass record `gate1-wi3-phase5.md`. **Downstream Gate-2/3/4/5 pass records now invalidated (Phase-5) → re-arm next.** light-SRS ✓ (+ REQ-008 cross-file-receiver + super-delegation), **SDD-003 ✓ (amended 2026-07-02: §1 two-channel model + fallback-channel §A.13 limitation, Architect-accepted)**, **RESEARCH-003 ✓** (§A.6 + 3 addenda), SRS **v1.11** (v1.4 REQ-011 type-usage; v1.5 REQ-015 exact-case-channel exception, probe-corrected; v1.6 REQ-010/REQ-004 misfile + lone-trigger exceptions, probe-corrected; v1.7 REQ-015 record-observability interpretation; v1.8 REQ-007/REQ-010 heritage-form limitations; v1.9 REQ-010 fragment-collision exception; v1.10 REQ-007 nested-parent + same-case-twin heritage limitations; v1.11 heritage-downstream consequences (probe-corrected: super self-loop) + misfiled-trigger collision — all 2026-07-02, Architect-ratified), pass-record gate2-wi3 **SUPERSEDED** (Phase-5 cascade) → **gate2-wi3-r2 PASS_FIXED (40 cold context-free rounds → clean; Adam-signed 2026-07-02)**. **Step 3a ✓:** 111 tests (integration + unit), 65 red / 46 pass (fallback-channel already-greens ledgered), peers 312/312 green; red-gate `tdd/WI-3-red-gate.md` + findings `tdd/WI-3-step3a-findings.md`. **Gate 3 CLEARED — gate3-wi3 PASS_FIXED (3 cold `vsdd-test-validator` rounds: 3·3·clean; Adam-signed 2026-07-02): F1 nested ctor edge + F2 both interface arms + F3 §7(14) planned MA-WI3-001; R2-F1 REQ-006 set completeness + R2-F2 ledger heritage recategorize + R2-F3 §7(7) Hidden.cls pin.** Edge-source reliance validated TRUE (host attributes trigger-body edges to the container natively). Design: Seam B `populateNamespaceSiblings` (pure registration) + OWNING-SCOPE top-level discriminant (the qualifiedName discriminant was found structurally false — RESEARCH-003 Addendum 7) + inject-none collision guard (bindings channel); RESEARCH-003 ✓ (§A.6 + addenda 4–17) |
| ITEM-004 | WI-4 parity & external | proposed | — | (epic 1+decomp) | light-SRS ✓; SDD pending |

**Dependency-DAG execution (refines the binary mode):** the run follows the dependency graph, not a
global vertical/horizontal switch — independent items may parallelise; a dependency chain is sequential;
and the vertical-vs-batched choice can differ per subgraph. Here the DAG is essentially a chain
(001→002→003→004, +002→004), so there is little to parallelise; WI-1 runs vertically to validate the
foundation, then WI-2…4 follow in order.

## Coverage map (every epic REQ/NFR → exactly one owning work item)

| REQ / NFR | Owning WI | | REQ / NFR | Owning WI |
|---|---|---|---|---|
| REQ-001 (recognition) | WI-1 | | REQ-009 (field/property chains) | WI-2 |
| REQ-002 (type container nodes) | WI-1 | | REQ-010 (cross-file binding enabler) | WI-3 |
| REQ-003 (member nodes) | WI-1 | | REQ-011 (trigger-body refs) | WI-3 |
| REQ-004 (trigger container nodes) | WI-1 | | REQ-012 (Java/Kotlin parity) | WI-4 |
| REQ-014 (annotation metadata) | WI-1 | | REQ-013 (external-ref handling) | WI-4 |
| NFR-003 (per-file budget) | WI-1 | | REQ-005 (unambiguous ref resolution) | WI-2 |
| REQ-015 (conservative skip) | WI-2 | | REQ-006 (no false unresolved) | WI-2 |
| REQ-008 (overload resolution) | WI-2 | | REQ-007 (extends/implements edges) | WI-2 |
| NFR-004 (resolution test) | WI-4 | | | |

**REQ-015 v1.5/v1.7, REQ-004 v1.6, REQ-007 v1.8/v1.10/v1.11, and REQ-010 v1.8/v1.9/v1.11 exception
acceptances complete at WI-3** (recorded 2026-07-02, Architect-approved): the SRS v1.5 exact-case-channel exception, the v1.6
misfile/lone-trigger exceptions, the v1.7 observability interpretation, the v1.8 heritage-form
limitations (extended v1.10: nested-parent + same-case-twin heritage), and the v1.9 fragment-collision
exception are ratified epic-level amendments whose pinning
fixtures (duplicate-name ctor, same-case duplicate, lone-trigger, misfiled-class/trigger, collision
observability, case-varied-heritage unresolved, twin-heritage trigger-bind, nested-parent-heritage
unresolved/decoy-mis-bind, same-case-twin-heritage unresolved) ship in WI-3's Gate-3
suite — WI-3 completes these exception acceptances without re-owning REQ-015 (WI-2), REQ-007 (WI-2), or
REQ-004 (WI-1), mirroring the REQ-008 cross-file-receiver completion entry.

**REQ-009 is owned solely by WI-2** (the resolution *mechanic*). WI-3 owns **REQ-010**, the cross-file
*binding enabler* — the implicit-namespace mechanism that lets every WI-2 mechanic (calls, types,
chains, …) reach across files. WI-3 co-owns no WI-2 mechanic REQ; it owns the one enabler that
completes their inherently-cross-file epic §9 scenarios end-to-end (see WI-2 / WI-3 below).

**REQ-008 stays owned by WI-2** (the overload-resolution mechanic), verified within its single-
declaration-unit acceptance for local/field/literal/constructor argument types. It has **two distinct
deferred completions** (each a *completion*, not co-ownership):
- the **cross-file-receiver** form — an overloaded call whose receiver type is defined in another file —
  completes at **WI-3** via the REQ-010 enabler (REQ-010 making WI-2's REQ-008 mechanic reach across files,
  exactly as it does REQ-005/007/009; this is the *dominant real-world Apex case*, since every class is its
  own file). Added to ITEM-003 at WI-3 Gate-2 round 3 (2026-06-30, Architect-approved — "as long as it gets
  covered, the division of labour is fine"); and
- the **parameter-typed argument** narrowing — typing a method-parameter used as an overload argument —
  completes at **WI-4** (it needs WI-4's REQ-013 external-type detection to tell a user-defined parameter
  type from an external one).
These are orthogonal sub-cases (cross-file receiver with a local/literal arg vs. a parameter-typed arg), so
they sit in different WIs without conflict.

**Receiver-*variable*-name case-fold (case-insensitivity completeness) → WI-4.** WI-2's §2.2 seam folded
type and member names but deferred folding a receiver *variable*'s name (its "§2.2 ceiling"); SDD-002 noted
revisiting it at WI-3. WI-3 does **not** need it — a variable is method-local and never crosses a file
boundary, and **no epic §9 acceptance scenario varies a variable's case** (cross-file reach keys on type and
member names, already folded). It is therefore a case-insensitivity **completeness** item parked at **WI-4**
(parity hardening), owned there against REQ-005/REQ-008 case-insensitivity — recorded here so it is not a
floating prose deferral. Surfaced at WI-3 Gate-2 round 4 (2026-06-30).

**Cross-cutting (per epic SRS §11 — gates on *every* WI, not single-owned):** **NFR-001** (malformed/
incomplete input → the *run* completes without crashing; the unparseable file is skipped) and
**NFR-002** (no regression of other languages). NFR-001 is a *whole-run* property: a malformed or
incomplete Apex file must not crash the run at any stage, and incomplete input can reach the resolution
stages as well as the parse stage — therefore each WI carries its own slice of NFR-001:
- **WI-1** — the parse-stage slice (SECT-001 trust boundary): a malformed/over-budget file is skipped
  and the run continues.
- **WI-2/WI-3/WI-4** — the resolution-stage slice: resolution completes without crashing on incomplete
  input and on references into skipped files (an unresolved reference is left unresolved, never a throw).

Every in-scope epic REQ-001…015 is covered by exactly one owning WI; NFR-003 → WI-1, NFR-004 → WI-4,
and NFR-001 + NFR-002 cross-cut every WI (epic §11). Deferred REQ-101…106 are out of this cycle (epic
SRS §10) and own no work item. (REQ-014 is scoped to member-level annotations per SRS v1.1; type-level
annotation capture is the deferred REQ-106.)

---

## ITEM-001 — WI-1: Parse & graph population

- **Single responsibility:** Integrate the Apex grammar and populate the graph with user-defined
  Apex container and member nodes (no reference resolution).
- **Requirement links:** REQ-001, REQ-002, REQ-003, REQ-004, REQ-014, NFR-003. SEC-001 instance
  (CWE-20 untrusted-source parsing, per Constitution SECT-001) to be authored in this item's SDD.
- **Owner / assignee:** claude (Builder) — assigned.
- **Criticality:** **security-critical = true.** WI-1 introduces the Apex parse path — the SECT-001
  untrusted-input trust boundary (it is the only WI that parses raw repository source; WI-2…4
  consume WI-1's safe-parsed output). *Architect approval: pending checkpoint sign-off (Adam);
  rationale: introduces the untrusted-source tree-sitter parse path.*
- **Dependencies:** none. Independently deployable — the graph populates (nodes, containment) before
  any resolution exists; this is exactly the host's Swift-tier "parse first" slice.
- **Status:** active (Phase 2 SDD authorship).
- **Artifact pointers:** light-SRS slice = below; SDD = `.vsdd/SDD.md` (WI-1 section, Phase 2);
  tests = `gitnexus/test/integration/resolvers/apex.test.ts` (+ malformed-input no-crash test).

### Light SRS (WI-1)

- **Inherited epic slice:** SRS-001 §5 Graph population + Recognition + Metadata; §6 NFR-003; §9
  scenarios for REQ-001/002/003 and REQ-004 (node half), REQ-014, NFR-003, NFR-001.
- **EARS requirements:** REQ-001, REQ-002, REQ-003, REQ-004 (container-node creation only — the
  trigger→symbol *edge* is REQ-011/WI-3), REQ-014, NFR-003. Verbatim text in the epic SRS; carried
  forward unchanged.
- **Gherkin acceptance criteria** (epic SRS §9 scenarios, tagged by confirmation mode):
  - "Apex classes and members enter the graph" (REQ-001/002/003) — **automated**.
  - "A trigger resolves a call to a user-defined handler" — **partial: automated**, *only the
    container-node half* ("the graph contains a container node for the trigger"). The resolved-edge
    half is WI-3 (REQ-011) and is out of WI-1's acceptance.
  - "Annotations are captured as metadata" (REQ-014) — **automated**.
  - "An over-budget Apex file is skipped at the same threshold as peers" (NFR-003) — **automated**.
  - "Malformed Apex does not crash the run" (NFR-001 — WI-1's **parse-stage slice**: a malformed or
    over-budget file is skipped and the run continues) — **automated**.
- **Dependencies & criticality:** dependencies none; security-critical = true (SECT-001, as above).
  Cross-cutting acceptance: NFR-001 (parse-stage slice) + NFR-002.

---

## ITEM-002 — WI-2: Resolution mechanics

- **Single responsibility:** Implement the user-defined Apex reference-resolution *mechanics* — call,
  constructor/type-usage, inheritance/implementation, overload, and field/property-chain resolution,
  plus conservative skip of ambiguous references.
- **Requirement links:** REQ-005, REQ-006, REQ-015, REQ-007, REQ-008, REQ-009. (REQ-009 in full —
  WI-3 owns no resolution mechanic, only the cross-file *enabler* REQ-010.)
- **Owner / assignee:** claude (Builder) — assigned.
- **Criticality:** **security-critical = false.** Operates on WI-1's parsed output, not on raw source;
  it introduces no new untrusted-source parse path (the SECT-001 boundary is owned by WI-1). *Architect
  approval: pending checkpoint sign-off (Adam); rationale: no new trust boundary, operates on parsed
  output.*
- **Dependencies:** ITEM-001 (needs the graph nodes to resolve against).
- **Status:** proposed.
- **Artifact pointers:** SDD WI-2 section (later); tests in `apex.test.ts`.

### Light SRS (WI-2)

- **Inherited epic slice:** SRS-001 §5 Reference resolution (user-defined) — the resolution
  algorithms — excluding the cross-file *binding enabler* (REQ-010) and trigger-body resolution
  (REQ-011), both WI-3; §9 scenarios for REQ-005/006/015/007/008/009.
- **EARS requirements:** REQ-005, REQ-006, REQ-015, REQ-007, REQ-008, REQ-009 (verbatim in the epic
  SRS). WI-2 owns each *mechanic* in full; cross-file reach for all of them is supplied by WI-3's
  REQ-010 enabler, not by co-ownership.
- **Acceptance boundary (resolves the file-boundary ambiguity of the epic §9 scenarios):** WI-2's own
  acceptance is verified within a **single declaration unit** (one top-level type and its nested types)
  — the scope that exercises every mechanic without the cross-file enabler. The epic §9 scenarios that
  are *inherently cross-file* as written (REQ-005's "two classes"; REQ-009's "different files" chain; **and
  REQ-007's top-level `extends`/`implements`** — in Apex every top-level type is its own file, so top-level
  inheritance between user-defined types is inherently cross-file) are **completed end-to-end at WI-3** once
  REQ-010 lands; they are not claimed as single-unit acceptance here. WI-2 verifies only the **nested-type**
  inheritance analog in-unit. WI-2 remains independently *deployable* (it resolves references within a declaration
  unit immediately).
- **Gherkin acceptance criteria** (epic SRS §9; **automated**; WI-2 form verified within a single
  declaration unit):
  - "An in-repository method call resolves with no unknown symbol" (REQ-005/006) — single-declaration-
    unit case; the two-file form completes at WI-3.
  - "An ambiguous in-repository reference is left unresolved, not mis-bound" (REQ-015).
  - "Inheritance and interface implementation resolve" (REQ-007) — single-declaration-unit case.
  - "Overloaded method resolves by argument shape" (REQ-008), in the three SRS v1.2 §9 forms: "Overload
    selection by exact parameter type" → resolves; "Overload selection on an assignable argument,
    disambiguated by arity" → resolves; "Overload selection on a genuinely-undisambiguable assignable
    argument" → REQ-015 unresolved. (Arity-then-exact-type narrowing; no assignability ranking.)
    *WI-2's exact-type narrowing infers argument static types for local-variable, field, literal, and
    constructor-expression arguments; a method-**parameter** used as the disambiguating argument is left
    untyped (conservative → arity-only, never mis-bound). **Parameter-typed argument narrowing completes
    at WI-4** — it requires WI-4's REQ-013 external-type detection to avoid mis-resolving an external-typed
    parameter argument (the §4 external-arg case), exactly as WI-3's REQ-010 completes the cross-file forms.*
  - Field/property-chain resolution (REQ-009) — single-declaration-unit case; the cross-file chain
    scenario completes at WI-3.
- **Dependencies & criticality:** depends on ITEM-001; security-critical = false. Cross-cutting
  acceptance: NFR-002, and NFR-001's **resolution-path slice** — resolution completes without crashing
  on partial / error-recovery trees and on references into skipped files (conservative skip, no throw).

---

## ITEM-003 — WI-3: Cross-file binding & trigger resolution

- **Single responsibility:** Supply the implicit-namespace cross-file *binding enabler* that lets the
  WI-2 mechanics reach across files without an explicit import, and resolve user-defined references
  from trigger bodies.
- **Requirement links:** REQ-010, REQ-011. (REQ-010 is the cross-file enabler; it completes — does
  not co-own — the WI-2 mechanic REQs' inherently-cross-file epic §9 scenarios.)
- **Owner / assignee:** claude (Builder) — assigned.
- **Criticality:** **security-critical = false.** Consumes parsed artifacts; no new parse path.
  *Architect approval: pending checkpoint sign-off (Adam); rationale: as WI-2.*
- **Dependencies:** ITEM-002 (the cross-file enabler operates on the WI-2 mechanics; trigger-body
  resolution reuses them).
- **Status:** proposed.
- **Artifact pointers:** SDD WI-3 section (later); tests in `apex.test.ts`.

### Light SRS (WI-3)

- **Inherited epic slice:** SRS-001 §5 REQ-010, REQ-011; §9 cross-file chain scenario + the
  resolved-edge half of the trigger scenario.
- **EARS requirements:** REQ-010, REQ-011 (verbatim in the epic SRS).
- **Gherkin acceptance criteria** (epic SRS §9; **automated**):
  - "Cross-file field/property chain resolves without an import" (REQ-010 enabler applied to the
    REQ-009 mechanic) — the two-file form of the chain scenario WI-2 verified same-unit.
  - The **two-file form** of "An in-repository method call resolves with no unknown symbol"
    (REQ-005/006 via the REQ-010 enabler) — completing end-to-end the scenario WI-2 verified
    same-unit. (No new REQ — this is REQ-010 making the WI-2 mechanic reach across files.)
  - The **top-level form** of "Inheritance and interface implementation resolve" (REQ-007 via the REQ-010
    enabler) — a top-level class `extends`/`implements` a user-defined type in another file; completing
    end-to-end the inheritance scenario WI-2 verified only in its nested-type analog. (No new REQ — REQ-010
    making the WI-2 REQ-007 mechanic reach across files, exactly as for REQ-005/009.)
  - The **top-level-parent form** of constructor/method delegation — `super()` / `super.method()` to a
    top-level superclass in **another file** (REQ-005 delegation sub-clause via the REQ-010 enabler) —
    completing end-to-end the delegation WI-2 verified only for a nested-sibling parent. (No new REQ —
    REQ-010 making WI-2's REQ-005 `super`-delegation reach a top-level parent across files, exactly as for
    REQ-005/007/009. Surfaced at WI-3 Gate-2 round 1; reconciled into the decomposition 2026-06-30.)
  - The **cross-file-receiver form** of "Overloaded method resolves by argument shape" (REQ-008's cross-file
    completion via the REQ-010 enabler) — a call `B.f(arg)` where overloaded type `B` is in another file →
    resolves the overload by the same arity+exact-type narrowing WI-2 verified same-unit. (No new REQ —
    REQ-010 making WI-2's REQ-008 mechanic reach across files; the *dominant real-world Apex case*. The
    distinct parameter-typed-argument completion stays WI-4 — see the coverage-map REQ-008 note. Surfaced at
    WI-3 Gate-2 round 3; Architect-approved 2026-06-30.)
  - "A trigger resolves a call to a user-defined handler" — the **resolved-edge half** (REQ-011),
    completing the scenario whose container-node half WI-1 delivered.
- **Dependencies & criticality:** depends on ITEM-002; security-critical = false. Cross-cutting
  acceptance: NFR-002, and NFR-001's **resolution-path slice** — cross-file/trigger resolution
  completes without crashing on partial / error-recovery trees and references into skipped files.

---

## ITEM-004 — WI-4: Parity hardening & external handling

- **Single responsibility:** Demonstrate Java/Kotlin-tier resolution parity on equivalent fixtures
  and handle external (stdlib/sObject/managed-package) references as benign unresolved, not defects.
  WI-4 also **completes REQ-008's parameter-typed-argument narrowing**, deferred by WI-2: typing a
  method-parameter used as an overload argument requires distinguishing a user-defined parameter type
  from an external one — the same REQ-013 external-type detection WI-4 introduces — without which the §4
  external-arg overload case would mis-resolve. (WI-4 *completes* this REQ-008 sub-case; it does not
  co-own the REQ-008 mechanic, which stays WI-2 — exactly as WI-3/REQ-010 completes WI-2's cross-file forms.)
- **Committed WI-3-carried limitations to resolve here (Architect-committed, Adam 2026-07-04):**
  - **Nested-parent cross-file heritage reorder (SRS v1.10(iv)/v1.11(b) → v1.13 documented limitations).**
    The heritage pre-pass (`preEmitInheritanceEdges`) runs BEFORE the WI-3 cross-file registration, so a
    nested-parent clause (`class Sub extends TOuter.TInner`) can't see the nested type cross-file and
    falls back to a same-tail top-level decoy — mis-binding the EXTENDS edge (v1.10(iv), pin 767) and, via
    the mis-bound MRO, letting `s.decoy2()` resolve into the decoy's member (v1.13 ratified poison). **Fix
    = the generic pipeline reorder** (resolve heritage AFTER the cross-file registration channel is
    populated), promoted here from a *noted candidate* to a **committed WI-4 deliverable**. Eliminating the
    mis-bind removes both the false EXTENDS edge and its poisoned-MRO member consequence; the v1.10(iv)/
    v1.13 fixtures (`apex-cross-file-collision` TailSub/TailMro/TInner) flip from documented-limitation pins
    to correct-resolution assertions. Generic (peer-affecting) reorder → its own §2.2 + adversary review.
- **Requirement links:** REQ-012, REQ-013, NFR-004. (Completes the REQ-008 parameter-arg-narrowing
  sub-case WI-2 deferred — see WI-2 acceptance criteria above; not a new REQ, a deferred completion.
  Plus the committed nested-heritage reorder above — the resolution of the WI-3 v1.10(iv)/v1.13
  documented limitations.)
- **Owner / assignee:** claude (Builder) — assigned.
- **Criticality:** **security-critical = false.** Test fixtures + external-reference classification;
  no parse path or trust boundary. *Architect approval: pending checkpoint sign-off (Adam);
  rationale: test/parity hardening, no trust boundary.*
- **Dependencies:** ITEM-002 and ITEM-003 (parity is measured over the full resolution surface; the
  benchmark fixtures exercise same-file *and* cross-file capabilities).
- **Status:** proposed.
- **Artifact pointers:** SDD WI-4 section (later); parity + external-ref tests in `apex.test.ts`.

### Light SRS (WI-4)

- **Inherited epic slice:** SRS-001 §5 Parity and external handling (REQ-012, REQ-013); §6 NFR-004;
  §9 parity + external-reference scenarios.
- **EARS requirements:** REQ-012, REQ-013, NFR-004. Verbatim in the epic SRS.
- **Gherkin acceptance criteria** (epic SRS §9, **automated**):
  - "Apex resolution reaches Java/Kotlin parity" (REQ-012).
  - "A standard-library reference is external, not a defect" (REQ-013).
  - NFR-004 — the existence of an automated resolution test comparable to peer languages
    (satisfied by `apex.test.ts`; **automated**).
- **Dependencies & criticality:** depends on ITEM-002, ITEM-003; security-critical = false.
  Cross-cutting acceptance: NFR-002, and NFR-001's **resolution-path slice** — parity + external-ref
  handling completes without crashing on partial / error-recovery trees.

---

## Dependency graph (acyclicity)

```
ITEM-001 ──▶ ITEM-002 ──▶ ITEM-003 ──▶ ITEM-004
                   └──────────────────▶ ITEM-004
```

A linear chain with one extra forward edge (ITEM-002 → ITEM-004). No back edges → **acyclic**.
Deployability order: 001, 002, 003, 004. Each is independently deployable in that order (001
populates the graph and ships value before any resolution; 002 adds same-file resolution; 003 adds
cross-file/trigger; 004 hardens parity + external handling).
