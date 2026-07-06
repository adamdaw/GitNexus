# Gate 1 Pass Record — WI-3 Phase-5 Cascade Re-review (SRS vs Intent), SRS v1.28

*VSDD §A.7. Gate 1 reviews the derived SRS against the committed Intent (+ Constitution, elicitation-facts).
This record covers the **Phase-5 cascade re-review** triggered by the WI-3 **Gate-3 probe-driven fidelity
corrections** (SRS v1.27 → v1.28), which cascade-invalidated the prior Gate-1 record (`gate1-wi3-phase5.md`,
SRS v1.27) and required re-clearing the SRS against Intent.*

- **Gate:** 1 (SRS vs committed Intent, + Constitution, + elicitation-facts §A.19)
- **Work item:** WI-3 (ITEM-003) — cross-file & trigger resolution
- **Verdict:** **PASS_FIXED** — the round-18 cold adversary returned the "Forced to manufacture flaws."
  termination invariant after a full-axis audit, with no knowledge of the 17 prior findings-rounds.
- **Loop:** 18 cold, context-free adversary rounds (2026-07-06). Rounds 1–17 surfaced findings, all
  dispositioned (fixed or Architect-ruled-rejected); round 18 clean.
- **Architect sign-off:** Adam, 2026-07-06.

## What triggered this cascade (the v1.28 corrections)

The WI-3 **Gate-3** re-review (SDD-003 tests vs amended SDD/SRS) surfaced two derivation-fidelity findings
whose resolution required **SRS corrections** — the SRS claimed host behaviour the real host does not
exhibit (the dogfood-#13 "Gate-2 verification split" pattern: a Gate-2 adversary reasoned host behaviour from
spec logic; only Gate-3-against-the-real-host falsified it). Both were **probe-verified 2026-07-06** against
the Step-3b implementation:

- **F1 — BL-12 same-case type-duplicate → NO record.** The v1.18 reclassification had modelled a same-case
  duplicate top-level type as a competing-candidate ambiguity emitting a positive unresolved record. The
  probe showed the host emits **no record** — edge-absence alone (a type-name collision is discharged
  before the recording resolver). Reverted the v1.18 addition of "type-name case-collision" to the recording
  set back to v1.7's overload+member-collision-only set.
- **F2 — BL-5 twin super arms RESOLVE (re-attributed BL-7 → BL-8).** BL-7 (v1.11(a)) had lumped the
  nested-parent (BL-3) and same-case-twin (BL-5) shapes as `super.method()` self-loops. The probe showed the
  twin's **simple-name** superclass resolves like BL-1 → `super()`/`super.method()` RESOLVE to the parent
  (the v1.12/BL-8 correction, never re-probed for BL-5). BL-7 now governs the BL-3 nested-parent
  (qualified/dotted superclass → self-loop) shape only; BL-8 covers BL-1 + BL-5 (simple-name → resolves).

## Artifacts (pinned by SHA-256 at pass, HEAD `a8b18f6a`)

| Role | Path | SHA-256 |
|---|---|---|
| Source (committed Intent) | `.vsdd/Intent.md` | `041c24a2e3127e99b69a0bf8ff7571730271a9b309e0bb94af92bb40803b7e20` |
| Derived (under review) | `.vsdd/SRS.md` (v1.28) | `35a87d8e704cd6efe50d911e1242f5aa054a4c74896d29d3b1de0692aed583db` |
| Governing (Constitution v1.1.3) | `.vsdd/Constitution.md` | `502df9b5cc7a3b001f1c022244ed69c5326c2791399e800be9202f5a2a53e699` |
| Objective evidence (§A.19) | `.vsdd/elicitation-facts.md` | `5cca4df0c3b2e88b021f980f48d01694b9755f67543ea78e75320594d4ee26da` |

SRS advanced **v1.27 → v1.28**; Constitution **unchanged at v1.1.3** (byte-identical — no cascade from this
gate to the Constitution). Fix commits `63a66ceb` (v1.28 corrections) .. `a8b18f6a` (R17), one per round.

## Reviewer independence attestation (§A.7/§A.17)

- Each of the 18 rounds was a **distinct, fresh general-purpose agent invocation** with no conversation
  history and no access to the producer (Builder) session — production independence, not a memory reset.
- **Admitted bundle** (identical each round): `Intent.md`, `SRS.md`, `Constitution.md`,
  `elicitation-facts.md`. Each reviewer was instructed to read exactly those four paths and nothing else.
- **Withheld** (never passed, explicitly forbidden): `SDD.md`, tests, all source, `.vsdd/adr/`, `HANDOFF.md`,
  `.vsdd/sessions/`, `.vsdd/pass-records/`, `.vsdd/tdd/`, `.vsdd/research/`, `state.json`.
