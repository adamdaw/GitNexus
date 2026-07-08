# WI-4 (ITEM-004) — Phase 3 Step 3b TDD compliance log (§A.12)

Per-increment record: failing test(s) → minimal implementation → pass, with changed
files and a one-line justification the diff is confined to satisfying the targeted tests.
Minimality is checked against this log at Gate 4.

Build note: integration tests run the compiled `dist/` worker; each `src/` edit requires
`node scripts/build.js` before re-running the integration suite.

Red baseline (HEAD `8873a457`): **20 WI-4 reds / 138** in
`apex-parity.test.ts` + `apex-cross-file.test.ts`; full resolver suite 3047/3067 (56 files).

Step-3b targets the four SDD-004 workstreams:
- **WS1** — Apex-gated pipeline re-sequence (`run.ts` + `resolveHeritageAfterSiblings?` flag).
- **WS2** — nested-aware heritage-base seam (`walkers.ts` + Apex `resolveDottedHeritageBase` hook).
- **WS3** — REQ-008 parameter-arg narrowing gate + oracle (`languages/apex/captures.ts`).
- **WS4** — receiver-variable case-fold (Apex-local).

---

## Increment 1 — WS1: Apex-gated pipeline re-sequence (SDD-004 §1(1))

- **Targets (red→green, 6):** BL-1 (CaseKid extends BASE implements IFACE), BL-2
  (TwistSub → class), BL-5 (TwinSub → class), BL-8 (CaseKid.inherited()), BL-10
  (PhantomSub extends PHANTOM), and the NFR-001 case-varied cross-file heritage
  cycle. `apex-parity` + `apex-cross-file`: **20 → 14 reds**.
- **Changes:**
  - `scope-resolution/contract/scope-resolver.ts` — new optional
    `resolveHeritageAfterSiblings?: boolean` (names no language; §2.2
    isolated-provider arm).
  - `scope-resolution/pipeline/run.ts` — extracted the heritage/MRO block, the
    `indexes` construction, and the workspace/sibling registration into three
    local closures (`runHeritageAndMro`/`buildIndexes`/`runWorkspaceAndSiblings`);
    fork on `resolveHeritageAfterSiblings`. Apex arm: build `indexes` with the
    empty method-dispatch finalize supplies → siblings → heritage+MRO (threading
    `indexes`, not `finalized`, to `preEmitInheritanceEdges` — §1(1) pin a) →
    re-spread the populated `methodDispatch` (fresh spread, no mutation — pin b).
    Peer arm: byte-identical order to today.
  - `languages/apex/scope-resolver.ts` — `resolveHeritageAfterSiblings: true`.
- **Justification:** the re-sequence is the SDD-004 §1(1) deliverable; the closure
  extraction is a behaviour-preserving refactor (peer order unchanged). Diff
  confined to the fork + flag. `postHeritageNodeLookup` hoisted (consumed by the
  downstream emit phase).

## Increment 2 — WS2: nested-aware dotted-heritage-base seam (SDD-004 §1(2))

- **Targets (red→green, 9):** the 4 seam refuse/resolve shapes (RCaseOuter
  resolve; RExtOuter/RTailAbsent/RCollidedOuter refuse), BL-3 (NestSub extends
  Outer.Inner), BL-4 (TailSub extends TOuter.TInner, never the decoy), BL-6
  (t.decoy2() no false member edge), and BL-7 (NestSub super.ping() + super()
  ctor). `apex-parity` + `apex-cross-file`: **14 → 5 reds**.
