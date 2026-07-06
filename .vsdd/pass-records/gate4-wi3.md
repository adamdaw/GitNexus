# Gate 4 Pass Record — WI-3 (ITEM-003) Cross-file Binding & Trigger Resolution

*VSDD Phase 4 (Adversarial Refinement). Composite record: Pass 1 (spec & test fidelity) +
Pass 2 (code quality). Both passes context-free, distinct-invocation per §A.7/§A.17.*

- **Work item:** ITEM-003 (WI-3 — cross-file binding & trigger resolution) · **Gate:** 4 (standing)
- **Reviewed HEAD:** `2ce89dce` (`feature/apex-parser`, commit-only, NOT pushed).
- **Artifacts under review (pinned by blob SHA at `2ce89dce`):**
  - Spec: `.vsdd/SDD.md` §SDD-003 (lines 921–2073) `3a63cdd0`; `.vsdd/SRS.md` v1.28 `2c5cf412`
    (load-bearing: §5.1 Bounded Limitations Register BL-1…BL-14); `.vsdd/Constitution.md` v1.1.3 `12ceab6f`.
  - Tests: `test/integration/resolvers/apex-cross-file.test.ts` (106 anchors) `a427c86e`;
    `test/unit/apex-cross-file-unit.test.ts` (10 anchors) `5f9addb4`.
  - Implementation — **(A) Apex-local adapter** (`languages/apex/`): `namespace-siblings.ts` `17c6ce16`,
    `scope-resolver.ts` `ebc1f596`, `query.ts` `a14aceb3`, `captures.ts` `48519625`, `resolution.ts` `4a848ec2`.
  - Implementation — **(B) the SEVEN shared generic edits** (outside `languages/`, used by every language):
    `scope-resolution/scope/walkers.ts` `f9aa9aec` (inc 2 workspace-channel reorder + inc 3 case-fold retry),
    `scope-resolution/pipeline/run.ts` `e61bf7c0` (inc 3/15 option threading),
    `scope-resolution/passes/free-call-fallback.ts` `f1852553` (inc 7 conservative ctor narrowing + inc 15 gated MRO walk),
    `scope-resolution/passes/compound-receiver.ts` `995eb945` (inc 8 `new Type()` receiver),
    `scope-resolution/passes/receiver-bound-calls.ts` `439154d1` (inc 11 Case-3b FQN fallback + inc 12 interface-dispatch gate),
    `model/scope-resolution-indexes.ts` `620571f6` (inc 3 optional `normalizeIdentifier`),
    `scope-resolution/contract/scope-resolver.ts` `acdb8885` (inc 12/15 two optional flags).
- **Objective evidence (verified at reviewed HEAD `2ce89dce`):** WI-3 suite **116/116** green (106 integration +
  10 unit); **full cross-language resolver suite `test/integration/resolvers/` — 52 files, 2991/2991 green**
  (cobol files skipped: native parser binding not built in-env, causally independent of resolution).
  **NFR-002 holds** — every non-Apex resolver passes with the seven shared edits in place. **Zero new
  dependencies / vendored assets.**

---

## Pass 1 — Spec & Test Fidelity (`vsdd-spec-reviewer`)

- **Verdict:** **PASS_CLEAN** ("Forced to manufacture flaws.") · Architect sign-off: Adam, 2026-07-06.
- **Independence (§A.7):** 1 cold context-free invocation (agent `a8c29b45f99a7eda9`), fresh agent with no
  producer-session access. First-pass clean is credible here: the implementation surface has been byte-stable
  since inc 15 (the entire v1.28 Phase-5 cascade was spec/test-only), and Gate-3 (tests↔spec) cleared
  immediately prior — so impl↔spec fidelity was continuously maintained into this gate.
- **Admitted bundle (§A.17):** SDD-003, SRS v1.28 (§5.1 register + REQ-005/006/007/008/010/011/015 + §9),
  Constitution v1.1.3 (§1.2/§2.1/§2.2/SECT-001), the two test files, the full impl surface (A)+(B), and the
  objective test evidence. **Withheld:** HANDOFF, sessions, research rationale (§A.6), prior pass-records/
  findings narrative, ADRs, the vault, the §A.12 compliance log (Builder rationale).
