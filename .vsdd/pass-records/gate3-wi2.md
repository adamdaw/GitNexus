# Gate 3 Pass Record — WI-2 (ITEM-002) Resolution mechanics

*VSDD §A.7. Gate 3 = tests vs spec, before implementation. Reviewer: the
`vsdd-test-validator` agent, a fresh CONTEXT-FREE invocation per round (admitted
artefacts + standing Gate-3 criteria only — no round/fix/focus framing, no prior-
review narrative, no Builder reasoning, no implementation).*

- **Gate:** 3 (Tests vs SDD-002, implementation withheld/nonexistent)
- **Work item:** ITEM-002 / WI-2 — Resolution mechanics
- **Date:** 2026-06-29
- **Verdict:** **PASS_CLEAN** (round 4, "Forced to manufacture flaws." on a fresh reviewer)
- **Architect sign-off:** **Adam, 2026-06-30.**

## Artifacts under review (pinned by path; content as of this date)

- Tests: `gitnexus/test/integration/resolvers/apex-resolution.test.ts` (29 tests),
  `gitnexus/test/unit/apex-resolution-unit.test.ts` (7 main-thread unit anchors, §7/#16 coverage).
- Fixtures: `gitnexus/test/fixtures/lang-resolution/{apex-resolution, apex-overload-resolution,
  apex-unresolved, apex-resolution-malformed}/` (20 `.cls` fixtures).
- Red-Gate record: `.vsdd/tdd/WI-2-red-gate.md`.

## Admitted bundle (each round)

SDD-002 (§1–§8), SRS-001 (REQ-005/006/007/008/009/015 + §9 Gherkin), work-items.md (ITEM-002 light-SRS
+ acceptance boundary), Constitution v1.1.0, the test files + fixtures, the harness observability API
(`helpers.ts`, `resolution-outcome.ts`), and the Red-Gate record. **Withheld:** the resolution
implementation (does not exist), deliberation, ADRs, RESEARCH rationale, prior-round narrative, session logs.

## Independence attestation

Four distinct `vsdd-test-validator` invocations (clean context each), no SendMessage continuation between
rounds — each reviewer had no knowledge of prior findings or the Builder's fixes. The round-4 clean verdict
is therefore a fresh first-pass "Forced to manufacture flaws.", not a re-review of a known-good suite.

## Objective evidence (test run, this date)

- WI-2 unit anchors: **7 failed / 7** (all genuinely red pre-impl — `normalizeIdentifier` undefined; the
  `arity-metadata` param-type fold module absent).
- WI-2 integration: **19 failed / 29** (positive resolution anchors red); 10 documented conservative-
  negatives pass (enumerated + justified in the Red-Gate record).
- Non-regression: peer `java.test.ts` + WI-1 `apex.test.ts` **green** (261 passed across both).

## Findings & dispositions (per round; all fixed-only, Architect-dispositioned)

**Round 1 (FAIL):** (1) REQ-006 uncovered on the overload fixture → fix; (2) REQ-008(ii) target under-
specified → fix; (3) REQ-005 delegation collapsed to one existence check → fix; (4) §4 external-arg
overload edge case missing → fix (new fixture + test); (5) §4 null/empty + ref-inside-malformed-unit
unexercised → fix (new fixtures + tests); (6) Red-Gate ledger omitted two `findDanglingEdges` lines → fix;
(7) OverUndis REQ-015 obligation-2 unobservable for misses → accept (Gate-3 reliance, documented);
(8) param-type rendering-asymmetry negative path unforceable → accept (residual).

**Round 2 (FAIL):** (1) REQ-006 over-scoped — global empty-`suppressed` conflicts with REQ-015 obligation-2
on the overload fixture → fix (scope to resolving names `{f,g}`); (2) REQ-015 obligation-2 under-specified
(`length>0` greens on any suppression) → fix (bind to the `value` reference); (3) param-type rendering-
asymmetry → fix (recorded as explicit [Gate-3 reliance] note in the ledger); (4) Constitution §2.5 path →
sign-off (sibling auto-discovered; non-contradiction).

**Round 3 (FAIL):** (1) `super.greet()` target fidelity — bare `target==='greet'` greens on a mis-bind to
the override `Derived.greet` → fix (pin `targetId` to Base); (2) §7 main-thread unit anchors missing
(coverage attribution, dogfood #16) → fix (new `apex-resolution-unit.test.ts` for `normalizeIdentifier` +
the param-type case-fold); (3) Constitution §2.5 named path (recurring) → fix (one-line clarifying §2.5
note, Architect-approved: additive siblings satisfy, not contradict).

**Round 4 (PASS_CLEAN):** "Forced to manufacture flaws." — the suite faithfully and completely derives
SDD-002 within the single-declaration-unit acceptance boundary; every observable behavioural target has a
genuine red anchor; all conservative-negatives justified and paired; the two unobservable items
(param-type asymmetry, no-match obligation-2) are documented [Gate-3 reliance]s, not silent gaps.

## Residuals carried to Step 3b (documented, not silent)

- The REQ-015 "recorded as unresolved" obligation is observed via `resolutionOutcomes` `suppressed`
  records — the only readable positive record. If Step 3b finds the host does not route Apex ambiguity
  through a `suppressed` outcome, the case-only-collision test loops back (Phase 5).
- Param-type comparison-symmetry: Step 3b must render the argument-side token via the same raw
  `formal_parameter.type` path (case-fold both sides) as the declared segment; divergence degrades to a
  conservative REQ-015 unresolved (caught by the (i)/(i-fold) anchors going red), never a mis-binding.

## On clearing

On Architect sign-off: commit this record; update the `work-items.md` ITEM-002 ledger to gates
[1, 1-decomp, 2, 3]; **do NOT `/vsdd-advance` the project state** (dogfood #8 — state.json is the stuck
phase-7 artifact; the ledger is authoritative). Then Step 3b: implement the `normalizeIdentifier` §2.2
seam + the Apex resolution configs/hooks (the gate hook unlocks impl source once Gate 3 is recorded).
