# Constitution — GitNexus Apex Support

*Project-level governing document (VSDD §A.2). Owned by the Architect (Adam). Drafted by the
Builder from the host project's existing conventions; **ratified by the Architect (Adam) on
2026-06-28**. Changed only by the amendment process below.*

- **Identifier:** CONST-gitnexus-apex
- **Version:** 1.1.3 · **Date:** 2026-07-05 · **Status:** ratified · **Supersedes:** 1.1.2
- **Ratified:** Adam (Architect), 2026-06-28. §6 fuzz budget right-sized pre-ratification (saturation
  exit + parity bar, replacing the 500k-execution count) — a draft revision, not a §7 amendment.
- **Amendment v1.1.0 (2026-06-29, Architect Adam):** §2.2 refined — generic, language-agnostic
  extension points / quality guards MAY be added to shared factories or phases where no host seam exists
  (the original "phases not edited" assumed every seam pre-existed). Surfaced by WI-1 Gate-2 review: a
  from-scratch language needs new generic seams (field-annotation hook, node-kind marker hook,
  degenerate-node guard); §2.1's no-Apex-naming guarantee is unchanged and absolute.
- **Amendment v1.1.1 (2026-06-30, Architect Adam):** §2.1/§2.2 isolation guarantee scoped to **logic and
  branching**, not comment prose. The v1.1.0 "absolute, all Apex naming forbidden" wording was too literal:
  the host's own shared ingestion files pervasively name example consumer languages (C++, Python, Java,
  Kotlin, PHP, Ruby) in **explanatory comments** to record why a generic seam exists, and the WI-2 §2.2
  seams do the same for Apex while carrying **no** Apex-specific executable path (no `language === Apex`
  branch anywhere). The rule's RFC #909 / RING4-1 target is per-language *coupling in shared logic*, which
  stays absolutely forbidden; naming Apex in a comment is permitted (and consistent with host convention).
  Surfaced by a WI-2 Gate-4 Pass-1 reviewer split (one reviewer read the literal ban as violated by the
  seam comments, one read it as conformant) — the ambiguity was in the Constitution text, not the code.
- **Amendment v1.1.2 (2026-07-04, Architect Adam):** §1.2 (Conservatism) admits a bounded set of
  documented limitations that depart from the conservative default. Surfaced by a WI-3 Gate-1 Phase-5
  cascade cold re-review: rounds of SRS bounded exceptions had ratified both **(a) valid-source false
  edges** and **(b) invalid-source channel binds** while §1.2's head still forbade any misleading binding
  unconditionally — the head stood contradicted by its own ratified exceptions. §1.2 now records both
  classes as Architect-ratified, fixture-pinned documented limitations (valid-source class with a committed
  WI-4 fix path), not a licence to invent misleading bindings. The exact exception membership is the §1.2
  clause body's BL-row citations against the SRS §5.1 register (the single source of truth) — not
  re-enumerated here. This does **not** weaken a
  non-waivable baseline (§7 — SECT-001 and the empty-Prove floor are untouched); the conservatism default
  stands everywhere else.
- **Amendment v1.1.3 (2026-07-05, Architect Adam):** editorial — §1.2's exception citations re-pointed to
  the SRS §5.1 Bounded Limitations Register (the single source of truth for the exception catalog) and the
  exact-case-arm split noted for BL-12. No guarantee is altered and no exception is added or removed (the
  (a)/(b) membership is unchanged); a §7-editorial citation re-point, versioned per §7's "committed as a new
  dated version" rule.
- **Amendment v1.1.4 (2026-07-08, Architect Adam):** §1.2's **(a) valid-source false edge** class — register
  **BL-2, BL-4, BL-6, and the BL-7 `super.method()` self-loop** — is **DISCHARGED at WI-4** (ITEM-004). The
  WI-4 heritage/namespace-sibling pipeline re-sequence and nested-aware heritage-base seam (SDD-004
  §1(1)/§1(2)) correct the underlying heritage edges, so none of those false edges is emitted any longer; the
  SRS §5.1 register and §1 in-scope framing reflect the discharge (SRS v1.29). The §1.2 (a) clause body is
  annotated discharged (its BL-row enumeration named the rows + their fix-path status, so the text change is
  owed despite §1.2's register-deference head). **No exception is added or invented; the (b) invalid-source
  class is unchanged.** Authored ON the WI-4 Gate-3 verification evidence (SDD-004 §8 — not ahead of it), a
  §7 "committed as a new dated version" amendment. The non-waivable baseline (§7 — SECT-001, the empty-Prove
  floor) is untouched.

This project is a fork of `abhigyanpatwari/GitNexus` adding Apex language support. Its prime
directive: **honour the host project's standing conventions** (`DoD.md`, `CONTRIBUTING.md`,
`ARCHITECTURE.md`, `AGENTS.md`). Where this Constitution is silent, the host project's documents
govern. Nothing here weakens a host-project gate.

## 1. Governing Principles

1. **Parity, not invention.** Apex support targets resolution parity with GitNexus's Java/Kotlin-tier
   OOP support for user-defined symbols. It does not invent a richer model than peer languages have.
