# Convergence roll-up — GitNexus Apex support (ITEM-001…004)

*VSDD Phase 7 (§A.7). Convergence is a **deterministic roll-up**, not a fresh adversarial review — the
reviews were Gates 1–5. This record asserts, per dimension, that every gate pass record is committed, every
finding dispositioned (accepted risks enumerated), every manual-acceptance record executed, no open
§A.13 Documented-Limitation remains, and the artifact lineage is hash-consistent. It carries no adversarial
verdict — only this assertion. Verdict authority: the Architect's non-delegable convergence declaration.*

- **Scope:** the whole Apex-support epic — ITEM-001 (WI-1, parse boundary), ITEM-002 (WI-2, resolution
  synthesis), ITEM-003 (WI-3, cross-file + trigger), ITEM-004 (WI-4, parity hardening & external handling).
  All four are DONE (Gates 1–5). This is a single epic-level roll-up (WI-1…3 never received an individual
  Phase-7 record; the epic converges together on the shared SRS / Constitution / resolver implementation).
- **Release candidate:** `feature/apex-parser` HEAD **`58b9f189`** (Gate-5 hardening tests atop the
  behaviourally-final implementation `9fb0aa7d`; no production-source change after `9fb0aa7d`).
- **Governing artifacts at convergence:** SRS **v1.29**, Constitution **v1.1.4**, SDD-001/002/003/004.
- **Verdict:** **CONVERGED** — every dimension converged; the three accepted risks and the ratified §1.2
  bounded exceptions are enumerated below; nothing hidden.
- **Architect declaration:** Adam, 2026-07-08 — convergence declared; the MA-WI3-001 §7(14) escalation
  re-ratified as a confirmation of SRS v1.7 (no spec change).
- **Date:** 2026-07-08.

## Per-dimension convergence

