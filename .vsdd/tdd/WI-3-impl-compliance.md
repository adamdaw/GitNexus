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

## Increment 11 — nested-type receiver member resolution (REQ-010/§7(5)/(13); Apex-local + 1 SHARED edit, Architect-approved 2026-07-03)

- **Targets (red→green):** the six nested-qualified receiver forms — `resolves qualified nested-type
  access (Outer.Inner … i.ping())`, `CASE-VARIED (OUTER.Inner … c.ping())`, `TAIL-VARIED (Outer.INNER
  … d.ping())`, `DOUBLY-VARIED (OUTER.INNER … e.ping())`, `nested access despite a same-tail top-level
  decoy (t.tping())`, and `trigger-body nested-qualified access (Kit.Part p; p.snap())`. Suite
  **98 → 104 passing / 7 red of 111**. Completes mechanism 3 (nested types).
- **Root cause:** two gaps. (1) `query.ts` never captured a `scoped_type_identifier` DECLARED type
  (`Outer.Inner i`), so the receiver `i` had no type binding. (2) Once captured, `interpretApexTypeBinding`
  stripped the qualifier to bare `inner` — which cannot reach the nested def (bare keys are deliberately
  never injected, REQ-015). Keeping the qualifier (`outer.inner`) routes the receiver through Case 3b,
  whose compound field/return-type walk resolves field/alias chains but has NO path for a nested-TYPE
  qualified name against the injected workspace FQN.
- **Changes:**
  - **Apex-local `languages/apex/query.ts`:** capture `scoped_type_identifier` as the declared type of
    `local_variable_declaration` and `field_declaration` (mirrors the existing scoped `formal_parameter`
    capture) → the receiver gets a dotted type binding.
  - **Apex-local `languages/apex/resolution.ts`:** `interpretApexTypeBinding` KEEPS the qualifier
    (folded `outer.inner`) instead of stripping to the bare tail — the folded qualified name is the
    nested type's injected workspace key. Removed the now-unused `stripQualifier`. An external qualifier
    (`System.Account`→`system.account`) stays unresolved, the same conservative outcome as the prior
    bare-tail strip (which also never bound an external `System.*` type — WI-2 peers unaffected).
  - **⚠ SHARED `scope-resolution/passes/receiver-bound-calls.ts` (Architect-approved fork 2026-07-03):**
    Case 3b gains an additive fallback — when the compound field/return walk misses, a dotted type
    binding that names a workspace-registered FQN class resolves directly to it via
    `findClassBindingInScope(declaredAtScope, rawName)` (folds + consults the workspace channel before
    the dotted-tail decoy fallback). Fires ONLY after the walk misses and only for non-`()` rawNames;
    a language that injects no dotted workspace key under that name gets `undefined` and is unchanged.
- **Justification (fork):** the compound resolver genuinely lacks nested-TYPE-via-FQN resolution — a
  real generic capability gap, not an Apex naming concern (Constitution §2.1 clean). Adam chose the
  shared fallback over an Apex-local synthetic-typeBinding workaround (cleaner + certain vs a
  pseudo-member registration smell). The receiver variable's type binding SHOULD resolve to the class
  its FQN names; this makes it so, generically.
- **NFR-002:** Apex WI-1/WI-2 peers **312/312**; the **full cross-language resolver suite** (52 files —
  cpp, csharp ×2, java ×2, kotlin, ts ×5, php ×3, python ×3, dart ×2, go, ruby ×3, rust ×4, swift, vue
  ×2, cobol ×3, c ×2, javascript, express/laravel/fastapi/nuxt route + shape suites) **2979/2986 pass**
  — the only 7 failures are the remaining WI-3 heritage/interface/trigger pins in
  `apex-cross-file.test.ts`; every non-Apex file passes (byte-identical peer semantics confirmed). (Two
  unrelated unit failures — `git.test.ts`, `sibling-clone-drift.test.ts` — are sandbox git/clone infra,
  causally independent of a resolution-pass edit.)
- **⚠ Owes its own §2.2 review + adversary pass — the FIFTH shared edit; batch with increments 2, 3,
  7, 8 at Gate 4** (generic-seam legitimacy + no unintended peer semantics change).

## Increment 12 — interface-dispatch opt-out for Apex (REQ-010/§3 Interface arm; SHARED-CODE, Architect-approved 2026-07-03)

- **Target (red→green):** `resolves DECLARATION-ONLY interface-typed variables — BOTH Iface v; v.act()
  AND case-varied IFACE w; w.act() to Iface.act`. Suite **104 → 105 passing / 6 red of 111**.
