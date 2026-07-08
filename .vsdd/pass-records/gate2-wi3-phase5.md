# Gate 2 Pass Record — WI-3 (SDD-003) Phase-5 cascade re-review

- **Gate:** 2 (SDD vs approved SRS + Constitution)
- **Work item:** ITEM-003 (WI-3 — cross-file binding & trigger resolution)
- **Verdict:** **PASS_FIXED** (4 cold context-free rounds: 3 findings-rounds → 1 clean)
- **Reviewed artifact:** SDD-003 (`.vsdd/SDD.md`, `# SDD-003` section)
- **Architect sign-off:** Adam, 2026-07-06
- **Trigger:** Phase-5 cascade. The Gate-1 Phase-5 re-clear (SRS v1.13 → v1.27, Constitution
  v1.1.1 → v1.1.3 — the §5.1 Bounded Limitations Register, the REQ-015 v1.16 consolidation, the §1.2
  two-class model, the REQ-004→REQ-010 v1.14 relocation, the v1.12/v1.13 super/MRO ratifications)
  cascade-invalidated the prior SDD-003 Gate-2 record (`gate2-wi3.md`, PASS_FIXED 2026-06-30). SDD-003
  re-reviewed against the amended upstreams.

## Artifacts (SHA-256, pinned)

| Artifact | Role | SHA-256 |
|---|---|---|
| `.vsdd/SRS.md` (v1.27) | source | `d462d4a98bb88ce80b4df57727098099ab42b41fa4bbec23b64a6db822503ca0` |
| `.vsdd/SDD.md` (SDD-003) | derived (under review) | `49d8428b4b43119c84f794f2627fc22f12def9b2b3fcea373acf09006613339a` |
| `.vsdd/Constitution.md` (v1.1.3) | governing | `502df9b5cc7a3b001f1c022244ed69c5326c2791399e800be9202f5a2a53e699` |
| `.vsdd/research/RESEARCH-003-apex-cross-file-binding.md` | objective host-API evidence | `0c65cb894a1e403184d16430656098845b6f2cd66beb80e3de2fd16a2aff5fad` |

The SRS and Constitution hashes are **identical** to the Gate-1 Phase-5 record — the Gate-2 loop
integrated every finding into the SDD alone; no upstream (SRS/Constitution) change was made, so no
further cascade was triggered.

## Reviewer independence attestation (§A.7 / §A.17)

