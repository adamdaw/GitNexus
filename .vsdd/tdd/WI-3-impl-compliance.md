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

## Increment 5 — integer/boolean literal argument-type inference (REQ-008; Apex-local)

- **Targets (red→green):** static type-name-receiver overload `Target.sf(7)` and the two
  trigger-body overload arms `AccountHandler.log(7)` → `log(Integer)` and `h.ilog(9)` →
  `ilog(Integer)`, plus the trigger fixture's scoped REQ-006 no-false-suppressed assertion
  (which was red only because those trigger overloads mis-recorded as `suppressed`).
  Suite **89 → 93 passing / 18 red of 111**.
- **Root cause (probed 2026-07-03):** `inferArgType` (`captures.ts`) was written against
  tree-sitter-java node names, but the vendored tree-sitter-sfapex grammar collapses Java's
  integer-literal variants to a single **`int`** node and boolean literals to **`boolean`**
  (grammar probe: `f(7)` → arg node `int`; `f(true)` → `boolean`). So every integer/boolean
  literal argument inferred to `''` → `@reference.parameter-types = [""]` → overload narrowing
  saw no argument type → all same-arity candidates survived → `OVERLOAD_AMBIGUOUS` suppression
  instead of an exact-type narrow. (Local-var args narrow via the arg-names channel and
  ctor-expression args via `object_creation_expression`, which is why `fLocal`/`fCtor` were
  already green — only the literal path was dead.)
- **Change (Apex-local, `languages/apex/captures.ts`):** add `case 'int'` (→ Integer) and
  `case 'boolean'` (→ Boolean) to `inferArgType`, alongside the retained-for-fidelity Java
  names (which never fire on Apex source). One switch, no control-flow change.
- **Justification:** corrects an Apex-grammar node-name mismatch in Apex-local code; no shared
  edit, no new seam. Diff confined to the integer/boolean literal-arg overload targets. Still
  red after this increment (distinct root causes, next increments): `fField` (`this.w` is a
  `field_access` arg — needs field-type inference, not a literal), `fLit` (`new Target().fLit(42)`
  — a compound constructor-expression *receiver* that must resolve cross-file), the REQ-015
  undisambiguable ctor, and the main-fixture REQ-006 (green once fLit + fField resolve).
- **NFR-002:** peers + prior Apex **312/312 green**.

## Increment 6 — `this.<field>` argument-type inference (REQ-008; Apex-local)

- **Targets (red→green):** the field-typed-argument overload `t.fField(this.w)` → `fField(Widget)`,
  and — as a consequence — the main overload fixture's REQ-006 no-false-suppressed assertion
  (red only because `fField` was mis-recording as `suppressed`). Suite **93 → 95 passing / 16 red of 111**.
- **Root cause:** the arg-names → declared-type channel (`resolveVarTypeBindings`) only extracted
  a name for bare `identifier` arguments, so `this.w` (a `field_access` node) got no name and its
  type stayed `''` → `fField`'s two Widget/Gadget overloads couldn't narrow → `OVERLOAD_AMBIGUOUS`.
  The class field `w`'s declared type (`Widget`) is ALREADY in the `varTypes` map at the class-level
  key `\0w` (from its `@type-binding.annotation`); only the arg side was missing.
- **Change (Apex-local, `languages/apex/captures.ts`):** new `argReferenceName` helper — returns a
  bare identifier's text, or `this.<field>` for a `this.`-qualified field access; used where
  `argNames` was built. In `resolveVarTypeBindings`, a `this.<field>` name resolves against the
  class-level field key `\0<field>` ONLY (never a same-named local — `this.` is explicit field
  access, so it must not be shadowed by a local of the same name).
- **Justification:** two Apex-local edits in one file; reuses the existing class-level field type
  map. No shared edit, no new seam. The `this.`-only class-level keying avoids a latent mis-bind
  (a method-local `w` shadowing the field `w`), which no fixture exercises but which the plain
  local-first lookup would have gotten wrong.
- **NFR-002:** peers + prior Apex **312/312 green**.

## Increment 7 — conservative constructor overload narrowing (REQ-015; SHARED-CODE, Architect-approved 2026-07-03)

- **Target (red→green):** `CtorAmb` — `new CtorTarget(o:Other)` where `o` matches neither
  `CtorTarget(Integer)` nor `(String)` → obligation 1 (no binding edge) + obligation 2 (a
  `suppressed` outcome named `ctortarget`). Suite **95 → 96 passing / 15 red of 111**.
