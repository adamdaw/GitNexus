# Gate 4 pass record — Adversarial Refinement (ITEM-001 / WI-1)

*VSDD §A.7. Gate 4 = two sequential passes over the test-passing implementation. Pass 1 (spec/test
fidelity) is fixed-only; Pass 2 (code quality/security/process/dependencies) closes only after Pass 1
passes, by a **distinct invocation with no Pass-1 involvement**. Verdict authority: Architect (Adam).
Reviewers: `vsdd-spec-reviewer` (Pass 1), `vsdd-code-reviewer` (Pass 2) — each fresh, **context-free**
per round (admitted artefacts + standing criteria only; no round/fix/focus framing). Disposition routing
via Phase 5 (route to owning phase + cascade-invalidate).*

- **Work item:** ITEM-001 (WI-1) — parse & graph population.
- **Spec under review:** SDD-001 **v1.2.1** (`.vsdd/SDD.md`) under Constitution **v1.1.0**.
- **Implementation under review:** `gitnexus/src/core/ingestion/languages/apex/**` (10 files incl. the
  new `modifiers.ts`), provider registration `languages/index.ts`, the three generic shared seams
  (`class-types.ts` + `class-extractors/generic.ts`; `field-types.ts` + `field-extractors/generic.ts`;
  `workers/parse-worker.ts` empty-name guard + Apex grammar-table registration + safe-parse), and the
  recognition entries in `gitnexus-shared/src/` (enum + extension/syntax/classification maps).
