# Gate 3 pass record — Tests vs Spec (ITEM-001 / SDD-001)

> **⚠ PARTIALLY SUPERSEDED — cascade-invalidated by SDD-001 v1.2 (2026-06-29).** This PASS_CLEAN
> validated the tests against SDD-001 **v1.1**. The v1.2 revert changes the expected behaviour for
> **7 tests** that encoded the now-reverted divergences (rounds R1/R5 above wrote them in: the
> canonical/always-on param-type signature, case-normalised ids, the same-line/identical-signature
> column disambiguator, the owner cascade-drop, and the no-nested-`DEFINES` modelling). Those 7 tests
> are re-derived to host expectations and **require a fresh context-free Gate-3 re-validation** against
> SDD-001 v1.2. The other 58 assertions are unaffected and remain valid. Re-clear order: Gate 2 (v1.2
> SDD) → revise the 7 tests → Gate 3 re-validation.

## v1.2 RE-CLEARANCE (2026-06-29)

- **Spec under test:** SDD-001 **v1.2** (`.vsdd/SDD.md`), Constitution v1.1.0. The 7 divergence-encoding
  tests were re-derived to host expectations: nested type → File `DEFINES`; identical-signature
  duplicates collapse to one (×2); non-overloaded method id carries no param segment; member id/name
  case-preserving; nameless-owner members/nested types re-parent to File (×2).
- **Reviewer:** fresh, distinct, **context-free** `vsdd-test-validator` per round — admitted = SDD-001 +
  the test files + fixtures + helpers; **implementation withheld** (tests judged against spec alone).
- **Loop:** R1 **FAIL** (1 incorrect test — the overload test still used `.toLowerCase()` + a stale v1.1
  comment, so it would pass even if the impl emitted the reverted lower-cased form; tautology) → fixed to
  assert exact-case `List<Account>`/`List<Contact>` → R2 **PASS** (faithful, non-tautological, un-mocked;
  every §2 clause + §8 assertion covered; all five v1.2 host-default pins covered by discriminating
  assertions that fail if violated). Sibling suites confirmed green: `apex-vendored-grammar` (2),
  `apex-skip-grammar` (4).
- **Execution note:** implementation already exists (Step 3b host-conforming), so the behavioural suite
  RUNS green (65/65) rather than skip — the v1.2 reverts required no new implementation; the host already
  behaved this way, which was the whole point of the revert.
- **Architect sign-off:** Adam, 2026-06-29, on the R2 PASS.
- **Verdict:** **PASS** — revised test suite cleared against SDD-001 v1.2. WI-1 green; ready for Phase 4.

---

*VSDD §A.7. Gate 3 reviews the test suite against the spec **before** implementation.
Verdict authority: Architect (Adam). Reviewer: `vsdd-test-validator`, fresh +
context-free each round (admitted artefacts + standing criteria only — no round/
fix/focus framing).*

- **Work item:** ITEM-001 (WI-1) — parse & graph population.
- **Spec under test:** SDD-001 (`.vsdd/SDD.md`) — §2 behavioural contract, §4 edge-case
  catalog, §8 enumerated Gate-3 acceptance assertions.
- **Verdict:** **PASS_CLEAN** — the final cold context-free run found no uncovered or
  incorrect requirement; the only notes were observations the reviewer itself redeemed
  as "acceptable derivations, not defects."
- **Date:** 2026-06-28. **Architect sign-off:** Adam.

## Adversary loop (each round a fresh, context-free invocation)

| Round | Findings | Disposition |
|---|---|---|
| R1 | 9 | fixed (canonical param-type signature unverified; case-insensitive ids; top-level-no-mod isExported; same-line column disambiguator; empty/whitespace; deep nesting; SKIP-env; cascade nested-type leg; tautological line-range) |
| R2 | 4 | fixed (nested interface/enum qualified id; multi-declarator distinct ranges; multiple/unknown annotations; provider statelessness) |
| R3 | 2 | fixed (grammar-unavailable pipeline test mis-targeted → real pipeline-level skip test; trigger events/sObject not emitted) |
| R4 | 2 | fixed (§4 encoding BOM/CRLF; concurrency proxy strengthened to per-file isolation) |
| R5 | PASS (2 in-scope notes) | addressed (private-enum constant; qualified-type signature) |
| R6 | PASS (2 in-scope notes) | addressed |
| R7 | PASS (1 actionable) | addressed (Interface/Enum line range) |
| **R8** | **PASS_CLEAN — 0 actionable** | — |

Findings are derivation-fidelity (fixed-only); none signed off. No spec change was
required across all 8 rounds — SDD-001 held.

## Red Gate

Met. Genuinely-red anchors: 3 filename-classification + 1 provider-routing
(`ingestion-utils.test.ts`) + 2 manifest-hold (`apex-vendored-grammar.test.ts`). The
behavioural integration suite (`apex.test.ts`, 65 tests) is executable-red — it runs
and fails because no provider/extractors exist yet. Pre-existing suite green
(`test/unit` failures = 19 environment-only git/CLI/incremental, outside this diff +
the 4 recognition anchors; zero regressions).

## Test scaffolding — red-stays-red (verified every round)

The grammar was vendored + registered as **test scaffolding** (the Apex grammar is an
ABI-14 regeneration of `aheber/tree-sitter-sfapex`; loader registration tagged
`// vsdd:scaffold`) to flip the behavioural suite skip→red. The discriminator held in
every round: the scaffold greened **no behavioural target** — recognition stayed red,
only infrastructure-presence tests (manifest, ABI smoke, consistency guard) and the
degradation guard greened. Evidence: `.vsdd/tdd/scaffold-ledger.md`,
`.vsdd/tdd/WI-1-red-gate.md`.

## Dogfood findings folded into the VSDD plugin this session (branch `feature/plugin`)

- **#10 — test-scaffolding category** + outcome-based discriminator (commit `df1de08`).
- **No-red restriction** to a residual exemption ladder (`da8e079`).
- **#12 — discriminator scoped to behavioural targets** (infra-presence tests may green) (`a2cc59d`).
- **#11 — hook wiring** fixed (dead `~/bin/vsdd-gate-check` bash prototype removed from
  settings.json; plugin cache synced to repo; gate now genuinely enforces, verified).

## Cleared

Final cold validator verdict: PASS_CLEAN. Architect signed off. `/vsdd-advance` →
gates_passed [1,2,3], implementation source unlocked for Step 3b (TDD red→green).