- **Reviewer:** the Adversary — a **fresh, distinct, general-purpose agent invocation per round** (4
  distinct invocations), each in a clean context with no access to the Builder's deliberation, no prior
  round/fix/focus framing, and no prior-review narrative (context-free discipline; dogfood #6).
- **Admitted bundle (every round):** `.vsdd/SRS.md` (v1.27), `.vsdd/SDD.md` (SDD-003 under review;
  SDD-001/002 readable for cross-reference), `.vsdd/Constitution.md` (v1.1.3),
  `.vsdd/research/RESEARCH-003-apex-cross-file-binding.md`; host source under `gitnexus/src/**` +
  `gitnexus-shared/src/**` **readable for verification only**.
- **Withheld:** all pass records, HANDOFF.md, `.vsdd/sessions/**`, `.vsdd/tdd/**`, `work-items.md`,
  `state.json`, and any prior-review narrative.
- Each round's prompt was byte-identical and context-free — a fresh Gate-2 first-pass review, never
  framed as a re-review (so a clean round returns the "Forced to manufacture flaws." first-pass invariant,
  not the re-review phrase). The Builder verified adversary-named claims (SRS amendment cites, drifted host
  line numbers, the treeCache/worker-mode cost) against source before acting — findings were not
  rubber-stamped.

## Round-by-round finding trail (10 findings, 5 → 2 → 3 → 0 — convergence)

### Round 1 — 5 findings (all fixed)
- **F1/F2 — same-case type-name duplicate positive record (BL-12 same-case arm).** §2 assertable-record
  set omitted "type-name case-collision"; §4/§8 same-case-duplicate fixtures asserted edge-absence only.
  Per BL-12 + REQ-015 + §2 "equal precedence", a same-case duplicate top-level type name is a
  competing-candidate ambiguity (two equal-precedence candidates reach the exact-case-channel resolver) →
  positive unresolved record (Gate-3-verified). *Fixed:* §2 assertable set + §2 exact-case-channel arm +
  §4 + §8 same-case bullets now assert the positive record for the exact-case arm; the bindings-channel
  typed-receiver form stays edge-absent (guard-miss).
- **F3 — stale REQ-004 v1.6 trigger-referenceability citations.** SRS v1.14 relocated the exception to
  REQ-010 (BL-10/BL-11); §3/§4 still cited REQ-004 v1.6. *Fixed:* re-cited the *exception* instances as
  REQ-010 v1.14 (ratified v1.6); kept "REQ-004" only for the non-referenceability *property* / node
  representation.
- **F4 — non-exported top-level type: hard "resolves" acceptance over-committed.** A private cross-file
  reference is invalid Apex (outside §1's valid-source SHALL), so §8's hard REQ-010-SHALL "resolves"
  acceptance over-committed and pre-empted the WI-4 REQ-012 resolve-vs-filter question. *Fixed (Architect:
  soften §8a):* §3(a)/§7(7)/§8 reframed to a disclosed forward-dependency (SDD-001 `Property`-label
  precedent) — §8 pins only no-throw + no-mis-bind; the resolve/filter outcome is the deferred WI-4
  question. (§3/§7 softened for consistency — they carry the framing §8a rests on.)
- **F5 — drifted [structural] line pins.** Cited host line numbers stale by 4–26 lines (symbols/ordering
  intact). *Fixed:* refreshed against the current host — `scope-resolver.ts:928/939`, `run.ts:640/687/732/757`
  (573 unchanged), `walkers.ts:364/530/501-529/76-107/639-657`, `scope-resolution-indexes.ts:81` (Builder
  pulled each number from source, did not trust the adversary's).

### Round 2 — 2 findings (all fixed)
- **R2-F1 — stale preamble Constitution version.** Document-level bullet said "SDD-003 authored under
  v1.1.1", contradicting the header (v1.1.3) and the §1.2(a)/(b) classes it relies on (post-v1.1.2).
  *Fixed:* preamble → v1.1.3 with the v1.1.2/v1.1.3 history.
- **R2-F2 — REQ-008 method-parameter-arg deferral not requirements-traceable.** SDD-003 defers the
  cross-file method-parameter-typed-argument overload to WI-4, traceable on the admitted set to SDD-002 §2
  (Gate-approved WI-2/WI-4 boundary, coupled to REQ-013) but not to any SRS requirement/§10/§11/BL row.
  *Disposition (Architect: path i — spec-level cite, no SRS reopen):* SDD-003 now explicitly cites the
  ratified SDD-002 §2 boundary as the deferral's ratification-of-record. The epic still delivers REQ-008
  in full (WI-2: 4 arg kinds; WI-4: the 5th) — decomposition, not reduction.

### Round 3 — 3 findings (all fixed)
- **R3-F1 — BL-10 departure admitted on a ground Constitution §1.2 doesn't enumerate.** BL-10 (trigger
  misfiled in `.cls` → injected → binds a non-constructable trigger) is a §1.2(b) bind, but SDD §3
  grounds it on *cost/complexity*, not §1.2's enumerated shared-coupling / trade-inconsistency grounds.
  **Builder verification (Architect-requested):** the `treeCache` node-kind suppression is genuinely
  Apex-local and precedented (csharp's `namespace-siblings.ts` sibling hook reads `treeCache` and walks
  the tree-sitter AST) — BUT **not cheap**: in worker mode `treeCache` is empty (native tree-sitter Trees
  cannot cross MessageChannels), and csharp found re-parsing "dominated worker-mode scope-resolution time",
  so it built a bespoke line-scanner fallback (`extractCsharpStructureViaScanner`). A robust Apex BL-10
  suppression would need the same worker-mode fallback — disproportionate for an invalid-source-only corner.
  (This refuted the Builder's initial "cost overstated" read; the SDD's "worker-path complexity" wording is
  accurate and retained.) *Disposition (Architect: path i-b — no amendment, no cascade):* a §3 note records
  that Constitution §1.2's enumerated grounds are *illustrative, not exhaustive*, and BL-10 is admitted
  under §1.2's general Architect-ratified, fixture-pinned, narrow, uncompiled-source-only bounded-limitation
  framing (with the verified cost ground stated).
- **R3-F2 — "plain miss" misapplied to a two-candidate collision.** SDD labelled the bindings-channel
  duplicate guard-miss a "plain miss" (and §7(14) proposed re-ratifying v1.7 as "no record for plain
  misses"), but SRS §2 defines *plain miss* as "no in-repository candidate at all" — a duplicate has two
  candidates. *Fixed:* §2 / §7(14) / §8 reframed to "a guard-suppressed collision — a competing-candidate
  ambiguity the §3 guard stops BEFORE the resolver" (edge-absent because it never reaches the resolver, so
  the positive-record obligation — conditioned on reaching the resolver — does not fire on that channel);
  genuine plain misses (`new Missing()`) keep the term.
- **R3-F3 — stale `super.method()` self-loop citation in §2.** §2 postcondition listed the self-loop as a
  uniform v1.11(a) outcome, but SRS v1.12 / BL-8 superseded it for the v1.8(i) case-varied shape (super
  resolves to parent); the self-loop is BL-7 (v1.10(iii)/(v)) only. *Fixed:* §2 parenthetical now splits
  BL-7 (self-loop) from BL-8 (super resolves), matching §4/§8.

### Round 4 — clean ("Forced to manufacture flaws.")
Fresh cold reviewer verified exhaustively: all 14 §5.1 BL rows correspond in outcome/source/§1.2 class;
every structural pin resolves against the current host; §2 definitions used consistently (explicitly noting
the R3-F2 guard-suppressed-collision framing "dissolves" the apparent §2 tension because the positive-record
obligation is conditioned on "ambiguity reaches the resolver"); [structural]/[Gate-3 reliance] split
disciplined; Constitution §1.2/§2/§A.3 compliance holds. No flaws.

## Disposition summary

All 10 findings are derivation-fidelity / Constitution-correspondence findings (Gates 1–2 fidelity =
**fixed-only**, never signed off) EXCEPT the two Architect scope/ground decisions dispositioned in-loop:
R2-F2 (path i — spec-level cite of SDD-002 §2) and R3-F1 (path i-b — §1.2 grounds illustrative). Both were
integrated into the SDD without an upstream change, so the SRS and Constitution are byte-unchanged and no
cascade propagates from this gate. No CSDD MUST (§A.1) or undischarged Prove (§A.3) issue arose (WI-3 has no
Prove properties — §7, per-property §A.3 disposition).

## Cascade note

Changed artifact: **SDD-003 only** (`.vsdd/SDD.md`). Per Phase-5 cascade, a changed SDD invalidates the
downstream test / implementation / proof records (Gates 3–5) derived from it — those must be re-reviewed
against the amended SDD-003. The WI-3 Gate-3 record (`gate3-wi3.md`) and the downstream impl/proof records
are re-earned in the continuing Phase-5 cascade (Gate 3 next).