- **Verdict:** **PASS** — Pass 1 PASS (all fidelity findings fixed), Pass 2 **PASS_CLEAN** ("Forced to
  manufacture flaws"). All findings dispositioned; no quality finding required an Architect waiver.
- **Date:** 2026-06-29. **Architect sign-off:** Adam, 2026-06-29.

## Objective evidence (admitted to both passes)

- Apex suite **93 passed (93)**: `apex.test.ts` 65 integration + `apex-provider.test.ts` 22 +
  `apex-skip-grammar.test.ts` 4 + `apex-vendored-grammar.test.ts` 2. Java peer suite **186 passed**
  (no regression). `tsc --noEmit` clean.
- **SEC-001 static audit:** zero raw `.parse(` under `languages/apex/**`; sole production parse is
  `parse-worker.ts:1254` via `parseSourceSafe`. (The `require-safe-parse` ESLint rule was not runnable
  in-environment — eslint absent from `node_modules` — so SEC-001 was assessed statically and by both
  reviewers; recorded as a measurement gap, not a finding.)
- **Coverage on `languages/apex/**` (§3 SHALL, ≥80% lines):** **~92% lines / ~90% stmts / 84% funcs /
  ~74% branch**, measured via the main-thread `apex-provider.test.ts` unit suite. The integration path
  runs the provider configs inside a parse **worker_thread** from compiled `dist/`, which main-thread v8
  instrumentation cannot see; the unit suite parses Apex in-process and calls the config functions
  directly so the logic is coverage-attributable. The §3 SHALL is therefore **met and evidenced, not
  waived**. Residual uncovered lines are interface-mandated/defensive (the unreached-but-required
  `extractName` hook, null-declaration guard).

## Pass 1 — Spec & Test Compliance (fidelity)

- **Reviewer:** `vsdd-spec-reviewer` (read-only: Read/Glob/Grep), fresh + **context-free** each round.
  **Admitted bundle:** SDD-001 v1.2(.1), SRS-001, Constitution v1.1.0, work-items, the four Apex test
  files, the implementation paths above, and the objective evidence. **Withheld** (§A.17): HANDOFF,
  sessions, ADRs, findings/pass-records, tdd, research rationale, session/daily logs.
- **Independence:** each round a distinct Agent invocation; no producer-session context.

| Round | Verdict | Findings → disposition |
|---|---|---|
| R1 | FAIL | 1 fidelity — `class-types.ts` JSDoc named `apexConstruct`/`trigger` in shared code (§2.1 violation, contradicting SDD §1 "seam names no language") → **fixed** (comment genericised). |
| R2 | PASS | "Forced to manufacture flaws." (clean re-review after the comment fix). |
| R3 | PASS | After the export-checker + case-insensitive impl changes: scope boundary confirmed (keyword-casing folded; **identifier ids stay case-preserving** — WI-2 deferral intact). 1 minor fidelity — SDD §3 described a worker-level `.type === 'field_declaration'` multiplicity discriminant the impl doesn't use (the query captures `@definition.property` per `variable_declarator`) → **fixed** (SDD §3 reworded to as-built; SDD → v1.2.1). |

- **Pass 1 verdict:** **PASS** — all fidelity findings fixed (none signed off). Tests confirmed
  non-tautological, non-over-mocked; every REQ-002/003/004/014 + NFR-001/003 + SEC-001 pin traced to an
  executable assertion.

## Pass 2 — Code Quality / Security / Process / Dependencies

- **Reviewer:** `vsdd-code-reviewer` (read-only), fresh + **context-free** each round, **distinct
  invocation with no Pass-1 involvement** (independence reset, §A.7). **Admitted bundle:** the
  implementation + tests + Constitution + SDD security/coverage pins + objective evidence. Same withheld
  set as Pass 1.

| Round | Verdict | Findings → disposition |
|---|---|---|
| R1 | FAIL | (1) `export-checker.ts` bucketed visibility via a whole-`modifiers`-text regex, so an annotation argument containing a keyword (e.g. `@RestResource(urlMapping='/public/v1')`) mis-classified a modifier-less member as exported → **fixed** (host token-walk `hasModifier`; regression test + Red-Green-Revert). (2) §3 ≥80% coverage SHALL appeared unmeasurable (worker-thread execution) → **answered, not waived**: added the main-thread `apex-provider.test.ts` unit suite; measured 86.7% → 92% lines. |
| R2 | FAIL | 1 quality (correctness) — Apex is case-insensitive but every modifier predicate matched lowercase exact-text, so `webService`/`Public`/`GLOBAL` (grammar preserves source case) mis-classified `isExported`/visibility/static/final/abstract → **fixed** (Apex-local `modifiers.ts` case-folding `apexHasModifier`/`apexFindVisibility`, wired into export-checker/field/method configs; the shared helpers stay case-sensitive for Java/Kotlin; regression tests + Red-Green-Revert). |
| R3 | PASS | 2 minor quality → **fixed**: `modifiers.ts` comment misdescribed the AST walk (reworded); `field-config.ts extractType` carried a dead secondary fallback for a grammar-impossible shape (dropped; coverage of the file 77% → 94%). |
| R4 | PASS | 1 minor quality → **fixed**: `field-config.ts extractName` over-implemented (factory prefers `extractNames`; the hook only serves a single-name caller) → delegated to `declaratorNames(node)[0]`. |
| **R5** | **PASS_CLEAN** | "Forced to manufacture flaws." — SEC-001, §2.1/§2.2 purity, edit-minimality, test quality, dependency hygiene all clear; no new dependency. |

- **Pass 2 verdict:** **PASS_CLEAN**. No CSDD MUST violation; no undischarged Prove (none in scope —
  a parser guards no security/financial/data-integrity invariant; §A.3 N/A, recorded at Gate 2).

## Edit-minimality (over-editing review, §A.7)

All edits confined to `languages/apex/**`, the three sanctioned §2.2 generic seams, the recognition
tables, and the SDD §3 reconciliation. Name/identifier extraction remained raw-text (no over-folding);
the case-fold applies to modifier keywords only. No collateral refactor of peer languages or shared
factories.

## Dispositions summary

- **Pass 1:** 2 fidelity findings, both **fixed** (§2.1 comment; SDD §3 reconciliation → v1.2.1).
- **Pass 2:** 6 quality/correctness findings, all **fixed**; 0 signed off. The two most consequential
  were genuine WI-1 parse-correctness bugs (annotation-argument export mis-bucketing; case-insensitive
  modifier keywords) caught only at Gate 4 — see dogfood findings below.

## Dogfood findings (fold into `~/Projects/Home/vsdd`, branch `feature/plugin`)

- **#16 — coverage pins must respect the host's measurement architecture.** A coverage SHALL on code
  that executes in a worker_thread from compiled output is unmeasurable by main-thread v8 instrumentation;
  the fix is main-thread unit anchors that call the provider's pure functions directly (not a waiver).
  The methodology/§A.11 should note: when integration runs off-thread, author unit anchors so coverage
  is attributable.
- **#17 — case-insensitive-keyword languages need keyword-casing handled at PARSE, separately from
  identifier case-insensitivity at RESOLUTION.** The WI-2 "case-insensitivity → resolver" deferral covers
  *identifier* folding; *keyword/modifier* casing is a WI-1 parse-correctness concern (a wrong node
  attribute), and conflating them left a real `webService`-endpoint mis-classification latent until
  Gate 4 Pass 2.

## Cleared

Both passes dispositioned (every Pass 1 finding fixed; every Pass 2 finding fixed; none signed off).
Gate 4 is not merge authority — Phase 6 (Gate 5: fuzz + mutation + safe-parse audit) completes WI-1's
vertical. On Architect sign-off: commit the record, then `/vsdd-advance` → Phase 6.
