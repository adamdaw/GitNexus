# Gate 1 pass record — WI-4 Phase-5 discharge re-clear (SRS v1.29)

- **Gate:** 1 (SRS vs committed Intent + Constitution + elicitation-facts).
- **Work item:** ITEM-004 (WI-4 — parity hardening & external handling).
- **Verdict:** **PASS_FIXED** — clean cold pass at R7 ("Forced to manufacture flaws.", a distinct fresh
  reviewer with no prior involvement), after a 7-round cold context-free adversary loop.
- **Architect sign-off:** Adam, 2026-07-08.
- **Reviewed HEAD:** `0df1a6bd` (`feature/apex-parser`).

## Why re-cleared

The WI-4 Phase-5 discharge cascade (SRS **v1.29** + Constitution **v1.1.4**, commit `ae4b6d3b`), authored ON
the green Step-3b evidence (all 20 WI-4 reds green; full resolver suite 3050/3050, 54 files — SDD-004 §8),
amended the SRS: it **cascade-invalidated** the prior Gate-1 pass record (§A.7). This record re-clears Gate 1
for SRS v1.29 vs INTENT-001 + Constitution v1.1.4.

## Admitted bundle (§A.17)

Read by the Builder, passed to each cold reviewer as read-only paths; the reviewer was instructed to read
ONLY these and forbidden the withheld set.

| Role | Path | Blob @ HEAD |
|---|---|---|
| Source (committed Intent) | `.vsdd/Intent.md` | `9db30bd4` |
| Derived artifact under review | `.vsdd/SRS.md` (v1.29) | `3bbcbfa0` |
| Governing Constitution | `.vsdd/Constitution.md` (v1.1.4) | `21703143` |
| Objective evidence — elicitation-facts (§A.19) | `.vsdd/elicitation-facts.md` | `25e16b16` |
| Objective evidence — standing dispositions (§A.17, rationale-redacted) | `.vsdd/pass-records/gate2-wi4-standing-dispositions.md` | `d3903337` |

**Withheld (never passed / explicitly forbidden):** `.vsdd/SDD.md`, `.vsdd/work-items.md`, `.vsdd/HANDOFF.md`,
`.vsdd/research/*`, all other `.vsdd/pass-records/*`, session logs, and any file outside `.vsdd/`.

## Independence attestation

Seven **distinct** general-purpose adversary invocations, each a fresh context with no conversation history
and no producer-session access; each received the identical context-free prompt (no round/fix/focus/version
framing leaked — §A.7, feedback: adversary-context-free). Agent ids: R1 `a04276f5330c82ce6` · R2
`a8f7dbd164f3c9300` · R3 `a42146bd28fa1d294` · R4 `a932b3ddfaf50d3e7` · R5 `a99fc9782d9ed043f` · R6
`a0eb0d751365bed7e` · R7 (clean) `a02192e68763f9c57`. Every round re-raised **zero** of the four settled
§A.17 standing dispositions.

## Findings & dispositions (all fixed-only — derivation-fidelity, never signed off)

The Phase-5 cascade's first pass (the 8 planned amendments) missed several densely-cross-referenced
propagation sites; each cold round surfaced the next, all behaviour-neutral text-fidelity reconciliations of
the SRS's own discharged content. **10 findings across R1–R6; R7 clean.**

- **R1 (2)** — REQ-015 **(a)** bounded-exception bullet still marked live "committed fix path WI-4" → DISCHARGED
  (provenance retained); REQ-015 **retained-obligation** "heritage form excepted, BL-1/3/5" → "including the
  heritage form, discharged." Commit `415d9036` (SRS v1.29 F6).
- **R2 (1)** — §5.1 register **preamble** cited BL-8's discharged "super-sourced CALLS edge with no EXTENDS
  edge" as a live "—"-class exemplar → dropped; cites still-live BL-9 / BL-13/BL-14. Commit `90958493` (F7).
- **R3 (1)** — §4 **BR-2** success clause still carved BL-1…BL-8 out of clean in-repository parity → dropped
  (discharged, retain full SHALL); only BL-9…BL-14 remain. Commit `036da2c2` (F8).
- **R4 (2)** — §2 **MRO** "poisoned/mis-bound" illustration cited live BL-4/BL-6 → discharged historical
  shape; §2 **Safety limitation** / **Documented false edge** annotated retained-for-provenance (no live
  instance post-discharge) + REQ-015 preamble "documented false edge (§2)" cite narrowed to the (a) class.
  Commit `e6f72c6a` (F9).
- **R5 (3)** — **[Architect-dispositioned]** Constitution v1.1.4 "(b) class unchanged" vs SRS BL-10's new
  case-varied-heritage trigger-bind arm → Adam ruled it a **wording reconciliation** (no new (b) row; BL-10's
  existing (b) bind now covers the heritage reference form — same trigger/fold/§1.2(b) mechanism,
  Gate-2-committed), v1.1.4 reworded accordingly. **[fix]** Constitution header version field lagged →
  bumped 1.1.3→**1.1.4** / 2026-07-08 / Supersedes 1.1.3. **[fix]** REQ-010 (BL-10's Gov-REQ) stale → v1.29
  BL-10-heritage-arm note added (matching REQ-005/007/009). Commit `97e20998` (F10).
- **R6 (1)** — BL-1 row text asserted the super/inherited arm "resolves" but its Gov-REQ cell is REQ-007
  (edge only; the arm is REQ-005, owned by BL-8) → narrowed BL-1's text to the EXTENDS/IMPLEMENTS edge,
  delegating the downstream to the BL-8 pointer. Commit `0df1a6bd`.
- **R7 — CLEAN.** "Forced to manufacture flaws." A candidate (REQ-005's retained pre-discharge BL-8 note) was
  probed and correctly ruled non-defective — its v1.29 superseding amendment is co-located and explicit (the
  SRS's ratified retained-provenance convention). Confirmed §1 / §2 / §4 / §5 / §5.1 / §6 / §9 / §10 all agree
  with each other, with Constitution v1.1.4, and with INTENT-001's delegated acceptance.

## Objective evidence

The discharge amendments were authored on Gate-3-verified green evidence (not ahead of it, SDD-004 §8): all
20 WI-4 acceptance reds green; full resolver suite **3050/3050 (54 files)**; zero peer regressions.

## Cascade note

No SRS change routed upstream to INTENT-001 (Intent byte-unchanged) — Gate 1 stays derived, not re-scoped.
The amended SRS v1.29 + SDD-004 §9 **cascade-invalidate the Gate-2 pass record** (SDD vs SRS); Gate 2 is
re-cleared next against SRS v1.29 + Constitution v1.1.4.