- **Root cause (probed 2026-07-03):** constructor calls did NOT narrow by argument type in ANY
  language — `free-call-fallback.ts pickConstructorOrClass` selected a ctor by ARITY only
  (`narrowByArity` → else `ctors[0]`). So every same-arity `new X(...)` bound the first-declared
  constructor regardless of arg types; `new CtorTarget(7)` passed only by luck (Integer declared
  first), and `new CtorTarget(o)` MIS-BOUND to Integer (a wrong edge — worse than unresolved).
  `conservativeOverloadResolution` (Apex=true) was consulted only in member-call resolution
  (`receiver-bound-calls.ts`), never the constructor/free-call path.
- **Architect disposition (design fork, mirrors increment 2):** Adam chose **the shared-code fix**
  over an SRS limitation (2026-07-03) — CtorAmb is a mis-bind on valid Apex, and a limitation that
  leaves a false edge is weaker than a correct narrow.
- **Change (SHARED code — generic, gated, no Apex naming), `scope-resolution/passes/free-call-fallback.ts`:**
  - extracted `collectConstructors` (the ctor-collection logic) out of `pickConstructorOrClass`
    (behaviour-preserving refactor — the default arity-only path is byte-identical);
  - added `selectConstructorConservative`: narrows the class's ctors by `site.argumentTypes` via the
    shared `narrowOverloadCandidates`; a single match binds, a 0/1-ctor class binds unconditionally
    (no ambiguity), an undisambiguable multi-ctor set returns `{ unresolved }`;
  - in the constructor block, a `resolveCtorTarget` closure routes to `selectConstructorConservative`
    ONLY when `conservativeOverloadResolution === true`; on `unresolved` it records a `suppressed`
    outcome (`overload-ambiguous`) + marks the site handled + `continue`s (mirroring the existing
    implicit-this and free-call conservative-suppression blocks). Every non-conservative language
    keeps the unchanged `pickConstructorOrClass` path.
- **Justification:** additive + gated — the new argument-type narrowing and suppression fire only
  under the existing `conservativeOverloadResolution` flag (Apex-only today). Generic, no
  language-specific control flow (Constitution §2.1). Bonus correctness: multi-ctor calls with a
  typed arg now bind the RIGHT ctor (`new CtorTarget('s')` → String), not the first-declared.
- **NFR-002:** peers + prior Apex **312/312 green**; plus a broad ctor-sensitive cross-language run
  (cpp, csharp ×2, kotlin, typescript, java-1928, php, python, dart, go, ruby) **1827/1827 green** —
  the gated default path is confirmed byte-identical.
- **⚠ Owes its own §2.2 review + adversary pass** — the THIRD shared edit; batch with increments
  2 + 3 at Gate 4 (generic-seam legitimacy + no unintended peer semantics change).

## Increment 8 — `new Type()` constructor-expression receiver (REQ-008; SHARED-CODE, Architect-approved 2026-07-03)

- **Target (red→green):** `fLit` — `new Target().fLit(42)`, a compound *constructor-expression
  receiver* chained into an overloaded member call. Suite **96 → 97 passing / 14 red of 111**.
  Completes mechanism 1 (cross-file overloads) — all five arg kinds + static receiver + both ctor
  cases + both REQ-006 arms now green.
- **Root cause (probed 2026-07-03):** `compound-receiver.ts resolveCompoundReceiverClass` handled a
  trailing `()` by stripping it and treating the head as a function name, so `new Target()` reduced
  to a lookup for a function literally named `new Target` → miss → the whole `fLit` site was never
  reached (probe: NO edge, NO record). No language recognized `new X()` as a constructor expression
  in a receiver position.
- **Architect disposition (the other half of the 2026-07-03 fork):** Adam chose the shared-code fix.
- **Change (SHARED code — generic C-family, no Apex naming), `scope-resolution/passes/compound-receiver.ts`:**
  in the trailing-`)` branch, recognise a `new <Type>(...)` head (`/^new\s+(.+)$/` — the whitespace
  guard leaves an ordinary `newThing()` identifier untouched): the constructed class IS the receiver
  type, so a simple type resolves via `findClassBindingInScope` and a qualified/nested type recurses
  (splitting the dotted head). Additive — the branch only fires on a leading `new ` keyword.
- **Justification:** generic constructor-expression-receiver support (`new Foo().bar()` is C-family
  syntax); no language-specific control flow (Constitution §2.1). Pure addition — no peer fixture
  produces a `new X()` receiver text, so nothing pre-existing changes.