2. **Conservatism under ambiguity** (host roadmap principle): prefer emitting *no* binding over a
   misleading one. An unresolved external reference is correct behaviour, not a defect.
   *(Amended v1.1.2, 2026-07-04, Adam.)* A bounded, **Architect-ratified, fixture-pinned** set of
   limitations departs from the conservative default — each catalogued in the **SRS §5.1 Bounded
   Limitations Register** and reachable only in a narrow named shape: **(a) valid-source false edges** —
   register **BL-2, BL-4, BL-6, and the BL-7 `super.method()` self-loop** (committed fix path WI-4 —
   **DISCHARGED at WI-4, SRS v1.29 / Constitution v1.1.4, 2026-07-08: this (a) class now holds no live
   valid-source false edge**); and
   **(b) invalid-source channel binds** — register **BL-10, BL-11, and the BL-12 exact-case arm** (BL-12's
   same-case arm is the retained conservative default, not a (b) exception), reachable only in uncompiled
   Apex. Both classes arise because suppressing them would require Apex-specific coupling in shared host
   code (forbidden by §2) or trade one graph inconsistency for another (an EXTENDS edge absent from its own
   MRO). These are **not** licence to invent a misleading binding — the conservatism default (no binding
   over a misleading one) stands everywhere else and is never waived for convenience. (The register is the
   single source of truth; this clause cites its rows and does not restate them.)
3. **Additive, non-regressing.** Adding Apex MUST NOT change graph or resolution behaviour for any
   existing language. The existing suite stays green.
4. **The goal is not a compiler.** No standard-library, sObject, or schema modelling — peer languages
   model none, and parity excludes it.

## 2. Architectural Rules

1. **Language isolation.** All Apex-specific logic lives under `gitnexus/src/core/ingestion/languages/apex/`
   and the per-language registries (provider index, `SCOPE_RESOLVERS`). Shared ingestion code MUST NOT
   contain Apex-specific **logic or branching** — no executable path keyed on Apex (no `language === Apex`,
   no Apex-only behaviour), and Apex MUST NOT appear as a branch condition or identifier in shared code
   (host RFC #909 / RING4-1). **Naming Apex in an explanatory comment is permitted** and matches the host's
   pervasive convention (the shared files name C++, Python, Java, Kotlin, PHP, Ruby in comments to record
   why a generic seam exists); the rule forbids Apex-specific *coupling in logic*, not comment traceability.
   *(Scoped to logic/branching v1.1.1, 2026-06-30, Adam — see header.)*
2. **Registration + generic seams, not Apex-specific pipeline edits.** Apex is added primarily by
   registering a `LanguageProvider` and a `ScopeResolver`. The shared parse and scope-resolution phases
   MUST NOT be edited to **branch on** Apex or carry Apex-specific logic (§2.1 — the isolation guarantee;
   an explanatory comment naming Apex is permitted per §2.1 v1.1.1). Where a
   needed behaviour has **no existing host seam**, a **generic, language-agnostic** extension point or
   quality guard MAY be added to a shared factory or phase — provided it (a) names no language, (b) is
   configured by the isolated provider *or* applies uniformly to every language, and (c) regresses no
   other language (NFR-002, measured). *(Amended v1.1.0, 2026-06-29, Adam: the original "phases are not
   edited" assumed every needed seam pre-existed; a from-scratch language sometimes requires a new
   generic seam — member annotations on Property nodes, a node-kind marker, a degenerate-node guard.
   Isolation is preserved — §2.1 still forbids Apex-specific *logic/branching* in shared code (comment-level
   naming excepted, v1.1.1).)*
3. **Safe parsing.** All tree-sitter parsing routes through `parseSourceSafe()` (host `require-safe-parse`
   eslint rule) — never a direct `.parse()`.
4. **Grammar vendoring.** The Apex grammar is vendored under `gitnexus/vendor/` and recorded in
   `.github/vendored-grammars.json`, consistent with Swift/Kotlin/C/Dart.
5. **Per-language test.** Apex carries a scope-resolution test at
   `gitnexus/test/integration/resolvers/apex.test.ts` (auto-discovered by CI parity).
   *(Clarified 2026-06-29, Architect-approved: the Apex test surface spans additive sibling suites —
   `apex.test.ts` (WI-1 parse/graph), `apex-resolution.test.ts` (WI-2 resolution),
   `apex-hardening.test.ts` (Gate-5 hardening), and main-thread unit anchors `test/unit/apex-*.test.ts`
   — all auto-discovered by the same vitest glob. The named path is representative, not exclusive; the
   additive siblings satisfy §2.5, they do not contradict it.)*

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
- **Fuzz budget (§A.4):** the SECT-001 boundary (`parseSourceSafe()`-routed Apex ingestion) is the
  target. The budget is calibrated to the actual risk surface — the vendored `parser.c` is generated,
  ABI-frozen, has **no external scanner** (the memory-unsafe surface tree-sitter fuzzing exists to
  catch), and is continuously fuzzed upstream (OSS-Fuzz); the owned surface is the TS ingestion path.
  Exercised by:
  1. **A malformed/adversarial-input no-crash test** (the host `c-coverage`/`csharp`/`cobol` pattern) —
     a corpus of truncated, deeply-nested, huge-identifier, unterminated-string/comment, mixed-encoding,
     and max-buffer-boundary Apex; asserts no throw escapes, conservative skip, bounded time/memory.
     **This is the gating obligation.**
  2. **A bounded smoke-fuzz** of the ingestion entry: exit on coverage plateau (no new edge in 5,000
     executions) **or** a ≥ 10,000-execution floor, whichever comes first, under a ~5-minute CI
     wall-clock cap; sanitizers on; seeded with the resolver fixtures + adversarial corpus. A
     malformed-input crash is fixed-only; zero un-triaged crashes at exit.

  This is the saturation-based exit (no new edges + zero un-triaged crashes), parity-consistent with how
  Swift/Kotlin/Dart were admitted (integration tests + a malformed-input no-crash test; the host has no
  heavier fuzz gate for any language).
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