| Dimension | Criterion | Status |
|---|---|---|
| Requirements (SRS) | Gate 1 records committed; every finding fixed; none open | **CONVERGED** — WI-1 `gate1` + `gate1-decomposition`; WI-3 `gate1-wi3-phase5-v128` (latest); WI-4 `gate1-wi4-phase5-v129` (latest). All PASS/PASS_FIXED, fixed-only, Adam-signed. |
| Spec (SDD) | Gate 2 records committed; every finding fixed; none open | **CONVERGED** — WI-1 `gate2`; WI-2 `gate2-wi2`; WI-3 `gate2-wi3-phase5-v128` (latest); WI-4 `gate2-wi4-phase5-v129` (latest). Fixed-only, Adam-signed. |
| Tests | (a) Gate 3 records committed, findings fixed; (b) every §A.10 manual-acceptance record `executed` | **CONVERGED** — WI-1 `gate3`; WI-2 `gate3-wi2`; WI-3 `gate3-wi3-phase5-v128` (latest); WI-4 `gate3-wi4` (+ `gate3-wi4-phase5-reconfirm`). **MA-WI3-001** (the epic's only §A.10 record) **executed 2026-07-08** — see below. All other WIs: acceptance fully automated (no planned MA). |
| Implementation | Gate 4 both passes dispositioned; Pass 1 fixed, Pass 2 fixed or signed off; coverage meets floor | **CONVERGED** — WI-1 `gate4`; WI-2 `gate4-wi2`; WI-3 `gate4-wi3`; WI-4 `gate4-wi4` (PASS_CLEAN). Accepted risks enumerated below. |
| Verification | Gate 5: findings dispositioned; Prove discharged (or none); fuzz to budget no open crash; mutants killed or verified-equivalent; purity clean | **CONVERGED** — WI-1 `gate5`; WI-2 `gate5-wi2`; WI-3 `gate5-wi3` (15/15 killed); WI-4 `gate5-wi4` (11/15 killed + 4 verified-equivalent). No §A.3 Prove properties in scope (proof leg N/A across all WIs). |
| Edit minimality | Verified at Gate 4 Pass 2; minimality verdict recorded | **CONVERGED** — recorded in each WI's Gate-4 record. |

## Accepted-risk dispositions (§A.8) — enumerated, nothing hidden

- **WI-2 Gate-4 Pass-2 — PASS_ACCEPTED (signed off, Adam):** a deliberate `java/captures.ts` parity-mirror /
  correct-if-reached defensive construct (`gate4-wi2.md`).
- **WI-3 Gate-4 Pass-2 — 2 MINOR signed off (Adam):** (F1) the inc-2 walker-reorder cross-language
  blast-radius (established csharp-parity pattern, 2991/2991 peer parity); (F2) a `ReadonlyMap`→`Map` cast
  (localized to the effectful hook). (F3 was fixed comment-only.) (`gate4-wi3.md`).
- **WI-1, WI-4:** no accepted risks — every finding fixed (WI-1 `gate4`), both Gate-4 passes first-pass
  clean (WI-4 `gate4-wi4`).

## Ratified Constitution §1.2 bounded exceptions (SRS §5.1 register) — enumerated

These are the resolver's **specified, tested** conservative behaviours on structurally-invalid or degenerate
Apex source — ratified in Constitution §1.2, part of the converged spec (NOT undischarged §A.13
Prove-blocked limitations). BL-1…BL-8 (valid-source heritage) were **all DISCHARGED by WI-4 (v1.29)**; the
following invalid-source rows remain as ratified bounded exceptions:

- **BL-9** — class/interface/enum mis-declared in a `.trigger` file: an exact-case reference binds the
  mis-filed class node (correct bind on invalid source); typed-receiver / case-varied cross-file forms
  unresolved. §1.2 —.
- **BL-10** — trigger mis-declared in a `.cls` file: becomes globally referenceable; a name reference (and,
  post-v1.29, a case-varied `extends <.cls-misfiled trigger>` heritage clause) binds the injected trigger;
  MRO contributes no false inherited-member edge. §1.2 (b).
- **BL-11** — a correctly-filed trigger's name referenced as a type (no same-named class): an exact-case
  reference binds the trigger def. §1.2 (b).
- **BL-12** — duplicate case-folded-colliding top-level type names: an exact-case reference binds the unique
  exact match; a same-case duplicate binds nothing and emits no record (discharged by edge-absence). §1.2
  (b) exact-case arm / — same-case arm.
- **BL-13** — a malformed file re-parents a nested-type fragment to file scope, colliding case-folded with a
  legit top-level type: registration registers neither → the valid type's forms unresolved (liveness). §1.2 —.
- **BL-14** — a trigger mis-declared in a `.cls` file sharing a case-folded name with a valid class:
  registration registers neither → the valid class's cross-file forms unresolved (liveness). §1.2 —.

## Manual-acceptance execution (§A.10)

- **MA-WI3-001 — `executed` 2026-07-08** (`.vsdd/tdd/WI-3-red-gate.md`). Obligation: confirm whether the
  host's internal unresolved counter fires for a pass-level typed-receiver guard-miss. Executed against the
  hardened build (`58b9f189`) over the `apex-cross-file-collision` fixture: **no internal
  unresolved/suppressed record fires** for the plain misses `d.hit()` / `r.sneak()` (1 suppressed outcome
  total across the fixture — the ambiguity case — none named hit/sneak; no CALLS edge for either). The
  §7(14) named escalation fires as a **confirmation** — the SRS v1.7 observable ("a plain typed-receiver
  miss is edge-absence, no internal record") holds; **re-ratified by the Architect at convergence, no spec
  change.** Non-blocking (the black-box contract was already automated as edge-absence).
- All other work items: acceptance fully automated; no planned §A.10 record (WI-1 `gate5`, WI-2 `gate5-wi2`,
  WI-4 `gate5-wi4` each record "no planned manual-acceptance record — N/A").

## No open Documented-Limitation (§A.13)

**None.** The §A.13 Documented-Limitation route (full-convergence blocker) is reserved for an undischarged
**Prove** property blocked by external tooling. This project has **no §A.3 Prove properties** (every Gate-5
record: the proof leg is N/A — the resolution slice guards no security/financial/data-integrity/safety/
concurrency invariant; the absence is the legitimate §A.3 calibration fixed at Gate 2). Therefore no open
§A.13 limitation can exist. The SRS §5.1 bounded exceptions above are Constitution §1.2 ratified behaviours,
not §A.13 limitations. Full-convergence-only route holds.

## Artifact lineage (§A.7 hash-consistency)

The epic evolved the shared SRS across work items (light-SRS → v1.3 → v1.28 → v1.29) under the cascade rule
(§A.7), each amendment re-clearing the gates it invalidated. Lineage consistency holds **within each work
item's chain** and **across the epic at the release candidate**:

- **Internal chains** (each WI's latest gate records pin one consistent artifact set):
  - **WI-4:** SRS v1.29 → SDD-004 → tests → impl (`9fb0aa7d` behaviourally-final). Gate-1/2/3 re-cleared at
    v1.29; Gate-4 impl vs SDD-004 + tests clean; Gate-5 impl byte-stable at `9fb0aa7d`.
  - **WI-3:** SRS v1.28 → SDD-003 → tests → impl (`260093eb`). Gate-1/2/3 re-cleared at v1.28; Gate-4/5 at
    `260093eb`.
  - **WI-2:** SRS v1.3 → SDD-002 → tests → impl (`51de145f`). **WI-1:** light-SRS → SDD-001 v1.2.1 → tests →
    impl. Each chain internally consistent.
- **Cross-WI (the SRS evolution):** v1.29's changes are confined to the **heritage discharge** (BL-1…BL-8 +
  the §1 in-scope reframe + the BL-10 heritage arm) — WI-3/WI-4 territory. WI-1 (parse boundary) and WI-2
  (resolution synthesis) REQs are untouched by v1.28→v1.29, so their earlier-version gate records remain
  lineage-valid. WI-3's records (v1.28) attest WI-3's correct behaviour *including* the then-open heritage
  limitations; WI-4 legitimately superseded those in a later work item (the discharge), which does not
  invalidate WI-3's correctness attestation.
- **Release-candidate regression proof:** the behaviourally-final implementation `9fb0aa7d` / hardened
  `58b9f189` passes the **entire cross-language resolver suite — 55 files, 3077/3077** — including every
  WI-1/WI-2/WI-3/WI-4 acceptance test. NFR-002 (peer parity) holds: no later work item regressed an earlier
  one. This is the epic-level lineage guarantee — every WI's tests are green against the single release
  candidate.

## Convergence assertion

All five gate dimensions converged for all four work items; the three accepted risks and the six ratified
§1.2 bounded exceptions are enumerated above; the single §A.10 manual-acceptance record is executed; no open
§A.13 Documented-Limitation exists (no Prove properties in scope); the artifact lineage is consistent within
each WI chain and the release candidate is green across every WI's acceptance suite. **Maximum Viable
Refinement reached — zero open findings, every accepted risk enumerated.**

**CONVERGED** — on the Architect's declaration. Work items ITEM-001…004 → `done` (already), the epic →
converged. The next real-world step (push / PR upstream) is a separate, explicitly-approved action.
