# Constitution — GitNexus Apex Support

*Project-level governing document (VSDD §A.2). Owned by the Architect (Adam). Drafted by the
Builder from the host project's existing conventions; **pending Architect ratification** at Gate 1.
Changed only by the amendment process below.*

- **Identifier:** CONST-gitnexus-apex
- **Version:** 0.1.0 · **Date:** 2026-06-28 · **Status:** proposed · **Supersedes:** none

This project is a fork of `abhigyanpatwari/GitNexus` adding Apex language support. Its prime
directive: **honour the host project's standing conventions** (`DoD.md`, `CONTRIBUTING.md`,
`ARCHITECTURE.md`, `AGENTS.md`). Where this Constitution is silent, the host project's documents
govern. Nothing here weakens a host-project gate.

## 1. Governing Principles

1. **Parity, not invention.** Apex support targets resolution parity with GitNexus's Java/Kotlin-tier
   OOP support for user-defined symbols. It does not invent a richer model than peer languages have.
2. **Conservatism under ambiguity** (host roadmap principle): prefer emitting *no* binding over a
   misleading one. An unresolved external reference is correct behaviour, not a defect.
3. **Additive, non-regressing.** Adding Apex MUST NOT change graph or resolution behaviour for any
   existing language. The existing suite stays green.
4. **The goal is not a compiler.** No standard-library, sObject, or schema modelling — peer languages
   model none, and parity excludes it.

## 2. Architectural Rules

1. **Language isolation.** All Apex-specific logic lives under `gitnexus/src/core/ingestion/languages/apex/`
   and the per-language registries (provider index, `SCOPE_RESOLVERS`). Shared ingestion code MUST NOT
   name Apex (host RFC #909 / RING4-1).
2. **Registration, not pipeline edits.** Apex is added by registering a `LanguageProvider` and a
   `ScopeResolver`; the parse and scope-resolution phases are not edited.
3. **Safe parsing.** All tree-sitter parsing routes through `parseSourceSafe()` (host `require-safe-parse`
   eslint rule) — never a direct `.parse()`.
4. **Grammar vendoring.** The Apex grammar is vendored under `gitnexus/vendor/` and recorded in
   `.github/vendored-grammars.json`, consistent with Swift/Kotlin/C/Dart.
5. **Per-language test.** Apex carries a scope-resolution test at
   `gitnexus/test/integration/resolvers/apex.test.ts` (auto-discovered by CI parity).

## 3. Quality Goals & Thresholds

- **Coverage floor:** the host vitest v8 thresholds — statements ≥ 26, branches ≥ 23, functions ≥ 28,
  lines ≥ 27 — produced by `cd gitnexus && npm run test:coverage`. Apex changes MUST NOT drop global
  coverage below these floors; new Apex modules SHALL be covered well above them (target ≥ 80% lines on
  `languages/apex/**`, since a new isolated module has no legacy excuse).
- **Functional suitability:** measured as parity against the host's Java/Kotlin resolver fixtures.
- **Reliability:** malformed Apex MUST NOT crash the pipeline (conservative skip, safe parse).
- **Severity & disposition policy:** findings are `blocker` / `major` / `minor` (§A.8). Blocker = ships a
  defect or fails a host DoD gate; major = substantive defect that should not ship un-dispositioned;
  minor = cosmetic/wording. No severity auto-passes.

## 4. Dependency Hygiene Policy

- **Justification:** the *only* sanctioned new runtime dependency is a tree-sitter Apex grammar — the
  standard library cannot parse Apex, and no existing GitNexus dependency covers it. Any other new
  dependency requires an explicit spec/work-item justification and re-enters review.
- **Pinning:** vendored grammar pinned by commit/version in `.github/vendored-grammars.json`; no floating
  ranges.
- **Licence:** a new dependency MUST be OSI-permissive (MIT/BSD/Apache-2.0) and compatible with the
  host's PolyForm Noncommercial distribution. (The selected grammar candidate is MIT.)
- **Review checklist:** the host dependency review applies (CVE scan, maintenance, transitive surface).

## 5. Security-Criticality Definition & Clause Register

A work item is security-critical if it touches auth/authorisation, secrets/PII, financial calculation,
or a trust boundary (parses untrusted input or crosses a privilege boundary). **Apex support is
security-critical only on the untrusted-input axis** — it parses untrusted repository source — and on
no other (no auth, secrets, PII, or financial surface).

**Clause register:**

- **SECT-001 — Untrusted source parsing (CWE-20 / resource-exhaustion on malformed input).**
  - *Level:* MUST.
  - *Applicability:* any code path that parses Apex source.
  - *Pattern:* all parsing routes through `parseSourceSafe()`; buffer sizing via the host
    `getTreeSitterBufferSize()`; malformed input degrades to a conservative skip, never a crash.
  - *Enforcement:* the host `require-safe-parse` eslint rule (required CI check) + a malformed-input
    test that asserts no crash. Automated.

No CWE-backed surface beyond SECT-001 exists for this work, so no other `SEC-NNN` instances are authored.

## 6. Verification Budgets

- **Provable properties (§A.3):** **none.** The Apex parser guards no security boundary, financial,
  data-integrity, safety, or concurrency invariant — every property falls in the "test only" row.
  Gate 5's formal-proof leg is therefore N/A for this project (a legitimate §A.3 calibration), and
  Gate 5 reduces to fuzz + mutation + the safe-parse audit.
- **Fuzz budget (§A.4):** the Apex parser is the fuzz target. Minimum effort ≥ 500,000 executions
  **and** a coverage plateau of no new edge in the last 100,000 executions; sanitizers on; seed corpus
  of representative + adversarial Apex; exit criterion = budget met and zero un-triaged crashes. A
  malformed-input crash is fixed-only.
- **Mutation expectation:** mutation run (host tooling) over `languages/apex/**`; every surviving mutant
  killed or justified `verified-equivalent`. No fixed score threshold beyond the coverage floor.

## 7. Amendment Process

A requirement or Spec that would violate this Constitution triggers an amendment, never a silent
exception: proposed with rationale → adversarially reviewed for whether it weakens a guarantee →
Architect-approved → committed as a new dated version. The non-waivable baselines (§A.1 MUST floor —
here SECT-001; §A.3 Prove baseline — here empty) cannot be weakened. Amendments take effect
prospectively. The ADR log (`.vsdd/adr/`) records rejected alternatives and accepted trade-offs and is
**withheld** from the Adversary.

## Evidence layout

- Gate pass records: `.vsdd/pass-records/`
- Finding/disposition records: `.vsdd/findings/`
- ADR log (withheld): `.vsdd/adr/`
- Admitted to a gate Adversary: the source + derived artifact under review, this Constitution, the
  elicitation-facts record (Gate 1), and objective gate evidence. Withheld: ADR log, deliberation,
  handoff notes.