- **Findings — none.** The reviewer traced each behavioural obligation to code and verified:
  - **BL-7 vs BL-8 heritage split (v1.28 F2):** NestSub's dotted `Outer.Inner` superclass folds to
    `outer.inner` (no simple-name workspace key) → `super.ping()` self-loops to NestSub's own override (BL-7,
    pinned `apex-cross-file.test.ts:370,383`); TwinSub/CaseKid's simple-name superclass folds to a live
    workspace hit → `super()`/`super.method()` resolve to the parent with no EXTENDS edge (BL-8, pinned
    `:230,245,787,800`). Consistent with SRS §5.1 BL-7/BL-8.
  - **BL-12 same-case type-duplicate no-record (v1.28 F1):** `computeApexNamespaceBindings` injects nothing
    for the colliding folded key; the ctor form misses `qualifiedNames` (tie) with no `selectConstructor-
    Conservative` record → edge-absence + no record (`:815`, `:979`). Matches REQ-015 head + §2.
  - **BL-9/10/11 exact-case arms** ride `qualifiedNames` single-match; the `.trigger` case-folded extension
    filter governs injection only (`:728,992,1025`). §3 inject-none / filter-before-grouping / owning-scope
    discriminant match every unit anchor. REQ-011 edge-from-trigger asserted throughout.
  - **Constitution §2.1/§2.2 isolation of all seven shared edits:** no `language === Apex` branch and no Apex
    identifier in any executable path (Apex appears only in explanatory comments, permitted v1.1.1). Every added
    behaviour is gated behind a generic flag defaulting to preserve peers (`conservativeOverloadResolution`,
    `resolveInheritedImplicitThisCall`, `emitInterfaceDispatch !== false`, the `normalizeIdentifier`-gated
    folded-retry firing only after a raw miss when `folded !== name`) or is a uniformly-applied additive seam
    (`new Type()` compound receiver; the Case-3b FQN fallback). The **2991/2991 peer parity is causally sound**
    — every gate keys on a normalizer/flag that is identity/absent/off for case-sensitive peers.

## Pass 2 — Code Quality / Security / Process / Dependencies (`vsdd-code-reviewer`)

- **Verdict:** **PASS** (0 blocker, 0 major; 3 minor dispositioned) · Architect sign-off: Adam, 2026-07-06.
- **Independence (§A.7):** 1 cold context-free invocation (agent `a7f40033593eeeb74`), **no Pass-1
  involvement** — distinct agent type, distinct invocation.
- **Admitted bundle:** the impl surface (A)+(B), the `f8139239..HEAD` diff (for minimality/scope-confinement),
  objective test evidence. **Withheld:** SRS/SDD fidelity narrative (Pass 1's) + all Pass-1-withheld material.
- **Clean on the load-bearing risks:** regex ReDoS (`stripGeneric`, the `new\s+` head, the `Map<` matchers —
  all anchored/linear, no catastrophic backtracking on adversarial source); fold edge cases (empty /
  already-folded short-circuited via `folded === name`); collision safety (inject-none + nodeId dedup +
  `.trigger`/non-type exclusion before grouping); MRO-walk termination (single-inheritance `defaultLinearize`,
  precomputed `mroFor`); gating-flag defaults (every peer byte-identical); MRO/exports all wired, no dead WI-3
  code; **no new third-party dependency, version bump, or vendored asset.**
- **Findings — 3 MINOR, all dispositioned:**
  - **F1** `walkers.ts:639–683` — the inc-2 workspace-channel reorder (deferred single lookup after the scope
    chain) changes local-shadows-global shadowing semantics for **every** language, not just Apex. Root-cause-
    correct, covered by the 2991-test suite; a cross-language semantic change delivered inside a single-language
    WI. **Disposition: signed off (Adam)** — explicit gate-level acceptance of the Step-3b Architect decision
    (shared-code fix over an SRS limitation, 2026-07-02), now peer-verified 2991/2991.
  - **F2** `namespace-siblings.ts:127` — `ReadonlyMap`→`Map` cast on `workspaceFqnBindings` then `.set()`/
    `.push()`; runtime-sound (finalize-built map is a real unfrozen Map), same append pattern as the sanctioned
    `populateCsharpNamespaceSiblings`; a type-seam kept honest by convention not the type system.
    **Disposition: signed off (Adam)** — established csharp-parity pattern, localized to the effectful hook.
  - **F3** `free-call-fallback.ts:923` — stale JSDoc referenced a non-existent `applyFreeCallFallback`; the
    production path invokes `resolveImplicitThisCall` directly from `emitFreeCallFallback` (`pickImplicitThis-
    Overload` is a test-only wrapper). **Disposition: fixed (Adam) — commit `63efcbb7`, comment-only, no
    cascade** (compiled worker behaviourally identical; WI-3 suite re-verified 116/116 green after the fix).

---

## Composite verdict

**GATE 4 — PASS** (Pass 1 PASS_CLEAN + Pass 2 PASS, both dispositioned; Architect-signed Adam 2026-07-06).
Two distinct cold context-free reviewers, Pass 2 with no Pass-1 involvement (§A.7). The seven shared edits'
§2.2 generic-seam legitimacy + no-unintended-peer-semantics obligation is discharged (Pass 1 §2.1/§2.2 trace +
Pass 2 minimality/diff + 2991/2991 peer parity). F3 remediated comment-only (no cascade); F1/F2 signed off.

Gate 4 is not merge authority — convergence still requires Phase 6 **Gate 5** (fuzz + mutation + purity over
the WI-3 impl surface; inc 15's gated MRO walk is the one edit that changed shared control flow) and the
Phase 7 roll-up. Ledger: ITEM-003 gates → [1, 1-decomp, 1/2/3-phase5-recleared-v128, **4**]. NEXT = Gate 5.

**Fix commits:** F3 `63efcbb7` (comment-only). Impl base: Step-3b `88af8606`..`40e54caa` (incs 1–16).
