# Gate 3 (Tests vs Spec) — WI-4 (ITEM-004) — PASS_FIXED

**Work item:** ITEM-004 (WI-4: parity hardening & external handling).
**Gate:** 3 — Tests vs Spec, implementation WITHHELD (VSDD Phase 3, Step 3a → Gate 3).
**Verdict:** **PASS_FIXED** — clean cold pass by a distinct fresh reviewer at R3 after R1/R2 fixes.
**Architect approval:** **Adam (Architect), 2026-07-08** — Gate 3 cleared; WI-4 advances to Step 3b
(implementation unlocked).

## Artifacts (pinned by git blob SHA at reviewed HEAD `6cf3e43f`, `feature/apex-parser`)

| Artifact | Blob SHA |
|---|---|
| SDD-004 (source spec, `.vsdd/SDD.md` `# SDD-004`) | `b681a349083904804063b5c6018b67506cd57c9c` |
| SRS-001 v1.28 (`.vsdd/SRS.md`) | `2c5cf4123de132c3fb948c0907d801a987041782` |
| Constitution v1.1.3 (`.vsdd/Constitution.md`) | `12ceab6f193ced3a40aa25221c437d02b5f1f242` |
| Tests — `apex-cross-file.test.ts` (BL-1…BL-8 flips + BL-10) | `f3ef2c57fffca3fae7e3ea923112136631ce5881` |
| Tests — `apex-parity.test.ts` (REQ-008/012/013, receiver-var, seam refuses, cycle) | `3984997721e7825fd63c07823bc0e8bac83ef230` |
| Red-gate ledger (`.vsdd/tdd/WI-4-red-gate.md`) | `fae635e70fce7969d1ae4eaa9526c572fb4e5921` |
| Standing-dispositions note (admitted §A.17) | `d3903337e4a23f4b623a53876e93f2f477675f50` |

Fixtures under `gitnexus/test/fixtures/lang-resolution/`: `apex-param-arg/`, `apex-external/`,
`apex-parity/`, `apex-heritage-cycle/`, `apex-heritage-refuse/` (new); `apex-cross-file/Outer.cls`
(added `Inner()` ctor) and `apex-cross-file-collision/PhantomSub.cls` (new) — all at HEAD `6cf3e43f`.

## Reviewer & independence attestation (§A.7)

Three **distinct** `vsdd-test-validator` invocations, each a fresh context-free agent with **no**
producer-session access, no deliberation record, no ADRs, no HANDOFF, no research rationale, and no
prior-review narrative — each received only the admitted bundle below and the standing Gate-3
checklist (no round/fix/focus framing).

- **R1** — agent `af1704cffbc6f22c2` — 9 findings.
- **R2** — agent `a84017e009ed946af` — 1 finding (distinct invocation; did not run R1).
- **R3** — agent `af5128efff29a34a9` — **CLEAN** ("Forced to manufacture flaws."; explicit
  "GATE 3 TEST VERDICT: PASS"); distinct invocation with no prior involvement.

## Admitted bundle (§A.17)

**Admitted:** SDD-004 (source spec under which the tests derive), SRS v1.28 + Constitution v1.1.3
(governing artifacts the tests must not contradict), the two WI-4 test files + all WI-4 fixtures
(the derived artifact under review), the WI-4 red-gate ledger (objective evidence of the pre-impl
red/green split), and the rationale-redacted standing-dispositions record (so the four settled
Architect rulings were not re-raised). **Withheld:** the implementation (WITHHELD — not yet built;
Step 3b is gated behind this pass), deliberation record, ADRs, HANDOFF, RESEARCH-004 rationale, and
all prior-review narrative.

## Objective evidence (Red Gate, at HEAD `6cf3e43f`)

