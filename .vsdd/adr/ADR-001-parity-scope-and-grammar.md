# ADR-001 — Parity-bounded scope, deferred schema realm, grammar candidate

*VSDD §A.18. Architecture Decision Record. **Withheld** from every gate Adversary (deliberation
rationale). Records the reasoning behind the Phase 1 scope decisions and the rejected alternative.*

- **Status:** accepted (Phase 1 deliberation, 2026-06-28) · **Architect:** Adam · **Builder:** Claude

## Context

GitNexus has no Apex support; Apex surfaces as unknown symbols (INTENT-001). "No unknown symbols" is
broad: Apex leans heavily on the Salesforce standard library (`System`, `Database`, `Schema`), sObjects,
and managed packages, none of which have explicit imports.

## Decision 1 — Acceptance is parity, not an absolute

Acceptance is defined as **resolution parity with GitNexus's best-supported language**, not "resolve
everything." Rationale: the Architect's instruction was to match the best support other languages get;
parity is a falsifiable, non-arbitrary bar, and it auto-tracks the host's resolution model rather than
inventing a richer one.

## Decision 2 — Benchmark = Java/Kotlin tier

Among the host's high-tier languages (TS, Python, Kotlin, Rust), **Java/Kotlin** is the parity
benchmark because Apex is a class-based, statically-typed, single-dispatch OOP language sharing their
semantics (inheritance/MRO, method overloading, constructor-visible virtual dispatch, optional-param
arity) rather than TypeScript's structural/functional ones.

## Decision 3 — Standard library / sObject / schema modelling REJECTED (not deferred)

The host roadmap is explicit that "the goal is not to build a compiler" and **no** supported language
models its standard library (only type-preserving passthroughs). Modelling Apex's stdlib + dynamic
sObject schema would be a second epic and would exceed every peer language. Rejected outright (no REQ).
External references resolve gracefully (skipped, no error) exactly as peer languages handle their stdlib.

## Decision 4 — In-scope/deferred construct split (after LoE evaluation)

LoE was evaluated against `tree-sitter-sfapex` coverage and the host provider model:
- **In scope** (cheap + parity-relevant): all user-defined OOP constructs; triggers as containers + their
  body references to user code; annotation capture as node metadata.
- **Deferred** (REQ-101…104): SOQL/SOSL semantic resolution (high + schema realm), trigger context-var
  typing (high + stdlib realm), SOQL bind-var refs (moderate, nested parse), annotation framework
  semantics (moderate, additive Tier-4). The first three are schema/stdlib realm already excluded by
  parity; the last two are optional enhancements.

## Decision 5 — Grammar candidate (Phase 2b, provisional)

`aheber/tree-sitter-sfapex` (MIT) is the leading candidate: it covers Apex + SOQL + SOSL, ships native
and WASM builds, and is the de-facto Apex tree-sitter. The chipiron fork is narrower (no triggers/
annotations/SOQL, no WASM). **Not finalised here** — grammar choice is Phase 2b, gated by a mandatory
§A.6 feasibility spike, because the host's native-binding parse path carries the same Node-ABI risk that
has Swift blocked. Vendoring + building (as Swift/Kotlin) is the expected integration path.

## Consequences

- The SRS names no grammar (kept HOW-free); A-1 carries the grammar-feasibility risk into Phase 2b.
- The deferred REQs keep the schema realm visible but out of cycle.
- Gate 5 has no formal-proof leg (no §A.3 Prove properties for a parser); fuzz + mutation carry it.