- **NFR-002:** peers + prior Apex **312/312 green**; broad cross-language run (cpp, csharp ×2,
  kotlin, typescript ×2, java-1928, php, python, dart, go, ruby, javascript) **1893/1893 green**.
- **⚠ Owes its own §2.2 review + adversary pass** — the FOURTH shared edit; batch with increments
  2 + 3 + 7 at Gate 4.

## Increment 9 — nested-type qualified-key injection (REQ-010/§7(5)/(13); Apex-local)

- **Target (red→green):** `resolves nested-enum constants (Outer.Mood.UP exact + OUTER.MOOD.DOWN
  case-varied)`. Suite **97 → 98 passing / 13 red of 111**. First piece of mechanism 3 (nested types).
- **Root cause (probed 2026-07-03):** `populateApexNamespaceSiblings` injected only TOP-LEVEL types
  (Predicate 2 = Module-parented Class scope), keyed by folded simple name. Nested types (`Outer.Mood`,
  `Outer.Inner`) were never registered in `workspaceFqnBindings`, so a static-type-name receiver
  `Outer.Mood` (Case 2: `findClassBindingInScope('Outer.Mood')`) missed the workspace and fell through
  to the dotted-tail fallback (which finds no bare `Mood` class). Probe confirmed nested defs carry a
  **dotted** `qualifiedName` in the parsed owned-def shape (`Outer.Mood`, `Outer.Inner`, `Outer.Helper`).
- **Change (Apex-local), `languages/apex/namespace-siblings.ts`:** in `computeApexNamespaceBindings`,
  also iterate Class-parented (nested) Class-kind scopes and inject their class-like owned defs under
  the SAME fold-of-`qualifiedName` rule. A top-level def's qualifiedName is bare (`Outer`→`outer`); a
  nested def's is dotted (`Outer.Mood`→`outer.mood`) — so the nested key is always dotted, never a
  bare key. `findClassBindingInScope` folds a dotted receiver (`Outer.Mood`→`outer.mood`) and consults
  the workspace channel BEFORE its dotted-tail decoy fallback (`walkers.ts:676` then `:320`), so the
  nested type binds and the same-tail top-level decoy is bypassed. Same inject-none collision guard.
- **Justification:** pure registration, no shared-code edit, no new seam — the §7(5)/(13) qualified-
  nested committed fallback expressed as an extension of the §3 injection universe (a bare `new Inner()`
  still misses: nested keys are dotted, so REQ-015 unresolved is preserved). Enum-constant ACCESS rides
  increment 4's `enum_constant` registration once the receiver `Outer.Mood` binds.
- **NFR-002:** Apex WI-1/WI-2 + Java peers **312/312 green** (the hook is Apex-only — registered on
  `apexScopeResolver` — so no cross-language surface is touched).

## Increment 10 — qualified nested constructor capture (REQ-010/§7(5)/(13); Apex-local)

- **Target:** the ctor half of the nested-qualified tests — `new Outer.Inner()` and its three case
  variants (`new OUTER.Inner()`, `new Outer.INNER()`, `new OUTER.INNER()`). Suite count unchanged
  (**98/111**) because every nested test also asserts a `.member` receiver call (increment 11), but
  the four ctor CALLS edges now emit (probe: `{NestedCaller,CaseNested,TailCase,DoubleCase}.cls →
  Inner @ Outer.cls`).
- **Root cause:** `query.ts` captured `object_creation_expression` only for `type_identifier` /
  `generic_type`; `new Outer.Inner()` is a `scoped_type_identifier`, so it produced NO constructor
  site (probe pre-impl: 0 CALLS). `query.ts:15` carried the stale WI-1 assumption "Apex has no
  qualified `new pkg.Foo()`".
- **Change (Apex-local), `languages/apex/query.ts`:** add a ctor capture matching
  `type: (scoped_type_identifier) @reference.name` — capturing the WHOLE scoped node so `site.name`
  is the dotted `Outer.Inner`. `resolveInheritanceBaseInScope` → `findClassBindingInScope` folds it
  (`outer.inner`) and hits the increment-9 workspace injection before the dotted-tail decoy fallback;
  the emitted edge target is the resolved def's simple name (`Inner`), verified against Outer.cls.
- **Justification:** captures + injection land TOGETHER (per the handoff diagnosis — a capture-only
  attempt regressed via the decoy fallback; increment 9's injection makes the folded workspace consult
  win first). Apex-local divergence from `java/query.ts`. No shared edit.
- **NFR-002:** Apex WI-1/WI-2 peers **126/126 green** (Java unaffected — Apex-only query).
