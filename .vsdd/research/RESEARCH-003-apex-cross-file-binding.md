# RESEARCH-003 — Apex cross-file binding feasibility

*§A.6 Research artifact. Phase 2b host-API spike for **WI-3 (ITEM-003, cross-file & trigger resolution)**.
Resolves the WI-3-defining unknown — how Apex's import-less implicit namespace (every top-level
user-defined type globally visible by simple name) reaches across files in GitNexus's resolution stack —
before SDD-003 commits the design. Settles epic-SRS assumption **A-3**.*

> **§A.6 calibration note.** §A.6 is written for *verification-tooling* (Prove-property) uncertainty. WI-3
> has no Prove-classified properties (resolution guards no security/financial/data-integrity invariant —
> same calibration as WI-1/WI-2). The uncertainty that objectively triggers a spike is a **host-API design**
> unknown: SRS-001 **A-3** ("Apex's implicit namespace can be modelled with the host's existing cross-file /
> whole-module import synthesis; *if wrong, REQ-010 needs a new mechanism*"). Per dogfood #13 an
> evidence-isolated Gate-2 adversary cannot validate a host-API design choice, and per dogfood #19 a
> host-API-heavy WI needs the §A.6 spike up front — so the seam feasibility is settled empirically before
> SDD-003 pins it. Authored against the §A.6 field structure with *host resolution API* for *verifier*.

| Field | Value |
|---|---|
| **RESEARCH-003** | How Apex resolves references between user-defined symbols in **different files** with no explicit import (REQ-010), and how a non-class top-level container (a trigger) resolves references from its body (REQ-011), in GitNexus's resolution stack. |
| **Question** | Apex has **no import statements and no packages**: each top-level user-defined type is its own file (filename = type name) and is visible **globally by its simple name** across the analysed repository. The host's default type/member resolution expects either an explicit import or a scope-chain hit. WI-2 set `resolveImportTarget: () => null` and verified resolution only within a **single declaration unit**. **Can the host make every top-level Apex type globally visible by simple name with an existing seam (A-3 holds), or does REQ-010 need a new mechanism? And does a trigger body resolve through the same machinery (REQ-011), or does a non-class container need its own handling?** Both must hold without naming Apex in shared code (Constitution §2.1). |
| **Method** | Trace the actual scope-resolution pipeline phase order and the name-lookup surfaces in the host stack (a structural/seam question — "is there a host hook that injects cross-file visibility, and is it consulted by the lookup the WI-2 mechanics already use?" — settled by reading host code, per dogfood #13's structural-vs-behavioural split). Verified against primary source (not a secondary summary). |

## Findings (each cited; structural facts, verified against `gitnexus/src/core/ingestion/`)

1. **The pipeline is finalize → (cross-file hooks) → resolve → emit, in that order.**
   `scope-resolution/pipeline/run.ts`: `finalizeScopeModel(...)` (`run.ts:562`) builds the indexes; then the
   optional cross-file hooks run — `provider.emitImplicitImportEdges?.(...)` (`run.ts:584`) and
   `provider.populateNamespaceSiblings?.(...)` (`run.ts:636`); **then** `resolveReferenceSites({...})`
   (`run.ts:683`) resolves references. So a cross-file hook that populates bindings at 584/636 is visible to
   reference resolution at 683.
2. **The host has TWO seams for import-less cross-file visibility, both per-language, both optional:**
   - **Seam A — `emitImplicitImportEdges`** (contract `scope-resolution/contract/scope-resolver.ts:515`):
     materializes synthetic File→File `IMPORTS` edges for compiler-implicit visibility (e.g. header/module
     visibility), feeding the import-graph machinery.
   - **Seam B — `populateNamespaceSiblings`** (contract `scope-resolver.ts:902`): runs after finalize
     (`run.ts:636`), directly injects cross-file bindings into the global registry **without** emitting any
     edge.
3. **The global registry the seam writes IS consulted by the same lookup the WI-2 mechanics use.**
   `ScopeResolutionIndexes.workspaceFqnBindings` is read unconditionally by `lookupBindingsAt` —
   `scope/walkers.ts:63` (`const workspace = scopes.workspaceFqnBindings?.get(name)`), the same
   `lookupBindingsAt` WI-2's receiver-typing/member lookups already flow through. So once a type is in
   `workspaceFqnBindings` by simple name, the existing WI-2 mechanics reach it cross-file with no new lookup
   path.
4. **Broad, proven precedent — five languages register Seam B.** `csharp`, `java`, `go`, `php`, `swift`
   each register `populateNamespaceSiblings` on their resolver. C#'s `populateCsharpNamespaceSiblings`
   (`languages/csharp/scope-resolver.ts:78`) writes `workspaceFqnBindings`
   (`languages/csharp/namespace-siblings.ts:639`). **Java uses Seam B for same-package no-import
   visibility** — the closest analog to Apex's global namespace (a Java type in the same package resolves
   with no `import`; an Apex top-level type resolves with no anything).
5. **What scopes WI-2 to one file today is precisely the *absence* of a cross-file hook.** With
   `resolveImportTarget: () => null` and **no** `populateNamespaceSiblings`/`emitImplicitImportEdges`, the
   finalize pass sees no imports and no implicit-visibility injection, so `workspaceFqnBindings` stays empty
   for Apex and a cross-file reference hits only local scopes → unresolved. (The WI-2 acceptance suite pins
   exactly this: `apex-resolution.test.ts:317-320` asserts a cross-file `new Broken()` is unresolved "in
   WI-2 — the cross-file enabler is WI-3".) The lookup machinery is already global-aware; the gap is only
   the unset hook.
6. **Triggers are already container scopes, but were explicitly excluded from WI-2's receiver-binding.**
   WI-1 captures `trigger_declaration` as a class-like container (`languages/apex/class-config.ts`,
   `apexConstruct: 'trigger'` discriminant) and the scope query tags it `@scope.class`
   (`languages/apex/query.ts:41,56`). WI-2's `receiver-binding.ts:17-24` **intentionally excludes** triggers
   from `this`/`super` synthesis ("they declare no methods … trigger-body resolution is WI-3 (REQ-011)").

## Conclusion

- **A-3 HOLDS. REQ-010 needs NO new host mechanism — it is registration of an existing seam.** Apex
  registers **Seam B (`populateNamespaceSiblings`)** (Architect-approved 2026-06-30) to inject every
  top-level user-defined type into `workspaceFqnBindings`, keyed by its **`normalizeIdentifier`-folded
  simple name** (so the §2.2 case-insensitivity seam composes — a cross-file `ACCOUNT`/`account` reference
  folds to the same global key). Then **every WI-2 mechanic reaches across files unchanged**, through the
  `lookupBindingsAt` global-registry consultation that already runs (finding 3). This completes the
  inherently-cross-file epic §9 forms WI-2 verified only in-unit: two-class calls (REQ-005), cross-file
  field/property chains (REQ-009), and **top-level `extends`/`implements`** (REQ-007 — every top-level Apex
  type is its own file). Seam B over Seam A: Apex has no imports, so synthetic `IMPORTS` edges (Seam A) would
  be beyond-parity graph noise; Java models the identical no-import situation with Seam B. **Names no
  language; configured by the isolated provider; identity-transparent for peers (Constitution §2.2,
  NFR-002).**
- **Seam surface (REQ-010):** one new `populateNamespaceSiblings` hook on the Apex resolver (+ its
  registration), ~1 small function: iterate `parsedFiles`' top-level user-defined type defs, fold the simple
  name, get-or-create the `workspaceFqnBindings` bucket, push the binding (dedup by nodeId). No shared-code
  edit. Mirrors `languages/csharp/namespace-siblings.ts` / the Java same-package path.

## Residual Gate-3 reliances (finding #13 — do NOT pin these at Gate 2)

The **seam feasibility** is settled (structural, read-verified). The **resolution behaviour once the seam
runs** is a host-API obligation to validate at Gate 3 (tests vs the real host), NOT a Gate-2 pin:
- that injecting top-level types into `workspaceFqnBindings` actually makes each WI-2 mechanic resolve
  end-to-end **across files** (two-class call, cross-file chain, top-level `extends`/`implements`/`super`),
  with the case-fold composing on the global key;
- that the global registry's precedence does not mis-rank a cross-file binding against a same-unit one
  (`lookupBindingsAt` ranks local/lexical above `workspaceFqnBindings` — finding 3 — which is the desired
  shadowing, but the exact behaviour is host-confirmed at Gate 3);
- **(REQ-011, the real WI-3 design risk)** that a **trigger body** resolves references through the same
  machinery. A trigger declares no methods (no `this`/`super` receiver — finding 6), and a trigger-body call
  on a user-defined handler is typically a **static-style call on a type name** (`MyHandler.handle()` /
  `new MyHandler().handle()`) rather than a typed-variable receiver. Whether the host resolves a
  type-name-receiver call from a non-class container scope, or whether REQ-011 needs a small trigger-scope
  addition (e.g. a receiver-binding/scope-capture path for triggers), is **left to Gate-3 discovery** — SDD-003
  treats trigger-body resolution as a design obligation with concrete acceptance fixtures, NOT as free fallout
  of REQ-010.

## Impact if wrong

If Seam B's global injection mis-keys (fold asymmetry vs the §2.2 seam, or wrong def set) cross-file
references silently fail to resolve — caught by Gate-3 cross-file fixtures, fixed-only. If REQ-011's trigger
path needs more than REQ-010 supplies, the Gate-3 trigger fixture goes red and the addition is scoped then.
No security/data risk: resolution is conservative (a miss is an unresolved reference, never a mis-binding —
REQ-015/006); cross-file does not relax that.

## Addendum (2026-06-30) — trigger-body capture grammar probe (REQ-011, structural)

Settles whether an Apex **trigger body** parses to the same reference node types as a class body — a
read-verifiable grammar fact (the same class RESEARCH-001 settled for class bodies), NOT a host runtime
behaviour. Probe: `emitApexScopeCaptures` over

```apex
trigger AccountTrigger on Account (before insert) {
  AccountHandler.handle(Trigger.new);
  AccountHandler h = new AccountHandler();
  String n = h.name;
}
```

emitted, from inside the trigger body:
- `AccountHandler.handle(...)` → `@reference.call.member` (receiver `AccountHandler`, name `handle`, arity,
  parameter-types) — a `method_invocation`;
- `new AccountHandler()` → `@reference.call.constructor` (name `AccountHandler`) — an
  `object_creation_expression`;
- `h.name` → `@reference.read.member` (receiver `h`, name `name`) — a `field_access`.

**Conclusion:** a trigger body parses to the same `method_invocation` / `object_creation_expression` /
`field_access` node types as a class body, and the WI-2 reference query patterns (which are **unanchored** —
not scoped to a `class_body`) fire on them tree-wide. **Trigger-body reference *capture* is therefore a
confirmed [structural] fact** (SDD-003 §2 REQ-011), not a Gate-3 reliance. The remaining REQ-011 risk shrinks
to the **resolution** of the static type-name receiver (`AccountHandler` typing to the class so `handle`
resolves) — that, and the edge's source node, stay [Gate-3 reliance]. (Probe was a throwaway; not committed.)

## Addendum (2026-06-30) — top-level-vs-nested discriminant (`qualifiedName` shape)

Backs SDD-003 §3's [structural] injection discriminant (a Gate-2 structural pin must be read-verifiable
against admitted evidence, not just asserted). Verified against the host source:

- **WI-1 keys nested types by a qualified name.** The Apex class-config **enables `qualifiedNodeId`** so that
  a **nested** type resolves to a qualified id and its `qualifiedName` is `Outer.Inner`
  (`languages/apex/class-config.ts:4-5,26`, "REQ-002 models nested-type membership by qualified id; nested
  types are keyed `Outer.Inner`").
- **A top-level type's `qualifiedName` is bare.** `SymbolTable.add` sets, for class-like labels,
  `qualifiedName = metadata.qualifiedName ?? name` (`model/symbol-table.ts:263-264`); a top-level type has no
  enclosing segment, so its `qualifiedName` is the bare simple name (`Account`).
- **The iteration source.** The hook iterates each `ParsedFile.localDefs` — declared
  `readonly localDefs: readonly SymbolDefinition[]` (`gitnexus-shared/.../scope-resolution/parsed-file.ts:75`)
  — so each iterated def is a `SymbolDefinition` carrying `label`, `qualifiedName`, and `filePath`
  (`model/symbol-table.ts:130-133, 268`), the discriminant fields. (This is what the C# precedent reads via
  `parsed.scopes`/`ownedDefs`, the same `SymbolDefinition` shape.)

**Conclusion:** "top-level vs nested" is a **read-verifiable [structural]** fact — a def is top-level **iff
its `qualifiedName` contains no `.` separator**. This is totally decidable from the `qualifiedName` field,
with **no `ownerId`-stamping subtlety and no host-pass-ordering dependency** (it supersedes the earlier
`ownerId` approach), and it reliably excludes nested types from bare-name global injection. Triggers (also
bare `qualifiedName`) are excluded separately by `filePath` ending `.trigger` (`SymbolDefinition.filePath`,
`symbol-table.ts:268`).

**Shared-registry structure (backs the cross-language NFR-002 reliance).** `ScopeResolutionIndexes`
declares `workspaceFqnBindings: ReadonlyMap<string, readonly BindingRef[]>` — a single **flat map shared
across all languages**, keyed by name with the documented design assumption that per-language key formats
"never collide" (`model/scope-resolution-indexes.ts:85-90`). This is the structural basis for SDD-003 §7(8):
Apex is the first language to inject lower-cased simple-name keys into it, so whether the host lookup is
language-scoped (preventing a peer reference from retrieving an Apex key, and vice-versa) is the
Architect-accepted Gate-3 reliance.

## Status

**Spike complete. A-3 confirmed. Recommendation: SDD-003 pins Seam B (`populateNamespaceSiblings`) as the
REQ-010 cross-file enabler, with the folded global-key injection, and treats REQ-011 trigger-body resolution
as a Gate-3-validated design obligation (not assumed-free).** Architect approval of the seam (Seam B) granted
2026-06-30; this artifact records the verified basis. Architect approval of this conclusion + the SDD-003
purity boundary gates Gate 2.

## Addendum 4 (2026-07-02) — workspace fallback channel: pre-hook cross-file resolution (objective probe)

**Method.** The WI-3 Step-3a suite (48 multi-file integration tests) was executed against the
pre-implementation host (no Apex `populateNamespaceSiblings` registered, `workspaceFqnBindings` empty of
Apex keys), followed by a direct pipeline probe dumping every CALLS/ACCESSES/EXTENDS/IMPLEMENTS edge for
three fixtures (`apex-cross-file`, `apex-cross-file-collision`, `apex-cross-file-trigger`). Reproducible:
run the suite at commit `08b804cf`; the probe script is inlined below (self-contained — the fixtures are
the committed `test/fixtures/lang-resolution/apex-cross-file*` directories at that commit; the follow-up
probes in Addenda 5/6 used ad-hoc three-file variants of the same shape, described in their entries):

```js
// probe.mjs — run with: npx tsx probe.mjs <fixture-dir>   (cwd: gitnexus/gitnexus)
import { runPipelineFromRepo } from '<repo>/gitnexus/src/core/ingestion/pipeline.js';
const r = await runPipelineFromRepo(process.argv[2], () => {});
for (const rel of r.graph.iterRelationships()) {
  if (!['CALLS','EXTENDS','IMPLEMENTS','ACCESSES'].includes(rel.type)) continue;
  const s = r.graph.getNode(rel.sourceId), t = r.graph.getNode(rel.targetId);
  console.log(rel.type, s?.properties.name, s?.properties.filePath, '->',
              t?.properties.name, t?.properties.filePath, rel.targetId);
}
```

Addendum-5 probes: (a) same-case pair — `SameA.cls`/`SameB.cls` both declaring `class Samey` + a caller
`Samey s = new Samey();` → no edges; (b) lone trigger — `T.trigger` (trigger T) + `LoneCaller.cls`
(`T t = new T();`) + `LoneSub.cls` (`class LoneSub extends T {}`) → CALLS and EXTENDS into
`Class:T.trigger:T`. Addendum-6 probe: `Outer.cls` (nested `Inner`), decoy `Inner.cls` (top-level
`class Inner`), `TailCaller.cls` (`Outer.Inner`/`OUTER.Inner` qualified ctor + member calls) → no edges.

**Observed — resolved with NO WI-3 code (exact-case forms only):**

```
IMPLEMENTS  SubIface (SubIface.cls) -> Iface (Iface.cls)
EXTENDS     Derived (Derived.cls)   -> Base (Base.cls)
IMPLEMENTS  Derived (Derived.cls)   -> Iface (Iface.cls)
EXTENDS     Child (Child.cls)       -> Base (Base.cls)
ACCESSES    read (StaticReader.cls) -> MAX_SIZE (Consts.cls)   [Property:Consts.cls:Consts.MAX_SIZE]
CALLS       greet (Derived.cls)     -> greet (Base.cls)        [Method:Base.cls:Base.greet#0]
CALLS       Derived (Derived.cls)   -> Base (Base.cls)         [Constructor:Base.cls:Base.Base#0]
CALLS       run (App.cls)           -> Engine (Engine.cls)     [Class:Engine.cls:Engine]
CALLS       go (DupCaller.cls)      -> Dupe (DupOne.cls)       [with class DUPE present in DupTwo.cls]
CALLS       go (RogueCaller.cls)    -> Rogue (Rogue.trigger)   [class def misfiled in a .trigger file]
CALLS       T (T.trigger)           -> handle (AccountHandler.cls)   [source = trigger container node]
CALLS       T (T.trigger)           -> AccountHandler (AccountHandler.cls)
ACCESSES    T (T.trigger)           -> MAX_SIZE (AccountHandler.cls)
```

**Observed — NOT resolved pre-hook (all red):** every instance-receiver member form (`e.start()`,
`held.label`, chains, cross-file inherited member, `h.process()`/`h.name` in a trigger), every case-varied
form (`new ENGINE()`, `e.STOP()`), enum-constant access (`Color.RED`, `Level.HIGH`), all overload narrowing
(incl. static `Target.sf(7)`), and nested `Outer.Inner`.

**Mechanism (read-verified).** `workspace-index.ts` precomputes a workspace-wide
`simpleName → FIRST module-local callable def` table (its header names it "the workspace-wide fallback of
`findExportedDefByName`"), and the heritage pass resolves parent/interface names workspace-wide. Both are
exact-case, first-match, language-hook-independent, and do not consult `workspaceFqnBindings` — so the §3
inject-none collision guard cannot govern them. This is the evidentiary basis for the SDD-003 §1
two-channel model, the §2/§7(4) bindings-channel scoping of the no-mis-bind foreclosure, and the §3/§4
fallback-channel §A.13 limitation (duplicate-name ctor/heritage/static-receiver references bind
exact-case-first; a class misfiled in a `.trigger` file is bindable via this channel). Architect-accepted
2026-07-02.

**Validated-true reliances (early).** §7(3) static-call/static-field arms incl. the REQ-011
edge-from-trigger source attribution (the host natively attributes trigger-body edge sources to the trigger
container node); §7(6) EXTENDS/IMPLEMENTS edge-label selection for a cross-file interface-extends-interface
source. The bindings-channel reliances (§7(1) instance-receiver arms, (2), (3b), (5), (7), (8), (9), (10))
remain Gate-3-validated at Step 3b.

## Addendum 5 (2026-07-02) — mechanism correction: the exact-case channel is the class-binding walk's QualifiedNameIndex single-match fallback (supersedes Addendum 4's mechanism attribution; Addendum 4's OBSERVATIONS stand)

**Correction.** Addendum 4 attributed the pre-hook cross-file resolutions to `workspace-index.ts`'s
`simpleName → first module-local callable def` table. Read-verification shows that table admits only
module-scope `Function`/`Method`/`Constructor` defs with `origin==='local'` (`workspace-index.ts:143-152`)
— empty for pure-Apex input — so it cannot be the mechanism. The actual surface, traced through the code:

- **`findClassBindingInScope` (`scope/walkers.ts:276-306`)**: first a `walkScopeChain` lexical walk, then —
  when the walk misses — the **`QualifiedNameIndex` fallback**: `scopes.qualifiedNames.get(name)` with
  **single-match-wins** (`qnames.length === 1`, `walkers.ts:287-291`). Keys are raw (exact-case)
  qualified names; the only def filter is `isClassLike(def.type)` — **trigger defs (type=Class) are
  admitted**.
- Reached from: the constructor/free-call path (`passes/free-call-fallback.ts` →
  `resolveInheritanceBaseInScope`), the heritage pre-emit pass (`pipeline/run.ts:133-195`), and the
  static type-name-receiver path (`passes/receiver-bound-calls.ts:734`); the member half of a static
  access resolves via the SemanticModel owner-keyed lookups (folded by the WI-2 §2.2 seam).

**Behavioural consequences (probe-verified 2026-07-02):**
- Same-case duplicate (`class Samey` in two files): `qualifiedNames.get('Samey')` → 2 → **binds nothing**
  (conservative). The "ties: first-indexed" wording in the originally ratified SRS v1.5 text was wrong in
  the unsafe direction; corrected + re-ratified.
- Case-variant duplicate (`Dupe`/`DUPE`): distinct exact-case keys → each unique → the exact-case
  reference binds its match (Addendum 4's observation, mechanism now correct).
- Valid twin (`Foo.trigger` + `Foo.cls`): 2 same-key class-like defs → **binds nothing** (Addendum 4 ✓).
- **Lone trigger** (`T.trigger` only): unique key, `isClassLike` admits the trigger def → `new T()` →
  CALLS `Class:T.trigger:T` and `class LoneSub extends T` → EXTENDS into the trigger def — a
  correctly-filed trigger IS bindable from (invalid) referencing source when no same-named class exists.
  Drove the SRS v1.6 REQ-004 text correction (re-ratified 2026-07-02).

**Channel interaction (corrects Addendum 4's "does not consult `workspaceFqnBindings`").** Every one of
these passes runs `walkScopeChain` → `lookupBindingsAt` (`walkers.ts:56-96`) BEFORE the QualifiedNameIndex
fallback, and `lookupBindingsAt` consults `workspaceFqnBindings` as its fourth channel (local scope
bindings → finalized → augmented → namespace → workspace). So WI-3's folded workspace keys ARE reachable
by the ctor/heritage/static-receiver passes — **iff each callsite's lookup NAME is folded** (the WI-2 §2.2
seam folded the receiver-bound-calls and declared-type keyspaces; the free-call/ctor and heritage
callsites' folding is unprobed → per-form [Gate-3 reliance]). The §3 inject-none guard therefore governs
everything the workspace channel serves; the QualifiedNameIndex fallback remains guard-independent but is
itself conservative on ties (single-match-wins).

## Addendum 6 (2026-07-02) — dotted-tail arm probe + erratum

**Dotted-tail arm.** `findClassBindingInScope`'s second fallback (`walkers.ts:295-305`) retries a dotted
name's exact-case simple tail (single-match-wins). Probe (nested `Outer.Inner` + unrelated top-level
`class Inner` decoy + qualified callers, both exact-case and case-varied): **nothing binds** — both defs
index under the tail key, so the single-match guard forecloses the tail-collision mis-bind. No edge into
the decoy; conservative miss pre-injection.

**Erratum (field name).** The earlier top-level-discriminant addendum described iterated defs as carrying
"`label`, `qualifiedName`, `filePath`". The kind field on `SymbolDefinition` is **`type: NodeLabel`**
(`gitnexus-shared/src/scope-resolution/symbol-definition.ts:27-30`); there is no `label` field. SDD-003
§3 Predicate 1 (`def.type ∈ {Class, Interface, Enum}`) is the corrected, authoritative statement and
supersedes the addendum's field description.

## Addendum 7 (2026-07-02) — top-level discriminant re-grounded: owning-scope shape (supersedes the earlier top-level-`qualifiedName` addendum's discriminant claim)

**Finding.** The v1 discriminant ("a def is top-level iff its `qualifiedName` contains no `.`") is
structurally FALSE on the iterated data: `ParsedFile.localDefs` is built by
`scope-extractor.ts` (`qualifiedName = match['@declaration.qualified_name'] ?? name`, `:565`), and the
Apex scope query emits **no** `@declaration.qualified_name` capture — so a NESTED Apex type's
resolution-side def carries a **bare** `qualifiedName` (`Inner`, not `Outer.Inner`). Corroborated by the
Addendum-6 probe: the nested `Inner` and the top-level decoy `Inner` both indexed under one bare key in
the `QualifiedNameIndex` (which keys strictly by `def.qualifiedName`,
`gitnexus-shared/src/scope-resolution/qualified-name-index.ts:46-64`) — impossible were the nested
def's key dotted. The earlier addendum's `SymbolTable`/`class-config` citations describe parse-worker
graph-id surfaces that do not feed `localDefs`.

**Re-grounding (Architect-approved 2026-07-02, option (b)).** The discriminant is the **owning-scope
shape**, mirroring `java/package-siblings.ts:95-105`: iterate `parsedFile.scopes`; a type def is
top-level iff its declaring class-kind scope's `parent` is the file's Module scope. All four Apex
type-declaration kinds create class-kind scopes (`query.ts:38-41` → `@scope.class`), so the shape is
total. No parse-side change; the exact-case channel's indexing (bare nested keys) is untouched, so
Addenda 5/6's probed facts remain valid. Rejected alternative (a) — synthesizing
`@declaration.qualified_name` for nested types (the Kotlin precedent) — would re-key nested defs in the
`QualifiedNameIndex` and re-open the dotted-tail decoy mis-bind on valid case-varied source.

**Consequence for valid source.** A valid nested/top-level name share (`class Outer { class Helper {} }`
+ top-level `class Helper`) selects only the top-level def → one def per folded key → injected (the v1
discriminant would have falsely tripped the inject-none guard and stripped the valid top-level type of
REQ-010).

## Addendum 8 (2026-07-02) — case-variant trigger/class twin probe

`Twist.trigger` (trigger Twist) + `TWIST.cls` (class TWIST) + `TwistCaller.cls`
(`Twist w = new Twist(); w.turn();`): pre-impl the exact-case channel binds
`CALLS go(TwistCaller.cls) → Twist(Twist.trigger) [Class:Twist.trigger:Twist]` — the trigger's
exact-case key stays unique (the case-variant class keys separately), so the single-match guard does not
suppress and the TRIGGER binds on valid source (REQ-004 breach / mis-bind; `w.turn()` does not resolve).
Drove: the SRS v1.6 boundary-wording correction ("same-EXACT-CASE-named", re-ratified 2026-07-02) and the
SDD-003 §4 committed-to-fix disposition — post-injection the folded workspace key holds the class alone
and must win BEFORE the exact-case channel (the walk's workspace consult precedes the QualifiedNameIndex
fallback; a fold-retry-after-miss remediation cannot fix this shape because the exact-case channel hits).

## Addendum 9 (2026-07-02) — heritage pre-emit pass ordering (corrects the Addendum-5 channel-interaction scope)

Read-verified: `preEmitInheritanceEdges` runs at `run.ts:573`, BEFORE `populateNamespaceSiblings` at
`run.ts:636`, and unconditionally suppresses every `inherits` site from the downstream reference bridge
(`run.ts:155-163` — "this pre-pass is the authoritative inheritance emitter"). Consequence: WI-3's
workspace keys are structurally UNREACHABLE for heritage clauses — Addendum 5's "reachable by those
passes too" holds only for the POST-hook passes (free-call/ctor `run.ts:753`, receiver-bound
`run.ts:728`). Case-varied heritage (`extends BASE`) and the case-variant twin's heritage form
(`extends Twist` → the trigger, per the Addendum-5 lone-trigger analog) cannot be served or corrected by
pure registration → ratified as the SRS v1.8 bounded limitations (Architect, 2026-07-02). The generic
pipeline reorder (hook before the pre-emit pass) is noted as a candidate upstream contribution / WI-4
item, subject to its own §2.2 review.

## Addendum 10 (2026-07-02) — direct localDefs dump + bare-nested reference probes (both shapes)

**Direct ground truth (extractParsedFile on `Outer.cls` with nested `Inner`):**

```
def type=Class qualifiedName=Outer   nodeId=def:Outer.cls#1:0:Class:Outer
def type=Class qualifiedName=Inner   nodeId=def:Outer.cls#2:4:Class:Inner      <- BARE (Addendum 7 confirmed)
def type=Method qualifiedName=ping
scope Module  (parent=null)
scope Class Outer (parent=Module)      owned=[Class:Outer]
scope Class Inner (parent=Class Outer) owned=[Class:Inner]                     <- owning-scope shape confirmed
```

Nested defs carry BARE `qualifiedName` on the resolution side, and the §3 owning-scope discriminant's
shape (type def in its own class scope; nested scope parented to the outer's scope, top-level to the
Module scope) is exactly as specified.

**Behavioural probes — bare cross-file `Inner` reference:** (a) no-decoy single-candidate repo
(`Outer.cls` nested `Inner` + `JustBare.cls` `Inner j = new Inner(); j.ping();`) → **no edges**;
(b) with a top-level decoy `class Inner` (Addendum 6) → **no edges**. So the exact-case channel's
ctor/free-call arm binds TOP-LEVEL types only — a bare reference to a nested def's bare key emits
nothing in both shapes (the internal reason is unpinned; the OUTCOME is fixture-pinned per shape).
Contrast: the heritage pre-pass DOES bind any unique class-like key, including trigger defs
(Addendum 5 lone-trigger, Addendum 8 twin-heritage).

## Addendum 11 (2026-07-02) — nested-parent heritage probes + extension-classification ground

**Nested-parent heritage (`class Sub extends Outer.Inner`, parent nested in another file — valid Apex):**
(a) no-decoy repo → **no edges** (the dotted base misses the bare-keyed QualifiedNameIndex; the pre-hook
pass leaves it unresolved); (b) with an unrelated top-level `class Inner` present → **EXTENDS Sub →
`Class:Inner.cls:Inner`** — the clause mis-binds the same-named top-level DECOY on valid source. Both
shapes ride the pre-hook heritage pass (Addendum 9), unreachable by the injection → ratified as the SRS
v1.10 extensions of the v1.8 heritage limitations (Architect, 2026-07-02).

**Extension classification (grounds the §3 case-folded extension pin, previously cited outside the
gate-admissible source scope):** `getLanguageFromFilename` lowercases the filename before extension
matching (`gitnexus-shared/src/language-detection.ts:88`, package `gitnexus-shared` — recorded here as
admitted evidence), so `T.TRIGGER`/`H.CLS` classify as Apex and reach the hook with case-preserved
`filePath`; the §3 discriminant therefore compares the extension case-folded.

## Addendum 12 (2026-07-02) — per-language registry (corrects the shared-registry interpretation) + fragment scope probe

**Per-language registry (read-verified; corrects this file's earlier "single flat map shared across all
languages" interpretation and retires SDD-003 §7(8)):** `finalizeScopeModel` constructs a FRESH
`workspaceFqnBindings: new Map()` per call (`finalize-orchestrator.ts:155`), and the scope-resolution
phase runs `runScopeResolution(input, provider)` once per registered language over extension-partitioned
files (`phase.ts:306,425`). The `scope-resolution-indexes.ts:90` doc's "shared" means shared ACROSS
SCOPES (one entry instead of per-scope duplication), not across languages. A peer-language entry and an
Apex reference can never meet in one map — **cross-language non-interference is structurally foreclosed**,
a stronger fact than the previously held Architect-accepted reliance. The mixed-language fixture remains
as an ordinary NFR-002 regression pin.

**Error-recovery fragment scope shape (probe — grounds the SRS v1.9 limitation under the owning-scope
discriminant):** `extractParsedFile` on a malformed outer class containing a nested type
(`public class Broken { public class Frag {...} public void oops( Integer`) yields:

```
scope Module (parent=null)                    owned=[]
scope Class  (parent=Module)                  owned=[Class:Frag]   <- the FRAGMENT, Module-parented
scope Function (parent=Class-Frag)            owned=[Method:f]
```

The outer `Broken` scope and def VANISH; the nested fragment's Class scope re-parents to the Module
scope on the resolution side — so the §3 owning-scope discriminant SELECTS it, and the v1.9
fragment-collision limitation fires exactly as ratified (fragment injects; a folded-name collision with
a valid top-level type → inject-none → the valid type's bindings-channel forms unresolved). Also
settles the WI-2 `new Broken()` watch item: the malformed outer yields NO def, so that WI-2 assertion
cannot flip at Step 3b.

## Addendum 13 (2026-07-02) — exact-case-channel mechanism RETRACTED as a pin; behavioural shape table

**Two probes falsify the single-match mechanism model** (Addendum 5's `findClassBindingInScope`
QualifiedNameIndex attribution, as a predictive pin):
- A class WITH an explicit constructor puts TWO defs under its exact-case key
  (`Class qualifiedName=Base` + `Constructor qualifiedName=Base` — dumped directly), yet exact-case
  `extends Base` / `super()` resolve (Addendum 4). The model predicts refusal.
- A top-level `class Validate` + a same-exact-case-named METHOD def in another file: `class ShareSub
  extends Validate` → `EXTENDS ShareSub → Class:Validate.cls:Validate` resolves correctly. The model
  predicts refusal.

The host evidently filters or ranks by def kind somewhere the walk-reading missed. **Conclusion: the
pre-existing exact-case channel's internal selection is HOST-INTERIOR and is not reliably
read-pinnable; it is not WI-3's design surface (WI-3 only registers the hook). The SDD pins its
BEHAVIOUR per probed shape and nothing more.** The probe-established shape table (all 2026-07-02):

| Shape (cross-file, exact-case reference) | Outcome |
|---|---|
| top-level class: ctor / heritage / static-Property / super | binds (Add. 4) |
| class WITH explicit ctor: heritage / super() | binds (Add. 4 + ctor-def dump) |
| class + same-named METHOD def elsewhere: heritage | binds the class (this addendum) |
| case-variant duplicate types (`Dupe`/`DUPE`): ctor | binds the unique exact-case match (Add. 4) |
| same-case duplicate types (`Samey` ×2): all forms | binds nothing (Add. 5) |
| same-name trigger+class twin (`Foo`): ctor/heritage | binds nothing (Add. 5) |
| case-VARIANT trigger/class twin (`Twist`+`TWIST`): ctor | binds the TRIGGER (Add. 8) |
| lone trigger (`T`): ctor / heritage | binds the trigger (Add. 5) |
| nested type, bare reference (± decoy): ctor/member | binds nothing (Add. 6, 10) |
| nested-parent heritage (`extends Outer.Inner`), no decoy | binds nothing (Add. 11) |
| nested-parent heritage, same-tail top-level decoy | binds the DECOY (Add. 11) |
| enum constant via type-name receiver (`Color.RED`) | binds nothing (Add. 4) |
| ANY case-varied form (`new ENGINE()`, `e.STOP()`, `extends BASE`) | binds nothing (Add. 4) |

Every SDD-003 limitation boundary and already-green justification keys on rows of this table, not on
the retracted mechanism. The two read-verified ORDERING facts stand (they are pipeline structure, not
channel interior): the heritage pre-emit pass runs pre-hook and suppresses retry (Addendum 9), and the
post-hook passes consult `lookupBindingsAt` — where the injected workspace channel lives — during their
resolution (Addendum 5; the folded-key REACHABILITY per callsite remains the §7(11)/(13) Gate-3
reliances).

## Addendum 14 (2026-07-02) — ctor-path folding: read-fact + behavioural counter-evidence

**Read-pinned:** the shared free-call fallback hands the RAW reference name to the class-binding walk
(`free-call-fallback.ts:137-142`; no `normalizeIdentifier` in `free-call-fallback.ts`, `walkers.ts`, or
`run.ts` on the reference side) — a raw `ENGINE`/`Twist` can never meet the folded workspace key on THAT
path, and the raw exact-case index serves the pre-hook binds Addendum 4 observed.

**Behavioural counter-evidence:** WI-2's in-unit case-varied constructor resolution (`new account()` →
CALLS `Account`) is green since WI-2 — an Apex-configured FOLDING ctor path exists (the WI-2
call-config / registration-table folded keyspaces), distinct from the raw free-call fallback. SDD-003
§7(11) is therefore sharpened, not falsified: the Gate-3 question is whether the WI-2 folding path
reaches the workspace channel cross-file and claims ctor references before the raw channel; the
committed fallback's named attachment is that same WI-2 Apex-local machinery.
