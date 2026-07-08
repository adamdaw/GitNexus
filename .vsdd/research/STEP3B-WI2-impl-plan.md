# WI-2 Step 3b — Minimal Apex resolution adapter: implementation blueprint

*Captured 2026-06-30 (Architect-approved minimal-adapter approach). Drives the
red→green of the 19 integration anchors in `apex-resolution.test.ts`. The 7 unit
anchors are already green (commit `c699efef`: provider `normalizeIdentifier` +
`normalizeApexParamType`). All file refs are in `gitnexus/` unless noted.*

## Two orienting facts
1. Apex has **no** scope-resolution wiring yet — `apexProvider` sets parse-side
   extractors only (no `callExtractor`, no Ring-3 hooks, not in `SCOPE_RESOLVERS`).
2. The **scope-resolution query is a SEPARATE string** from the parse query.
   Java carries both: `JAVA_QUERIES` (parse) + `JAVA_SCOPE_QUERY` (`java/query.ts:32-269`).
   `APEX_QUERIES` today is parse-only; add `APEX_SCOPE_QUERY`.

## Capture vocabulary (consumed in `scope-resolution/scope/scope-extractor.ts`)
Prefixes (~264-268): `@scope.` `@declaration.` `@import.` `@type-binding.` `@reference.`
Reference kinds (~1046-1071): `call` `read` `write` `type-reference` `inherits`.
Call forms (~1080-1091): `@reference.call.{free,member,constructor,index}`.
Captures Apex needs (mirror `java/query.ts`):
- `(method_invocation object:(_) @reference.receiver name:(identifier) @reference.name) @reference.call.member`
- `(method_invocation name:(identifier) @reference.name) @reference.call.free`
- `(object_creation_expression type:(type_identifier) @reference.name) @reference.call.constructor`
- `(field_access object:(_) @reference.receiver field:(identifier) @reference.name) @reference.read.member`
- write variant via `assignment_expression left:(field_access …) @reference.write.member`
- `@type-binding.name`/`@type-binding.type` on `formal_parameter`, `local_variable_declaration`, `field_declaration`
- scopes: `@scope.module` (root), `@scope.class`, `@scope.function`; declarations `@declaration.*`
- **extends/implements**: NOT in the query — synthesized in `captures.ts`. Copy
  `synthesizeJavaInheritanceReferences` (`java/captures.ts:355-408`): reads
  `class_declaration` `superclass:`/`interfaces:` (+ `interface_declaration extends_interfaces`),
  emits `@reference.inherits` + `@reference.name`. EXTENDS-vs-IMPLEMENTS decided downstream by target kind.
- **Skip `explicit_constructor_invocation` (this()/super()) capture in v1** — `isSuperReceiver`
  handles the super branch; ctor-chain edge is low-value. (Affects the delegation anchor — see Risks.)

## New Apex files (mirror the cited peer)
- `languages/apex/query.ts` — `APEX_SCOPE_QUERY` from `JAVA_SCOPE_QUERY`, trimmed to the rows above.
- `languages/apex/captures.ts` — `emitApexScopeCaptures` + `synthesizeApexInheritanceReferences` (copy java/captures.ts:355-408).
- `languages/apex/resolution.ts` — `interpretApexTypeBinding`, `apexBindingScopeFor`, `apexMergeBindings`, `apexArityCompatibility`, `apexReceiverBinding` (copy java/index.ts equivalents). **`interpretApexTypeBinding` folds the type name to lower-case before storing** (Apex-local class-name case-insensitivity — see Seam ceiling).
- `languages/apex/call-config.ts` — `apexCallConfig = { language: Apex, typeAsReceiverHeuristic: true }`.
- `languages/apex/scope-resolver.ts` — `apexScopeResolver`, the 9 required fields:
  `language, languageProvider(apexProvider), importEdgeReason('apex-scope: import'),
  resolveImportTarget(()=>null), mergeBindings([...e,...i]), arityCompatibility(apexArityCompatibility),
  buildMro(buildMro+defaultLinearize; interface default-methods → copy buildKotlinMro if needed),
  populateOwners(populateClassOwnedMembers), isSuperReceiver(t=>t.trim()==='super')`;
  set `fieldFallbackOnMethodLookup:false`, `propagatesReturnTypesAcrossImports:false`. Omit everything else.

