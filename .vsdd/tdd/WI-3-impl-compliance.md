# WI-3 (ITEM-003) — Phase 3 Step 3b TDD compliance log (§A.12)

Per-increment record: failing test(s) → minimal implementation → pass, with changed
files and a one-line justification the diff is confined to satisfying the targeted tests.
Minimality is checked against this log at Gate 4.

Build note: integration tests run the compiled `dist/` worker; each `src/` edit requires
`node scripts/build.js` before re-running the integration suite.

---

## Increment 1 — Namespace-siblings registration (REQ-010/REQ-011 base; SDD-003 §3)

- **Targets (red→green):** the 10 unit anchors in `test/unit/apex-cross-file-unit.test.ts`
  (the §3 selection/fold/guard shape), and every cross-file/trigger form the *bare injection*
  is sufficient for — 24 integration anchors greened (two-class call, bare declared-type
  binding, cross-file chain, misfiled/non-exported top-level types, the trigger static/instance
  arms, etc.). Integration suite `apex-cross-file.test.ts`: **46 → 70 passing of 101**.
- **Changes:**
  - `src/core/ingestion/languages/apex/namespace-siblings.ts` (new) —
    `computeApexNamespaceBindings` (pure §3 selection + fold: Module-parented `Class`-kind
    scopes → every class-like `ownedDef` minus `.trigger`-filed, folded key, inject-none on
    >1 distinct nodeId) + `populateApexNamespaceSiblings` (the effectful `workspaceFqnBindings`
    writer shell; ReadonlyMap→Map cast localized, mirroring `csharp/namespace-siblings.ts:639/688`).
  - `src/core/ingestion/languages/apex/scope-resolver.ts` — register
    `populateNamespaceSiblings: populateApexNamespaceSiblings` on `apexScopeResolver`.
- **Justification:** pure registration of the existing `populateNamespaceSiblings` seam
  (Constitution §2.2), no shared-code edit, no new seam. Discriminant/trigger-exclusion/collision
  guard are Apex-local. Diff confined to satisfying the §3 unit anchors + the injection-sufficient
  cross-file forms.
- **NFR-002:** peers + prior Apex suites **312/312 green** (java.test, apex.test,
  apex-resolution.test, apex-resolution-hardening, apex-resolution-unit).

### Step-3b findings surfaced by Increment 1 (the designed Gate-3 reliance validations)

- **⚠ §7(2) local-over-global precedence — reliance validated FALSE → Phase-5 escalation.**
  The `local-over-global precedence` fixture (ShadowUser declares a nested `class Shadow`; a
  top-level `Shadow.cls` exists) is now RED: post-injection, `Shadow s = new Shadow()` in
  ShadowUser's method body binds the **injected global** Shadow (1 CALLS edge → Shadow.cls)
  instead of the local nested Shadow (0 edges → ShadowUser.cls). Apex requires the inner class
  to win. Per SDD-003 §7(2), the enclosing-scope shadow case was "genuinely unverified either
  way... a red fixture here is a mis-bind on valid source → **Phase-5 escalation to the
  Architect (no Apex-local knob exists over the shared rank order)**" — `lookupBindingsAt`
  consults the scope-independent `workspaceFqnBindings` at the method scope, before the walk
  reaches the declaring class scope. **AWAITING ARCHITECT DECISION** (a shared-code precedence
  edit under §2.2 review, an SRS-ratified bounded limitation, or other). No Apex-local
  remediation exists; not patched unilaterally.

- **The remaining 30 integration reds are the designed committed-fallback clusters** (§3/§7),
  built at Step 3b only where their fixtures are red (they now are): static type-name-receiver
  synthesis (§7(3) — Color.RED, Level.HIGH, and the case-varied CONSTS.FLOOR/COLOR.BLUE/
  ACCOUNTHANDLER.notify/LEVEL.LOW), nested-type member resolution (§7(5)/(13) — Outer.Inner +
  variants, Kit.Part), case-fold at the ctor/free-call lookup (§7(11) — new ENGINE/ACCOUNTHANDLER),
  cross-file inherited-member MRO (§7(10) — implicit-this inherited, h.tag), cross-file overloads
  (REQ-008 ∘ REQ-010), the interface declaration-only arm (§3), and the trigger-scope compositions
  (REQ-011 ∘ the above). Increments 2+ pending.

## Increment 2 — §7(2) local-over-global precedence (shared-code fix; Architect-approved 2026-07-02)

- **Target (red→green):** the `local-over-global precedence` fixture (nested `Shadow` in
  ShadowUser wins over the injected global `Shadow.cls`). Integration `apex-cross-file.test.ts`
  70 → 71 passing; 81/111 with unit.
- **Architect disposition (Phase-5 escalation):** the §7(2) reliance validated FALSE; Adam chose
  **the shared-code precedence fix** (a generic §2.2 seam, not an SRS limitation) — local-shadows-
  global is universal, so the injected flat global must not beat an enclosing-scope declaration.
