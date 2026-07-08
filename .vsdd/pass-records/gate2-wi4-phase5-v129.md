# Gate 2 pass record — WI-4 Phase-5 re-clear (SDD-004 vs SRS v1.29)

- **Gate:** 2 (SDD vs approved SRS + Constitution).
- **Work item:** ITEM-004 (WI-4 — parity hardening & external handling).
- **Verdict:** **PASS_FIXED** — clean cold pass at R3 ("Forced to manufacture flaws.", a distinct fresh
  reviewer with no prior involvement), after a 3-round cold context-free adversary loop.
- **Architect sign-off:** Adam, 2026-07-08.
- **Reviewed HEAD:** `ce308b0d` (`feature/apex-parser`).

## Why re-cleared

The WI-4 Phase-5 discharge cascade amended the SRS to **v1.29** (Gate-1 re-cleared, `gate1-wi4-phase5-v129.md`),
and Step-3b added SDD-004 **§9** (WS3/WS4 placement clarifications). Both **cascade-invalidated** the prior
Gate-2 pass record (`gate2-wi4.md`, §A.7). This record re-clears Gate 2 for SDD-004 vs SRS v1.29 + Constitution
v1.1.4.

## Admitted bundle (§A.17)

| Role | Path | Blob @ HEAD |
|---|---|---|
| Approved source (SRS v1.29) | `.vsdd/SRS.md` | `3bbcbfa0` |
| Derived artifact under review (SDD-004) | `.vsdd/SDD.md` (`# SDD-004`) | `8256be1f` |
| Governing Constitution (v1.1.4) | `.vsdd/Constitution.md` | `21703143` |
| §A.6 research result | `.vsdd/research/RESEARCH-004-apex-parity-heritage-reorder.md` | `681a8620` |
| Standing dispositions (§A.17, rationale-redacted) | `.vsdd/pass-records/gate2-wi4-standing-dispositions.md` | `d3903337` |

**Withheld:** `.vsdd/Intent.md`, `.vsdd/work-items.md`, `.vsdd/HANDOFF.md`, all other `.vsdd/pass-records/*`,
session logs, and any file outside `.vsdd/`.

## Independence attestation

Three **distinct** general-purpose adversary invocations, each a fresh context with no conversation history
and no producer-session access; identical context-free prompt (no round/fix/version framing leaked). Agent
ids: R1 `a8076eb6535dfe77e` · R2 `a482c8aae08d59e04` · R3 (clean) `a5fddf1f7d8187588`. Every round re-raised
**zero** of the four settled §A.17 standing dispositions.

## Findings & dispositions (all fixed-only — derivation-fidelity, never signed off)

**12 findings across R1–R2; R3 clean.** The cluster: (a) stale version refs the discharge cascade should
have bumped; (b) the SDD-004 §9 addendum's "three shared touches" correction not propagated into the §1/§5/§7
body (left as a floating erratum); (c) two pre-existing SDD-vs-SRS strictness/traceability gaps the cold read
surfaced.

- **R1 (7)** — `§Consumes` SRS-001 v1.28→**v1.29**; `§Constitution` v1.1.3→**v1.1.4** (the amendment the
  discharge drives); propagated "**three shared touches**" into the header/§Constitution/§1(4)/§2/§5/§7 (the
  receiver-var fold is the third touch — a folded fallback in shared `findReceiverTypeBinding` via the
  existing WI-3 `normalizeIdentifier` seam, **not** "Apex-local") + added it as §7 purity-boundary
  effectful-shell item (d) + a third NFR-002 leg; stated the §9 param-arg `populateRangeBindings` hook's
  ordering under the §1(1) Apex-run re-sequence (position/inputs preserved); reconciled the seam/fold NFR-002
  "Gate-4-measured" framing with the Step-3b 3050/3050 measurement. Commit `8f1a2247`.
- **R2 (5)** — §1(3) brittle "SRS line 967" → "§11 preamble"; §7 purity item **(c)** updated from the
  superseded capture-phase `varTypes` write to the §9 resolution-phase `populateRangeBindings` hook (R1
  fixed (d) but missed (c)); §1(3)(a) workspace-injection **assumption made explicit** (inject-none /
  `.trigger`-excluded def → external → arity-only under-narrow, never a mis-bind). **[Adam-dispositioned
  "clarify as hardening"]** — SDD REQ-013's count/attempt-parity bar marked **self-imposed conservative
  hardening** (only "no Apex-specific defect" is the gated REQ-013 acceptance the SRS states); REQ-008 arm (c)
  clarified as the ITEM-004 REQ-008-completion sub-case validated at Gate 3 (§9 scenarios illustrative,
  REQ-012 parity general; conservative floor if unconfirmed — no un-derived SHALL). Commit `ce308b0d`.
- **R3 — CLEAN.** Confirmed SDD-004 faithfully derives from SRS v1.29, conforms to Constitution v1.1.4, the
  purity boundary covers all three shared touches (§7 a–d), the §9 addendum is reconciled into the body (not
  floating), and every version / suite-count (3050/3050) / BL-governance cross-reference is accurate.

## Cascade note — Gate 3 (tests vs spec)

The SDD-004 edits were **placement/wording only — SDD-004's behavioural contracts (§2) and Gate-3 acceptance
assertions (§8) are byte-unchanged.** So the existing WI-4 acceptance suite still validly derives from the
spec, and no behavioural cascade reaches the tests. A **fast Gate-3 re-confirmation** (tests-vs-spec mapping
preserved, impl withheld from the mapping check) follows before Gate 4 (Adam-directed 2026-07-08); the 20 WI-4
acceptance tests are green against the built implementation. Gate 4 (impl vs spec+tests, two passes) is the
substantive next gate; the three shared touches owe its §2.2 code-level review + NFR-002 measurement (the
3050/3050 run is the objective evidence).
