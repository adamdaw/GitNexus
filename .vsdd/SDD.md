# Software Design Document — Apex Support

*VSDD §A.11. The technical contract (the **how** and **what-must-be-provable**) derived from the
approved SRS-001 and the work-item decomposition. One SDD section per work item; authored in
dependency order. **WI-1 (ITEM-001) first.***

- **Constitution version:** CONST-gitnexus-apex **v1.1.0** (amended 2026-06-29; §2.2 generic-seams
  refinement). This SDD is authored under it and Gate 2 checks the SDD does not contradict it.
- **Consumes:** RESEARCH-001 (§A.6 grammar feasibility, Architect-approved 2026-06-28).

---

# SDD-001 — WI-1: Parse & graph population

- **SDD-id:** SDD-001 · **Work item:** ITEM-001 (WI-1) · **SRS slice:** SRS-001 §5 (Recognition,
  Graph population, Metadata) + §6 NFR-003, and the parse-path slice of cross-cutting NFR-001.
- **Requirements discharged:** REQ-001, REQ-002, REQ-003, REQ-004, REQ-014, NFR-003; NFR-001
  (parse-path slice); NFR-002 (cross-cutting non-regression). *No resolution* (REQ-005…013 are WI-2…4).
- **Amended v1.2 (2026-06-29)** — Gate-3 implementation evidence (peer-handling investigation across
  Java/Kotlin/C#) showed five §2/§4 design pins diverged from the host's established behaviour, with no
  SRS basis (the SRS pins none of them). Architect-approved revert (Adam, 2026-06-29) to host defaults:
  (1) nested types receive a File `DEFINES` edge like top-level types and the benchmark — triggering
  this SDD's own REQ-002 contingency early; (2) member ids are case-preserving (case-insensitivity moves
  to WI-2's resolver, the host pattern for C#); (3) the param-type id segment is collision-triggered,
  not always-on; (4) identical-signature duplicates (illegal-to-compile Apex) collapse to one node;
  (5) a nameless owner's valid-named members/nested types re-parent to File scope, not dropped. The
  retained NFR-001 guarantee — no degenerate empty-named node, no empty owner-segment id — is enforced
  by a generic worker guard. A Gate-2 (SDD-only) amendment; Gate 1/SRS unchanged. Re-enters Gate 2.

## 1. Design overview (the HOW, grounded in the host)

Apex is added the way every host language is: a `LanguageProvider` (registered in the provider
table) supplies a tree-sitter query string and a set of extractors; the parse worker runs the query
over each parsed file and emits graph nodes + containment edges. WI-1 covers everything up to and
including node/containment emission — no reference resolution.

**Module layout (Constitution §2.1 isolation — stricter than Swift's scattered configs):** all
Apex-specific logic is consolidated under **`gitnexus/src/core/ingestion/languages/apex/`**:

| File | Role |
|---|---|
| `languages/apex/index.ts` | `apexProvider = defineLanguage({…})` — the provider. |
| `languages/apex/queries.ts` | the tree-sitter query string (`APEX_QUERIES`). |
| `languages/apex/method-config.ts` | `MethodExtractionConfig` covering **both `method_declaration` and `constructor_declaration`** (the method extractor emits the `Method`/`Constructor` nodes and runs `extractAnnotations` for both — so constructor annotations, REQ-014, have a path). |
| `languages/apex/field-config.ts` | `FieldExtractionConfig`. |
| `languages/apex/class-config.ts` | `ClassExtractionConfig` (nested-type qualified names). |
| `languages/apex/type-config.ts`, `export-checker.ts`, `import-resolver.ts` | the remaining required provider hooks. |

These import the host's **language-agnostic factories** (`createMethodExtractor`,
`createFieldExtractor`, `createClassExtractor`, `createImportResolver`, …). No factory or shared
ingestion module is edited to name Apex (Constitution §2.1; host RFC #909). Rationale for the
directory (vs Swift's `languages/swift.ts` + scattered `*-extractors/configs/swift.ts`): §2.1
mandates "all Apex logic under `languages/apex/`", which the consolidated directory satisfies while
the scattered-config pattern would not.

**Generic shared seams (Constitution §2.2 v1.1.0; Architect-approved 2026-06-29).** Three needed WI-1
behaviours have **no existing host seam**, so WI-1 adds a **generic, language-agnostic** extension point
for each — naming no language, configured by the isolated Apex provider (or applied uniformly), and
NFR-002-verified (Java/Kotlin/C# resolver suites stay green). None is an Apex-specific pipeline branch
(§2.1 intact); the Apex behaviour lives entirely in `languages/apex/` configs:
1. **`ClassExtractionConfig.extractProperties`** (+ `ExtractedClassSymbol.properties`, spread by the
   worker) — lets a provider stamp marker properties on a class-like node by AST node type. Apex uses it
   for `apexConstruct='trigger'` (REQ-004). Mirrors the method-level `isPartial` marker pattern.
2. **`FieldExtractionConfig.extractAnnotations`** (+ `FieldInfo.annotations`, spread by the worker's
   Property branch) — field/property annotations, mirroring the existing method `extractAnnotations`
   path. Apex uses it for REQ-014 member annotations.
3. **Empty-name conservative-skip guard** in the parse worker — `if the extracted node name is empty,
   emit no node`. Generic (every language); enforces the NFR-001 no-degenerate-node guarantee the host
   previously lacked (it emitted an empty-named node for a nameless declaration on any language).

**Grammar (from RESEARCH-001):** `tree-sitter-apex` vendored under `gitnexus/vendor/tree-sitter-apex/`
as an **ABI-14 regeneration** of `aheber/tree-sitter-sfapex`'s apex grammar (the upstream ABI-15
`parser.c` will not load on the pinned `tree-sitter@0.21.1`). Registered in
`VENDORED_GRAMMAR_PACKAGES` (`src/core/tree-sitter/vendored-grammars.ts`) and the `GRAMMARS` registry
(`scripts/build-tree-sitter-grammars.cjs`, `required:false`, honours `GITNEXUS_SKIP_OPTIONAL_GRAMMARS`);
loaded in the worker via a guarded `requireVendoredGrammar('tree-sitter-apex')`; recorded in
`.github/vendored-grammars.json` with a **regeneration `hold`** so the weekly auto-update bot does not
revert to ABI-15; **and the manifest/vendor-dir consistency-guard test is updated to include Apex**
(RESEARCH-001 Structural-constraint #3's second MUST — without it the guard either fails host CI or under-covers,
letting the silent ABI-15 breakage path through). (All four vendoring steps + both maintenance MUSTs
detailed in RESEARCH-001 "Structural constraints".)

**Verification split (what is provable at which gate).** This SDD's claims fall in two classes. (1)
**Grammar facts** — the node shapes, names, and nesting the Apex grammar produces — are verified now, in
RESEARCH-001's spike + addenda (the §A.6 evidence), and are the basis of the Gate-2 contract. (2)
**Host-API / extractor behaviours** WI-1 relies on (e.g. that `createFieldExtractor` iterates
declarators, that `extractName` returns a given node's name, that the worker emits `DEFINES`/`HAS_*`
edges as described) are stated here as **WI-1 design obligations**: where the host factory already
provides the behaviour WI-1 uses it; where it does not, Apex's own config/code supplies it. These are
not provable from the spec bundle and are **verified at Gate 3** (tests against the real host), not at
Gate 2. Gate 2 checks that the contract is unambiguous, complete, and faithful to the SRS/Constitution;
it does not (and cannot, under evidence isolation) verify host-code behaviour.

## 2. Behavioural contract

Each clause carries its REQ-NNN through the chain. "The system" = a single GitNexus analysis run.

### REQ-001 — Recognition
- **Precondition:** a file path with extension `.cls` or `.trigger`.
- **Postcondition:** `getLanguageFromFilename(path)` returns `SupportedLanguages.Apex`; the file is
  dispatched to `apexProvider`. Files of no other extension are unaffected.
- **Invariant:** the extension→language map is total and deterministic; adding Apex changes the result
  for no non-Apex path (supports NFR-002).

### REQ-002 — Type container nodes
- **Precondition:** a parsed Apex file containing one or more user-defined classes, interfaces,
  enums, or nested types (nested class/interface/enum).
- **Postcondition:** for each such type, exactly one container node is emitted with:
  `label ∈ {Class, Interface, Enum}` (class/inner-class→`Class`, interface→`Interface`,
  enum→`Enum`; WI-1 relies on the host `NodeLabel` set including `Class`, `Interface`, and `Enum`
  members — a host fact Gate-3-confirmed per the verification split); `properties.name` = the declared
  simple name; `filePath`; `startLine`/`endLine` from
  the definition node; `language='apex'`; `isExported` per the Apex `exportChecker` (rule below).
- **Export semantics (Apex `exportChecker`, pinned — by declaration context):** Apex has no
  module-export concept; visibility is the analogue, and the **no-modifier default is context-dependent**:
  - **Explicit modifier present** (type, class member): `isExported = true` iff modifiers include
    `global`, `public`, or **`webservice`** (the latter exposes a member externally — referenceable in
    the resolution sense); `protected`/`private` → `false`.
  - **Implicitly-public, modifier-less contexts** → `isExported = true`: **interface members with no
    access modifier** (Apex forbids access modifiers on interface methods — they are as visible as the
    interface) and **enum constants** (modifier-less, implicitly public/referenceable). (Totality over
    uncompiled source: an *illegally* modified interface member has an explicit modifier and so falls
    under the first bullet, not here — the buckets stay mutually exclusive.)
  - **`isExported` is the node's OWN visibility, not transitive referenceability:** a member's
    `isExported` reflects its own declared/contextual visibility independently of its owner's (e.g. an
    enum constant is `true` even inside a `private` enum). Effective external referenceability =
    member visibility AND owner visibility; **combining them is WI-2/3's job**, not WI-1's — WI-1 emits
    the per-node own-visibility value and does not resolve owners.
  - **No-modifier-defaults-to-private contexts** → `isExported = false`: a top-level type, a **nested
    type**, or a class member with no modifier (Apex default = private in all three), and a **trigger**
    (no modifier; not a referenceable type — REQ-004). The rule is **total**: every node falls in
    exactly one of these three bullets.
  Rationale:
  `global`/`public` make a symbol referenceable from other classes in the repo (the resolution-relevant
  sense of "exported"); it mirrors the benchmark's public-is-exported rule, with Apex's wider `global`
  also exported. **This is WI-1's own pinned design decision, NOT parity-anchored:** REQ-012 parity is
  scoped to node *kind* and edge *kind* (SRS §5), not node property *values*, so `isExported` has no
  REQ-012 confirmation — it is committed concretely here and verified by its own Gate-3 assertion (§8).
- **Containment edge:** each **top-level** type (and the trigger, REQ-004) is connected to its `File`
  node by a `DEFINES` edge — the host's file→top-level-symbol containment, emitted by the worker when a
  definition has no enclosing type. This pins the `DEFINES` member of the output relationship set.
- **Nested-type membership (v1.2 — host default, parity-anchored):** a nested type receives a
  File→type **`DEFINES` edge, identical to a top-level type**. This rests on the host's **owner-*edge*
  resolution** (`findEnclosingClassInfo`), which the worker runs only for members (method/constructor/
  property/function) to attach a `HAS_*` edge, and **not** for class-like labels (Class/Interface/Enum) —
  so a nested type resolves **no enclosing-type owner edge** and the worker emits the File→symbol
  `DEFINES` for it, exactly as for a top-level type and as the Java/Kotlin benchmark do. Nesting structure
  is **separately** recoverable from the qualified id (`Outer.Inner`, next clause), built by a *distinct*
  host path. *Rationale for the v1.2 revert:* the original WI-1 pin (no containment edge; id-only) diverged
  from the host and from the benchmark; Gate-3 evidence confirmed Java/Kotlin/C# all emit File→nested
  `DEFINES`. Reverting pre-satisfies REQ-012 parity (this clause's own prior contingency, now triggered)
  rather than deferring an asymmetry to WI-4.
- **Invariant:** a nested type (class, **interface, or enum**) is emitted with a qualified id
  (`Outer.Inner`) via the host's **qualified-*name* path** (`buildQualifiedName`, gated on
  `qualifiedNodeId`) — a scope walk over enclosing type declarations that **keys the node id**, distinct
  from the owner-*edge* resolution above (which governs containment edges and resolves none for a
  class-like node). The name path is type-kind-agnostic — it qualifies nested interfaces and enums as it
  does nested classes (exactly as the host resolves nested Swift/Kotlin types) — so id is unambiguous and no two distinct
  types (including a nested enum vs a same-named top-level enum) collide on id. Grammar support for the
  nesting this relies on is verified: `class_body` directly contains nested `class_declaration` and
  `interface_declaration` (RESEARCH-001 probe4) and nested `enum_declaration` (the main spike), all
  0 ERROR/MISSING.

### REQ-003 — Member nodes
- **Precondition:** a parsed user-defined Apex type with methods, constructors, properties, fields,
  and/or enum constants.
- **Postcondition:** each member is emitted as a node **associated with its declaring type**:
  - method → `label=Method`; constructor → `label=Constructor` (committed definitively — the host
    `NodeLabel` set includes `Method` and `Constructor` members, a host fact Gate-3-confirmed, same
    basis as the `Class`/`Interface`/`Enum` reliance and the `Field`-absence finding);
  - field **and** property (`private Integer x;` and `String x { get; set; }`) → `label=Property`. The
    grammar emits both as `field_declaration` with no distinct `property_declaration` node
    (RESEARCH-001 addendum), so WI-1 makes no field-vs-property node-type distinction. The label is
    pinned **provisionally** to `Property` — the host `NodeLabel` set has no `Field` member (a host fact
    Gate-3-confirmed), and the Java/Kotlin benchmark resolves a field to `Property`; **REQ-012 parity
    confirms the exact label
    at WI-4** (if the benchmark differs, WI-4 reconciles).
  - **Multi-declarator fields (`Integer a, b, c;`):** one `field_declaration` carries **N
    `variable_declarator` children** (RESEARCH-001 probe4). Emitting **one `Property` node per
    `variable_declarator`** (so no *distinct-named* declarator is dropped at extraction — the
    pathological same-name `Integer x, x;` collapses to one node by id-dedup per §4, the host default),
    each with its own name **and its own
    `startLine`/`endLine` taken from its `variable_declarator`** (distinct ranges, not the shared
    `field_declaration` range), with the declaration's shared `modifiers` annotations **propagated to
    every** resulting node (REQ-014), is a **WI-1 design obligation on its field extraction** — supplied by Apex's `field-config` if the host factory does
    not already iterate declarators; verified by a Gate-3 fixture asserting all N members.
  - enum constant → `label=Property`, emitted as a member of its `Enum` (from the grammar's
    `enum_constant` nodes under `enum_body`, verified in RESEARCH-001 addendum). Its name is read from
    the `enum_constant`'s **`name` field** (uniform with the other type/member kinds — RESEARCH-001
    probe5; not the `field_declaration` declarator walk).
  - Association is realised by owner-edge resolution as: a `HAS_METHOD` edge for methods and
    constructors; a `HAS_PROPERTY` edge for fields, properties, **and enum constants** (all
    `label=Property`), from the declaring type's node. **In well-formed source** a member always has an
    enclosing type (Apex has no top-level functions); the sole exception is the malformed-input
    re-parent case (NFR-001 below), where a member of a *nameless* owner re-parents to File scope.
  - Each member node also carries the standard `ParsedNode` properties — `name`, `filePath`,
    `startLine`/`endLine`, `language='apex'`, and **`isExported` per the REQ-002 export rule** (interface
    members / enum constants → true; class members per modifier). The `annotations` property is carried
    by the **four REQ-014 member kinds only** (method, constructor, field, property); enum constants
    take no `annotations` (Apex forbids annotations on enum constants).
- **Invariant (v1.2 — host default):** every emitted member node of a **well-formed type** has exactly
  one declaring-type owner edge (`HAS_METHOD`/`HAS_PROPERTY`); the one exception is a member of a
  *nameless* owner under error recovery, which re-parents to a File `DEFINES` edge (NFR-001) — it has a
  File owner edge, not a declaring-type one, but is never orphaned. Member ids follow the **host id
  scheme unchanged**: `owner + name + #arity`, with the host
  appending a parameter-type segment **only to disambiguate a same-name-same-arity collision** (the
  host's `typeTagForId` mechanism, identical to every peer language). **Type-only overloads** (same name,
  same arity, different parameter types — `f(Integer)` vs `f(String)`, valid Apex, REQ-008 scope) thus
  still receive **distinct ids and both nodes are emitted** via the collision-triggered signature (the
  `formal_parameter.type` field, RESEARCH-001 probe6). WI-1 adds **no** Apex-specific id construction:
  no always-on signature, no positional disambiguator.
- **Parameter-type id segment (v1.2 — collision-triggered, host default):** when a same-arity collision
  exists, the host builds the segment from the `formal_parameter.type` source text (`List<Account>`,
  `Schema.SObjectType`, `Account[]`). It is **not** Apex-normalised and **not** always-on. A WI-2 call
  site recomputes the segment the same way the host does for every language. *(v1.1 pinned an always-on,
  whitespace-stripped, lower-cased canonical rendering; reverted in v1.2 — it diverged from the host and
  has no SRS basis.)*
- **Case-insensitivity (v1.2 — a WI-2 resolution concern, not a WI-1 id concern):** Apex identifiers are
  case-insensitive, so a call `F()` must match a declaration `f()`. This is resolved the way every
  case-insensitive host language (e.g. C#) resolves it — **case-insensitive lookup in the WI-2
  resolver** — **not** by case-normalising WI-1 ids. WI-1 ids and the node `name` are both
  case-preserving, identical to every peer. The case-insensitive-identity obligation moves to WI-2's SDD
  section (REQ-005/REQ-008). *(v1.1 case-normalised WI-1 ids; reverted in v1.2.)*

### REQ-004 — Trigger container node
- **Precondition:** a parsed `.trigger` file declaring a user-defined trigger.
- **Postcondition:** the trigger is emitted as one container node: `label=Class` (the host's general
  container label — it supports `DEFINES`/containment and, in WI-3, reference ownership), with
  `properties.name` = the trigger name and a distinguishing `properties.apexConstruct='trigger'` (WI-1
  relies on the host `NodeProperties` type carrying an index signature `[key: string]: unknown` — a host
  fact Gate-3-confirmed; the extension key then needs no shared-type edit — Constitution §2.1
  preserved); `filePath`, line range, `language='apex'`; and **`isExported=false`** — an Apex trigger
  has no visibility modifier and is not a referenceable type (it is an event handler), so the export
  rule yields `false` — the trigger is REQ-002 export bucket 3 (the no-modifier default; that bucket
  explicitly enumerates the trigger), restated here for the REQ-004 postcondition's completeness.
- **Discriminant (pinned):** `trigger_declaration` and `class_declaration` share the
  `@definition.class` capture, but are distinct node *types*. The provider sets
  `apexConstruct='trigger'` (and reads no enclosing owner) iff the captured definition node's `.type ===
  'trigger_declaration'`; a `class_declaration` takes neither. The trigger **name** comes from the
  uniform `name` field like every other type (RESEARCH-001 probe5 — `trigger_declaration` exposes
  `childForFieldName('name')`); the trigger's sObject (a separate `identifier`) is **not** emitted as a
  graph node.
- **Grammar feasibility:** `trigger_declaration` parses clean (0 ERROR/MISSING) with the name as a
  child `identifier` — verified in RESEARCH-001's addendum (the original spike parsed only a `.cls`;
  the addendum closes the trigger surface).
- **Id disambiguation:** a trigger and a class may share a simple name (separate Apex namespaces). The
  host node id is `filePath`-qualified (`generateId(label, 'filePath:qualifiedName…')`), so `trigger Foo`
  (in `Foo.trigger`) and `class Foo` (in `Foo.cls`) get distinct ids by file path; the
  `apexConstruct='trigger'` property further distinguishes them. No top-level id collision.
- **Invariant:** the node is capable of being the enclosing reference scope for its body (the WI-3
  REQ-011 hook); WI-1 emits the node only — no body references are resolved here.
- **Design note (Architect-confirmed, Adam 2026-06-28):** `label=Class` + `apexConstruct` property is
  chosen over (a) adding a `Trigger` member to the shared `NodeLabel` type — rejected: it would name an
  Apex concept in shared code (Constitution §2.1) — and (b) `label=Function` — viable for WI-3
  reference ownership but weaker as a "container" per REQ-004's wording.
- **Fallback if the index-signature host fact is false (Gate 3):** the `apexConstruct` property assumes
  `NodeProperties` carries an open index signature. If Gate-3 confirmation finds it does not, the
  in-property approach is unavailable and all three label options conflict with §2.1/REQ-004; the
  conflict is then **escalated to the Architect for a Constitution-amendment decision** (e.g. sanction a
  `Trigger` `NodeLabel` by amendment) — never resolved by a silent shared-type edit. (Mirrors the
  `.cls`/`.trigger` extension-contention escalation in §3.)

### REQ-014 — Annotation metadata (member-level; SRS v1.1)
- **Precondition:** a user-defined Apex **member** (method, constructor, field, or property) bearing
  one or more annotations (`@AuraEnabled`, `@InvocableMethod`, `@TestSetup`, …).
- **Postcondition:** each annotated member node carries `properties.annotations: string[]`, each entry
  normalised to `@Name` (arguments stripped, e.g. `@AuraEnabled(cacheable=true)` → `@AuraEnabled`), via
  the Apex `extractAnnotations` hook in `method-config`/`field-config` — the same mechanism Swift uses
  for `attribute` nodes. Member-annotation evidence (RESEARCH-001 addendum, probe3): annotated method,
  **constructor, field, and property** all carry the identical `modifiers > annotation > identifier`
  shape (0 ERROR/MISSING), so the single `extractAnnotations` walk covers all four member kinds — the
  node-shape this clause depends on is verified for each, not just methods.
- **Scope (Gate 2 finding G02, Architect-resolved 2026-06-28 — option (a) descope):** REQ-014 is
  scoped to **member-level** annotations. **Type-level** annotation capture (`@IsTest`/`@RestResource`
  on a class) is **deferred to REQ-106**. The governing reason is parity (Constitution §1.1): type-level
  annotation capture exceeds the Java/Kotlin benchmark, which captures no type-level annotations — so
  it is out of this cycle. (Corroborating, to be confirmed in WI-2/impl: the host appears to attach
  annotations only via the member path, so a type-level path would be a new generic mechanism; this is
  a secondary observation, not the load-bearing ground.) WI-1 makes no type-level annotation claim.
- **Invariant:** annotation capture is metadata only; WI-1 attaches **names** (deliberately
  name-only — argument *values*, e.g. `(cacheable=true)`, are stripped; full argument-text capture is
  the deferred **REQ-107**, consistent with the host's name-normalising mechanism and the benchmark).
  WI-1 does not interpret framework *semantics* (the separate deferred REQ-104).

### NFR-003 — Per-file resource budget
- **Precondition:** an Apex file whose content byte length exceeds the host per-file threshold
  (`getTreeSitterContentByteLength` compared against `TREE_SITTER_MAX_BUFFER`). NFR-003's skip-gate and
  SEC-001's `getTreeSitterBufferSize()` both route through the host's per-file size handling; whether
  they are literally one function or layered is a host-API detail **Gate-3-confirmed** (verification
  split) — WI-1 reuses the host budget either way, with no Apex-specific limit.
- **Postcondition:** the file is skipped at the **same** threshold applied to every language; no
  Apex-specific exemption and no Apex-specific lower limit. The run continues.
- **Invariant:** Apex reuses the host's existing budget constants unchanged.

### NFR-001 (parse-path slice) — Crash-safety on malformed input
- **Precondition:** a syntactically broken or incomplete Apex file in a repository with valid files.
- **Postcondition:** parsing routes through `parseSourceSafe()`; a parse that throws or a file over
  buffer is skipped; the run completes and the valid files are represented. (The resolution-path
  slice of NFR-001 is WI-2…4.)
- **Partial-tree rule (retained — generic conservative skip):** tree-sitter error recovery can yield a
  definition node whose name is `MISSING` or unrecoverable — via the uniform `name` field (every kind
  except `field_declaration`, incl. `enum_constant` — RESEARCH-001 probe5) or via the declarator walk
  (`field_declaration` only). The rule is phrased on the **extracted name**: a node is emitted **only
  when the extracted name is non-empty**; otherwise the capture match is **dropped — no node emitted**
  (conservative skip, Constitution §1.2). This is enforced by a **generic worker guard** (`if the
  extracted node name is empty/whitespace, emit no node`) — generic, not Apex-specific, so no language
  emits a degenerate empty-named node on any label.
- **Owner handling (v1.2 — host default, re-parent not cascade-drop):** if an enclosing type's own name
  is unrecoverable, the **type node is dropped** (partial-tree rule above), but its **valid-named members
  and nested types re-parent to File scope** — they take a File→symbol `DEFINES` edge, exactly as the
  host does for every language (a member resolves no enclosing-*type* owner → File edge). They are **not**
  themselves dropped. **No id carries an empty owner segment** on either id path: a re-parented
  **method/property** keys its id off the host's `owner.name` qualifier, which the worker reduces to just
  `name` (+`#arity`) when no enclosing type resolves — so the owner segment is absent, not empty; a
  re-parented **nested type** keys off `buildQualifiedName`, which strips empty scope segments — so it is
  keyed by its own simple/qualified tail (`InnerOfBroken`, not `.InnerOfBroken`). *(v1.1 pinned an
  Apex-specific cascade that dropped valid-named children of a nameless owner and forbade re-parenting;
  reverted in v1.2 — it diverged from the host with no SRS basis. The retained guarantees — no degenerate
  node, no empty-segment id — hold via the generic guard + the host owner/qualified-name paths.)*
- **Contained extraction (closes the extractor-throw path):** the no-crash guarantee rests on three
  guards, not two: (1) `parseSourceSafe()` contains *parse* throws; (2) the drop rule contains *empty*
  names; (3) **WI-1's extractors must be defensive on error-recovery trees** — a traversal over a
  `MISSING`/partial node returns "no result," it does not throw — and extractor invocation is
  additionally contained by the host's per-file error handling (`reportWarning` + skip), so even an
  unexpected throw degrades to a skipped file, never a crashed run. (Guard 3's host-containment leg is a
  WI-1 reliance, Gate-3-confirmed per the verification split; the defensive-extractor leg is WI-1's own
  obligation.) This holds across **both name-extraction paths** (the uniform `name` field; the
  `field_declaration` declarator walk).
- **Invariant:** no Apex input — malformed, truncated, or oversized — can crash the analysis run on
  *any* name-extraction path, and no malformed fragment yields a degenerate (empty-named) node.

## 3. Interface definition

- **`SupportedLanguages`** (`gitnexus-shared/src/languages.ts`): add `Apex = 'apex'`. Extension map
  (`getLanguageFromFilename`): `.cls`, `.trigger` → `Apex`. This is the host **registration** path
  (Constitution §2.2 — the same enum + extension-map onboarding every peer language uses), **not**
  shared ingestion *logic* branching on Apex (the §2.1 prohibition): adding an enum value and a filename
  mapping introduces no Apex-specific control flow into shared code. *Assumption (Gate-3-confirmable,
  NFR-002):* `.cls` and `.trigger` are not already claimed by another host language — `.cls` is
  contended in the wider ecosystem (VB/LaTeX), so the mapping is additive only if the host does not
  already map them. Concrete resolution if a Gate-3 check finds `.cls`/`.trigger` already claimed: the
  conflict is **surfaced to the Architect for an explicit precedence decision** (which language owns the
  extension) before the mapping lands — never a silent override of an existing mapping (that would
  regress the incumbent language, violating NFR-002 / Constitution §1.3).
- **`apexProvider: LanguageProvider`** — required fields: `id=Apex`; `extensions=['.cls','.trigger']`;
  `treeSitterQueries=APEX_QUERIES`; `typeConfig`; `exportChecker`; `importResolver`
  (Apex has no import statements — a no-op/identity resolver; cross-file binding is WI-3's REQ-010
  enabler, not an import resolver). Optional-but-supplied: `methodExtractor`, `fieldExtractor`,
  `classExtractor`. `callExtractor` is authored in WI-2 (no calls resolved in WI-1).
- **`APEX_QUERIES`** — capture-name scheme matching the host convention (suffix → `NodeLabel` via
  `getLabelFromCaptures`): `@definition.class` (class_declaration, inner classes, **and**
  trigger_declaration — see REQ-004 discriminant), `@definition.interface` (interface_declaration),
  `@definition.enum` (enum_declaration), `@definition.method` (method_declaration),
  `@definition.constructor` (constructor_declaration), `@definition.property` (**field_declaration** —
  which the grammar uses for *both* Apex fields and auto-properties; there is no separate
  `property_declaration` node — **and enum_constant**; all → member `Property`). **Multiplicity
  discriminant within this capture (pinned):** if the captured node's `.type === 'field_declaration'`,
  emit **one node per `variable_declarator`**; if `.type === 'enum_constant'`, emit one node.
  **Name extraction has two paths (RESEARCH-001 probe5):** (1) the node's **`name` field** —
  `class`, `interface`, `enum`, `method`, `constructor`, `trigger`, **and `enum_constant`** all expose
  `childForFieldName('name')` uniformly; (2) the **declarator walk** — `field_declaration` only, whose
  name is nested in each `variable_declarator` (the field extractor's `extractName`). Both paths yield a
  non-empty name for a well-formed node, so the partial-tree drop rule fires only on genuine
  error-recovery, never on a healthy node. All eight node types are
  verified present in RESEARCH-001 (+ its two addenda): `class_declaration`, `interface_declaration`,
  `enum_declaration`, `enum_constant`, `method_declaration`, `field_declaration`,
  `constructor_declaration`, `trigger_declaration`.
- **Node output type:** the worker's `ParsedNode` (`{id, label: NodeLabel, properties:{name,
  filePath, startLine, endLine, language, isExported, annotations?, apexConstruct?, …}}`) and
  `ParsedRelationship` (`DEFINES | HAS_METHOD | HAS_PROPERTY`). WI-1 adds no new output type.
- **Error type:** none thrown across the worker boundary — failures degrade to `reportWarning` + skip
  (the host contract; SEC-001 below).

## 4. Edge-case catalog (per-input checklist → each traces to a Gate-3 test)

| Input dimension | Apex case | Required behaviour |
|---|---|---|
| null / empty | empty `.cls`; whitespace-only file | parses to empty tree; emits no nodes; no crash. |
| boundary / maximum | file at/over `TREE_SITTER_MAX_BUFFER` | skipped at the host threshold (NFR-003); run continues. |
| grammar unavailable | Apex binding absent / `GITNEXUS_SKIP_OPTIONAL_GRAMMARS=1` | `.cls`/`.trigger` still recognised as Apex but the file is skipped; run completes, no crash (RESEARCH-001 Structural-constraint #2, guarded load). |
| malformed / incomplete | unterminated class/string/comment; stray tokens | `parseSourceSafe` → partial/throw → file skipped or partial tree with no crash (NFR-001). |
| malformed — partial node, **name-field path** | any of class/interface/enum/method/constructor/trigger/enum_constant with a `MISSING` `name` field | capture match dropped, no node, no crash (partial-tree rule). |
| malformed — partial node, **declarator path** | `field_declaration` with an unrecoverable `variable_declarator` | the bad declarator yields no node; well-formed sibling declarators still emit; no throw. |
| malformed — **owner nameless, children valid** (v1.2) | `class` with a `MISSING` name but valid-named methods/fields/nested types | nameless owner emits no node (partial-tree rule); its valid-named members/nested types **re-parent to File scope** (File `DEFINES`), host default; no degenerate node, no empty owner-segment id. |
| encoding | non-UTF-8 / BOM / mixed line endings | host buffer sizing handles; no Apex-specific path. |
| structural — deep nesting | deeply nested inner classes | container nodes + qualified ids emitted; no stack overflow within host limits. |
| structural — type-only overloads (v1.2) | two **methods or constructors** same name **and** arity, different parameter types — incl. **generic/array/qualified** (`f(Integer)`/`f(String)`; `f(List<Account>)`/`f(List<Contact>)`; `Foo(Integer)`/`Foo(String)`) | distinct ids via the host's **collision-triggered** parameter-type signature (host `typeTagForId`, raw type text); **both** nodes emitted (so WI-2/REQ-008 can resolve them). |
| structural — identical-signature duplicate (v1.2) | two members with the **same** owner+name+arity+param-types, incl. same-line `Integer x, x;` (illegal-to-compile Apex; GitNexus graphs uncompiled source) | exact id collision → **collapses to a single node**, host default (last-write-wins / graph-layer dedup) for every language. No Apex-specific positional disambiguator. |
| trigger with no body / multiple events | `trigger T on A (before insert,after update){}` | one container node emitted; trigger events are not emitted as nodes or node properties in WI-1 (consistent with the REQ-004 postcondition's property list). |
| id collision — trigger vs class same name | `trigger Foo` in `Foo.trigger` + `class Foo` in `Foo.cls` | distinct ids (filePath-qualified + `apexConstruct`); no collision (REQ-004 id disambiguation). |
| annotated members — all kinds | `@TestVisible` field, `@AuraEnabled` property, annotated constructor | each carries normalised `@Name` in `annotations` (REQ-014; grammar-uniform, RESEARCH-001 probe3). |
| multi-declarator field | `public Integer a, b, c;` (one `field_declaration`, 3 declarators) | three `Property` nodes (one per `variable_declarator`); a shared annotation propagates to all three (REQ-003/REQ-014; RESEARCH-001 probe4). |
| nested class, interface & enum | `class Outer { class Inner {} interface I {} enum E { A } }` | nested `Class`, `Interface`, and `Enum` nodes with qualified ids `Outer.Inner` / `Outer.I` / `Outer.E` (REQ-002; RESEARCH-001 probe4 + main spike). |
| annotations | annotation with arguments; multiple annotations; unknown annotation | all normalised to `@Name` and captured; unknown names captured verbatim (no validation — REQ-104 deferred). |
| concurrent | many Apex files across worker threads | per-file isolation (host worker model); no shared Apex mutable state in the provider. |

A new edge case first surfaced here that implies a *behaviour* not in the SRS is written back to
SRS-001 as a versioned addendum (new REQ-NNN) re-entering Gate 1 — none required for WI-1 as authored.

## 5. Non-functional requirements (baked in)

- **Performance/memory:** Apex adds no per-file work beyond the host parse+query path; reuses the
  host buffer budget (NFR-003) and the worker's per-file cache-clear. No new global state.
- **Compatibility (NFR-002):** the Apex-onboarding changes are additive — a new enum value, a new
  provider-table entry, a new vendored grammar, a new query string. No shared code branches on Apex. The
  three generic shared seams (§1) are language-agnostic: two are inert until a provider configures them
  (no peer configures `extractProperties`/`extractAnnotations`, so peer output is byte-identical); the
  **empty-name guard is the one cross-language behavioural delta** — for a nameless declaration under
  error recovery, every language now emits *no* node where it previously emitted a degenerate empty-named
  one. This is a strict quality improvement (removal of malformed-only junk output), not a regression: no
  well-formed source reaches it. Per the §1 verification split, the no-regression claim is a **Gate-3/CI
  obligation** — **NFR-002 is measured by suite-green** (Constitution §1.3 / §2.2(c)): the gate confirms
  the pre-existing suite (incl. Java/Kotlin/C# resolver suites) stays green; the SDD does not assert it as
  proven. The §2.2 v1.1.0 amendment explicitly sanctions this degenerate-node guard.
- **Security:** see §6.

## 6. Security-critical tag & clauses

- **Security-critical:** **true.** *Approver:* Adam (Architect), 2026-06-28 (at the Gate 1
  decomposition checkpoint). *Rationale:* WI-1 introduces the untrusted-source Apex parse path — the
  SECT-001 trust boundary.

### SEC-001 — Untrusted Apex source parsing
- **SEC-id:** SEC-001 · **Template:** SECT-001 (Constitution §5 register).
- **CWE:** CWE-20 (Improper Input Validation) / resource exhaustion on malformed input.
- **Level:** MUST (inherits the template; not weakened).
- **Implementation pattern:** every Apex parse in the worker routes through `parseSourceSafe()` — never
  a direct `parser.parse()`; buffer sizing via `getTreeSitterBufferSize()`; a file exceeding
  `TREE_SITTER_MAX_BUFFER` is skipped; a parse failure degrades to `reportWarning` + skip. Malformed
  input never crashes the run.
- **Enforcement mechanism:** (1) the host `require-safe-parse` ESLint rule (forbids direct `.parse()`)
  — automated, CI-required; (2) a malformed/adversarial-input no-crash test.
- **Verification reference:** the malformed-input no-crash test at **Gate 3** (NFR-001 acceptance) +
  the `require-safe-parse` rule at **Gate 4 Pass 2** / CI. Concrete artifacts named by those gates.
- **Version & status:** v0.1.0, 2026-06-28, **proposed** (re-enters Gate 2).

No other CWE-backed surface exists for WI-1 (no auth/secrets/PII/financial) → no further SEC-NNN.

## 7. Verification architecture (Step 2b — Builder proposal, Architect approval pending)

- **Provable-properties catalog:** **none are Prove-classified.** Per the §A.3 decision table, WI-1
  guards no security-boundary *correctness* invariant, no financial, data-integrity, safety/regulatory,
  or concurrency invariant — it produces graph nodes from a parse. SECT-001 is a *reliability/crash-
  safety* obligation discharged by test (no-crash) + lint, not a formal proof. Every WI-1 property is
  **test-only**. (This matches the Constitution §6 calibration: Gate 5's formal-proof leg is N/A.)
  - REQ-001…004, REQ-014, NFR-003 → test-only (integration assertions on emitted nodes/edges/props).
  - NFR-001 parse-path → test-only (malformed-input no-crash) + lint (`require-safe-parse`).
  - **Explicit disposition (cascade / no-degenerate-node / no-dangling-edge invariants):** these are
    **graph-construction correctness** properties (the output graph matches the parsed source),
    finitely example-verifiable by integration fixtures — **not** §A.3 *data-integrity* in the
    sense that table guards (a persisted-store / trust-boundary integrity invariant). They are
    correctly test-only; this is the per-property statement, not a blanket denial.
- **Purity boundary map:**
  - **Pure core** — the extractors (`method-config`/`field-config`/`class-config` logic, annotation
    normalisation, query capture → node mapping): given an AST node, deterministic data out, no I/O,
    no shared mutable state. This is where WI-1's logic lives and where unit-level tests bind.
  - **(v1.2 — removed) Pure per-file fold.** v1.1 specified a per-file fold to append a positional
    disambiguator on exact id collision (the identical-signature / `Integer x, x;` case). The v1.2 revert
    collapses identical-signature duplicates to a single node (host default), so **no per-file fold
    exists** — WI-1 adds no node-id post-processing. Member-id construction is entirely the host's.
  - **Effectful shell** — grammar load (`requireVendoredGrammar`), `parser.parse`, the worker's
    file iteration / `postMessage` / disk shard writes. Owned by the host; Apex adds only the grammar
    load and a `languageMap` entry. Dependency direction: shell → core (the worker calls the pure
    extractors), never core → shell.
- **Verification tooling selection:** the host's **vitest** integration harness
  (`test/integration/resolvers/apex.test.ts`, `runPipelineFromRepo` + `getNodesByLabel` /
  `getRelationships` helpers) with fixtures under `test/fixtures/lang-resolution/apex-*`; coverage via
  the host `npm run test:coverage` floors (Constitution §3). **No formal-verification stack** (Kani/
  Dafny/TLA+) — no Prove properties exist (§A.6 inexpressibility not needed; the absence is by the
  §A.3 table, recorded here). The only tooling uncertainty — the grammar — was resolved by RESEARCH-001.
- **Constitution §6 active verification legs (carried, not just the N/A formal leg):**
  - **§6.1 malformed-input no-crash test** → Gate 3 (the SEC-001 / NFR-001 acceptance test above).
  - **§6.2 bounded smoke-fuzz** of the Apex ingestion (parse + node-emission) entry → **Gate 5**: exit
    on coverage plateau (no new edge in 5,000 executions) or a ≥10,000-execution floor, whichever
    first, ~5-min CI cap, sanitizers on, seeded with **WI-1's node-emission fixtures + an adversarial
    Apex corpus** (WI-1 has no resolver fixtures — resolution is WI-2…4); zero un-triaged crashes; a
    crash is fixed-only. (A resolution-seeded fuzz, if warranted, is an epic-level run owned by a later
    WI's gate once resolver fixtures exist.)
  - **§6 mutation run** over `languages/apex/**` → **Gate 5**: every surviving mutant killed or
    justified `verified-equivalent`.
  These three are the §6 obligations applicable to WI-1 (the §A.3 formal-proof leg is the only N/A
  one). They are named here so WI-1's verification architecture provisions them rather than deferring
  silently; their discharge is at the cited gates.
  - **Gate-assignment reconciliation (Constitution §6 "Gate 5 reduces to fuzz + mutation + safe-parse
    audit"):** the malformed-input no-crash test runs at **Gate 3** (acceptance) yet **counts toward**
    the §6 obligation — running an obligation's test earlier than Gate 5 satisfies it, it does not
    relocate it. The Constitution's **"safe-parse audit" IS the `require-safe-parse` ESLint rule**
    (one artifact, not two), enforced at Gate 4 Pass 2 / CI. So the §6 set is discharged across Gates
    3/4/5, not exclusively at Gate 5; the "reduces to" wording names the *legs*, not a single gate.
- **Property specifications:** none (no Prove properties).
- **Architect approval (purity boundary + tooling):** **APPROVED — Adam (Architect), 2026-06-28.**
  Confirmed: WI-1 is verified by tests + lint alone (no Prove properties, no formal-verification
  stack), with the pure-extractor-core / effectful-host-shell boundary as specified.

## 8. Tracker integration & Gate-3 acceptance

ITEM-001 (`active`). Sub-items: one per behavioural-contract clause (REQ-001/002/003/004/014, NFR-003,
NFR-001 parse-slice) and SEC-001; each maps to ≥1 Gate-3 test. No provable-property sub-chain (none
exist).

**Per-kind Gate-3 assertions (each kind asserted explicitly — not folded into one class+method test):**
- **REQ-001 — recognition:** a `.cls` file and a `.trigger` file each classify as Apex and dispatch to
  the Apex provider; a sample non-Apex extension's classification is unchanged (NFR-002 spot-check).
- **REQ-002 — every type kind:** a top-level **class**→`Class`, **interface**→`Interface`, **enum**→`Enum`
  node; a **nested** class/interface/enum→ a node with a qualified id (`Outer.Inner`); each with correct
  name + line range.
- **REQ-003 — every member kind:** **method**→`Method`, **constructor**→`Constructor`, **field**→`Property`,
  **auto-property**→`Property`, **enum constant**→`Property` member of its `Enum`; with the correct
  containment edge (`HAS_METHOD` for method/constructor; `HAS_PROPERTY` for field/property/enum-constant).
- **REQ-002 — `DEFINES` containment (v1.2):** a top-level type, a trigger, **and a nested type** each
  produce a `DEFINES` edge from their `File` node (host default; nested types take the File edge like
  top-level types and the Java/Kotlin benchmark).
- **REQ-003 — type-only overloads (v1.2):** `f(Integer)`/`f(String)`, `f(List<Account>)`/`f(List<Contact>)`
  (generic), and **`f(Account)`/`f(Account[])`** (array) each → two distinct `Method` nodes;
  `Foo(Integer)`/`Foo(String)` → two distinct `Constructor` nodes (distinct ids via the host's
  collision-triggered parameter-type signature) — none dropped. An **identical-signature duplicate**
  (illegal Apex) collapses to one node (host default); ids are case-preserving (case-insensitive
  matching is WI-2's resolver concern).
- **REQ-002 — `isExported` per context:** `global`→true, `public`→true, **`webservice`→true**,
  `protected`→false, `private`→false, class-member/top-level-type/**nested-type** no-modifier→false,
  **interface method (no modifier)→true**, **enum constant→true**, trigger→false. One assertion per case.
- **REQ-004 — trigger:** a `.trigger` file → one container node (`label=Class`, `apexConstruct='trigger'`,
  `isExported=false`).
- **REQ-014 — every annotated member kind:** an annotated **method, constructor, field, and property**
  each carry the normalised `@Name` in `properties.annotations` (grammar-uniform per RESEARCH-001 probe3).
- **Build/maintenance (RESEARCH-001 §3):** the manifest/vendor-dir consistency-guard test passes with
  Apex included; and a grammar-unavailable run (binding absent / `GITNEXUS_SKIP_OPTIONAL_GRAMMARS`) →
  recognised `.cls`/`.trigger` files are skipped and the run completes (no crash).
- **NFR-003 / NFR-001 (parse-slice) / SEC-001 (v1.2):** over-budget skip; the partial-tree drop rule
  (no degenerate empty-named node on any label, via the generic guard); **malformed-input no-crash
  asserted on both name-extraction paths** (the uniform `name` field; the `field_declaration` declarator
  walk); and the **nameless-owner case** — its valid-named members/nested types re-parent to File (host
  default), no degenerate node, no empty owner-segment id.

---

**Known forward dependency (rework risk, disclosed; v1.2):** WI-1 commits concrete, testable outputs
now — the `Property` member label and the `global`/`public`→`isExported` rule. **Only the `Property`
label** is subject to WI-4's REQ-012 parity confirmation (REQ-012 covers node *kind* and edge *kind*):
if the Java/Kotlin benchmark labels a field differently, **WI-4 may remap the label** — a mechanical,
additive migration. *(The nested-type containment edge is no longer a forward risk: v1.2 reverted WI-1
to the host/benchmark default — File→nested `DEFINES` — so it already matches REQ-012 parity.)* The
**`isExported` rule is WI-1's own design**, outside REQ-012's scope (a property value, not a kind), and
is not subject to that amendment. WI-1 remains independently deployable on its committed values.

*WI-2…4 SDD sections follow after WI-1 clears Gate 2 and (per the host's per-item flow) WI-1's own
downstream gates, authored in dependency order ITEM-002 → ITEM-003 → ITEM-004.*
