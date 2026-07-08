# Gate 3 pass record — Tests vs Spec (ITEM-003 / WI-3), Phase-5 re-review at SRS v1.28

*VSDD §A.7 / §A.17, Phase 3 / Phase 5. Gate 3 validates the WI-3 test suite against the amended
SRS + SDD BEFORE the implementation is trusted, via distinct context-free `vsdd-test-validator`
invocations (spec + tests + fixtures + Red-Gate evidence only; implementation WITHHELD). Findings
are **fixed-only** (return to tests or, if upstream, to the spec). Verdict authority: Architect (Adam).*

- **Work item:** ITEM-003 (WI-3) — cross-file binding & trigger resolution.
- **Cascade cause:** the prior Gate-3 record `gate3-wi3.md` (tests vs SDD-003 @ SRS v1.11) was
  cascade-invalidated twice over: (1) the Gate-2 v127 SDD-003 softening, then (2) the **SRS v1.11 →
  v1.28** amendment (BL-12 same-case type-dup = NO record; BL-5 same-case twin super arms RESOLVE,
  re-attributed BL-7→BL-8). Per Phase-5 cascade invalidation, Gate 3 was re-earned against the
  re-amended SDD-003 + SRS v1.28.
- **Artifact under review:** the WI-3 test suite —
  `gitnexus/test/integration/resolvers/apex-cross-file.test.ts` +
  `gitnexus/test/unit/apex-cross-file-unit.test.ts`.
- **Source / governing:** SDD-003 (`.vsdd/SDD.md`, `# SDD-003`, Gate-2-re-cleared
  `gate2-wi3-phase5-v128.md`), **SRS-001 v1.28**, Constitution **v1.1.3**.
- **Objective Red-Gate evidence:** `.vsdd/tdd/WI-3-red-gate.md` (incl. the Phase-5 v1.28 heritage-super
  subsection + the round-1 disposition block).
- **Implementation:** WITHHELD. WI-3 Step 3b is DONE (111/111 at inc 16), so the suite is green; the
  reviewers were forbidden to read `src/**` and validated tests against the SPEC only — a Phase-5
  test-addition to a shipped work item is green by construction (the inc-14 CaseKid-super precedent).
- **Verdict:** **PASS_FIXED.** **Architect sign-off:** Adam, 2026-07-06.

## Bundle manifest (§A.17 — pinned by git blob SHA at HEAD `940d147e`)

| SHA (git blob) | Path |
|---|---|
| `3a63cdd0` | `.vsdd/SDD.md` (SDD-003 under review; v1.28-derived, Gate-2-re-cleared) |
| `2c5cf412` | `.vsdd/SRS.md` (v1.28) |
| `12ceab6f` | `.vsdd/Constitution.md` (v1.1.3) |
| `5fc32668` | `.vsdd/tdd/WI-3-red-gate.md` (Red-Gate ledger + Phase-5 v1.28 + round-1 dispositions) |
| `a427c86e` | `gitnexus/test/integration/resolvers/apex-cross-file.test.ts` (106 anchors) |
| `5f9addb4` | `gitnexus/test/unit/apex-cross-file-unit.test.ts` (10 anchors) |

Fixture read access under `gitnexus/test/fixtures/lang-resolution/apex-cross-file*` was admitted.
**Withheld:** all implementation source (`src/**`, `gitnexus-shared/src/**`), HANDOFF, sessions/,
other pass-records, deliberation, RESEARCH-003 rationale, prior-review narrative, and any
round/fix/version-cascade framing.

## Reviewer independence (§A.7 / §A.17)

Each of the **3 rounds** was a **distinct, context-free `vsdd-test-validator` invocation** — a fresh
agent with no producer-session access and no knowledge of prior rounds or of the amendment history,
given only the admitted bundle + standing Gate-3 criteria, with **no round/fix framing**. The agents
read spec + tests + fixtures + Red-Gate ledger only; each was explicitly forbidden to read
implementation source (the Gate-3 discipline: tests are validated against the spec, not the code).

- Round 1 — agent `a3d0016507b9c3157`
- Round 2 — agent `ada76ce67f0a12d95` (distinct from R1)
- Round 3 — agent `ac8efa4fe75c34c78` (distinct from R1/R2) — returned the clean invariant

## Loop & convergence (§A.8 — every finding fixed-only)

**3 rounds** (2 with findings → 1 clean); trajectory **4 · 3 · clean**. Round 3 returned the
context-free clean invariant ("Forced to manufacture flaws.") with no knowledge of the 7 prior
findings — so the **gate-record verdict is PASS_FIXED**.

### Round 1 (4 findings — Architect-dispositioned FIX, 2026-07-06)

- **F1 — non-exported `hd.reveal()` over-asserted resolution.** The test hard-pinned resolution to
  `Hidden.cls`, but SDD-003 §7(7)/§8 (line 1355) commits **only no-throw + no-mis-bind** — the
  resolve/filter outcome is the disclosed WI-4 REQ-012 forward-dependency, not a WI-3 SHALL. (The
  prior resolves-assertion was a Gate-3-v1.11 strengthening that the Gate-2 v127 SDD softening
  cascade-invalidated.) **Fix:** relax to a no-mis-bind guard (no `reveal` edge to a non-Hidden
  target) — green under the current inject-all design AND green if WI-4 adds the sanctioned filter.
  Reclassified in the ledger from genuinely-RED resolves-assertion to conservative-negative.
