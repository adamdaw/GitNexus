# Gate 2 pass record — SDD vs SRS (ITEM-002 / WI-2: Resolution mechanics)

*VSDD §A.7. Gate 2 reviews the SDD against the approved SRS + the Constitution. Verdict authority:
Architect (Adam). Reviewer: a general-purpose adversary, **fresh + context-free each round** (admitted
artefacts + standing criteria only — no round/fix/focus framing). Findings are fixed-only; an
SRS/Constitution contradiction is remedied by a documented amendment, never a silent exception (§7).*

- **Work item:** ITEM-002 (WI-2) — resolution mechanics (REQ-005/006/015/007/008/009; NFR-001 resolution
  slice + NFR-002 cross-cutting).
- **Artifact under review:** SDD-002 (`.vsdd/SDD.md`, the `# SDD-002 — WI-2` section) under Constitution
  v1.1.0, deriving from **SRS-001 v1.2**.
- **Also clears:** the **Gate-1 fidelity re-entry** for the SRS **v1.2** amendment (REQ-008 head + §9
  overload scenarios), folded into the read-SRS+SDD-together adversary passes (rounds 4–12), per the v1.1
  precedent.
- **Verdict:** **PASS_CLEAN** — round 12 returned the "Forced to manufacture flaws." invariant.
- **Date:** 2026-06-29. **Architect sign-off:** Adam, 2026-06-29.

## Admitted bundle (§A.17)

`.vsdd/SRS.md` (v1.2), `.vsdd/work-items.md` (ITEM-002 + ITEM-003 acceptance), `.vsdd/SDD.md` (SDD-002),
`.vsdd/Constitution.md` (v1.1.0), and the §A.6 objective evidence `.vsdd/research/RESEARCH-002-...md` +
`.vsdd/research/RESEARCH-001-...md` (incl. the 2026-06-29 reference-grammar addendum). **Withheld:**
deliberation, ADRs, HANDOFF, sessions, pass-records, tdd, prior-review narrative, research rationale.

## Adversary loop (each round a fresh, context-free invocation)

| Round | Findings | Disposition |
|---|---|---|
| R1 | 8 | 7 fixed (USES label cite; REQ-005 EXTENDS/IMPLEMENTS scope bleed; REQ-006/015 tag splits; REQ-008 type-normalizer reliance; §4 cyclic case; §7 effectful-shell); **REQ-008 SHALL-select** → Architect-ratified (a) |
| R2 | 6 | fixed (pin emitApexScopeCaptures author; **reference-grammar probe** → RESEARCH-001 addendum; REQ-006 retag; **super/this delegation** added; generics-vs-id-segment reconcile; cyclic termination) |
| R3 | 5 | fixed (REQ-008 case-insensitive type-normalizer pinned; host-pass/label citations; REQ-006 negative assertion; forward-reference case); **REQ-008 §9 inconsistency** → SRS **v1.2 amendment** approved |
| R4 | 8 | fixed (REQ-008 head modal fix; §9 split; **major scope catch: top-level inheritance is cross-file → WI-3**; forward-ref tag; absent-member case; cyclic fixture scope) |
| R5 | 6 | fixed (staged-narrowing head; work-items Gherkin propagation; strict equal-arity; §9 split sub-cases; external-arg-type case; OVERLOAD_AMBIGUOUS genericised) |
| R6 | 6 | fixed (assignable-only-by-arity logic; §9 three-case restructure; positive exact-type fixture; A-WI2-1 assumption; drop benchmark cross-ref; IMPLEMENTS cite) |
| R7 | 4 | fixed (type-fold as C++-local pattern; **WI-3 owns top-level inheritance** acceptance; §8 REQ-006 global; work-items titles) |
| R8 | 6 | fixed (multi-parameter all-positions narrowing + §9 scenario; param-type-fold fixture; REQ-005 USES wiring; rationale premise as Gate-3-verifiable) |
| R9 | 2 | fixed (competing-overload fold fixture; param-type comparison-symmetry invariant) |
| R10 | 1 | fixed (multi-param §9 scenario split into two atomic scenarios) |
| R11 | 3 | fixed (per-REQ-005-reference-kind §8 assertions; REQ-009 per-segment edges; REQ-015's two obligations) |
| **R12** | **PASS_CLEAN — 0 actionable** | "Forced to manufacture flaws." |

All findings fixed-only; no finding signed off. Two findings routed upstream to documented amendments
(both Architect-approved): the REQ-008 selection-algorithm **scope reduction** (SRS v1.2) and the
case-insensitive-resolution **§A.6 spike** (RESEARCH-002 → the generic `normalizeIdentifier` §2.2 seam).

## Key outcomes pinned by the loop

- **Case-insensitive resolution** = a generic §2.2 `normalizeIdentifier` seam (option a; option b proven
  infeasible by RESEARCH-002 — registry name-keys are built in shared code). Names no language; ids stay
  case-preserving. Plus an Apex-local param-type case-fold (the C++ `arity-metadata` pattern).
- **REQ-008** (SRS v1.2) — arity → all-positions-exact-type narrowing → REQ-015; a deliberate scope
  reduction (Conservatism §1.2), NOT a REQ-012 entailment; host-API selection *outcome* is a Gate-3
  reliance.
- **Scope**: every WI-2 mechanic's in-unit (nested-type) form is WI-2; the inherently-cross-file forms
  (top-level inheritance, two-class calls, cross-file chains) complete at WI-3 via REQ-010 — Apex's
  one-type-per-file fact makes top-level inheritance cross-file.
- **The [structural] / [Gate-3 reliance] split** (finding #13 operationalised): WI-2 wiring + grammar
  facts are pinned and cited; every host-API resolution *behaviour* is flagged for Gate-3, not pinned.

## Dogfood findings (fold into `~/Projects/Home/vsdd`, branch `feature/plugin`)

- **#18 — a documented Architect disposition can itself be internally incomplete; re-run the cold adversary
  AFTER a disposition.** The REQ-008 (a) ratification (R1) "no SRS amendment needed" was shown by R3/R4 to
  contradict the un-amended SRS §9 Gherkin — the disposition needed its own re-review. A finding-#13
  sibling: the Architect, reasoning from intent, can miss an artifact-level inconsistency the cold,
  evidence-isolated adversary catches.
- **#19 — host-API-heavy work items need many cold rounds + the §A.6 spike up front.** WI-2 took 12 rounds
  vs WI-1's far fewer; the convergence was real (every round a fixed-only finding), driven by REQ-008's
  amendment and the resolution layer's host-API surface. The finding-#13 split discipline held throughout
  and is what kept the host-API behaviours from being pinned.

## Cleared

Round 12 PASS_CLEAN; Architect signed off. Commit the record, then `/vsdd-advance` → Phase 3 (Step 3a:
author the WI-2 resolution test suite; Gate 3 before implementation). The SRS v1.2 amendment + RESEARCH-002
are committed alongside.