- **Changes:**
  - `model/scope-resolution-indexes.ts` — `DottedHeritageBaseResolution`
    (3-state: resolved/refuse/pass-through) + optional
    `resolveDottedHeritageBase?` field on `ScopeResolutionIndexes`.
  - `scope-resolution/contract/scope-resolver.ts` — the same hook on the
    provider contract.
  - `scope-resolution/scope/walkers.ts` — consult the seam at the TOP of
    `resolveInheritanceBaseInScope`, keyed on `rawQualifiedName ?? baseName` (the
    dotted form; `baseName` is only the tail). `resolved`→return def;
    `refuse`→return undefined WITHOUT falling through; `pass-through`→unchanged.
  - `scope-resolution/pipeline/run.ts` — thread `provider.resolveDottedHeritageBase`
    onto `indexes` in `buildIndexes`.
  - `languages/apex/namespace-siblings.ts` — `resolveApexDottedHeritageBase`
    (OUTER-first via the folded `workspaceFqnBindings` channel: unique outer type
    AND unique folded full-key nested type → resolved; else refuse; >2 segments →
    refuse; non-dotted → pass-through) + `uniqueWorkspaceType` helper.
  - `languages/apex/scope-resolver.ts` — register the hook.
  - `languages/apex/captures.ts` — emit `@reference.qualified-name` for a scoped
    (dotted) heritage base in `emitApexInheritanceBase` (so `rawQualifiedName`
    reaches the seam) AND for a dotted `super()` superclass in
    `emitApexExplicitConstructorRef` (so the super-ctor call resolves OUTER-first
    like `new Outer.Inner()` — the BL-7 super() arm).
- **Justification:** the seam is the SDD-004 §1(2) deliverable (a generic
  per-language hook; Apex supplies the impl). The two capture additions carry the
  dotted qualifier the seam/ctor-resolver need — the prior captures dropped it,
  leaving only the decoy-prone tail. Diff confined to the seam + its two capture
  feeds. Peers register no hook → `resolveInheritanceBaseInScope` behaviour
  unchanged for them (Gate-4 NFR-002 leg).

## Increment 3 — WS3: REQ-008 parameter-arg narrowing gate + oracle (SDD-004 §1(3))

- **Targets (red→green, 4):** narrows a USER-DEFINED top-level param (`b.f(p:Widget)`
  → f(Widget)); a DOTTED nested param (`b.g(p:NOuter.NInner)` → g); a SIMPLE-name
  nested param referenced from its enclosing class (§1(3)(c)); and the REQ-006
  no-false-unresolved anchor. `apex-parity`: **5 → 1 red** (WS4 only).
- **Gate-3 placement finding (Adam-approved, routed 2026-07-08):** SDD-004 §1(3)
  places the oracle in `resolveVarTypeBindings` (`captures.ts`, "no shared edit").
  But that runs at **parse phase** with no cross-file `workspaceFqnBindings`, and the
  §1(3)(a)/(b) arms are inherently cross-file (a param type is external vs
  user-defined only knowable against the workspace). So the oracle must run at
  **resolution phase**. Adam chose "build Apex-local at resolution phase"; recorded
  as a Gate-3-reliance discovery + a Phase-5 SDD-004 §1(3) placement clarification.
  **No shared edit** — an existing optional per-language hook (`populateRangeBindings`)
  is registered; only Apex reference sites are touched.
- **Changes (Apex-local):**
  - `languages/apex/captures.ts` — `resolveVarTypeBindings` now also reads
    `@type-binding.parameter` (params were excluded — the WI-2 deferral), and TAGS a
    param-sourced arg-type slot with `APEX_PARAM_ARG_MARKER` (a local declaration of
    the same name un-tags it). Local/field slots patch unchanged (WI-2).
  - `languages/apex/param-arg-gate.ts` (new) — `APEX_PARAM_ARG_MARKER` + the
    `gateApexParamArgTypes` `populateRangeBindings` hook: for each tagged slot,
    the decoy-safe oracle resolves the folded declared type — dotted → unique nested
    workspace key; simple → the call-site enclosing class's owned nested type FIRST
    (local-over-global, shadowing a top-level decoy), then a unique top-level type;
    else blank (external / inject-none tie → arity-only). Emits the folded TAIL
    (overload declared param types fold to `extractSimpleTypeName` = the tail), or
    `''` to blank. Strips every marker before `resolveReferenceSites` consumes it.
  - `languages/apex/namespace-siblings.ts` — export `uniqueWorkspaceType` for reuse.
  - `languages/apex/scope-resolver.ts` — register `populateRangeBindings`.
