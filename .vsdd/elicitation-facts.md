# Elicitation-Facts Record (Gate 1 admitted) — SRS-001

*VSDD §A.19. Bare facts surfaced during Phase 1 deliberation, so Gate 1 completeness is checkable
against what was consciously scoped — not guessed. Facts only; the **why** lives in the ADR log
(withheld).*

## Stakeholders considered

- Architect/requester (Adam); GitNexus end-users (Apex/Salesforce developers); upstream GitNexus
  maintainer (fork must honour DoD / not regress other languages). No other stakeholder identified.

## Assumptions surfaced (carried into SRS §8)

- A tree-sitter Apex grammar exists and can build/load in GitNexus's Node runtime.
- Apex OOP semantics map onto the Java/Kotlin resolution model.
- Apex's implicit namespace can be modelled by the host's existing cross-file / whole-module import
  synthesis.

## Candidates considered but NOT scheduled this cycle (deferred → REQ-101…104)

- SOQL/SOSL semantic field/object resolution.
- Trigger context-variable typing (`Trigger.new`/`old`/…).
- SOQL/SOSL bind-variable references to local Apex variables.
- Annotation framework / entry-point semantics.
- Anonymous Apex (`.apex`) blocks — recognition/graphing/resolution (deferred → REQ-105; decided at
  Gate 1 round 1).
- Behaviour for ambiguous/unresolvable in-repository references — surfaced at Gate 1 round 1 and brought
  in-scope as REQ-015 (conservative skip), not deferred.

## Candidate explicitly rejected (no REQ minted)

- Modelling the Salesforce standard library and sObject schema (the "resolve everything" option) —
  not scheduled, not deferred-with-REQ; rejected as out of the project's parity scope. (Reasoning in ADR.)

## NFR dimensions reviewed (ISO 25010)

- Reliability (malformed input) → NFR-001.
- Compatibility / non-regression → NFR-002.
- Performance efficiency (ingestion budgets) → NFR-003.
- Maintainability (test parity) → NFR-004.
- Reviewed and judged not-separately-constrained for this work: Security (covered by Constitution
  SECT-001, untrusted-input only), Usability, Portability (inherited from host).

## Tooling facts surfaced (feed Phase 2b §A.6)

- Two candidate grammars evaluated: `aheber/tree-sitter-sfapex` (MIT; Apex+SOQL+SOSL; native + WASM)
  and `jsuarez-chipiron/tree-sitter-apex` (MIT; Apex-only; narrower).
- Host parses with native tree-sitter bindings in the Node CLI; Swift support is currently blocked on a
  native Node-22 ABI issue — the same risk class for any Apex grammar.

## Construct coverage decided in-scope (this cycle)

- Parse + graph: classes, interfaces, enums, inner classes, methods, constructors, properties, fields,
  triggers (as containers); annotations captured as node metadata.
- Resolve (user-defined): calls, type usage, constructor invocation, inheritance/implementation,
  overloads, field/property chains, cross-file (no import), trigger-body references.
- External symbols (stdlib/sObject/managed-package): handled as external/unresolved at benchmark parity.