- **F2 — dead `fake`-absence guard.** `CALLS target==='fake' from MisfileCaller` was vacuous
  (MisfileCaller only references `h.assist()`); the `assist → Utils.cls` positive is the real
  name-share discriminator. **Fix:** delete the sub-assertion; the positive carries the intent.
- **F3 — dead Samey `ACCESSES` guard** (in the v1.28 BL-12 pin). SameCaller has no field-access
  site, so the ACCESSES filter was always-empty. **Fix:** remove it — the CALLS filter + no-record
  check are the exhaustive BL-12 edge-absence-and-no-record evidence.
- **F4 — mixed-language `it`-titles cited retired §7(8).** SDD-003 retires §7(8) (Addendum 12);
  the describe header already frames the block as an NFR-002 regression pin. **Fix:** retitle both
  to the NFR-002 registry-partitioning framing (assertions unchanged).

### Round 2 (3 findings — Architect-dispositioned FIX, 2026-07-06)

- **F1 — typed-receiver `c.inherited()` find source-unpinned.** The implicit-this form (Child.callUp
  → Base.inherited, asserted separately) resolves to the SAME target, so the source-unpinned find
  could green off it even if InhCaller's typed-receiver path broke (§8 names both as materially
  different paths). **Fix:** source-pin the find to `InhCaller`.
- **F2 — valid-twin `t.spin()` find source-unpinned (regression introduced this session).** The new
  v1.28 TwinSub `super.spin()` BL-8 pin (same fixture dir) also resolves to `Twin.cls:Twin.spin`, so
  the source-unpinned find could green off that super edge even if TwinCaller's `t.spin()` broke.
  **Fix:** source-pin the find to `TwinCaller` (the ctor arm was already pinned). A clean example of
  the cold re-review catching an interaction a same-session fixture change created.
- **F3 — ledger unit-anchor count stale (8 → 10).** The genuinely-RED section understated the
  `apex-cross-file-unit.test.ts` anchor count. **Fix:** corrected to 10 (all 10 reject pre-impl).

### Round 3 — CLEAN

Fresh context-free validator (88 tool calls) independently cross-checked every §8 acceptance bullet,
§2 clause, §4 edge case, each `[Gate-3 reliance]`, and **all 14 §5.1 BL rows** (BL-1 CaseKid … BL-14
Victim) against a fixture-backed falsifiable assertion; confirmed the **BL-7 self-loop vs BL-8
parent-resolve** split and the **BL-12 same-case-no-record vs exact-case-bind vs member-collision-
record** distinctions match the register wording exactly; verified name-only assertions discriminate
on unique targets; verified the reliance tests would expose host misbehaviour; validated every
Red-Gate justification category (fallback-channel already-green, conservative-negatives anchored by
red positives, the Phase-5 v1.28 green-by-construction pins, and MA-WI3-001). Verdict: "Forced to
manufacture flaws."

## Objective evidence

- The 3 `vsdd-test-validator` transcripts (rounds 1–3) — round 3 = "Forced to manufacture flaws."
- Suite state at the clean round: **116 tests (106 integration + 10 unit) — all green** (WI-3 impl is
  DONE); the pre-existing Apex + Java peer suites stay green (**312/312** across apex.test,
  apex-resolution.test, apex-resolution-hardening, apex-resolution-unit, java.test — NFR-002 holds).
- Red-Gate ledger `.vsdd/tdd/WI-3-red-gate.md`: the Phase-5 v1.28 heritage-super subsection (BL-7/BL-8
  no-red justifications, probe-verified 2026-07-06), the Samey BL-12 no-record clause, and the
  round-1 disposition block. No `// vsdd:scaffold` edits (nothing to discriminate).

## Scope of this re-review (Phase-5, no cascade beyond the tests)

Step 3a additions (5 v1.28 pins: NestSub BL-7 self-loop ×2, TwinSub BL-8 resolve ×2, Samey BL-12
no-record) + the 7 round-1/2 fixes are **test/fixture/ledger only** — no implementation source and no
spec (SDD/SRS/Constitution) changed. The SDD/SRS were byte-unchanged throughout (SHAs `3a63cdd0` /
`2c5cf412` / `12ceab6f` stable), so **no downstream cascade** and **no Gate-1/Gate-2 reopen**. Gate 4
(impl vs spec+tests) is next and reviews the same test suite as its fidelity anchor.

## Cleared

Every finding fixed (fixed-only); the clean 3rd round by a distinct reviewer attests full spec
coverage of SDD-003 §8 and every SRS §5.1 BL row, faithful falsifiable assertions with unique-target
discrimination, reliance tests that would expose host misbehaviour, and sound Red-Gate/manual-
acceptance categorisation. On sign-off: commit this record, update the `work-items.md` ledger
(ITEM-003 gates → [..., 3-phase5-v128]), then **Gate 4** (both passes, cold, distinct invocations;
MUST cover the SEVEN shared edits — incs 2, 3, 7, 8, 11, 12, 15) → **Gate 5** → WI-3 DONE → **WI-4**.

## Commits (commit-only, NOT pushed)

- `360f7b7a` — Step 3a: the 5 v1.28 pins (fixtures + assertions + ledger).
- `67906d28` — round-1 fixes (F1–F4).
- `940d147e` — round-2 fixes (F1–F3). ← reviewed clean state.
- (this record + ledger) — pass-record commit following.
