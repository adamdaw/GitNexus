# Software Requirements Specification — Apex Support for GitNexus

*Epic-tier SRS (VSDD §A.14). Business-facing **what** and **why**; no design or implementation
detail in the requirement obligations. The v1.5-onward bounded-limitation amendments cite host mechanism
as parity justification for *why* a limitation is forced; the obligation itself remains observable as a
source-shape → edge-present/absent outcome, with normative mechanism detail only in the SDD. Derived
from INTENT-001; reviewed against it and the Constitution at Gate 1.*

- **SRS-id:** SRS-001 · **Intent:** INTENT-001 · **Status:** Gate-1-cleared; **amended v1.1
  (2026-06-28)** — REQ-014 descoped to member-level; REQ-106 and REQ-107 minted (deferred). Driven by Gate 2
  finding G02; Architect-approved (Adam, 2026-06-28). A scope-reduction + deferral amendment; re-enters
  Gate 1 fidelity (verified by the fresh Gate 2 adversary reading SRS+SDD together).
  **Amended v1.2 (2026-06-29)** — REQ-008's head + its §9 assignable-overload scenario narrowed to the
  benchmark's arity + exact-type narrowing (the host implements no assignability ranking for any language).
  Driven by WI-2 Gate-2 findings (SDD-002 R3/R4); Architect-approved (Adam, 2026-06-29). A **deliberate
  scope reduction** of REQ-008's selection algorithm under Conservatism (Constitution §1.2) — NOT a pure
  clarification and NOT entailed by REQ-012 (which scopes parity to node/edge kind only). Re-enters Gate 1
  fidelity (verified by the fresh Gate 2 adversary reading SRS+SDD together).
  **Amended v1.3 (2026-06-30)** — REQ-005's **type-usage** sub-clause clarified: a type usage (`Account a;`)
  resolves as the declared-type **binding** that drives the variable's static type — observable via the
  member access it enables — NOT as a standalone resolved edge, because the Java/Kotlin benchmark emits no
  edge for a bare type declaration (REQ-012 parity). Driven by WI-2 Step-3b (dogfood #20 — a Gate-3 reliance,
  the assumed type-usage edge, found false against the real host) and already recorded as the SDD-002
  2026-06-30 clarification; Architect-approved (Adam, 2026-06-30). A **clarification** aligning the text to
  the parity-mandated behaviour (NOT a scope change). Re-enters Gate 1 fidelity (verified by the fresh Gate 2
  adversary reading SRS+SDD together).
  **Amended v1.4 (2026-06-30)** — REQ-011's **type-usage** sub-clause clarified to match REQ-005 v1.3: a bare
  declared-type usage in a trigger body resolves as the declared-type **binding** (no standalone edge),
  while constructor/static/method/field references still emit resolved edges. The same parity-mandated
  behaviour (no benchmark emits an edge for a bare type declaration — REQ-012) applied to REQ-011's "type"
  arm. Driven by WI-3 SDD-003 Gate-2 round 5 (a v1.3 clarification found to need parallel ratification for a
  sibling REQ sharing the pattern); Architect-approved (Adam, 2026-06-30). A **clarification**, not a scope
  change. Re-enters Gate 1 fidelity (verified by the fresh Gate 2 adversary reading SRS+SDD together).
  **Amended v1.5 (2026-07-02)** — REQ-015 + its §9 scenario: a bounded, invalid-source-only exception
  carved out for the host's language-uniform exact-case workspace fallback channel. WI-3 Step-3a
  validation against the real host found that channel resolves constructor, inheritance, and static
  type-name-receiver references workspace-wide (exact-case, first-match) independently of any
  per-language hook; on duplicate user-defined top-level type names — invalid Apex, reachable only in
  uncompiled source — it binds the exact-case match **only when that exact-case key is unique** (a
  case-variant duplicate); a same-case duplicate resolves **nothing** (the host's single-match guard —
  conservative). *(Text corrected 2026-07-02 after a same-case-tie probe: the originally ratified
  "ties: first-indexed" wording was empirically wrong in the unsafe direction; the host binds no tie.
  Correction re-ratified by the Architect same day.)* Suppressing it for Apex would require an Apex-specific edit to shared host
  machinery (Constitution §1 parity / §2.2). A **deliberate, bounded scope reduction**, NOT a
  clarification. Driven by WI-3 Step-3a findings (`.vsdd/tdd/WI-3-step3a-findings.md`);
  Architect-approved (Adam, 2026-07-02). Re-enters Gate 1 fidelity (verified by the fresh Gate 2
  adversary reading SRS+SDD together).
  **Amended v1.6 (2026-07-02)** — REQ-010 + REQ-004: two bounded, invalid-source-only misfile exceptions
  ratified at SRS level (extending the v1.5 pattern; previously SDD-side notes). (i) A class/interface/enum
  *mis-declared in a `.trigger` file* is excluded from the cross-file visibility registration — the
  source-file-extension discriminant is a deliberate, Architect-owned trade-off (an AST-level node-kind
  check is available to the registration hook but costs re-parse-fallback complexity for
  invalid-source-only shapes; ground corrected + re-affirmed 2026-07-02) — so its typed-receiver and
  case-varied cross-file forms remain unresolved (a REQ-010 liveness reduction). (ii) A trigger *mis-declared in a
  `.cls` file* passes that same discriminant and becomes globally referenceable — a reference to its name
  binds the trigger (a REQ-004 non-referenceability breach); additionally (probe-corrected and
  re-ratified 2026-07-02) a *correctly-filed* trigger whose name is referenced as a type from invalid
  referencing source binds via the host's exact-case single-match channel when no same-named class
  exists. All are reachable only in invalid,
  uncompiled Apex source; all are deliberate bounded scope reductions, NOT clarifications. Driven by WI-3
  Gate-2 re-review findings; Architect-approved (Adam, 2026-07-02). Re-enters Gate 1 fidelity (verified by
  the fresh Gate 2 adversary reading SRS+SDD together).
  **Amended v1.7 (2026-07-02)** — REQ-015 observability interpretation ratified: the "recorded as
  unresolved" obligation is dischargeable by a host-internal record for **plain-miss** shapes (no unique
  target exists or the name is simply absent); the externally-observable acceptance for a plain miss is
  the ABSENCE of any binding edge. A positive unresolved record on the analysis result is required —
  and asserted — wherever an **ambiguity reaches the resolver** (competing live candidates: overload
  ambiguity, case-collision among members). An interpretation note fixing the observable form of an
  existing SHALL, not a scope change. Driven by WI-3 Gate-2 re-review; Architect-approved (Adam,
  2026-07-02). Re-enters Gate 1 fidelity (verified by the fresh Gate 2 adversary reading SRS+SDD
  together).
  **Amended v1.8 (2026-07-02)** — REQ-007/REQ-010 heritage-form bounded limitations: the host resolves
  inheritance clauses in a pre-pass that runs BEFORE any per-language cross-file registration and
  suppresses those sites from retry, so no pure-registration design can serve them. Ratified: (i) a
  **case-varied** heritage clause (`class Sub extends BASE` — valid Apex) remains cross-file-unresolved
  (a valid-source **liveness** limitation; exact-case heritage resolves via the host's own channel);
  (ii) in the **case-variant trigger/class twin**, a heritage clause naming the trigger's exact case
  (`extends Twist` with `Twist.trigger` + `class TWIST`) binds the trigger (a valid-source,
  triple-narrow **safety** limitation — trigger + case-variant class + heritage reference in the
  trigger's case). Both parity-grounded (the pre-pass ordering is host-uniform across languages);
  the constructor and member forms of the twin remain committed to resolve to the class. Deliberate
  bounded scope reductions; the generic pipeline reorder is noted as a candidate upstream/WI-4 item.
  Driven by WI-3 Gate-2 re-review round 11; Architect-approved (Adam, 2026-07-02). Re-enters Gate 1
  fidelity (verified by the fresh Gate 2 adversary reading SRS+SDD together).
  **Amended v1.9 (2026-07-02)** — REQ-010 fragment-collision bounded exception promoted from the
  2026-06-30 SDD-side note (consistency with the v1.5–v1.8 ratification route): WHERE a malformed file's
  error-recovery re-parents a nested-type fragment to file scope AND its case-folded name collides with a
  legitimate top-level type's, the cross-file visibility registration conservatively registers neither —
  the valid type's typed-receiver/case-varied cross-file forms remain unresolved. Invalid-source-only
  (requires the malformed file), triple-narrow, liveness-only (no mis-bind). A deliberate bounded scope
  reduction; Architect-approved (Adam, 2026-07-02). Re-enters Gate 1 fidelity (verified by the fresh
  Gate 2 adversary reading SRS+SDD together).
  **Amended v1.10 (2026-07-02)** — REQ-007 nested-parent heritage limitations, extending v1.8 (the same
  pre-pass structural wall, probe-verified): (iii) a heritage clause naming a **nested** parent
  (`class Sub extends Outer.Inner` — valid Apex, parent in another file) remains cross-file-unresolved
  (liveness); (iv) WHERE an unrelated top-level type shares the nested parent's simple name (also valid
  Apex), the heritage clause can **mis-bind to that top-level type** (a valid-source, triple-narrow
  safety limitation — nested parent + same-named top-level type + heritage form); (v — added same day)
  the SAME-case valid trigger/class twin's heritage clause (`class Sub extends Foo`, `Foo.trigger` +
  `Foo.cls` both present) remains **unresolved** — the pre-pass sees two defs under the exact-case key
  and conservatively refuses (valid-source liveness, no mis-bind). All parity-grounded
  (the pre-pass runs before any per-language registration, host-uniform) and fixture-pinned as
  documented behaviour; the generic pipeline reorder remains the noted upstream/WI-4 candidate.
  Deliberate bounded scope reductions; Architect-approved (Adam, 2026-07-02). Re-enters Gate 1 fidelity
  (verified by the fresh Gate 2 adversary reading SRS+SDD together).
  **Amended v1.11 (2026-07-02)** — heritage-limitation downstream consequences + misfiled-trigger
  collision, extending v1.8–v1.10: (a) WHERE a heritage clause is unresolved under the v1.8(i)/
  v1.10(iii)/(v) limitations, the subtype's inherited-member references and `super()` remain unresolved
  too, and `super.method()` MIS-RESOLVES to the subtype's own override (probe-corrected + re-ratified
  2026-07-02: a self-loop bind — a valid-source mis-bind bounded to the already-ratified
  unresolved-heritage shapes; fixture-pinned as documented behaviour). **(Superseded for the v1.8(i)
  case-varied shape by v1.12 — see register BL-8** — under a case-varied heritage clause
  `super()`/`super.method()` DO resolve to the parent. This (a) pin now governs only the v1.10(iii)
  nested-parent shape (**register BL-7**): for it, `super()` and the
  inherited-member implicit-this reference remain unresolved, while `super.method()` still self-loops to
  the subtype's own override (a false edge). **Further superseded for the v1.10(v) same-case-twin shape by
  v1.28 F2 — see register BL-8:** its simple-name superclass resolves, so `super()`/`super.method()` DO
  resolve to the parent (like BL-1); only the inherited-member implicit-this arm stays unresolved.**)** (b) The v1.10(iv) mis-bound-heritage MRO surface was TRIPWIRED,
  not excused: acceptance asserted NO member edge into the mis-bound target; if implementation work
  showed the poisoned MRO mis-resolving members, that was to be escalated for its own targeted ratification,
  never silently absorbed. **(Superseded by v1.13 — the tripwire FIRED at Step 3b; the false member edge is
  ratified as register BL-6 (REQ-005/REQ-009 v1.15, the §9 poisoned-MRO scenario), so the "NO member edge"
  assertion no longer holds; WI-4 owns the fix.)** (c) WHERE a trigger mis-declared in a `.cls` file (invalid Apex) shares a
  case-folded name with a valid class, the registration conservatively registers neither — the valid
  class's bindings-channel forms remain unresolved; for the CASE-VARIANT sub-shape its exact-case forms
  still resolve via the host's own channel, while the SAME-case sub-shape loses those too (the
  twin-analog refusal — probe-corrected + re-ratified 2026-07-02; misfile-triggered, liveness-only). Deliberate bounded scope reductions;
  Architect-approved (Adam, 2026-07-02). Re-enters Gate 1 fidelity (verified by the fresh Gate 2
  adversary reading SRS+SDD together).
  **Amended v1.12 (2026-07-03)** — Phase-5 impl-driven correction of v1.11(a)'s `super`-arm consequence
  for the **v1.8(i) case-varied-heritage shape** (the CaseKid fixture; tests at Gate-3 §8), Architect-approved
  (Adam, 2026-07-03). Probe + implementation show that under a case-varied heritage clause
  (`class Sub extends BASE`, `Base.cls` present), `super()` and `super.method()` DO resolve to the parent:
  the `super`-receiver synthesis folds the superclass identifier taken from the `extends` clause and consults
  the cross-file registration channel **independently of the heritage pre-pass**, so it reaches the parent
  even though the EXTENDS/IMPLEMENTS *edge* stays unresolved (the v1.8(i) edge limitation is unchanged — the
  two cross-file mechanisms have independent reach). Only the **MRO-dependent inherited-member implicit-this**
  reference remains unresolved for this shape — it needs the resolved EXTENDS edge to enter the linearization.
  Documented consequence, fixture-pinned: a subtype may carry `super`-sourced CALLS edges into the parent
  **without** an EXTENDS edge to it. This supersedes v1.11(a)'s `super()`-unresolved and `super.method()`
  self-loop pins **for the case-varied shape only**; the v1.10(iii) nested-parent and v1.10(v) same-case-twin
  heritage shapes are not re-probed here and remain as pinned. Not a shipped limitation — a requirement
  correction (the v1.11(a) pin over-constrained a behaviour the host resolves correctly). Re-enters Gate 1
  fidelity (verified by the fresh Gate 2 adversary reading SRS+SDD together).
  **Amended v1.13 (2026-07-04)** — resolves the v1.11(b) poisoned-MRO **tripwire**, which fired at
  Step 3b as the spec anticipated (Architect-approved Adam, 2026-07-04). Under the v1.10(iv) nested-parent
  heritage mis-bind (`class Sub extends TOuter.TInner` with a same-tail top-level decoy `TInner` present;
  pin ratified — the EXTENDS edge to the decoy is REQUIRED), a typed-receiver member call on the subtype
  (`Sub s; s.decoy2()`) **rides the mis-bound MRO into the decoy's member** and resolves there. This is
  **ratified as a documented limitation** (not suppressed): it is the internally-consistent downstream
  consequence of the already-ratified mis-bound EXTENDS edge — a graph that pins `Sub extends TInner(decoy)`
  and then resolves the decoy's members through it is self-consistent; suppressing the member edge while
  keeping the EXTENDS edge would trade one inconsistency for another (an edge absent from its own MRO). The
  emitted member edge is a bounded false edge, confined to the triple-narrow v1.10(iv) shape (nested parent
  + same-tail top-level decoy + heritage). **Committed fix path: WI-4 (ITEM-004).** The correct resolution
  is the generic **pipeline reorder** — run heritage resolution AFTER the WI-3 cross-file registration so
  `TOuter.TInner` binds the real nested type instead of falling back to the decoy — which is hereby moved
  from a *noted candidate* to a **committed WI-4 deliverable** (see ITEM-004 scope + the tracked limitation
  in `work-items.md`); this limitation is expected to be eliminated there. A deliberate, WI-4-owned bounded
  scope reduction. Re-enters Gate 1 fidelity (verified by the fresh Gate 2 adversary reading SRS+SDD together).
  **Amended v1.14 (2026-07-04)** — Gate-1 Phase-5 cascade cold re-review reconciliation (Architect-approved
  Adam, 2026-07-04). Nine rounds of bounded exceptions (v1.5–v1.13) had accreted beneath head clauses that
  still carried pre-amendment absolute language; a cold context-free Gate-1 adversary surfaced the gap. No
  ratified **behaviour** changes — this is a text-fidelity reconciliation: (F1) **BR-2** success clause now
  names the ratified valid-source heritage-liveness + invalid-source exceptions rather than claiming an
  unqualified zero; (F5) **REQ-012** parity clause reworded to admit "no edge where the benchmark emits
  none" (the v1.3/v1.4 bare-type behaviour it had literally contradicted); (F4) **REQ-004** relocates its
  v1.6 trigger-referenceability exception to **REQ-010** (a cross-file resolution concern mis-filed under a
  node-representation REQ), leaving REQ-004 to govern node representation only; (F7) **REQ-015 v1.7**
  observability wording tightened from the internal "an ambiguity reaches the resolver" to the observable
  "competing in-repository candidates of equal precedence reach resolution"; (F8) **NFR-004** given a
  measurable criterion (the auto-discovered `apex-resolution` suite, Constitution §2.5); (F3) the header
  disclaimer softened to record that bounded-limitation amendments cite host mechanism as parity
  *justification* while the obligation stays observable. Companion **Constitution v1.1.2** (§1.2, F2) admits
  the bounded, fixture-pinned, Architect-ratified valid-source false edges (v1.8(ii)/v1.10(iv)/v1.11(a)/
  v1.13) as documented limitations with a committed WI-4 fix path, so the conservatism head no longer stands
  contradicted by its own exceptions. A text-fidelity reconciliation, NOT a scope change. Re-enters Gate 1
  fidelity (verified by the fresh Gate 2 adversary reading SRS+SDD together).
  **Amended v1.15 (2026-07-04)** — Gate-1 Phase-5 cascade round-2 reconciliation (Architect-approved Adam,
  2026-07-04); completes the v1.14 head-clause reconciliation the round-1 fixes left partial and extends it
  to the acceptance layer. No behaviour change. (F1) **§1** records the settled "in-scope" boundary —
  discharging INTENT-001's explicit delegation ("the precise scope of 'in-scope' is settled in deliberation
  and recorded in the SRS") — so the ratified valid-source heritage-form limitations (v1.8/v1.10) and
  invalid-source shapes sit *outside* in-scope rather than as shortfalls against a live SHALL; NOT an Intent
  amendment. (F2) **REQ-015** head folds in the v1.7 observability split (positive unresolved record
  required only where competing equal-precedence in-repository candidates reach resolution; a plain miss
  discharged by edge-absence). (F3) **REQ-005/REQ-009** carry an explicit bounded-exception clause for the
  v1.13 poisoned-MRO false edge (previously only on the v1.13 note + Constitution §1.2). (F5) **REQ-012**
  states that Apex-only shapes with no equivalent benchmark fixture are governed by the REQ-007/010/015
  limitations (§5.1 register), not by parity. (F4/F6) **§9** gains representative acceptance scenarios for the documented
  limitation classes + the v1.3/v1.4 binding-not-edge behaviour (exhaustive per-variant pinning remains at
  Gate 3). A text-fidelity reconciliation, NOT a scope change. Re-enters Gate 1 fidelity (verified by the
  fresh Gate 2 adversary reading SRS+SDD together).
  **Amended v1.16 (2026-07-05)** — Gate-1 Phase-5 cascade round-3 reconciliation (Architect-approved Adam,
  2026-07-05). No behaviour change. Triggered by the §A.8 three-cycle checkpoint on REQ-015 (flagged in
  three consecutive Gate-1 rounds), the Architect elected a **consolidation** over further incremental
  patching: **REQ-015** head + its v1.5/v1.7 amendment notes are unified into a single treatment stated by
  observable shape against new **§2** defined terms (*plain miss*, *unresolved record*, *static type*,
  *documented false edge*), closing (F2) the overloaded "unresolved" term, (F3) the §1.2 gap that covered
  only valid-source false edges — now **Constitution v1.1.2** names both the valid-source (a) and
  invalid-source (b) classes — and (F5) the retained-SHALL scope previously stated in host-channel terms,
  now stated by observable reference shape. Straightforward fixes: (F1) the non-deterministic "may resolve"
  in the §9 nested-parent scenario and REQ-005/REQ-009 v1.15 clauses replaced with the deterministic
  "resolves" (v1.13 pins the false edge); (F4) the v1.11(a) super-arm marked superseded for the v1.8(i)
  case-varied shape by v1.12; (F6) "static type" defined in §2. A text-fidelity reconciliation, NOT a scope
  change. Re-enters Gate 1 fidelity (verified by the fresh Gate 2 adversary reading SRS+SDD together).
  **Amended v1.17 (2026-07-05)** — Gate-1 Phase-5 cascade round-4 reconciliation (Architect-approved Adam,
  2026-07-05). No behaviour change. Four rounds of cold re-review showed the bounded-exception catalog was
  duplicated across six locations (head REQs, amendment log, §1 scope, §2 defs, §9 scenarios, Constitution
  §1.2) with no single source of truth, so each fix round re-synced some but not all — a structural
  duplication defect. The Architect elected the level-up fix: a single **§5.1 Bounded Limitations Register**
  (BL-1…BL-14) that every other location now **references** instead of restating. This closes round-4's
  correspondence findings at the root: (F1) REQ-015(b) and Constitution §1.2(b) now cite the same register
  rows (BL-10/BL-11/BL-12) — the missing misfiled-trigger bind is present in both; (F2) the stale "REQ-010
  v1.6" citation is gone (BL-10/BL-11 carry the correct v1.14); (F3) the v1.13/v1.15 version mismatch is
  resolved to a single register row (BL-6, "v1.15, ratified v1.13"); (F4) the v1.11(a) `super.method()`
  self-loop is catalogued (BL-7) and cited by both §1.2(a) and REQ-015(a); (F5) the v1.11(a) supersession
  wording corrected (BL-7/BL-8 state the deterministic outcome); (F6) the super/inherited arms are
  cross-referenced from REQ-005 and REQ-007 to the register; (F7) type-name case-collision added to the §2
  unresolved-record trigger list (Gate 3 verifies the host emits the positive record). §1, REQ-005/007/015,
  the §9 limitation scenarios, and Constitution §1.2/v1.1.2 all now point at register rows. A text-fidelity
  reconciliation, NOT a scope change. Re-enters Gate 1 fidelity (verified by the fresh Gate 2 adversary
  reading SRS+SDD together).
  **Amended v1.18 (2026-07-05)** — Gate-1 Phase-5 cascade round-5 reconciliation (Architect-approved Adam,
  2026-07-05); register-wiring completeness, no behaviour change. (F1) BL-12's same-case-duplicate arm
  reclassified from "plain miss" to a competing-candidate ambiguity → unresolved record (two candidates
  exist; Gate 3 verifies the host emits the positive record), aligning BL-12 with §2, REQ-015, and §9.
  (F2) the stale REQ-004 citation dropped from BR-2 and REQ-012 v1.15 (REQ-004 governs node representation
  only since v1.14 and cites no register row) → the lists read REQ-007/REQ-010/REQ-015. (F3) REQ-010 —
  governing REQ for the most register rows — gains a §5.1 pointer and surfaces BL-13 (v1.9 fragment
  collision) and BL-14 (v1.11(c) trigger/class case-fold collision), previously in the amendment log only.
  (F4) §11's WI-4 scope now lists ITEM-004 (the heritage-limitation pipeline reorder) so the register's and
  Constitution §1.2's committed "Fix = WI-4" path has a home in the decomposition. A text-fidelity
  reconciliation, NOT a scope change. Re-enters Gate 1 fidelity (verified by the fresh Gate 2 adversary
  reading SRS+SDD together).
  **Amended v1.19 (2026-07-05)** — Gate-1 Phase-5 cascade round-6 reconciliation (Architect-approved Adam,
  2026-07-05); register-internal consistency + two latent terminology gaps, no behaviour change. (F1)
  REQ-015(b) prose "same-case plain-miss" corrected to "same-case competing-candidate ambiguity" (stale
  after v1.18). (F2) BL-12 modelled as the two-arm row it is — its §1.2 column split to "b (exact-case
  arm) / — (same-case arm = retained SHALL)", and the REQ-015(b) + Constitution §1.2(b) citations qualified
  to the exact-case bind arm only (the same-case arm is the conservative default, not a (b) exception).
  (F3) the Constitution §1.2 amendment-header enumeration, which had drifted from the BL-row clause body,
  now defers to the body/register rather than re-listing REQ-versions. (F4) **MRO** defined in §2 (it was
  load-bearing in BL-6/BL-7/§9 while undefined). (F5) the §9 main REQ-015 scenario Given restated from the
  host "bindings channel" to an observable equal-precedence/no-unique-exact-case shape (WHAT-not-HOW in
  acceptance). (F6) the duplicated inherited-member arm removed from register BL-1 (owned by BL-8 for the
  v1.8(i) shape). A text-fidelity reconciliation, NOT a scope change. Re-enters Gate 1 fidelity (verified by
  the fresh Gate 2 adversary reading SRS+SDD together).
  **Amended v1.20 (2026-07-05)** — Gate-1 Phase-5 cascade round-7 reconciliation (Architect-approved Adam,
  2026-07-05); two residual minor items, no behaviour change. (F1) register BL-10/BL-11 amend cells now
  carry the ratification provenance "REQ-010 v1.14 (ratified v1.6)", matching the register's prevailing
  statement-vs-ratification convention (cf. BL-6). (F2) the §9 NFR-001 malformed-input scenario gains a
  Then asserting the malformed file contributes no nodes to the graph — exercising NFR-001's "SHALL skip
  the unparseable file" clause, previously unasserted. A text-fidelity reconciliation, NOT a scope change.
  Re-enters Gate 1 fidelity (verified by the fresh Gate 2 adversary reading SRS+SDD together).
  **Amended v1.21 (2026-07-05)** — Gate-1 Phase-5 cascade round-8 reconciliation (Architect-approved Adam,
  2026-07-05); three trivial consistency items, no behaviour change. (F1) REQ-010's §5.1 pointer no longer
  over-claims BL-12 (whose Gov REQ is REQ-015 v1.5 per the register) — narrowed to BL-9/BL-10/BL-11/BL-13/
  BL-14, ending the dual governance. (F2) BL-12's Shape column restated to "duplicate case-folded-colliding
  top-level type names (case-variant and same-case sub-arms)" so both adjudicated arms sit inside the named
  shape (the prior "differing only by case" excluded the same-case arm). (F3) five residual non-deterministic
  "can bind"/"can mis-bind"/"can MIS-RESOLVE" occurrences (REQ-007 v1.8(ii)/v1.10(iv), REQ-010 v1.14, and two
  amendment-log entries) made deterministic ("binds"/"mis-binds"/"mis-resolves") to match the register and §9
  — residue the v1.16 "may resolve"→"resolves" determinism pass had left. A text-fidelity reconciliation, NOT
  a scope change. Re-enters Gate 1 fidelity (verified by the fresh Gate 2 adversary reading SRS+SDD together).
  **Amended v1.22 (2026-07-05)** — Gate-1 Phase-5 cascade round-9 reconciliation (Architect-approved Adam,
  2026-07-05). (F1) **§1 in-scope framing corrected**: the valid-source heritage limitations (BL-1…BL-8) are
  restated from "outside in-scope, not shortfalls" to **epic-deferred shortfalls of a live Apex semantic
  (case-insensitive resolution) carrying a committed WI-4/ITEM-004 fix** — they are neither parity-excluded
  (peers are case-sensitive) nor out of scope; INTENT-001's acceptance is met at epic completion.
  Architect-confirmed WI-4-deferred. (F2) **BL-9 completed** against the WI-3 Step-3a probe (scratchpad
  `probe-wi3.mjs`, `new Rogue()` → binds the class misfiled in `Rogue.trigger`): an exact-case
  constructor/inheritance/static reference to a class mis-declared in a `.trigger` file **resolves** via the
  host's file-extension-independent exact-case single-match channel (a correct bind on invalid source), while
  its typed-receiver and case-varied cross-file forms stay unresolved; the §9 BL-9 scenario
  pins both arms; §1.2 class stays "—" (a correct bind, not a misleading one). (F3) the register's "—" class
  reworded to key on "emits no misleading binding" (dropping "edge-absent"), footnoting BL-8's correct
  super-CALLS-without-EXTENDS edge and BL-9's exact-case bind. (F4) a §9 **member-name case-collision**
  scenario added (the third ambiguity trigger, alongside overload ambiguity and type-name case-collision,
  previously unpinned). Behaviour-neutral text-fidelity (F1/F3/F4) + one probe-verified register completion
  (F2). Re-enters Gate 1 fidelity (verified by the fresh Gate 2 adversary reading SRS+SDD together).
  **Amended v1.23 (2026-07-05)** — Gate-1 Phase-5 cascade round-10 reconciliation (Architect-approved Adam,
  2026-07-05). (F1/F2) **§1 case-insensitivity scope corrected**: the in-scope boundary had restricted the
  full SHALL to "exact-case" references, wrongly implying all case-varied references are excluded — but
  Apex is case-insensitive and WI-2/WI-3 case-folding resolves case-varied references (verified GREEN in
  the resolution suite: `new ENGINE()`, `ENGINE e; e.STOP()`, `IFACE w; w.act()`, a case-varied `.CLS`
  file). The valid-source heritage shortfall (BL-1/3/5, the inheritance pre-pass, WI-4-deferred) remains;
  case-varied non-heritage references resolve. §1 and REQ-015's retained-obligation clause reworded
  accordingly (no new register row — the shortfall was already catalogued). (The precise case-varied vs
  exact-case breakdown of BL-1/3/5 was sharpened at v1.25 F3.) (F3) the §9 BL-9 and v1.5 Then clauses de-mechanised from "via the host's
  exact-case/language-uniform channel" to the observable "emits a resolved edge to the … node" (matching
  the v1.19 F5 rework). (F4) the header's stale "v1.5–v1.13" bounded-amendment range → "v1.5-onward".
  Behaviour-neutral text-fidelity throughout (F1/F2 a scope-wording correction verified against green
  tests, not a behaviour change). Re-enters Gate 1 fidelity (verified by the fresh Gate 2 adversary reading
  SRS+SDD together).
  **Amended v1.24 (2026-07-05)** — Gate-1 Phase-5 cascade round-11 reconciliation (Architect-approved Adam,
  2026-07-05); REQ-level quality items surfaced by the full cold read (the register itself verified clean),
  no behaviour change. (F1) BL-12's amend cell → "REQ-015 v1.16 (ratified v1.5)" to match the register's
  statement-vs-ratification provenance convention. (F2) REQ-008's failure clause disambiguated against the
  consolidated REQ-015: a competing overload set (>1 candidate, none uniquely selected) is an ambiguity
  requiring a positive unresolved record; a zero-candidate call is a plain miss. (F3) a §9 scenario added
  for REQ-002's interface/enum/nested-type container-node obligations (the prior sole REQ-002 scenario
  exercised only a top-level class). (F4) NFR-001 restated as a single obligation (complete without
  crashing) with the skip as its observable acceptance, rather than two bundled SHALLs. (F5) NFR-004's
  obligation made generic ("comparable in kind … exercising the §9 scenarios"), the concrete
  `apex-resolution` suite name relegated to a Constitution §2.5 mechanism reference — undoing a round-1 (F8)
  over-correction that had coupled the requirement to an implementation filename. A text-fidelity
  reconciliation, NOT a scope change. Re-enters Gate 1 fidelity (verified by the fresh Gate 2 adversary
  reading SRS+SDD together).
  **Amended v1.25 (2026-07-05)** — Gate-1 Phase-5 cascade round-12 reconciliation (Architect-approved Adam,
  2026-07-05); ripples from the v1.22 BL-9 completion + v1.23 §1 reword, plus two precision items, no
  behaviour change. (F1) REQ-010's §5.1 pointer "All invalid-source, liveness-only" corrected — BL-13/BL-14
  are liveness, BL-10/BL-11 are §1.2(b) binds, BL-9 resolves an exact-case arm. (F2) REQ-010's v1.6 clause
  now records BL-9's exact-case-resolves arm (previously only in the register). (F3) **§1 heritage-shortfall
  characterization corrected** — the prior wording labelled BL-1/3/5 uniformly "case-varied" and claimed
  "every exact-case reference resolves," but BL-3 (nested-parent) and BL-5 (same-case twin) are **exact-case**
  heritage shortfalls; the shortfall is now framed as a heritage-pre-pass limitation covering a case-varied
  clause (BL-1) and two exact-case clauses (BL-3/5), with case-varied and exact-case *non-heritage*
  references resolving. (F4) "**equal precedence**" defined in §2 (it gates ambiguity→positive-record vs
  plain-miss→edge-absence). (F5) the §9 main-REQ-015 and the two competing-overload scenarios now assert the
  **positive unresolved record** explicitly (they had said only "recorded unresolved," ambiguous against §2).
  A text-fidelity reconciliation, NOT a scope change. Re-enters Gate 1 fidelity (verified by the fresh Gate 2
  adversary reading SRS+SDD together).
  **Amended v1.26 (2026-07-05)** — Gate-1 Phase-5 cascade round-13 reconciliation (Architect-approved Adam,
  2026-07-05); §1-prose ripples from the v1.22–v1.25 corrections + one term + Constitution versioning, no
  behaviour change. (F1/F2/F3) the **§1 in-scope opener rewritten**: it had labelled BL-1…BL-8 uniformly as
  "shortfalls of a live semantic (case-insensitive resolution)", but BL-2/BL-4/BL-6 + the BL-7 self-loop are
  §1.2(a) *false edges* (over-binds), not shortfalls, and the cause is the **heritage pre-pass** ordering,
  not case-insensitivity (BL-3/BL-5 are exact-case). The opener now splits the heritage limitations into
  **under-binds** (edge-absent BL-1/3/5 + unresolved super/inherited arms BL-7/8) and **over-binds** (false
  edges BL-2/4/6 + BL-7 self-loop), and the "sole shortfall" sentence is qualified to the heritage-*edge*
  shortfall with BL-7/8 named as its downstream. (F4) the **Constitution bumped to v1.1.3 (2026-07-05)** — the
  §1.2 register re-point (a 07-05 text change) had been left under the 07-04 v1.1.2 header, violating §7's
  new-dated-version rule; v1.1.3 records it as an editorial citation re-point (no guarantee altered). (F5)
  the undefined host term "injection channel" dropped from BL-9 and the v1.22 log entry — the excluded set is
  stated by observable shape ("typed-receiver instance-member and case-varied cross-file forms"). A
  text-fidelity reconciliation, NOT a scope change. Re-enters Gate 1 fidelity (verified by the fresh Gate 2
  adversary reading SRS+SDD together).
  **Amended v1.27 (2026-07-05)** — Gate-1 Phase-5 cascade round-14 reconciliation (Architect-approved Adam,
  2026-07-05); no behaviour change. (F1) **§1 BL-8 attribution corrected** — the v1.26 opener had said BL-8's
  `super()` "stays unresolved," but BL-8 is the v1.12 correction where `super()`/`super.method()` **resolve**
  to the parent (a CALLS edge with no EXTENDS edge); only its inherited-member implicit-this arm is the
  shortfall. §1 now distinguishes BL-7 (super() + inherited unresolved, v1.10 iii/v) from BL-8
  (inherited-member only, v1.8(i)). (F2) the v1.1 amendment-log entry now records **REQ-107** minted alongside
  REQ-106 (§10 already attributed both to v1.1). (F3) the §9 v1.5 scenario's loose "recorded unresolved"
  tightened to the positive-record split (a v1.25 F5 miss). (F4) a clean §9 **constructor-invocation** success
  scenario added (REQ-005's ctor arm previously appeared only inside limitation scenarios). (F5) NFR-004's
  qualitative "comparable in kind" replaced by the measurable "exercises every §9 resolution scenario" (the
  peer-parity glob relegated to the §2.5 mechanism note). A text-fidelity reconciliation, NOT a scope change.
  Re-enters Gate 1 fidelity (verified by the fresh Gate 2 adversary reading SRS+SDD together).
  **Amended v1.28 (2026-07-06)** — WI-3 Gate-3 Phase-5 cascade: two probe-driven derivation-fidelity
  corrections (Architect-approved Adam, 2026-07-06); the SRS claimed host behaviour the real host does not
  exhibit. (F1) **BL-12 same-case arm + the type-name-collision recording claim corrected.** The v1.18
  reclassification had modelled a same-case duplicate top-level type as a competing-candidate ambiguity
  emitting a positive unresolved record; a Gate-3 probe (2026-07-06) shows the host emits NO record for a
  same-case duplicate type reference — edge-absence alone, no mis-bind (a type-name collision, discharged
  like the case-variant duplicate). Reverts the v1.18 addition of "type-name case-collision" to the
  recording set back to v1.7's overload+member-collision-only set; §2 (Unresolved record / Equal precedence),
  REQ-015 head + §1.2(b), register BL-12, and the §9 v1.5 scenario aligned. No mis-bind either way (the
  no-binding SHALL holds); only the unverified record obligation is dropped. (F2) **BL-5 twin super arms
  re-attributed from BL-7 to BL-8.** BL-7 (v1.11(a)) had lumped the nested-parent (BL-3) and same-case-twin
  (BL-5) shapes as `super.method()` self-loops; a probe shows the twin's simple-name superclass (`Twin`)
  binds like BL-1's, so `super()`/`super.method()` RESOLVE to the parent — exactly the v1.12/BL-8
  correction applied to BL-1 but never re-probed for BL-5. BL-7 now governs the BL-3 nested-parent shape only
  (qualified/dotted superclass → self-loop); BL-8 covers BL-1 + BL-5 (simple-name superclass → resolves); §1 + register
  BL-5/BL-7/BL-8 aligned. Both surfaced by the Gate-3 verification-split (a Gate-2 adversary reasoned host
  behaviour from spec logic; only Gate-3-against-the-real-host falsifies it). Re-enters Gate 1 fidelity
  (verified by the fresh Gate 2 adversary reading SRS+SDD together).
- **Classification:** epic (fans out into multiple independently-deployable work items).

## 1. Purpose and Scope

GitNexus builds a queryable knowledge graph from source code across many languages. It has no Apex
support, so Salesforce codebases cannot be graphed or analysed. This SRS specifies first-class Apex
support **at resolution parity with GitNexus's Java/Kotlin-tier support, for user-defined Apex
symbols.** Salesforce standard-library, sObject, and schema modelling are **out of scope** — peer
languages model no standard library, and parity excludes it.

**In-scope boundary (settled per INTENT-001's delegation).** INTENT-001's acceptance condition
delegates the precise scope of "in-scope" to this SRS ("the precise scope of 'in-scope' is settled in
deliberation and recorded in the SRS"). Discharging that delegation: the **valid-source heritage
limitations** (§5.1 register BL-1…BL-8), all forced by the host's **inheritance pre-pass** running before
cross-file registration, are **epic-deferred with a committed in-epic fix at WI-4/ITEM-004** (the pipeline
reorder). They fall in two sub-classes: **under-binds (shortfalls)** — the heritage `extends`/`implements`
edge is absent (BL-1 case-varied, BL-3 nested-parent, BL-5 same-case-twin) and a subtype's inherited-member
implicit-this arm stays unresolved (BL-7 for the v1.10(iii) nested-parent shape, where `super()` is
unresolved too and `super.method()` self-loops; BL-8 for the v1.8(i) case-varied AND v1.10(v)
same-case-twin shapes, where `super()`/`super.method()` instead **resolve** to the parent — a correct
CALLS edge with no EXTENDS edge, so only the inherited-member arm is the shortfall there); and **over-binds
(ratified false edges)** — the heritage clause or a downstream member mis-binds (BL-2, BL-4, BL-6, and the
BL-7 `super.method()` self-loop), documented under Constitution §1.2(a). None is **parity-excluded** (peers are
case-sensitive and never exhibit these shapes) or **out of scope**; INTENT-001's acceptance is met at epic
completion, and until then they stand as documented, fixture-pinned limitations. The **invalid-source limitations** (§5.1 register BL-9…BL-14 — bounded shortfalls or false edges
reachable only in uncompiled Apex) are genuinely **outside** the settled in-scope set for this cycle. An
invalid-source shape whose conservative outcome is *correct* — e.g. a member-name case-collision, which
emits a positive unresolved record with no mis-bind — is not a limitation and remains in scope. The
BL-9…BL-14 rows catalogue these bounded limitations; where a row also documents a correct-conservative arm (e.g. BL-12's same-case no-mis-bind default, or BL-9's exact-case correct bind), that arm is the correct outcome per the criterion above, not a shortfall. Every valid, correctly-filed
reference **outside the heritage family (BL-1…BL-8 — the heritage clause and its super/inherited-member/poisoned-MRO downstream)** among user-defined symbols is in-scope and carries the full SHALL — **including
case-varied non-heritage references, which resolve case-insensitively via the host's case-folding** (Apex is
case-insensitive; verified against the resolution suite: a case-varied cross-file constructor, method,
interface-typed, and `.CLS`-filed reference all resolve); the case-varied **heritage** clause (BL-1) is the
WI-4-deferred shortfall named next. The **sole** valid-source **heritage-edge** shortfall is BL-1/BL-3/BL-5
— a **case-varied** heritage clause (BL-1) plus two **exact-case** heritage clauses (nested-parent
`extends Outer.Inner`, BL-3; same-case twin `Foo.trigger`+`Foo.cls`, BL-5); its downstream unresolved arms
are BL-7 (`super()` + inherited-member, v1.10(iii) nested-parent) and BL-8 (inherited-member only, v1.8(i)
case-varied + v1.10(v) same-case twin — `super()`/`super.method()` resolve). Every other reference — every reference outside the heritage family (BL-1…BL-8), case-varied or exact-case — resolves. So the shortfall is a heritage-pre-pass
limitation (not purely a case-insensitivity one), and the SRS *meets* INTENT-001's delegated acceptance
rather than falling short of it.

## 2. Definitions

- **Apex source file** — a file the system classifies as Apex (`.cls`, `.trigger`). Anonymous `.apex`
  blocks are out of scope this cycle (deferred — REQ-105).
- **User-defined Apex symbol** — a class, interface, enum, inner class, method, constructor, property,
  field, enum constant, or trigger declared within the **analysed repository**.
- **Container node** — a graph node that owns member nodes (e.g. a class, interface, enum, or trigger).
- **External symbol** — a symbol not defined in the analysed repository: Salesforce standard library
  (e.g. `System`, `Database`, `Schema`), sObject types (`Account`, `Foo__c`), or managed-package types.
- **Resolved edge** — a graph relationship from a reference to the node of the symbol it denotes.
- **Binding** — the resolved association of a reference to the symbol it denotes: for a call, constructor,
  member access, or heritage reference, a *resolved edge* (CALLS / ACCESSES / EXTENDS / IMPLEMENTS); for a
  bare declared-type usage, the association of the declared type to the variable's static type — observable
  via the member access it enables, not a standalone edge (REQ-005 / REQ-012). "Emit no binding" (REQ-015)
  means neither form is produced.
- **Unresolved (unknown) symbol** — a reference that resolution binds to no target — neither a resolved
  edge nor a bare-type-usage *binding* (§2). Edge-absence alone does not make a reference unresolved: a
  correctly-bound bare declared-type usage emits no standalone edge yet is resolved (REQ-005/REQ-006). See
  *plain miss* and *unresolved record* for the two distinct unresolved outcomes.
- **Plain miss** — an unresolved reference for which no in-repository candidate survives resolution (for an
  overload, no arity-matching candidate; otherwise no name match at all); its externally-observable
  acceptance is edge-absence, with no positive record required (REQ-015).
- **Unresolved record** — a positive entry on the analysis result explicitly marking a reference as
  unresolved, distinct from mere edge-absence; required only where an ambiguous **member or overload
  reference** has two or more equal-precedence candidates (overload ambiguity, or a member-name
  case-collision) — the obligation is gated by reference kind, not candidate count alone. A
  **type-name collision** (a constructor / inheritance / static-type reference to duplicate top-level type
  names) does NOT record — no positive record for any form (probe-verified 2026-07-06); its edge outcome is
  edge-absence, except a reference whose case uniquely matches one duplicate, which resolves (BL-12 (b)) (REQ-015).
- **Equal precedence** — two or more in-repository candidates that the resolution rules do not rank one
  above the others: for overloads, more than one remains after arity + exact-parameter-type narrowing
  (REQ-008); for name collisions, more than one member or type matches with no unique exact-case tiebreak.
  An ambiguous **member or overload** reference (two+ equal-precedence candidates) is an ambiguity that
  records (positive unresolved record); a **type-name collision** — equal-precedence, but excluded from the
  record obligation by kind — emits no record (its edge outcome is edge-absence, except the BL-12
  exact-case-unique bind), and a reference with no candidate at all is a
  plain miss (edge-absence).
- **Static type** — the statically-known (compile-time) type of a variable or expression: a variable's
  declared type, a constructor expression's type (`new Widget()` → Widget), a literal's type, or a method's
  declared return type — not a runtime or promoted type; the basis for REQ-005 type-usage binding and
  REQ-008 exact-type overload narrowing.
- **Liveness limitation** — an under-bind: a reference the SHALL would resolve emits no edge (edge-absence);
  a bounded shortfall, not a mis-bind.
- **Safety limitation** — an over-bind: a ratified *documented false edge* — a resolved edge to a
  wrong-but-internally-consistent target, emitted where the SHALL would withhold or redirect it.
- **Documented false edge** — a resolved edge deliberately emitted to a wrong-but-internally-consistent
  target under a ratified bounded limitation (Constitution §1.2), reachable only in a narrow named shape
  and carrying a committed fix path; not a conservatism waiver.
- **MRO (method resolution order)** — the linearised ancestor order along which an inherited-member or
  implicit-`this` reference is resolved (the type's own members first, then its supertypes in order). A
  "poisoned" or "mis-bound" MRO is one built from a mis-bound heritage edge (register BL-4), so a member
  lookup walks into the wrong ancestor (register BL-6).
- **Benchmark** — GitNexus's Java/Kotlin support, the parity target for resolution behaviour.
- **Analysed repository** — the codebase passed to a single GitNexus analysis run.

## 3. Stakeholders

| Role | Stakeholder | Goal | Priority |
|---|---|---|---|
| Architect / requester | Adam | Graph and analyse Salesforce/Apex codebases in GitNexus | Must |
| GitNexus users | Apex/Salesforce developers | Call graphs, impact analysis, context over Apex | Must |
| Host maintainer | upstream GitNexus | A change that honours the DoD and does not regress other languages | Must |

## 4. Business Requirements

- **BR-1 (Must):** GitNexus analyses an Apex codebase and produces a knowledge graph of its
  user-defined symbols. *Success:* a repository of Apex files yields class/method/trigger nodes.
- **BR-2 (Must):** References among user-defined Apex symbols resolve, so Apex no longer reports unknown
  symbols for in-repository targets. *Success:* zero unresolved references to unambiguous in-repository
  Apex symbols across the acceptance scenarios (§9), **except the bounded, Architect-ratified limitations
  recorded in REQ-007/REQ-010/REQ-015 and catalogued in the §5.1 register (valid-source heritage liveness
  under v1.8/v1.10; the invalid-source shapes) — each a documented, fixture-pinned exception, not open
  drift.**
- **BR-3 (Must):** Apex resolution quality matches the Java/Kotlin benchmark for applicable capabilities.
  *Success:* the §9 parity scenario (REQ-012) resolves each applicable construct equivalently to the
  Java/Kotlin fixture (REQ-012 defines the applicable-capability set).
- **BR-4 (Must):** Adding Apex does not regress any other language. *Success:* the existing suite stays
  green.

## 5. Functional Requirements (EARS)

*Modal discipline: SHALL only. Each REQ is observable without reading the implementation. REQ-015 was
minted during Gate 1 and is slotted by theme (resolution), not appended numerically.*

**Recognition**
- **REQ-001** — The system SHALL classify `.cls` and `.trigger` files as Apex source.

**Graph population**
- **REQ-002** — WHEN the system analyses a repository containing Apex source, the system SHALL represent
  each user-defined Apex class, interface, enum, and nested type (a nested class, interface, or enum) as a
  container node in the knowledge graph.
- **REQ-003** — WHEN the system analyses Apex source, the system SHALL represent each method,
  constructor, property, field, and enum constant of a user-defined Apex type as a node associated with
  its declaring type.
- **REQ-004** — WHEN the system analyses a repository containing Apex triggers, the system SHALL
  represent each trigger as a container node in the knowledge graph.
  (**Amended v1.14 — scope clarified:** whether a reference to a trigger's name from another file binds
  the trigger node is a **cross-file resolution** concern, governed by REQ-010's bounded exceptions and
  REQ-015 — not by this node-representation requirement. The referenceability exception formerly stated
  here (v1.6) is relocated to REQ-010; this REQ governs node representation only.)

**Reference resolution (user-defined)**
- **REQ-005** *(type-usage sub-clause clarified v1.3)* — The system SHALL resolve a reference that
  unambiguously denotes another user-defined Apex symbol to that symbol. For a **method invocation,
  constructor invocation, or field/property access**, resolution is a resolved edge to the symbol's node
  (CALLS / ACCESSES). For a **type usage** (a declared type, e.g. `Widget w;`), resolution is the binding
  of the declared type to the variable's static type — observable as the resolution it enables (a member
  access on that variable resolving to the type's members) — consistent with the Java/Kotlin benchmark,
  which emits no standalone edge for a bare type declaration (REQ-012). (The ambiguous case is governed by
  REQ-015.) (**Amended v1.3 — clarification, re-entering Gate 1:** the prior head demanded "a resolved edge"
  for *all four* reference kinds including type usage; no benchmark language emits a standalone edge for a
  bare declared type, so this aligns the text to the parity-mandated behaviour rather than changing scope.
  Driven by WI-2 Step-3b dogfood #20; Architect-approved 2026-06-30; recorded as the SDD-002 2026-06-30
  clarification.)
  (**Amended v1.15 — bounded exception (poisoned-MRO false edge):** WHERE a subtype's `extends` clause is
  itself a ratified mis-bind under REQ-007 v1.10(iv) (`class Sub extends TOuter.TInner` with a same-tail
  top-level decoy `TInner` present), a typed-receiver member call on the subtype resolves into the
  mis-bound parent's member — a documented bounded false edge, internally consistent with the ratified
  mis-bound `extends` edge; triple-narrow (nested parent + same-tail decoy + heritage). Committed fix
  path: WI-4 (ITEM-004 pipeline reorder). Correctly-bound receivers retain the full SHALL.)
  (**Bounded exceptions — see §5.1 register:** this REQ also governs `super()`/`super.method()` and
  implicit-this inherited-member resolution, whose unresolved-heritage-downstream limitations are BL-6
  (poisoned-MRO member edge), BL-7 (unresolved-heritage super/inherited arms), and BL-8 (v1.12 super
  resolves to parent without an EXTENDS edge).)
- **REQ-006** — The system SHALL NOT report a reference that REQ-005 resolves as unresolved — i.e., SHALL
  emit no positive unresolved record (§2) for it. (This is INTENT-001's literal acceptance condition; REQ-005 emits the edge, REQ-006 forbids the
  false unresolved record for the same reference.)
- **REQ-015** *(consolidated v1.16)* — IF a reference to a user-defined Apex symbol cannot be resolved to
  a single unambiguous target, THEN the system SHALL emit no binding. AND for an **ambiguous member or
  overload reference** — two or more equal-precedence candidates (overload ambiguity, or a member-name
  case-collision) — the system SHALL additionally emit a positive **unresolved
  record** (§2) on the
  analysis result. A **plain miss** (§2 — no candidate survives resolution) is discharged by edge-absence
  alone; a **type-name collision** (a constructor / inheritance / static-type reference to duplicate
  top-level type names, same-case or case-variant) requires **no positive record** in any form, and is
  discharged by edge-absence **except** a reference whose case *uniquely* matches one of the duplicates,
  which resolves to that unique exact-case match (the BL-12 (b) bounded exception). (Conservative
  resolution: prefer no binding over a misleading one — Constitution §1.2.)

  **Bounded exceptions (documented limitations — Constitution §1.2).** Each emits a documented false edge
  (§2) or a bind the conservative default would withhold; each is Architect-ratified, fixture-pinned, and
  reachable only in the narrow shape named — recorded as a limitation, not a silent departure:
  - **(a) Valid-source false edges** — BL-2, BL-4, BL-6, and the BL-7 `super.method()` self-loop (§5.1
    register). Committed fix path: WI-4 (ITEM-004).
  - **(b) Invalid-source channel binds** — BL-10, BL-11, and the **BL-12 exact-case arm** (§5.1 register);
    reachable only in uncompiled Apex. Suppressing these would require Apex-specific coupling in shared host
    code (Constitution §2). BL-12's **same-case arm is NOT a (b) exception** — it emits no binding and no
    record: a type-name collision is discharged by edge-absence alone (probe-verified 2026-07-06), which is
    no mis-bind — the conservative default. The register rows carry the per-arm detail.

  **Retained obligation.** Every reference of an in-scope observable shape — a typed-receiver member
  access, a correctly-filed cross-file reference (exact-case or case-varied, per case-insensitive folding —
  the heritage form excepted, BL-1/3/5), and any reference not matching a named (a)/(b)
  exception shape — retains the full conservative SHALL above.
  (**Consolidated v1.16 (2026-07-05):** REQ-015's head + the v1.5 bounded exception + the v1.7 observability
  interpretation were unified into this single treatment, triggered by the §A.8 three-cycle checkpoint
  (REQ-015 flagged in three consecutive Gate-1 rounds). No behaviour change from v1.5/v1.7: the positive
  unresolved record vs plain-miss edge-absence split (v1.7) and the case-variant duplicate exact-case bind
  (v1.5) are preserved — now stated once, by observable shape, against the §2 defined terms, with the
  invalid-source bind class named alongside the valid-source class (Constitution §1.2 v1.1.2).
  Architect-approved Adam, 2026-07-05.)
- **REQ-007** — The system SHALL resolve Apex class inheritance (`extends`) and interface implementation
  (`implements`) between user-defined Apex types as edges in the knowledge graph.
  (**Amended v1.8 — bounded exceptions:** the host's inheritance pre-pass precedes per-language
  cross-file registration, so (i) a case-varied cross-file heritage clause remains unresolved (liveness)
  and (ii) the case-variant trigger/class twin's heritage form binds the trigger (triple-narrow
  safety) — both documented limitations; exact-case heritage between top-level classes resolves.
  **Amended v1.10 — extended:** (iii) a nested-parent heritage clause remains unresolved (liveness);
  (iv) with a same-named top-level type present it mis-binds to that type (triple-narrow safety);
  (v) the same-case valid trigger/class twin's heritage clause remains unresolved (liveness).)
  (**§5.1 register:** BL-1..BL-5 catalogue the heritage-edge forms; BL-7 (governed by REQ-005) and BL-8 (co-governed by REQ-007/REQ-005) catalogue the super/inherited-member
  downstream of an unresolved/corrected heritage edge.)
- **REQ-008** *(head reworded v1.2)* — The system SHALL resolve an overloaded user-defined Apex method at
  a call site to the unique overload remaining after narrowing by parameter count, then — among any
  equal-arity overloads — by exact declared parameter types: the unique equal-arity overload **every** one
  of whose declared parameter types is identical to the corresponding argument's static type. WHERE no
  single overload remains — parameter count isolates none AND no equal-arity overload matches every
  parameter position exactly — the system SHALL record the reference unresolved per REQ-015: a **competing
  overload set** (more than one candidate, none uniquely selected) is an ambiguity requiring a positive
  **unresolved record**; a call with no candidate overload at all is a **plain miss** (edge-absence). (**Amended v1.2 —
  a deliberate scope reduction under Conservatism, Constitution §1.2, re-entering Gate 1:** the prior head
  invoked "Apex's own documented overload-resolution rules", which rank implicit conversions. The operative
  rule is instead arity + exact-type narrowing. (This is consistent with the premise — Gate-3-verifiable,
  not asserted as a pinned fact — that GitNexus ranks no implicit conversions for any language; but the
  narrowing stands as a deliberate Conservatism reduction *regardless* of that premise's truth: WI-2 elects
  the conservative exact-type rule even if the host could do more.) It narrows REQ-008's selection
  algorithm; it is NOT entailed by REQ-012 parity, which concerns node/edge *kind* only. The acceptance
  fixture pins a host-resolvable case.)
- **REQ-009** — The system SHALL resolve field and property access chains across user-defined Apex types.
  (**Amended v1.15 — bounded exception:** the same REQ-005 v1.15 poisoned-MRO carve-out applies — a member
  or property access chained off a receiver whose static type is a ratified v1.10(iv) heritage mis-bind
  resolves into the mis-bound parent's member (bounded false edge; WI-4 fix). Correctly-bound chains retain
  the full SHALL.)
- **REQ-010** — The system SHALL resolve references between user-defined Apex symbols declared in
  different files of the analysed repository without requiring an explicit import statement.
  (**Amended v1.6 — bounded exception:** WHERE a class/interface/enum is mis-declared in a `.trigger`
  file — invalid Apex, reachable only in uncompiled source — its typed-receiver and case-varied
  cross-file forms remain unresolved (the source-file-extension discriminant, a deliberate trade-off
  re-affirmed 2026-07-02): a
  documented liveness limitation for those forms; an **exact-case** constructor/inheritance/static-type
  reference whose case uniquely matches the mis-filed class, however, resolves to it (register BL-9 — a
  correct bind on invalid source). Correctly-filed types retain the
  full SHALL.)
  (**Amended v1.14 — trigger-referenceability exception relocated here from REQ-004 v1.6 (a cross-file
  resolution concern; text corrected 2026-07-02, re-ratified same day):** WHERE a trigger is mis-declared
  in a `.cls` file — invalid Apex, reachable only in uncompiled source — it passes the extension
  discriminant and becomes globally referenceable: a reference to its name binds the trigger. AND
  WHERE a correctly-filed trigger's name is referenced as a type (`new T()`, `extends T` — itself invalid
  Apex) and no same-named class exists, an exact-case reference whose case uniquely matches the trigger binds it
  — a documented limitation. A correctly-filed trigger remains non-referenceable on the language's
  cross-file visibility channel (it is never registered there); a same-EXACT-CASE-named class-like def
  keeps the exact-case guard, while a CASE-VARIANT same-named class does not suppress the exact-case
  channel — the twin's constructor and member forms are committed to resolve to the CLASS, its heritage
  form is the v1.8(ii) bounded limitation.)
  (**§5.1 register:** REQ-010 is the governing REQ for BL-9, BL-10, BL-11, BL-13, BL-14 — BL-9
  (class-in-`.trigger`, v1.6), BL-10/BL-11 (misfiled/referenced trigger, v1.14), and two
  registration-collision liveness limitations previously in the amendment log only: **BL-13** (v1.9 —
  a malformed file re-parents a nested-type fragment whose case-folded name collides with a legit
  top-level type → registration registers neither → the valid type's cross-file forms unresolved) and
  **BL-14** (v1.11(c) — a trigger mis-declared in a `.cls` file sharing a case-folded name with a valid
  class → registers neither → the valid class's cross-file forms unresolved; a case-variant sub-shape's
  exact-case forms still resolve, a same-case sub-shape loses those too). All invalid-source; BL-13/BL-14
  are liveness-only, BL-10/BL-11 are §1.2(b) binds, and BL-9 resolves an exact-case arm while its
  typed-receiver/case-varied arm stays unresolved — see the register for each row's outcome.)
- **REQ-011** *(type-usage sub-clause clarified v1.4)* — WHEN a user-defined Apex trigger body references a
  user-defined Apex type, method, or field, the system SHALL resolve the reference to that symbol. For a
  **method/constructor invocation** (incl. a static `Type.method()` call) or a **field/property access**,
  resolution is a resolved edge from the trigger to the symbol's node (CALLS / ACCESSES). For a **bare
  declared-type usage** in the trigger body (e.g. `Widget w;`), resolution is the binding of the declared
  type to the variable's static type — observable via the member access it enables — **not** a standalone
  edge, consistent with the Java/Kotlin benchmark and with REQ-005 (no benchmark emits an edge for a bare
  type declaration — REQ-012). (**Amended v1.4 — clarification, re-entering Gate 1:** the prior text demanded
  "a resolved edge" for *all three* reference kinds including a bare type usage; this aligns REQ-011's
  type arm to the same parity-mandated binding-not-edge behaviour REQ-005 received at v1.3, rather than
  changing scope. Driven by WI-3 SDD-003 Gate-2 round 5; Architect-approved 2026-06-30.)

**Parity and external handling**
- **REQ-012** — For each capability applicable to Apex — explicit-type binding, constructor-type
  inference, inheritance and interface-implementation lookup, overload disambiguation,
  field/property-chain resolution, and cross-file binding — the system SHALL resolve an Apex construct to
  a node of the same kind, with an edge of the same kind (**including no edge where the benchmark emits
  none — e.g. a bare declared-type usage, per REQ-005/REQ-011 v1.3/v1.4**), as the Java/Kotlin benchmark
  resolves on an equivalent fixture. (**Amended v1.15 — scope of "equivalent fixture":** WHERE a shape is
  Apex-specific and has no equivalent benchmark fixture (case-collision duplicates, source-file misfile,
  case-variant twin), REQ-012 parity does not govern it — it is governed by the
  REQ-007/REQ-010/REQ-015 bounded limitations (§5.1 register). Parity applies only where an equivalent
  benchmark construct exists.)
- **REQ-013** — IF an Apex reference targets an external symbol, THEN the system SHALL treat it as an
  external unresolved reference in the same manner as the benchmark treats its standard library — its
  observable acceptance being that no Apex-specific defect is reported for it.

**Metadata**
- **REQ-014** — The system SHALL capture annotations declared on Apex **members** (methods,
  constructors, fields, and properties) as metadata on the corresponding nodes. (Amended v1.1: scoped
  to member-level. Type-level annotation capture is deferred — REQ-106 — as it exceeds the Java/Kotlin
  parity benchmark, which captures no type-level annotations, and has no host mechanism.)

## 5.1 Bounded Limitations Register

*Added v1.17 (2026-07-05). The **single normative catalog** of every Architect-ratified bounded limitation
(the VSDD documented-limitation route). §1's in-scope boundary, REQ-015's exception clauses, Constitution
§1.2, and the §9 limitation scenarios all **reference** these BL-ids rather than restating them — this table
is the source of truth. Each row is reachable only in the narrow shape named. "§1.2 class" is the
Constitution §1.2 exception class: **(a)** valid-source false edge / mis-bind, **(b)** invalid-source
channel bind, or **—** for a limitation that **emits no misleading binding** and so needs no §1.2 cover —
whether edge-absent (a liveness limitation) or a *correct* edge on a degenerate shape (BL-8's super-sourced
CALLS edge with no EXTENDS edge; BL-9's exact-case bind to the real, mis-filed class node). Exhaustive per-variant fixtures are pinned at Gate 3; the amendment log above carries the
dated provenance.*

| ID | Shape (reachable only as named) | Source | Outcome | Gov REQ · amend | §1.2 | Fix |
|----|----|----|----|----|----|----|
| BL-1 | case-varied cross-file heritage clause (`class Sub extends BASE`, `Base.cls`) | valid | EXTENDS edge absent (liveness); super/inherited-member downstream — see BL-8 | REQ-007 v1.8(i) | — | WI-4 |
| BL-2 | case-variant trigger/class twin, heritage naming the trigger's exact case (`extends Twist`, `Twist.trigger`+`class TWIST`) | valid | heritage mis-binds to the trigger | REQ-007 v1.8(ii) | a | WI-4 |
| BL-3 | nested-parent heritage clause (`extends Outer.Inner`, parent in another file) | valid | EXTENDS edge absent (liveness); super/inherited — see BL-7 | REQ-007 v1.10(iii) | — | WI-4 |
| BL-4 | nested-parent heritage + an unrelated same-tail top-level decoy present | valid | heritage mis-binds to the top-level decoy | REQ-007 v1.10(iv) | a | WI-4 |
| BL-5 | same-case valid trigger/class twin heritage (`Foo.trigger`+`Foo.cls`) | valid | EXTENDS edge absent (liveness); super arms resolve to parent — see BL-8; inherited-member implicit-this unresolved | REQ-007 v1.10(v) | — | WI-4 |
| BL-6 | typed-receiver member call on a BL-4 subtype (`Sub s; s.decoy2()`) | valid | rides the mis-bound MRO → false member edge into the decoy's member | REQ-005/REQ-009 v1.15 (ratified v1.13) | a | WI-4 |
| BL-7 | super/inherited arms of an unresolved-heritage subtype (BL-3 nested-parent shape — qualified/dotted superclass) | valid | `super()` + inherited-member implicit-this unresolved; `super.method()` self-loops to the subtype's own override (false edge) | REQ-005 v1.11(a) | a (self-loop) / — (unresolved arms) | WI-4 |
| BL-8 | super arms of a BL-1 or BL-5 subtype (simple-name superclass) (v1.12/v1.28 correction) | valid | `super()`/`super.method()` RESOLVE to the parent → subtype carries super-sourced CALLS edges into the parent with NO EXTENDS edge (documented consequence, not a defect); inherited-member implicit-this still unresolved | REQ-007/REQ-005 v1.12 | — | WI-4 |
| BL-9 | class/interface/enum mis-declared in a `.trigger` file | invalid | an exact-case constructor/inheritance/static-type reference whose case uniquely matches resolves to the mis-filed class (a correct bind on invalid source — the class is a real node); its typed-receiver (instance-member) and case-varied cross-file forms remain unresolved | REQ-010 v1.22 (ratified v1.6) | — | — |
| BL-10 | trigger mis-declared in a `.cls` file | invalid | becomes globally referenceable — a name reference binds the trigger | REQ-010 v1.14 (ratified v1.6) | b | — |
| BL-11 | correctly-filed trigger's name referenced as a type, no same-named class exists | invalid | an exact-case reference whose case uniquely matches binds the trigger def | REQ-010 v1.14 (ratified v1.6) | b | — |
| BL-12 | duplicate case-folded-colliding top-level type names (case-variant and same-case sub-arms) | invalid | an exactly-case-matching constructor/inheritance/static-type reference binds the unique exact-case match; a same-case duplicate reference binds nothing and emits no record — a type-name collision is discharged by edge-absence alone (probe-verified 2026-07-06); no mis-bind (liveness) | REQ-015 v1.16 (ratified v1.5) | b (exact-case arm) / — (same-case arm = type-name collision, no record) | — |
| BL-13 | malformed file re-parents a nested-type fragment to file scope, case-folded name collides with a legit top-level type | invalid | registration registers neither → the valid type's typed-receiver/case-varied cross-file forms unresolved (liveness) | REQ-010 v1.18 (ratified v1.9) | — | — |
| BL-14 | trigger mis-declared in a `.cls` file sharing a case-folded name with a valid class | invalid | registration registers neither → the valid class's cross-file forms unresolved; a case-variant sub-shape's exact-case forms still resolve, a same-case sub-shape loses those too (liveness) | REQ-010 v1.18 (ratified v1.11(c)) | — | — |

## 6. Non-Functional Requirements (ISO 25010, measurable)

- **NFR-001 (Reliability)** — WHILE analysing malformed or syntactically incomplete Apex source, the
  system SHALL complete the analysis run without crashing — its observable acceptance being that the
  unparseable file is skipped (contributes no nodes to the graph) while the run finishes.
- **NFR-002 (Compatibility)** — The system SHALL preserve existing resolution and graph behaviour for
  every other supported language (measured: the pre-existing test suite stays green).
- **NFR-003 (Performance efficiency)** — The system SHALL apply the same per-file resource-budget
  threshold to Apex files as to other supported languages: a file exceeding that threshold is skipped at
  the same limit, with no Apex-specific exemption.
- **NFR-004 (Maintainability)** — Apex resolution SHALL be covered by an automated resolution test that
  exercises every §9 **resolution scenario** — the scenarios tagged REQ-005, REQ-006, REQ-007, REQ-008,
  REQ-009, REQ-010, REQ-011, REQ-012, REQ-013, or REQ-015 (the reference-resolution requirements), as
  distinct from the recognition / graph-population (REQ-001…004), metadata (REQ-014), compatibility/non-regression (NFR-002), and reliability
  (NFR-001) scenarios. (The concrete artifact is the auto-discovered `apex-resolution`
  suite, auto-discovered by the same CI parity glob as the peer-language resolution suites, per Constitution
  §2.5 — a mechanism reference, not part of the obligation.)
- **Considered, not separately constrained (host-inherited).** Usability and Portability were reviewed
  (ISO 25010) and judged not to warrant Apex-specific requirements this cycle — both are inherited from the
  host GitNexus platform. (Security is covered by Constitution SECT-001 for untrusted input; recorded in
  the §A.19 elicitation-facts.)

## 7. Constraints

- **C-1** — Delivered as a fork of GitNexus; MUST conform to its Definition of Done and CI gates.
- **C-2** — The only new runtime dependency permitted is an OSI-permissive tree-sitter Apex grammar
  (Constitution §4).
- **C-3** — No standard-library, sObject, or schema modelling is in scope (the parity boundary).

## 8. Assumptions and Dependencies (impact-if-wrong)

- **A-1** — A usable tree-sitter Apex grammar exists and can be built and loaded in GitNexus's Node
  runtime. *If wrong:* the parsing approach is infeasible and the epic stalls (cf. Swift's Node-22
  block). **Mitigation: a mandatory Phase 2b §A.6 feasibility spike before the architecture commits.**
- **A-2** — Apex's OOP semantics map onto the benchmark's resolution model. *If wrong:* resolver work
  beyond parity is needed, expanding scope.
- **A-3** — Apex's implicit namespace can be modelled with the host's existing cross-file / whole-module
  import synthesis. *If wrong:* REQ-010 needs a new mechanism.

## 9. Acceptance Criteria (Gherkin)

```gherkin
# REQ-001, REQ-002, REQ-003
Scenario: Apex classes and members enter the graph
  Given a repository containing an Apex class with a method, a constructor, a property, and a field, and an enum with a constant
  When GitNexus analyses the repository
  Then the graph contains a node for the class
  And the graph contains nodes for the class's method, constructor, property, and field associated with the class
  And the graph contains a node for the enum constant associated with its enum

# REQ-002 — interfaces, enums, and nested types as container nodes
Scenario: Interfaces, enums, and nested types enter the graph as container nodes
  Given a repository containing a top-level Apex interface, a top-level enum, and a class with a nested class, a nested interface, and a nested enum
  When GitNexus analyses the repository
  Then the graph contains a container node for the top-level interface and the top-level enum
  And the graph contains a container node for each nested class, nested interface, and nested enum

# REQ-004, REQ-011
Scenario: A trigger resolves a call to a user-defined handler
  Given an Apex trigger whose body calls a method on a user-defined Apex class
  When GitNexus analyses the repository
  Then the graph contains a container node for the trigger
  And there is a resolved edge from the trigger to the user-defined method

# REQ-011 — trigger-body bare type usage + field access
Scenario: A trigger body's bare declared-type usage and field access resolve
  Given an Apex trigger whose body declares a variable of a user-defined class type and accesses a field on that variable
  When GitNexus analyses the repository
  Then the field access resolves to the user-defined type's field (ACCESSES from the trigger)
  And no standalone resolved edge is emitted for the bare declared-type usage (REQ-012 no-edge parity)

# REQ-005, REQ-006
Scenario: An in-repository method call resolves with no unknown symbol
  Given two user-defined Apex classes where one calls a method on the other
  When GitNexus analyses the repository
  Then there is a resolved edge from the call site to the called method
  And no unresolved symbol is recorded for that call

# REQ-005 — constructor invocation
Scenario: An in-repository constructor invocation resolves
  Given a user-defined Apex class that constructs another user-defined Apex class via `new Other()`
  When GitNexus analyses the repository
  Then there is a resolved edge from the construction site to the constructed class's constructor
  And no unresolved symbol is recorded for that construction

# REQ-005, REQ-011, REQ-012 (v1.3/v1.4 binding-not-edge)
Scenario: A bare declared-type usage binds the static type but emits no standalone edge
  Given a user-defined class Widget and a variable declared `Widget w;` whose member `w.foo()` is called
  When GitNexus analyses the repository
  Then the member access `w.foo()` resolves to Widget's foo method
  And no standalone resolved edge is emitted for the bare `Widget w` declaration (REQ-012 no-edge parity)

# REQ-015
Scenario: An ambiguous member or overload reference is left unresolved, not mis-bound
  Given a reference to a user-defined member or method with two or more equal-precedence candidates the resolution rules cannot rank (a member-name case-collision, or an overload set arity + exact-type narrowing leaves ambiguous)
  When GitNexus analyses the repository
  Then no resolved edge is emitted for that reference
  And a positive unresolved record is emitted for it rather than a binding to a wrong target
  # A type-name collision (duplicate top-level type names, same-case or case-variant) is discharged by
  # edge-absence alone — no record (see the case-variant / BL-12 scenario below).

# REQ-015 — member-name case-collision ambiguity (positive unresolved record)
Scenario: A member reference colliding by case on two members is left unresolved with a record
  Given a user-defined Apex class with two members whose names differ only by case (invalid Apex, uncompiled source)
  And a reference to that member name that matches neither uniquely by exact case
  When GitNexus analyses the repository
  Then no resolved edge is emitted for that reference
  And a positive unresolved record is emitted for it (two equal-precedence member candidates)
  # Like the BL-12 type-name collision, this shape arises only on invalid case-duplicate source; UNLIKE
  # BL-12 (a no-record liveness limitation), its required outcome — a positive unresolved record and no
  # binding — is a live REQ-015 obligation, not a bounded limitation.

# REQ-015 (amended v1.5 — the bounded fallback-channel exception)
Scenario: Case-variant duplicate types — a unique exact-case reference resolves, other forms do not (documented limitation)
  Given two user-defined top-level Apex types whose names differ only by case (invalid Apex, uncompiled source)
  And a constructor, inheritance, or static type-name reference matching one of them exactly by case
  When GitNexus analyses the repository
  Then that reference emits a resolved edge to its unique exact-case match (documented limitation)
  And every other reference form to the colliding name emits no binding and no record — a type-name collision is discharged by edge-absence alone (probe-verified 2026-07-06)
  # A SAME-case duplicate has no unique exact-case match: it binds nothing and records nothing — a
  # type-name collision is discharged by edge-absence alone. The member/overload recording scenario does NOT govern it.

# REQ-007
Scenario: Inheritance and interface implementation resolve
  Given an Apex class that extends a user-defined class and implements a user-defined interface
  When GitNexus analyses the repository
  Then the graph contains an inheritance edge to the parent class
  And the graph contains an implementation edge to the interface

# Documented limitations (representative — exhaustive per-variant pinning is at Gate 3)

# REQ-007 v1.8(i) / register BL-1 — valid-source heritage liveness limitation
Scenario: A case-varied cross-file heritage clause is left unresolved (documented limitation)
  Given a user-defined `class Sub extends BASE` and a user-defined `Base` class in another file (valid Apex, case-varied)
  When GitNexus analyses the repository
  Then no inheritance edge is emitted for the case-varied heritage clause
  # exact-case cross-file heritage resolves; the case-varied form is the v1.8(i) liveness limitation

# REQ-010 v1.6 / register BL-9 — invalid-source misfile liveness limitation
Scenario: A class mis-declared in a .trigger file resolves only to a unique exact-case reference (documented limitation)
  Given a class/interface/enum mis-declared inside a `.trigger` file (invalid Apex, uncompiled source)
  When GitNexus analyses the repository
  Then its typed-receiver and case-varied cross-file references from other files emit no binding
  And an exact-case constructor/inheritance/static reference to it emits a resolved edge to the mis-filed class node (a correct bind on invalid source)

# REQ-007 v1.10(iv) / v1.13 / register BL-4 + BL-6 — nested-parent mis-bind, tripwire-ratified
Scenario: A nested-parent heritage clause with a same-tail top-level decoy mis-binds (documented limitation)
  Given `class Sub extends TOuter.TInner` with an unrelated top-level `TInner` present (valid Apex)
  When GitNexus analyses the repository
  Then the heritage clause binds the top-level decoy `TInner`
  And a typed-receiver member call on Sub resolves into the decoy's member (v1.13 bounded false edge; WI-4 fix)

# REQ-008
Scenario: Overloaded method resolves by argument shape
  Given a user-defined Apex class with two methods of the same name and different parameter counts
  And a call site that matches one overload
  When GitNexus analyses the repository
  Then the resolved edge targets the matching overload

# Amended v1.2: the single assignable-overload scenario was under-determined (its Given admitted cases
# with no unique match while its Then demanded an edge). Split into the two deterministic sub-cases:
Scenario: Overload selection by exact parameter type
  Given a user-defined Apex class with two equal-arity overloads of different declared parameter types
  And a call site whose argument's static type is identical to exactly one overload's parameter type
  When GitNexus analyses the repository
  Then the resolved edge targets that overload

Scenario: Overload selection on an assignable argument, disambiguated by arity
  Given a user-defined Apex class with overloads of different parameter counts
  And a call site whose argument is assignable but not identical to the matching-arity overload's parameter
  When GitNexus analyses the repository
  Then the resolved edge targets the matching-arity overload (assignability does not block arity selection)

Scenario: Overload selection on a genuinely-undisambiguable assignable argument
  Given a user-defined Apex class with same-arity overloads of different declared parameter types
  And a call site whose argument is assignable but not identical to any of them
  When GitNexus analyses the repository
  Then no resolved edge is emitted and a positive unresolved record is emitted for it (equal-precedence competing overloads, REQ-015)

Scenario: Multi-parameter overload selection, all positions identical to one overload
  Given a user-defined Apex class with two equal-arity multi-parameter overloads of different signatures
  And a call site whose argument static types are identical to exactly one overload at every position
  When GitNexus analyses the repository
  Then the resolved edge targets that overload

Scenario: Multi-parameter overload, no overload identical at every position
  Given a user-defined Apex class with two equal-arity multi-parameter overloads of different signatures
  And a call site whose argument static types match no overload at every position (some positions only)
  When GitNexus analyses the repository
  Then no resolved edge is emitted and a positive unresolved record is emitted for it (equal-precedence competing overloads, REQ-015)

# REQ-009, REQ-010
Scenario: Cross-file field/property chain resolves without an import
  Given user-defined Apex types in different files where one accesses a property chain on the other
  When GitNexus analyses the repository
  Then the chain resolves to the declaring members across files
  And resolution requires no explicit import statement

# REQ-012
Scenario: Apex resolution reaches Java/Kotlin parity
  Given an Apex fixture and an equivalent Java fixture exercising the same OOP construct
  When GitNexus analyses both
  Then the Apex graph resolves the construct equivalently to the Java graph

# REQ-013
Scenario: A standard-library reference is external, not a defect
  Given an Apex method that calls System.debug
  When GitNexus analyses the repository
  Then the call to System.debug is treated as an external unresolved reference
  And it is not reported as an Apex-specific unknown-symbol defect

# REQ-014
Scenario: Annotations are captured as metadata
  Given an Apex method annotated with @AuraEnabled
  When GitNexus analyses the repository
  Then the method node carries the annotation as metadata

# NFR-003
Scenario: An over-budget Apex file is skipped at the same threshold as peers
  Given an Apex file exceeding the per-file resource budget
  When GitNexus analyses the repository
  Then the file is skipped at the same threshold applied to other languages
  And no Apex-specific budget exemption is applied

# NFR-001
Scenario: Malformed Apex does not crash the run
  Given a repository containing a syntactically broken Apex file alongside valid files
  When GitNexus analyses the repository
  Then the analysis completes
  And the valid files are represented in the graph
  And the malformed file contributes no nodes to the graph (it is skipped, per NFR-001)
```

## 10. Deferred requirements (minted, scheduled later)

Each carries a REQ-NNN and a linked tracked item; out of this cycle by recorded decision, not omission.
All seven are deferred by recorded decision: REQ-101…103 are schema/standard-library realm (excluded by
parity), REQ-104 is a moderate optional enhancement, REQ-105 is a file-type scope deferral, REQ-106
(added v1.1) is type-level annotation capture (excluded by parity), and REQ-107 (added v1.1) is
annotation argument-value capture (member annotations are captured name-only this cycle).

- **REQ-101 (deferred)** — Semantic resolution of SOQL/SOSL field and object references.
- **REQ-102 (deferred)** — Typing of trigger context variables (`Trigger.new`, `Trigger.old`, …).
- **REQ-103 (deferred)** — Resolution of SOQL/SOSL bind-variable references (`:localVar`) to local
  Apex variables.
- **REQ-104 (deferred)** — Annotation framework / entry-point semantics (e.g. `@AuraEnabled`,
  `@InvocableMethod` entry-point detection).
- **REQ-105 (deferred)** — Anonymous Apex (`.apex`) block recognition, graphing, and reference
  resolution. (Script-style; no class structure; out of this cycle.)
- **REQ-106 (deferred, added v1.1)** — Capture of annotations declared on Apex **types**
  (class/interface/enum/trigger), e.g. `@IsTest` or `@RestResource` on the type node. Deferred because
  it exceeds the Java/Kotlin parity benchmark — no peer language captures type-level annotations
  (the governing ground). Out of this cycle by recorded decision (Architect, 2026-06-28). Linked
  item: ITEM-106.
- **REQ-107 (deferred, added v1.1)** — Capture of annotation **argument values** (e.g. `cacheable=true`
  in `@AuraEnabled(cacheable=true)`) as metadata. Member annotations are captured **name-only** this
  cycle (REQ-014), consistent with the host's name-normalising annotation mechanism and the Java/Kotlin
  benchmark; full argument-text capture is deferred. This is annotation *data* capture — distinct from
  REQ-104 (annotation *semantics* / entry-point interpretation). Out of this cycle by recorded decision
  (Architect, 2026-06-28). Linked item: ITEM-107.

## 11. Intended decomposition (epic → work items)

Provisional; the formal cut and its **Gate 1 decomposition checkpoint** follow once this epic SRS
clears Gate 1. Modelled on the host's Swift-ingestion tiers:

1. **WI-1 — Parse & graph population:** grammar integration + recognition + class/member/trigger nodes
   (REQ-001…004, REQ-014, NFR-003). Independently deployable — the graph populates before resolution is
   required.
2. **WI-2 — Resolution mechanics:** calls, type usage, inheritance, overloads, field/property
   chain resolution, and conservative skip of ambiguous references (REQ-005…009, REQ-015). The
   cross-file aspect of these mechanics is owned by WI-3.
3. **WI-3 — Cross-file & trigger resolution:** implicit-namespace cross-file binding + trigger-body
   resolution (REQ-010, REQ-011).
4. **WI-4 — Parity hardening & external handling:** Java/Kotlin parity fixtures + external-reference
   handling (REQ-012, REQ-013, NFR-004), **plus ITEM-004 — the heritage-limitation pipeline reorder**
   (run heritage resolution AFTER the WI-3 cross-file registration) that discharges the committed
   "Fix = WI-4" path for the valid-source heritage limitations §5.1 register BL-1…BL-8 (promoted from a
   noted candidate to a committed deliverable at SRS v1.13; see `work-items.md` ITEM-004).

**NFR-001 (reliability) and NFR-002 (non-regression) are cross-cutting acceptance gates on every work
item**, not assigned to a single one — any WI that touches parsing or shared code must satisfy both.

## 12. Requirements Traceability Matrix

| REQ | Business req | Confirmation mode |
|---|---|---|
| REQ-001 | BR-1 | automated |
| REQ-002 | BR-1 | automated |
| REQ-003 | BR-1 | automated |
| REQ-004 | BR-1 | automated |
| REQ-005 | BR-2 | automated |
| REQ-006 | BR-2 | automated |
| REQ-015 | BR-2 | automated |
| REQ-007 | BR-2, BR-3 | automated |
| REQ-008 | BR-3 | automated |
| REQ-009 | BR-2, BR-3 | automated |
| REQ-010 | BR-2, BR-3 | automated |
| REQ-011 | BR-1, BR-2 | automated |
| REQ-012 | BR-3 | automated |
| REQ-013 | BR-2 | automated |
| REQ-014 | BR-1 | automated |
| NFR-001 | BR-1 | automated |
| NFR-002 | BR-4 | automated |
| NFR-003 | BR-1 | automated |
| NFR-004 | BR-3 | automated |
