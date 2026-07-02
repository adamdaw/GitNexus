# Software Requirements Specification — Apex Support for GitNexus

*Epic-tier SRS (VSDD §A.14). Business-facing **what** and **why**; no design or implementation
detail. Derived from INTENT-001; reviewed against it and the Constitution at Gate 1.*

- **SRS-id:** SRS-001 · **Intent:** INTENT-001 · **Status:** Gate-1-cleared; **amended v1.1
  (2026-06-28)** — REQ-014 descoped to member-level; REQ-106 minted (deferred). Driven by Gate 2
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
  *mis-declared in a `.trigger` file* is excluded from the cross-file visibility registration — the only
  available trigger discriminant is the source-file extension — so its typed-receiver and case-varied
  cross-file forms remain unresolved (a REQ-010 liveness reduction). (ii) A trigger *mis-declared in a
  `.cls` file* passes that same discriminant and becomes globally referenceable — a reference to its name
  can bind the trigger (a REQ-004 non-referenceability breach); additionally (probe-corrected and
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
- **Classification:** epic (fans out into multiple independently-deployable work items).

## 1. Purpose and Scope

GitNexus builds a queryable knowledge graph from source code across many languages. It has no Apex
support, so Salesforce codebases cannot be graphed or analysed. This SRS specifies first-class Apex
support **at resolution parity with GitNexus's Java/Kotlin-tier support, for user-defined Apex
symbols.** Salesforce standard-library, sObject, and schema modelling are **out of scope** — peer
languages model no standard library, and parity excludes it.

## 2. Definitions

- **Apex source file** — a file the system classifies as Apex (`.cls`, `.trigger`). Anonymous `.apex`
  blocks are out of scope this cycle (deferred — REQ-105).
- **User-defined Apex symbol** — a class, interface, enum, inner class, method, constructor, property,
  field, enum constant, or trigger declared within the **analysed repository**.
- **Container node** — a graph node that owns member nodes (e.g. a class, interface, enum, or trigger).
- **External symbol** — a symbol not defined in the analysed repository: Salesforce standard library
  (e.g. `System`, `Database`, `Schema`), sObject types (`Account`, `Foo__c`), or managed-package types.
- **Resolved edge** — a graph relationship from a reference to the node of the symbol it denotes.
- **Unresolved (unknown) symbol** — a reference for which no resolved edge is emitted.
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
  Apex symbols across the acceptance scenarios (§9).
- **BR-3 (Must):** Apex resolution quality matches the Java/Kotlin benchmark for applicable capabilities.
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
  (**Amended v1.6 — bounded exception (text corrected 2026-07-02 after a lone-trigger probe,
  re-ratified same day):** WHERE a trigger is mis-declared in a `.cls` file — invalid Apex, reachable
  only in uncompiled source — it is indistinguishable from a class by the available discriminant and
  becomes globally referenceable: a reference to its name can bind the trigger. AND WHERE a
  correctly-filed trigger's name is referenced as a type (`new T()`, `extends T` — itself invalid
  Apex) and no same-named class exists, the host's exact-case single-match channel binds the trigger
  def — a documented limitation. A correctly-filed trigger remains non-referenceable on the
  language's cross-file visibility channel (it is never registered there), and whenever a
  same-EXACT-CASE-named class-like def exists (the host's single-match guard keys exact-case — corrected
  2026-07-02 after the case-variant-twin probe, re-ratified: a CASE-VARIANT same-named class does not
  suppress the exact-case channel; the twin's constructor and member forms are committed to resolve to
  the CLASS, while its heritage form is the v1.8(ii) bounded limitation).)

**Reference resolution (user-defined)**
- **REQ-005** *(type-usage sub-clause clarified v1.3)* — The system SHALL resolve a reference that
  unambiguously denotes another user-defined Apex symbol to that symbol. For a **method invocation,
  constructor invocation, or field/property access**, resolution is a resolved edge to the symbol's node
  (CALLS / ACCESSES). For a **type usage** (a declared type, e.g. `Account a;`), resolution is the binding
  of the declared type to the variable's static type — observable as the resolution it enables (a member
  access on that variable resolving to the type's members) — consistent with the Java/Kotlin benchmark,
  which emits no standalone edge for a bare type declaration (REQ-012). (The ambiguous case is governed by
  REQ-015.) (**Amended v1.3 — clarification, re-entering Gate 1:** the prior head demanded "a resolved edge"
  for *all four* reference kinds including type usage; no benchmark language emits a standalone edge for a
  bare declared type, so this aligns the text to the parity-mandated behaviour rather than changing scope.
  Driven by WI-2 Step-3b dogfood #20; Architect-approved 2026-06-30; recorded as the SDD-002 2026-06-30
  clarification.)