- **Changes (SHARED code — generic, no Apex naming):**
  - `src/core/ingestion/scope-resolution/scope/walkers.ts` — `lookupBindingsAt` gains an
    `includeWorkspace = true` param (default preserves every single-scope caller);
    `walkScopeChain` now walks the chain with `includeWorkspace: false` and consults the
    scope-independent `workspaceFqnBindings` channel ONCE, after the whole chain's per-scope
    declarations are exhausted — so a local/enclosing declaration of the same name shadows the
    flat global (the same lexical-scoping rule the walker already applied per-scope, now extended
    across the whole chain for the workspace channel). Cycle-break defers to the same fallback.
- **Justification:** minimal generic edit — reorders only the workspace channel relative to the
  scope walk; no language-specific control flow (Constitution §2.1). `findClassBindingInScope`
  (the declared-type/class-name resolver) routes through `walkScopeChain`, so the Apex declared
  type `Shadow s` now finds the enclosing nested type first. Other scope-chain walkers
  (callables/exports) are untouched — no fixture exercises an enclosing-shadow of those name kinds.
- **NFR-002:** peers + prior Apex **312/312 green** (the reorder changed no peer resolution).
- **⚠ Owes its own §2.2 review + adversary pass (Adam's condition):** flagged for the Gate-4
  review of the shared edit (generic-seam legitimacy + no unintended peer semantics change).

## Increment 3 — fold-(b): case-fold at the shared workspace lookup (Architect-approved 2026-07-03)

- **Targets (red→green):** the case-varied forms that reach the folded workspace channel with a
  raw-cased name — `new ENGINE()`, `ENGINE e; e.STOP()`, `CONSTS.FLOOR`, `ACCOUNTHANDLER.notify()`,
  `ACCOUNTHANDLER cv; cv.wake()`. Integration 71 → 75 passing; **85/111** with unit.
- **Architect disposition:** the §3/§7 case-fold clusters; Adam chose **fold approach (b)** — thread
  the language `normalizeIdentifier` into the shared workspace lookup, over per-Apex-path folding.
- **Changes (SHARED code — generic, no Apex naming):**
  - `model/scope-resolution-indexes.ts` — `ScopeResolutionIndexes` gains optional
    `normalizeIdentifier?: (identifier: string) => string`.
  - `scope-resolution/pipeline/run.ts` — thread `provider.languageProvider.normalizeIdentifier`
    onto the per-language-run `indexes` object.
  - `scope-resolution/scope/walkers.ts` — new `workspaceBindingsFor(name, scopes)` helper: try the
    RAW workspace key, then (only on miss, only when a folding normalizer is present and the folded
    form differs) the folded key. Used at both workspace-consult sites (`lookupBindingsAt` and the
    `walkScopeChain` post-loop fallback). **Additive** — case-sensitive languages (identity/absent
    normalizer) are byte-for-byte unchanged.
- **Justification:** one generic site; folds ONLY the workspace `.get()`; finalized/augmented
  channels stay RAW-keyed (exact-case). No Apex-specific control flow (Constitution §2.1).
- **NFR-002:** peers + prior Apex **312/312 green** (additive fold changed no peer resolution).
- **⚠ Owes its own §2.2 review + adversary pass** — the SECOND shared edit; batch with increment 2 at Gate 4.

## Increment 4 — static-receiver enum-constant synthesis (SDD-003 §3; Apex-local)

- **Targets (red→green):** the flat static-receiver enum-constant ACCESS forms —
  `Color.RED` and case-varied `COLOR.BLUE` (main), plus the trigger arms `Level.HIGH`
  and case-varied `LEVEL.LOW`. Integration+unit suite **85 → 89 passing / 22 red of 111**.
- **Root cause (probed 2026-07-03):** enum constants are captured by the WI-1 graph query
  (`queries.ts:38` `@definition.property` → `HAS_PROPERTY` edge exists) but NOT by the
  WI-2/WI-3 scope-resolution query (`query.ts` `APEX_SCOPE_QUERY`), which — mirroring
  `java/query.ts` node-for-node — captures `field_declaration`/`local_variable_declaration`
  but no `enum_constant`. So an enum's constants never enter the scope-resolution field
  registry; `findOwnedMember(Color, 'RED')` misses even though the static-receiver `Color`
  (Enum, class-like) resolves via Case 2. Static class fields (`Consts.MAX_SIZE`) already
  green because `field_declaration` IS captured — the residual was enum-only.
- **Change (Apex-local, `languages/apex/query.ts`):** add an `enum_constant` declaration
  capture to `APEX_SCOPE_QUERY`, tagged `@declaration.variable` (same tag as
  `field_declaration`), so each constant registers as a Property of its enclosing enum
  scope (ownerId = the enum) via the shared `propertyHook`. `findOwnedMember` then resolves
  `Color.RED` → ACCESSES. The member name is folded through the §2.2 seam (increment 3), so
  the case-varied `COLOR.BLUE`/`LEVEL.LOW` arms resolve on the same capture.
- **Justification:** one Apex-local query line; a deliberate divergence from `java/query.ts`
  (which omits enum constants from scope resolution) implementing the SDD-003 §3 committed
  fallback. No shared-code edit, no new seam (Constitution §2.1/§2.2). Diff confined to
  the four enum-constant target tests; the nested-enum `Outer.Mood.UP` form stays RED (it
  needs the mechanism-3 nested-type resolver, not this flat capture).
- **NFR-002:** peers + prior Apex **312/312 green** (Java/peer queries untouched; the new
  capture fires only on the Apex grammar).