- Prompts carried **only** the admitted artefacts + the standing Gate-1 checklist — no round number, no
  prior-finding narrative, no fix framing (§A.17 context-free adversary).

## Loop & convergence (§A.8 — finding trajectory)

Findings-per-round: **5·5·4·2·2·3·3·3·3·4·2·4·4·4·3·2·3·1 → clean (round 18).**

The two triggering corrections (F1/F2) cleared by ~round 3; the remainder was the full context-free
re-audit exercising the entire SRS — surfacing pre-existing latent issues and fix-induced ripples. Themes:

- **Rounds 1–3 (change-area + immediate consequences):** made F1/F2 observable (record obligation and super
  arms stated by reference **kind** / **superclass-name shape**, not resolver-mechanism); §2/REQ-015/§9/§1
  aligned to the corrections; §1 invalid-source scope; `Account`→`Widget` (dual-sense term); REQ-003 member
  nodes + REQ-011 trigger scenarios; NFR-004 resolution-scenario subset; Usability/Portability scope note.
- **Rounds 4–11 (pre-existing consistency + term hygiene):** BL-12 exact-case exception carve-out in the
  REQ-015 head; §2 plain-miss by *surviving* candidate; amendment-log supersession notes (v1.11(a)/(b),
  v1.18/v1.22); REQ-006 term; "binding" defined; REQ-010/BL exact-case stated observably; §2 static-type
  admits expression types; §2 unresolved-symbol excludes the edgeless binding; liveness/safety defined;
  provenance dual-form (BL-9/BL-13/BL-14); §1 heritage-family exception completeness; BR-2 exception scope.
- **Round 12 (the load-bearing structural fix):** **§1 leaned to *reference* the §5.1 register** rather than
  restate BL outcomes (restoring the v1.17 single-source-of-truth invariant) and dropped the pre-pass/reorder
  mechanism from Purpose-and-Scope — this damped the recurring §1 ripple at its source.
- **Rounds 13–17:** heritage defined; REQ-011 static-call scenario; **§2 overload equal-precedence corrected
  to count *arity* survivors** (a real REQ-008/§9 correctness catch, R15); BR-2 success made bidirectional;
  BL-12 same-case relabelled the *correct conservative default* (not a liveness shortfall).

## Architect-ruled REJECTIONS (§A.8 — not every adversary finding is valid)

Four findings were **rejected by the Architect** as adversary over-reach, all against the SRS header's
ratified convention (lines 4–6: *"the bounded-limitation amendments cite host mechanism as parity
justification for why a limitation is forced; the obligation itself remains observable"*):

- **R13-F2, R14-F4, R17-F2** — three re-raises of a broad "strip all mechanism from REQ-007/REQ-010/BL rows"
  finding. The header explicitly permits host mechanism as *justification* where the obligation is stated
  observably (as REQ-007/REQ-010 do). Rejected; only the narrow undefined-jargon terms ("exact-case
  guard/channel") were de-mechanised (R13), consistent with prior stripping (v1.26 "injection channel").
- **R17-F3** — a proposal to move all "probe-verified"/"verified-against-the-suite" provenance to a separate
  evidence log. Rejected: these are non-normative provenance on decisions whose obligations are already
  falsifiable by the §9 scenarios — the same permitted class as the mechanism-justification.

## Objective evidence

- The 18 general-purpose adversary transcripts (rounds 1–18) — round 18 = "Forced to manufacture flaws."
  with a full-axis clean attestation (register / §1 / §2 / REQ clauses / §9 / Constitution §1.2 all state
  each limitation's outcome, governing REQ, and §1.2 class identically).
- Commit trail `63a66ceb`..`a8b18f6a` (18 commits, one per round), commit-only, NOT pushed.

## Cascade note

This gate changed the **SRS only** (v1.27 → v1.28); the Constitution is byte-unchanged. Per Phase-5 cascade
invalidation, the SRS change invalidates the downstream **Gate 2 (SDD-003), Gate 3 (tests)** records for
WI-3, which must be re-cleared against the amended SRS v1.28. **NEXT: Gate 2** — cold `vsdd-adversary`
re-review of SDD-003 vs the amended SRS v1.28 + Constitution v1.1.3.

## Cleared (Architect-signed)

Every finding fixed or Architect-ruled-rejected; the clean round-18 cold pass attests full-axis consistency.
Architect sign-off: **Adam, 2026-07-06 (PASS_FIXED)**. On sign-off: commit this record, update the
`work-items.md` ledger (ITEM-003 Gate-1 re-cleared at v1.28), then re-arm **Gate 2**.
