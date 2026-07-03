# Gate 2 pass record (re-review) — Spec Fidelity (ITEM-003 / WI-3, amended SDD-003)

*VSDD §A.7 / §A.17. Gate 2 reviews the derived SDD against the source SRS + the Constitution, via distinct
context-free adversary invocations (production independence, not just memory reset). Findings are
derivation-fidelity → **fixed-only**. Verdict authority: Architect (Adam).*

> **Supersedes `gate2-wi3.md`** (Phase-5 cascade, dogfood #15). The original Gate-2 record covered the
> pre-amendment SDD-003. WI-3 Step-3a validation against the real host falsified that design model — the
> host already resolves several REQ-010 forms (exact-case ctor/heritage/super/static-Property) via a
> pre-existing channel that bypasses the §3 inject-none guard. Architect-dispositioned 2026-07-02 as
> parity-accept + document; SDD-003 was amended in place (two-channel model + owning-scope discriminant +
> the v1.5–v1.11 limitation family + reliances (1)–(15)); this record covers the **amended** SDD-003.

- **Work item:** ITEM-003 (WI-3) — cross-file binding & trigger resolution.
- **Artifact under review:** **SDD-003** (`.vsdd/SDD.md`, `# SDD-003` section, amended this cycle).
- **Source / governing:** SRS-001 (amended **v1.4 → v1.11** this cycle — see the ratification ledger below),
  work-items ITEM-003, Constitution CONST-gitnexus-apex **v1.1.1**.
- **§A.6 evidence:** **RESEARCH-003** (`.vsdd/research/RESEARCH-003-apex-cross-file-binding.md`) — the
  cross-file-binding host-API spike (A-3 confirmed; Seam B) + **addenda 4–17** (the Step-3a probe evidence;
  scripts inlined; addenda 5/7/12/13/14 correct earlier attributions).
- **Verdict:** **PASS_FIXED.** **Architect sign-off:** Adam, 2026-07-02.

## Bundle manifest (§A.17 — pinned by git blob SHA at HEAD `8aa7fc43`)

The **admitted** bundle passed to each reviewer (paths + object hashes):

| SHA (git blob) | Path |
|---|---|
| `bc93d86c` | `.vsdd/SRS.md` (v1.11) |
| `88635e22` | `.vsdd/SDD.md` (SDD-003 under review; SDD-001/002 completion-context only) |
| `129d2b0c` | `.vsdd/Constitution.md` (v1.1.1) |
| `2d6390b3` | `.vsdd/work-items.md` (ITEM-003 row) |
| `cebc9998` | `.vsdd/tdd/WI-3-red-gate.md` (added to the bundle round 39 — suite-state evidence) |
| `857eabdf` | `.vsdd/research/RESEARCH-003-apex-cross-file-binding.md` (+ addenda 4–17) |

**Additional admission for this gate (new vs `gate2-wi3.md`): host source read access** under
`gitnexus/src/**` and `gitnexus-shared/src/**`, so the reviewer verifies every SDD-003 host-behaviour claim
against the actual pipeline (dogfood: Gate-2 adversaries need host-source read access to be effective).
**Withheld:** everything else under `.vsdd/` (HANDOFF, sessions/, adr/, findings/, step3a-findings, other
pass-records, state.json, RESEARCH-001/002, STEP3B*) and all git history / session logs / prior-review
narrative.

## Reviewer independence (§A.7 / §A.17)

Each of the **40 rounds** was a **distinct, context-free `general-purpose` adversary invocation** — a fresh
window with no producer-session access, given only the admitted bundle + host-source read access + standing
criteria, with **no round/fix/focus framing**. No reviewer saw a prior round, a prior finding, the
deliberation, HANDOFF, ADRs, session logs, or pass-record narrative.

## Loop & convergence (§A.8 — every finding fixed-only unless noted accept-risk)

**40 rounds** (39 with findings → 1 clean). Per-round finding counts:

```
 4  7  5  4  8  4  4  5  4  4   (r1–10)
 6  3  5  4  3  5  3  4  5  6   (r11–20)
 3  4  4  4  4  3  3  3  4  4   (r21–30)
 6  3  4  3  2  3  2  2  2      (r31–39)
 clean                          (r40 — "Forced to manufacture flaws.")
```

~156 findings across 39 findings-rounds, all fixed or Architect-dispositioned. Trajectory converged from
7–8/round early to 2–3/round with explicit "all other surfaces held" verification notes from round 35 on.
The clean 40th round returned PASS_CLEAN's invariant ("Forced to manufacture flaws.") with zero knowledge of
the ~156 prior findings — so the **gate-record verdict is PASS_FIXED** (the gate had findings; the reviewer's
phrase reflects production-independence, not a clean first pass — dogfood #24). The round-40 reviewer
independently re-verified every load-bearing `[structural]` pin against host source (pipeline ordering at
`run.ts`; `lookupBindingsAt` channel order `walkers.ts:63`; per-language fresh `workspaceFqnBindings`
`finalize-orchestrator.ts:155`; csharp `{def, origin:'namespace'}` precedent `:688`; Java take-first vs the
WI-3 take-every divergence `java/package-siblings.ts:95-105`) and confirmed the `[structural]` /
`[Gate-3 reliance]` split is honestly labelled.

## What the loop drove (the dogfood-grade findings)

- **The original design model was falsified and rebuilt.** The `qualifiedName`-has-no-`.` top-level
  discriminant was **structurally false** (nested defs carry a BARE `qualifiedName` on the resolution side —
  Addendum 7, `extractParsedFile` dump Addendum 10). Re-grounded on the **owning-scope shape** (a def is
  top-level iff its declaring class-kind scope's parent is the file's Module scope — the Java package-siblings
  precedent; take-EVERY is a deliberate divergence from Java's take-first). Architect option (b).
- **Host-interior mechanism retracted as a pin.** The pre-existing exact-case channel resisted three
  successive read-models (each mispredicted a probe). SDD-003 §1 now pins **only the probe-established
  behavioural shape table (Addendum 13)**; mechanism is explicitly NOT pinned. Generalisable lesson: pin
  behaviour per probed shape; never narrate host-interior mechanism as load-bearing.
- **§7(8) cross-language reliance RETIRED into a structural fact.** `workspaceFqnBindings` is a **fresh
  per-language-run Map** (`finalize-orchestrator.ts:155`; per-provider loop `phase.ts:306,425`) —
  cross-language interference is structurally impossible, not a held reliance. The mixed fixture became an
  NFR-002 regression pin (Addendum 12).
- **Heritage is unreachable by registration** — the heritage pre-emit pass runs PRE-hook (`run.ts:573` <
  `:636`) and suppresses `inherits` sites from retry (`run.ts:155-163`). No pure-registration design serves
  heritage clauses → the ratified SRS v1.8/v1.10/v1.11 heritage-limitation family, each fixture-pinned (incl.
  the `super.method()` SELF-LOOP mis-bind under an unresolved clause — Addendum 17 — and the nested-parent
  heritage decoy mis-bind — Addendum 11).
- **Discriminant ground corrected (not the discriminant).** The "extension is the only available
  discriminant / beyond pure registration" ground was false — the hook ctx carries `treeCache`
  (`scope-resolver.ts:902-913`). Architect kept the extension discriminant as a deliberate cost/complexity
  trade-off; SRS v1.6 ground re-affirmed on corrected reasoning.
- **§3 injection algorithm finalized:** universe = every class-like def (`def.type ∈ {Class,Interface,Enum}`)
  of Module-parented class-kind scopes, minus `.trigger`-filed (case-folded extension filter **before**
  grouping); group by `normalizeIdentifier(qualifiedName)`; inject `{def, origin:'namespace'}` (no `via`,
  csharp precedent `:688`) iff exactly one distinct nodeId; no candidacy tier.

## SRS ratification ledger (all Adam-ratified 2026-07-02, each its own explicit sign-off)

Every limitation is fixture-pinned; the unprobeable poisoned-MRO surface is a TRIPWIRE fixture (red at Step 3b
escalates rather than absorbs).

| Ver | What it ratifies | Probe corrections applied same day |
|---|---|---|
| v1.5 | exact-case-channel duplicate exception | corrected: unique-key-only binds; same-case ties refuse |
| v1.6 | misfile + lone-trigger exceptions | corrected: exact-case boundary; extension-ground = deliberate trade-off (treeCache was available) |
| v1.7 | REQ-015 record-observability interpretation | — |
| v1.8 | heritage-form limitations (pre-hook pass wall) | — |
| v1.9 | fragment-collision promotion | — |
| v1.10 | +nested-parent heritage, +(v) same-case twin heritage | — |
| v1.11 | heritage-downstream consequences + misfiled-trigger collision | corrected: super() nothing / super.method() SELF-LOOP; same-case sub-shape loses all forms |

## §7 reliances (Architect-tracked, validated at Gate 3 against the real host)

Reliance list now (1)–(15); (8) RETIRED (structural — per-language registry instances). Notable: (11) ctor
folded-path reach (raw free-call read-pin + WI-2 folding path as committed fallback attachment), (12)
single-registry sufficiency (`workspaceTypeBindings` second write = committed remediation), (13)
qualified-outer folding, (14) plain-miss internal record, (15) receiver-bound static-member reach. Gate 3 is
where these are validated against the real host (tests vs impl-withheld).

## Objective evidence

- The 40 adversary transcripts (rounds 1–40) — round 40 = "Forced to manufacture flaws." with an
  independent host-source re-verification of every structural pin.
- RESEARCH-003 host-source verifications + addenda 4–17 (probe scripts inlined).
- Red-gate ledger `.vsdd/tdd/WI-3-red-gate.md` — suite state 111 tests (65 genuinely red / 46 already-green
  with committed no-red justifications); peers 312/312 green.

## Cleared (pending Architect sign-off)

Every finding fixed (fixed-only) or ratified as a documented limitation / accepted as a held Gate-3 reliance;
the clean 40th round attests the wiring + the two-channel model + the discriminant + the `[structural]` /
`[Gate-3 reliance]` split + SRS v1.11 / Constitution v1.1.1 fidelity. On sign-off: commit this record, update
the `work-items.md` ledger (ITEM-003 gate-2 re-review recorded), then Phase 3 continues — the cold Gate-3
`vsdd-test-validator` loop (tests vs amended SDD-003, impl withheld — where the reliances (1)–(15) are
validated against the real host) → Step 3b.