- **Justification:** completes the WI-2-deferred param sub-case without re-owning
  REQ-008's selection algorithm; the oracle reuses WI-3's folded workspace channel
  (decoy-safe), never the shared `findClassBindingInScope` tail. No shared-code edit
  (existing hook). Regression check: full Apex suites **209/209** green
  (`apex-resolution`, `apex`, `apex-cross-file`, `apex-resolution-unit`) — incl.
  `OverExternalArg` (param external → still unresolved) and `OverFold` (local nested
  user-defined → still narrows), which pinned the param-vs-local boundary.

## Increment 4 — WS4: receiver-variable case-fold (SDD-004 §1(4))

- **Targets (red→green, 1):** folds a case-varied receiver VARIABLE (`Widget a; A.foo()`
  → Widget.foo). `apex-parity`: **1 → 0 red**. (The collision negative — `Widget pa;
  Gadget PA; Pa.foo()` → no edge — stays green.)
- **Mechanism decision (Adam-approved, routed 2026-07-08):** the fold lives at the
  SHARED `findReceiverTypeBinding` (exact `typeBindings.get`), which the Apex code
  comment (`resolution.ts:12`) had deferred "per the §2.2 ceiling." SDD-004 §5 budgets
  only two shared edits (WS1/WS2) and calls WS4 Apex-local hardening. Adam chose
  "extend the existing `normalizeIdentifier` seam" — mirroring WI-3's already-sanctioned
  `workspaceBindingsFor` fold. Record a Phase-5 SDD-004 §1(4)/§5 clarification (a
  third shared touch, via the existing seam, inert for peers).
- **Changes:**
  - `scope-resolution/scope/walkers.ts` — `findReceiverTypeBinding` gains a folded
    fallback AFTER the exact scope walk misses: scan each scope's `typeBindings`
    folding keys via `scopes.normalizeIdentifier`; a unique folded match binds, a
    folded-key COLLISION at a scope → `undefined` (ambiguous, never guess). Gated on
    `normalizeIdentifier !== undefined` → inert for case-sensitive peers.
- **Justification:** names no language (reads the threaded `normalizeIdentifier`
  seam), runs only on an exact-match miss, and is inert for peers. Non-gated §1(4)
  hardening. No storage/capture change.

---

## Step 3b complete — objective evidence

**All 20 WI-4 reds → green.** Full resolver suite **3050/3050 passed (54 files)** —
every peer language + every prior Apex test green under both budgeted shared edits
(WS1 re-sequence + WS2 seam), the WS3 `populateRangeBindings` hook, and the WS4
`normalizeIdentifier` fold. NFR-002 holds by measurement (not only by construction).

**Gate-3-reliance placement findings for the Phase-5 SDD-004 cascade** (both
Adam-approved 2026-07-08, neither a shared-edit beyond what was dispositioned):
- **WS3 (§1(3))** — the param-arg oracle runs at resolution phase
  (`populateRangeBindings`), not capture (`captures.ts`), because it needs
  cross-file `workspaceFqnBindings`. No shared edit (existing hook).
- **WS4 (§1(4)/§5)** — the receiver-var fold extends the shared
  `findReceiverTypeBinding` via the existing `normalizeIdentifier` seam (a third
  shared touch, inert for peers) rather than being purely Apex-local.

**Next:** the Phase-5 SRS/Constitution discharge amendments authored ON this green
evidence (SDD-004 §8) + these two placement clarifications → Gate 4 (both passes;
the shared edits owe a §2.2 code review + NFR-002 measurement — the 3050/3050 run is
the objective evidence) → Gate 5.