- **Root cause:** the generic `emitInterfaceDispatchFor` (`receiver-bound-calls.ts:208`, called at
  `:1205` after a Case-4 primary edge to an Interface method) emits a SECONDARY `interface-dispatch`
  CALLS edge to every implementer's same-named method. `Derived implements Iface`, so `v.act()`/`w.act()`
  each produced a primary edge (→Iface.act) AND a secondary (→Derived.act) — 4 edges where §3 wants 2,
  each targeting the interface's OWN member (a declaration-only interface var has no known runtime type).
- **Change (SHARED code — generic, no Apex naming):**
  - `contract/scope-resolver.ts`: new optional `emitInterfaceDispatch?: boolean` (default = on).
  - `receiver-bound-calls.ts`: gate the `emitInterfaceDispatchFor` call on `provider.emitInterfaceDispatch
    !== false`; add the field to the consumed `ReceiverBoundProviderSubset` Pick.
  - `languages/apex/scope-resolver.ts`: `emitInterfaceDispatch: false`.
- **Justification (fork, Architect-approved):** additive + gated on a new default-on toggle — every other
  language leaves it undefined (dispatch stays ON), so peer behaviour is byte-identical. The Apex opt-out
  encodes a real graph-convention difference (SDD-003 §3), not an Apex-named branch (Constitution §2.1).
- **NFR-002:** Apex peers **312/312**; **full cross-language resolver suite 2980/2986** (only the 6
  remaining WI-3 pins fail; all 51 non-Apex files pass — the default-on gate is peer-clean).
- **⚠ Owes its own §2.2 review + adversary pass — the SIXTH shared edit; batch with increments 2, 3, 7,
  8, 11 at Gate 4.**

## Increment 13 — test-defect corrections (#809 twin-ctor case predicate, #1019 trigger-ctor count) — TEST-ONLY, Phase-5 → Gate 3

Not an implementation increment: two Gate-3 acceptance tests asserted the wrong observable and
were RED against a *correct* implementation. Architect-ruled test defects (Adam, 2026-07-03,
"Confirm — correct the tests"); the fix corrects the tests, not the resolver. Suite **105 → 107
passing / 4 red of 111**; peers untouched (test-only). Probe-verified impl correctness before
editing (throwaway `apex-probe.scratch.test.ts`, deleted).

- **#809 (`resolves the CASE-VARIANT trigger/class twin to the CLASS, never the trigger`):** the
  class is declared `TWIST`, so its ctor edge target is the node name `'TWIST'`; the source wrote
  `new Twist()`. The finder used `e.target === 'Twist'` — a **case-sensitive predicate on a
  case-insensitive language**, so it missed the class-cased node and failed while the impl was
  correct (probe: `new Twist()` → `TWIST @ TWIST.cls`, never the trigger; turn/buzz likewise).
  Fix: fold case in the predicate (`e.target.toLowerCase() === 'twist'`). Test-only.
- **#1019 (`resolves a trigger-body CASE-VARIED constructor`):** asserted `>= 2` ctor edges from
  the trigger to `AccountHandler` (exact-case + case-varied). A trigger is a **single container
  node T**, so two ctors to one class collapse to one edge (the I2 `(caller,target)` invariant) —
  the assertion is *structurally unsatisfiable*, not merely wrong-valued (probe: exactly one
  collapsed `rel:CALLS:…T->…AccountHandler`, no per-site metadata). No peer suite asserts `>=2`
  collapsed edges; peers keep each ctor site observable by isolating it in a distinct caller
  (`cpp.test.ts:4499` `callsFrom('call_defaulted_constructor','Gadget')` → `toHaveLength(1)`) — and
  a trigger body cannot have distinct callers. Fix (Architect chose "distinct-target fixture"):
  add `BaseHandler bh = new BASEHANDLER();` to `T.trigger` (case-varied ctor → a **distinct**
  class), assert `toHaveLength(1)` on the trigger→BaseHandler edge — the peer idiom, and the
  case-varied ctor's folded-path resolution in trigger scope is now independently observable.
  Probe-verified the distinct-target ctor **resolves** (1 edge → BaseHandler.cls, source T) before
  committing — i.e. a genuine test defect, not a masked build gap.
- **Changed files:** `test/integration/resolvers/apex-cross-file.test.ts` (two tests),
  `test/fixtures/lang-resolution/apex-cross-file-trigger/T.trigger` (one distinct-target ctor line).
- **⚠ Phase-5 cascade:** both tests were cleared at Gate 3 (`gate3-wi3.md`); correcting them
  partially supersedes that record. Batch the Gate-3 re-attestation with the #223/#233 ratify
  (which also edits the suite) — record once when the heritage rulings land.

