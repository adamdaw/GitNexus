# Gate 3 re-confirmation — WI-4 tests-vs-spec mapping preserved under the Phase-5 cascade

- **Gate:** 3 (tests vs spec) — **mapping re-confirmation**, not a full red-gate re-run.
- **Work item:** ITEM-004 (WI-4).
- **Verdict:** **PASS (mapping preserved)** — clean cold pass ("Forced to manufacture flaws.").
- **Architect direction:** Adam, 2026-07-08 (fast re-confirm, then Gate 4).
- **Reviewed HEAD:** `3c89f408` (`feature/apex-parser`).

## Why a re-confirmation, not a re-run

The WI-4 Gate-3 pass record (`gate3-wi4.md`) was technically cascade-invalidated by the SRS v1.29 amendment
and the SDD-004 §9 addendum (§A.7). But those edits were **placement/wording only — SDD-004's behavioural
contracts (§2) and Gate-3 acceptance assertions (§8) are byte-unchanged**, and the SRS v1.29 discharge made
the §5.1 register / §9 scenarios assert the *same* correct-resolution outcomes the tests already pin. The red
gate itself cannot re-run post-implementation (the tests are green), so this is scoped to the **tests-vs-spec
mapping**: does every §2/§8 item still map to a faithful, non-tautological, node-pinned executable test
consistent with SRS v1.29?

## Reviewer

One **distinct** cold `vsdd-test-validator` invocation (agent `a4f759ee1675aa7da`), read-only, spec + tests
only (implementation not read); admitted: SDD-004, SRS v1.29, Constitution v1.1.4, the two WI-4 test files,
the red-gate ledger, and the §A.17 standing dispositions. No standing disposition re-raised.

## Result

**CLEAN.** Every SDD-004 §2 behavioural-contract clause and §8 acceptance assertion maps to an executable,
**target-node-pinned** test (never a mis-bind-greening file substring alone) consistent with SRS v1.29:
BL-1…BL-8 discharge (EXTENDS/IMPLEMENTS pinned on `.target`; BL-2/BL-5 twin file-substrings correctly paired
with never-trigger sweeps), BL-10 heritage arm, the REQ-008 param-arg oracle arms (a)/(b)/(c) + external/tie
skips, REQ-012 parity + bare-decl no-edge, REQ-013 external (no suppressed *defect*), the nested-aware seam
refuse/resolve states, NFR-001 cyclic heritage, and the receiver-var fold. NFR-002 is the Gate-4 measurement
(not an executable §8 acceptance for this suite). No tautology, over-mock, or over-broad-substring mis-bind.

## Objective evidence

The 20 WI-4 acceptance tests are green against the built implementation; full resolver suite 3050/3050 (54
files). **Next: Gate 4** (impl vs spec + tests — Pass 1 spec-fidelity, then Pass 2 code-quality; the three
shared touches owe a §2.2 code-level review + the NFR-002 measurement, the 3050/3050 run being the evidence).