- **20 WI-4 reds** (behaviour unbuilt): 10 in `apex-cross-file.test.ts` (BL-1…BL-8 discharge flips +
  BL-10 heritage arm) + 10 in `apex-parity.test.ts` (REQ-008 param-arg user-defined/dotted/
  enclosing narrowing + REQ-006 anchor; receiver-variable fold; NFR-001 case-varied heritage cycle;
  and the three decoy-bearing seam refuses RExtOuter/RTailAbsent/RCollidedOuter + the RCaseOuter
  case-varied-OUTER resolve).
- **Full resolver suite: 3047 passed / 20 failed of 3067 (56 files).** The 20 failures are exactly
  the intended WI-4 reds in the two owned files; every peer language and every non-WI-4 apex test is
  green — NFR-002 holds for the Step-3a test/fixture additions (zero production source changed;
  the full NFR-002 cross-language *measurement under the two WI-4 shared edits* is owed at Gate 4).
- Green anchors (no-red justifications in the ledger, independently re-verified by R3): the REQ-012
  parity cross-file shapes (WI-3 REQ-010), REQ-013 external no-edge/no-defect (host default), the
  bare-declared-type no-standalone-edge arm, the external-typed and enclosing-tie param-arg
  conservative skips, the receiver-variable collision skip, and the two no-decoy seam refuses
  (RNamespace >2-segment, RAmbiguous ambiguous-nested-tie).

## Findings & dispositions (all fixed-only — derivation-fidelity, §A.8)

**R1 (9 findings, Adam-dispositioned "fix all + add #8"):** (1/2) BL-3/BL-4 EXTENDS assertions
strengthened to pin the nested target node (`ext.target === 'Inner'/'TInner'`) — a file-only check
greened on a seam bug returning the OUTER binding; (3/4) added `apex-heritage-refuse` covering the
six SDD-004 §4 dotted-base shapes incl. the ambiguous-nested refuse-on-tie fixture §7 names; (5)
BL-10 MRO-downstream made non-vacuous (PhantomSub `ghost()` call; memberless-trigger structural
disposition); (6) added the §1(3)(c) enclosing-scope tie param fixture (ETie); (7) added the REQ-006
negative for the flipped collision-block discharges; (8) added the receiver-variable collision
fixture (PColl). Commit `50d38b54`.

**R2 (1 finding, Adam-dispositioned "fix"):** BL-1 `implements`/`extends` pins were over-broad
(`targetFilePath.includes('Iface')` also matched IfaceUser.cls + SubIface.cls → a mis-bind to the
wrong interface would green). Pinned `impl.target === 'Iface'` and `ext.target === 'Base'`. Commit
`6cf3e43f`.

**R3:** CLEAN — no findings.

**Cascade:** none during the loop — every fix was test/fixture/ledger-only; SDD-004, SRS, and the
Constitution are byte-unchanged, so no Gate-1/Gate-2 pass record is invalidated. (The committed
Phase-5 SRS/Constitution discharge amendments — SRS §5.1 register `Fix=WI-4`, REQ-007/005/009, §9
Gherkin, §1+INTENT-001, BL-10, BL-1 implements arm, Constitution §1.2(a) — are authored on the
discharge evidence at Step 3b, when the flipped tests go green, NOT at this gate, per SDD-004 §8
"not mutated ahead of the evidence.")

**Scaffold ledger:** none — no `// vsdd:scaffold` edits were needed (grammar/provider/registration
and the WI-2/WI-3 mechanics all pre-exist; WI-4 adds no capability that must be registered before
its behavioural targets can run).

## Next

Gate 3 cleared → **Step 3b (implementation unlocked):** build the Apex-gated pipeline re-sequence +
the nested-aware heritage-base seam + the REQ-008 parameter-arg narrowing gate + the receiver-var
fold, one failing test at a time (TDD compliance log §A.12), driving the 20 reds green while the
full resolver suite stays green (NFR-002). Then the Phase-5 SRS/Constitution discharge amendments
(on green evidence), then Gate 4 (both passes; the two shared edits owe §2.2 + NFR-002 measurement)
→ Gate 5. ⚠ Track via `.vsdd/work-items.md` (ITEM-004); do NOT `/vsdd-advance` the project state
(dogfood #8).