- **REQ-006** — The system SHALL NOT report a reference that REQ-005 resolves as an unknown or unresolved
  symbol. (This is INTENT-001's literal acceptance condition; REQ-005 emits the edge, REQ-006 forbids the
  false unresolved record for the same reference.)
- **REQ-015** — IF a reference to a user-defined Apex symbol cannot be resolved to a single unambiguous
  target, THEN the system SHALL emit no binding and SHALL record the reference as unresolved (conservative
  resolution, per the governing principle of preferring no binding over a misleading one).
  (**Amended v1.5 — bounded exception:** WHERE the ambiguity arises solely from duplicate user-defined
  top-level Apex type names — invalid Apex, reachable only in uncompiled source — a constructor,
  inheritance, or static type-name reference resolved by the host's language-uniform exact-case fallback
  channel binds the exact-case match **when that key is unique** (a case-variant duplicate) rather than
  being left unresolved — a same-case duplicate resolves nothing (single-match guard, conservative;
  probe-corrected and re-ratified 2026-07-02): a documented limitation. Every
  reference resolved through the per-language bindings channel — all typed-receiver member forms and all
  case-varied forms — retains the full conservative SHALL.)
  (**Amended v1.7 — observability interpretation:** the "recorded as unresolved" obligation is
  dischargeable by a host-internal record for plain-miss shapes; the externally-observable acceptance for
  a plain miss is edge absence. A positive unresolved record on the analysis result is required wherever
  an ambiguity reaches the resolver.)
- **REQ-007** — The system SHALL resolve Apex class inheritance (`extends`) and interface implementation
  (`implements`) between user-defined Apex types as edges in the knowledge graph.
  (**Amended v1.8 — bounded exceptions:** the host's inheritance pre-pass precedes per-language
  cross-file registration, so (i) a case-varied cross-file heritage clause remains unresolved (liveness)
  and (ii) the case-variant trigger/class twin's heritage form can bind the trigger (triple-narrow
  safety) — both documented limitations; exact-case heritage between classes resolves.)
- **REQ-008** *(head reworded v1.2)* — The system SHALL resolve an overloaded user-defined Apex method at
  a call site to the unique overload remaining after narrowing by parameter count, then — among any
  equal-arity overloads — by exact declared parameter types: the unique equal-arity overload **every** one
  of whose declared parameter types is identical to the corresponding argument's static type. WHERE no
  single overload remains — parameter count isolates none AND no equal-arity overload matches every
  parameter position exactly — the system SHALL record the reference unresolved per REQ-015. (**Amended v1.2 —
  a deliberate scope reduction under Conservatism, Constitution §1.2, re-entering Gate 1:** the prior head
  invoked "Apex's own documented overload-resolution rules", which rank implicit conversions. The operative
  rule is instead arity + exact-type narrowing. (This is consistent with the premise — Gate-3-verifiable,
  not asserted as a pinned fact — that GitNexus ranks no implicit conversions for any language; but the
  narrowing stands as a deliberate Conservatism reduction *regardless* of that premise's truth: WI-2 elects
  the conservative exact-type rule even if the host could do more.) It narrows REQ-008's selection
  algorithm; it is NOT entailed by REQ-012 parity, which concerns node/edge *kind* only. The acceptance
  fixture pins a host-resolvable case.)
- **REQ-009** — The system SHALL resolve field and property access chains across user-defined Apex types.
- **REQ-010** — The system SHALL resolve references between user-defined Apex symbols declared in
  different files of the analysed repository without requiring an explicit import statement.
  (**Amended v1.6 — bounded exception:** WHERE a class/interface/enum is mis-declared in a `.trigger`
  file — invalid Apex, reachable only in uncompiled source — its typed-receiver and case-varied
  cross-file forms remain unresolved (the trigger discriminant is the source-file extension): a
  documented liveness limitation. Correctly-filed types retain the full SHALL.)
- **REQ-011** *(type-usage sub-clause clarified v1.4)* — WHEN a user-defined Apex trigger body references a
  user-defined Apex type, method, or field, the system SHALL resolve the reference to that symbol. For a
  **method/constructor invocation** (incl. a static `Type.method()` call) or a **field/property access**,
  resolution is a resolved edge from the trigger to the symbol's node (CALLS / ACCESSES). For a **bare
  declared-type usage** in the trigger body (e.g. `Account a;`), resolution is the binding of the declared
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
  a node of the same kind, with an edge of the same kind, as the Java/Kotlin benchmark resolves on an
  equivalent fixture.