## Apex-own edits (no shared change)
- `type-config.ts` — replace no-op `extractDeclaration`/`extractParameter` with the JVM bodies
  (`type-extractors/jvm.ts:33-52` extractJavaDeclaration; `:78-98` extractJavaParameter; import
  `extractSimpleTypeName` from `type-extractors/shared.ts`). Optional `extractInitializer`
  (jvm.ts:55-75) only if `Account a = new Account()` must type-bind `a` from the ctor — add if a
  constructor-inferred-binding anchor needs it.
- `index.ts` — add `callExtractor: createCallExtractor(apexCallConfig)` + Ring-3 hooks Java sets
  (`java.ts:124-137`): `emitScopeCaptures, interpretTypeBinding, bindingScopeFor, mergeBindings,
  receiverBinding, arityCompatibility, resolveImportTarget`.

## Shared seam edits (the normalizer fold)
- `model/semantic-model.ts:177` — `createSemanticModel(resolveNormalizer?: (filePath)=>(s)=>string)`;
  pass into `createRegistrationTable({types,methods,fields,resolveNormalizer})`.
- `model/registration-table.ts:266-302` — add `resolveNormalizer?` to `RegistrationTableDeps`;
  `const fold=(def,s)=>resolveNormalizer?resolveNormalizer(def.filePath)(s):s`; fold `name` (+ qualified
  key) in classLikeHook/methodHook/propertyHook. Only the NAME segment of `ownerId\0name` folds.
- `pipeline-phases/parse-impl.ts:399` — `createSemanticModel((fp)=>{const l=getLanguageFromFilename(fp);
  const n=l?getProvider(l).normalizeIdentifier:undefined; return n??((s)=>s);})`. Both accessors in scope.
- `scope-resolution/passes/receiver-bound-calls.ts` — add `'languageProvider'` to
  `ReceiverBoundProviderSubset` (~81-96); fold `memberName` ONCE at ~260
  (`provider.languageProvider.normalizeIdentifier?.(site.name) ?? site.name`). `pickOverload`/`findOwnedMember`
  inherit it (lookupAllByOwner/lookupFieldByOwner at ~1302-1314). Optionally fold free-call name in
  free-call-fallback for `system.debug` vs `System.debug`.
- `scope-resolution/pipeline/registry.ts` — add `[SupportedLanguages.Apex, apexScopeResolver]`.

## Seam ceiling (minimal v1 — Architect-approved)
- **Member names (method/field): folded** at register (registration-table) + lookup (receiver-bound-calls). Covers `acc.NAME`→`name`, `s.RUN()`→`run`, case-collision ambiguity.
- **Class/type names: folded Apex-locally** in `interpretApexTypeBinding` (fold the type name before
  storing the binding) + the registration-table classLikeHook fold (class registers under folded name).
  Covers `ACCOUNT a`, `new account()` → class `Account`. No shared-keyspace edit.
- **Receiver VARIABLE names (e.g. `Account acc; ACC.foo()`): DEFERRED.** `findReceiverTypeBinding`
  (`walkers.ts:183-212`) is provider-less; folding var names needs threading through it + scope-extractor
  finalize — wide edit. None of the current fixtures use case-varied *variable* names (they vary class +
  member names only), so v1 doesn't need it. Mark deferral with a `// ponytail:` comment.

## Risks / open checks during build
1. **Delegation anchor** (`this()`/`super()`/`super.greet()` → Base): skipping the
   `explicit_constructor_invocation` capture means `this()`/`super()` ctor edges won't emit. `super.greet()`
   is a `method_invocation` with `super` receiver → should resolve via `isSuperReceiver`. RE-CHECK the
   delegation anchor; if it needs the ctor-chain edge, add the `explicit_constructor_invocation` capture.
2. **Type-usage USES edge** (`ACCOUNT a;`): confirm the `@type-binding`/`@reference.type` path emits a USES
   edge to the class, folded. If type references resolve via the provider-less class-name keyspace, the
   `interpretApexTypeBinding` fold + classLikeHook fold must align the keys.
3. **Cyclic chain / forward ref / bounded termination** — host fixpoint; should be free once resolution runs.
4. Build via `node scripts/build.js` before integration (worker uses dist). Peers must stay green (NFR-002).

## Sequence
type-config → call-config → query → captures → resolution hooks → scope-resolver → register →
wire index.ts → seam (semantic-model, registration-table, parse-impl, receiver-bound-calls) →
build → run apex-resolution.test.ts → iterate → peers green.