## Increment 14 — #223/#233 super-arm ratify (Phase-5, SRS v1.12) — SPEC + TEST, NO impl change

Not an implementation increment: the impl already resolves `super()`/`super.greet()` → **Base** (the
inc-3 identifier-fold gave the `super`-receiver synthesis independent cross-file reach); the ratified
spec pinned the *old* super()-unresolved / super.method()-self-loop behaviour it labelled "documented,
NOT correct." Architect ruled **Phase-5 ratify →Base** (Adam, 2026-07-03) — a *requirement correction*
(the v1.11(a) pin over-constrained a behaviour the host resolves correctly), the VSDD revise-the-SRS
route, NOT a shipped limitation. Suite **107 → 109 passing / 2 red of 111**; peers untouched.

- **Probe-confirmed shape (throwaway test, deleted):** from `CaseKid.cls`, exactly two CALLS —
  `Base` → `Constructor:Base.cls:Base.Base#0` (super ctor) and `greet` → `Method:Base.cls:Base.greet#0`
  (super.greet → **Base**, not the CaseKid override). No EXTENDS edge from CaseKid (the v1.8(i)
  case-varied heritage-edge limitation is unchanged — pin 244 stays green). So the graph carries
  `super`-sourced CALLS into Base **without** an EXTENDS edge to it: the `super`-receiver synthesis and
  the MRO/heritage pre-pass have **independent** cross-file reach. CaseKid's implicit-this `inherited()`
  (MRO path) stays unresolved (pin 212 green) — the MRO lacks the parent.
- **Scope:** the ratify is scoped to the **v1.8(i) case-varied shape** the tests exercise; the
  v1.10(iii) nested-parent and v1.10(v) same-case-twin shapes are **not re-probed** and remain pinned.