- **REQ-013** — IF an Apex reference targets an external symbol, THEN the system SHALL treat it as an
  external unresolved reference in the same manner as the benchmark treats its standard library, and
  SHALL NOT report it as an Apex-specific defect.

**Metadata**
- **REQ-014** — The system SHALL capture annotations declared on Apex **members** (methods,
  constructors, fields, and properties) as metadata on the corresponding nodes. (Amended v1.1: scoped
  to member-level. Type-level annotation capture is deferred — REQ-106 — as it exceeds the Java/Kotlin
  parity benchmark, which captures no type-level annotations, and has no host mechanism.)

## 6. Non-Functional Requirements (ISO 25010, measurable)

- **NFR-001 (Reliability)** — WHILE analysing malformed or syntactically incomplete Apex source, the
  system SHALL complete the analysis run without crashing and SHALL skip the unparseable file.
- **NFR-002 (Compatibility)** — The system SHALL preserve existing resolution and graph behaviour for
  every other supported language (measured: the pre-existing test suite stays green).
- **NFR-003 (Performance efficiency)** — The system SHALL apply the same per-file resource-budget
  threshold to Apex files as to other supported languages: a file exceeding that threshold is skipped at
  the same limit, with no Apex-specific exemption.
- **NFR-004 (Maintainability)** — Apex resolution SHALL be covered by an automated resolution test
  comparable in kind to those covering peer supported languages.

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
  Given a repository containing an Apex class with a method and a field
  When GitNexus analyses the repository
  Then the graph contains a node for the class
  And the graph contains nodes for its method and field associated with the class

# REQ-004, REQ-011
Scenario: A trigger resolves a call to a user-defined handler
  Given an Apex trigger whose body calls a method on a user-defined Apex class
  When GitNexus analyses the repository
  Then the graph contains a container node for the trigger
  And there is a resolved edge from the trigger to the user-defined method

# REQ-005, REQ-006
Scenario: An in-repository method call resolves with no unknown symbol
  Given two user-defined Apex classes where one calls a method on the other
  When GitNexus analyses the repository
  Then there is a resolved edge from the call site to the called method
  And no unresolved symbol is recorded for that call

# REQ-015
Scenario: An ambiguous in-repository reference is left unresolved, not mis-bound
  Given two user-defined Apex symbols a reference could equally denote
  And the reference resolves through the language's bindings channel
  When GitNexus analyses the repository
  Then no resolved edge is emitted for that reference
  And the reference is recorded as unresolved rather than bound to a wrong target

# REQ-015 (amended v1.5 — the bounded fallback-channel exception)
Scenario: Case-variant duplicate types referenced via the host's exact-case channel (documented limitation)
  Given two user-defined top-level Apex types whose names differ only by case (invalid Apex, uncompiled source)
  And a constructor, inheritance, or static type-name reference matching one of them exactly by case
  When GitNexus analyses the repository
  Then that reference binds its unique exact-case match via the host's language-uniform channel (documented limitation)
  And every other reference form to the colliding name emits no binding and is recorded unresolved
  # A SAME-case duplicate has no unique key: the host's single-match guard binds nothing — the main
  # REQ-015 scenario above governs it unchanged (probe-verified 2026-07-02).

# REQ-007
Scenario: Inheritance and interface implementation resolve
  Given an Apex class that extends a user-defined class and implements a user-defined interface
  When GitNexus analyses the repository
  Then the graph contains an inheritance edge to the parent class
  And the graph contains an implementation edge to the interface

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
  Then no resolved edge is emitted and the reference is recorded unresolved (REQ-015)

Scenario: Multi-parameter overload selection, all positions identical to one overload
  Given a user-defined Apex class with two equal-arity multi-parameter overloads of different signatures
  And a call site whose argument static types are identical to exactly one overload at every position
  When GitNexus analyses the repository
  Then the resolved edge targets that overload

Scenario: Multi-parameter overload, no overload identical at every position
  Given a user-defined Apex class with two equal-arity multi-parameter overloads of different signatures
  And a call site whose argument static types match no overload at every position (some positions only)
  When GitNexus analyses the repository
  Then no resolved edge is emitted and the reference is recorded unresolved (REQ-015)

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
   handling (REQ-012, REQ-013, NFR-004).

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