- **Changed artifacts:** `SRS.md` (new **v1.12** amendment superseding v1.11(a)'s super sub-clause),
  `SDD.md` (Edge-Case-Catalog heritage-downstream entry + §8 acceptance pin → v1.12), tests 223/233
  (`apex-cross-file.test.ts`) flipped to assert the Base targets.
- **⚠ Phase-5 cascade (load-bearing):** changed **SRS** → invalidates SDD/test/impl/proof records
  (Gates 2–5) **for the touched pin**; changed **tests** (incs 13 + 14) → invalidates the Gate-3
  record. Re-arm order: **Gate 1** (SRS v1.12 vs Intent, cold) → **Gate 2** (SDD vs SRS v1.12, cold) →
  **Gate 3** (tests vs spec, cold `vsdd-test-validator`, covering incs 13 + 14) → Gate 4 fidelity picks
  up impl-vs-v1.12. The re-reviews are localised (one pin) but **not skipped** — each re-cleared record
  is re-committed. Impl is UNCHANGED by this increment, so no Gate-5 re-fuzz owed *from this edit*.

## Increment 15 — implicit-`this` inherited-member MRO walk (#185; REQ-005/007) — SHARED-CODE, gated (7th shared edit)

- **Target (red→green):** `resolves an implicit-this inherited member (inherited() inside Child) to the
  cross-file parent (REQ-005/007)`. Suite **109 → 110 passing / 1 red of 111** (only #740, the pending
  poisoned-MRO tripwire, remains).
- **Root cause:** `free-call-fallback.ts resolveImplicitThisCall` looked up only the enclosing class's
  OWN methods (`lookupAllByOwner(classDefId, name)`), no MRO walk — so an unqualified call to an
  INHERITED member (`inherited()` inside `Child extends Base`, Base in another file) returned
  unresolved. The typed-receiver form (`c.inherited()`) already resolved (Case 4 walks the chain);
  only the implicit-`this` form was the gap.
- **Change (SHARED code — generic, no Apex naming), GATED default-off:**
  - `contract/scope-resolver.ts`: new optional `resolveInheritedImplicitThisCall?: boolean` (default
    off = current own-class-only behaviour).
  - `free-call-fallback.ts`: when the flag is on, `resolveImplicitThisCall` walks
    `[classDefId, ...methodDispatch.mroFor(classDefId)]` most-derived-first (first owner declaring the
    name supplies the overload set — a subclass override shadows); else own-class-only (unchanged).
    Threaded through the options type + both call sites + the exported `pickImplicitThisOverload` hookCtx.
  - `pipeline/run.ts`: thread `provider.resolveInheritedImplicitThisCall` into the free-call options.
  - `languages/apex/scope-resolver.ts`: `resolveInheritedImplicitThisCall: true`.
- **Why gated (empirically forced):** the FIRST cut walked the MRO unconditionally and **regressed C++**
  — `cpp.test.ts:3770` (`unqualified f() inside Derived<T>::g() does NOT bind to a dependent base`): C++
  two-phase lookup forbids an unqualified name in a template body binding to a dependent base, so the
  unconditional walk over-connected (full suite 2983/2986, 2 cpp reds). Gating default-off restores
  byte-identical peer behaviour (every non-Apex resolver uses the own-class-only path); Apex opts in
  (ordinary single inheritance, no dependent-base rule to guard). Established toggle pattern (incs 8,
  12) — a real generic capability gap surfaced by an Apex fixture, fixed generically + gated, not an
  Apex-named branch (Constitution §2.1 clean).
- **NFR-002:** Apex peers 312/312; cpp reverted to green (432-test apex+cpp run: 431/432, sole red =
  the pending #740 tripwire). Full cross-language resolver suite (52 files): **2985/2986 — 51 files
  pass, the sole red is the pending #740 tripwire in `apex-cross-file.test.ts`**; every non-Apex file
  (incl. cpp, post-gate) passes → the gated edit is byte-identical for peers. **⚠ SEVENTH shared edit —
  owes §2.2 review + adversary at Gate 4; batch with incs 2, 3, 7, 8, 11, 12.**

## Increment 16 — #740 poisoned-MRO tripwire RATIFY (Phase-5, SRS v1.13) — SPEC + TEST + LEDGER, NO impl change

Not an implementation increment: the v1.11(b) tripwire FIRED at Step 3b exactly as the spec designed
it to (`red → escalate for targeted ratification, never absorb`). Architect ruled **ratify + commit the
fix to WI-4** (Adam, 2026-07-04, after a fix-feasibility investigation). Suite **110 → 111 passing / 0
red of 111** — WI-3 Step 3b is GREEN. Peers untouched (no impl change).

- **Fix-feasibility investigation (why ratify, recorded per the escalation):** the mis-bind is
  `TailSub extends TOuter.TInner` → the top-level decoy `TInner.cls` (probe: `EXTENDS TailSub → TInner.cls`;
  `CALLS decoy2 → TInner.cls:TInner.decoy2` from `TailMro`, a TYPED-receiver Case-4 walk — pre-existing,
  NOT from inc 15). The mismatch signal (written `site.rawQualifiedName` = `TOuter.TInner` vs resolved
  `targetDef` FQN = `TInner`) is detectable ONLY at the binding site `preEmitInheritanceEdges`
  (`pipeline/run.ts:172`). But the poison manifests two layers downstream in `buildMro` (`mro.ts:49`,
  builds the MRO purely from graph `EXTENDS` edges — no clause text) → Case-4's member walk, neither of
  which can see the signal. A fix must therefore propagate a NEW signal (edge property or a threaded
  poison-set) into `buildMro`, must KEEP the false EXTENDS edge (pin 767 requires it) yet EXCLUDE that
  parent from the MRO — a new inconsistency (edge absent from its own MRO) — and needs gating (C++ two-phase
  lookup just proved "generic-safe" MRO changes aren't; inc 15). = an 8th gated shared edit trading one
  inconsistency for another, for a triple-narrow pathological shape.
- **Ruling — RATIFY (internally consistent):** pin 767 already ratifies `TailSub EXTENDS the decoy TInner`;
  a graph that pins that edge and then resolves the decoy's members through it is self-consistent. The
  emitted `decoy2` edge is a bounded documented false edge. Not a shipped derivation-fidelity gap — a
  **de-scope via SRS amendment** (SRS v1.13), the legitimate route, with a **committed** fix owner.
- **Committed fix path (Architect, Adam 2026-07-04):** the generic **pipeline reorder** (heritage resolved
  AFTER the WI-3 cross-file registration so `TOuter.TInner` binds the real nested type) is promoted from a
  *noted candidate* to a **committed WI-4 deliverable** — recorded in `work-items.md` ITEM-004. So the
  limitation is temporary-until-WI-4 by construction, not open-ended.
- **Changed artifacts:** `SRS.md` (v1.13 amendment), `SDD.md` (Edge-Case-Catalog tripwire entry + §8
  acceptance pin → ratified/v1.13), test 740 (`apex-cross-file.test.ts`, flipped to expect the decoy2 edge
  into `TInner.cls`), `work-items.md` (ITEM-004 committed reorder + limitation link).
- **⚠ Phase-5 cascade:** changed SRS/SDD (this pin) + tests → re-arm Gates 1 → 2 → 3 for the touched pin
  (batch with incs 13 + 14's Gate-3 re-attestation). Impl UNCHANGED → no Gate-5 re-fuzz from this edit.
