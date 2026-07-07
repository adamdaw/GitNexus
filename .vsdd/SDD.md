# Software Design Document — Apex Support

*VSDD §A.11. The technical contract (the **how** and **what-must-be-provable**) derived from the
approved SRS-001 and the work-item decomposition. One SDD section per work item; authored in
dependency order. **WI-1 (ITEM-001) first.***

- **Constitution version:** CONST-gitnexus-apex **v1.1.3** (v1.1.0 at SDD-001 authoring — the
  2026-06-29 §2.2 generic-seams refinement; v1.1.1 since 2026-06-30 — §2.1/§2.2 isolation scoped to
  logic, not comments; v1.1.2/v1.1.3 since 2026-07-04/05 — §1.2 admits the bounded documented-limitation
  classes (a)/(b); SDD-003 is authored under v1.1.3). Each SDD section is authored under, and Gate 2
  checks it against, the Constitution version its own header declares.
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
- **Amended v1.2.1 (2026-06-29)** — Gate-4 Pass-1 fidelity reconciliation (descriptive, no behaviour
  change): §3 previously described the multi-declarator multiplicity as a worker-level
  `.type === 'field_declaration'` discriminant, but the implemented `APEX_QUERIES` captures
  `@definition.property` on each `variable_declarator` directly, so multiplicity is intrinsic to the
  query. §3 reworded to match the as-built mechanism; REQ-003 behaviour (one Property per declarator,
  own line range) is unchanged and tested. Also added (REQ-002/003): Apex keyword/modifier matching is
  **case-insensitive** (Apex-local `modifiers.ts`) — the grammar preserves source case, so a
  case-sensitive lowercase match mis-classified `webService`/`Public`/`GLOBAL`; identifier ids remain
  case-preserving (case-insensitive *resolution* stays WI-2).

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
  `@definition.constructor` (constructor_declaration), `@definition.property` (each
  **`variable_declarator`** of a `field_declaration` — the grammar uses `field_declaration` for *both*
  Apex fields and auto-properties, with no separate `property_declaration` node — **and enum_constant**;
  all → member `Property`). **Multiplicity is intrinsic to the query (pinned):** the
  `@definition.property` capture sits on each `variable_declarator`, so a multi-declarator field yields
  **one match per declarator** (each with its own `variable_declarator` line range) with no worker-level
  node-type discriminant; `enum_constant` is captured once via its uniform `name` field.
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

---

# SDD-002 — WI-2: Resolution mechanics

- **Consumes:** SRS-001 REQ-005, REQ-006, REQ-015, REQ-007, REQ-008, REQ-009 (the user-defined
  resolution *mechanics*, verified within a single declaration unit — cross-file reach is WI-3/REQ-010);
  the NFR-001 **resolution-stage slice** + NFR-002 (cross-cutting). **RESEARCH-002** (§A.6 host-API spike,
  Architect-approved 2026-06-29) — the case-insensitive-resolution seam.
- **Constitution:** CONST-gitnexus-apex v1.1.1. **Security-critical = false** (operates on WI-1's
  safe-parsed output; introduces no new untrusted-source parse path — the SECT-001 boundary stays WI-1's).
  No new SEC clause.
- **Builds on:** WI-1's graph (container + member nodes, case-preserving ids, collision-triggered
  param-type id segments). WI-2 fills the WI-1 resolution stubs (`type-config.ts`, `import-resolver.ts`)
  and adds the call/scope hooks — all under `languages/apex/` (Constitution §2.1).
- **Amended (clarification) 2026-06-30 — REQ-005 type-usage USES (Gate-3-reliance-found-false).**
  §2 REQ-005 tagged "the host reference pass emits the `USES` edge to the type node" as a
  **[Gate-3 reliance]**. Step-3b implementation evidence: **no benchmark language emits a standalone
  `USES` edge for a plain declared type** (`Account a;`), and the host has no such reference pass for
  declarations — emitting one would exceed Java/Kotlin parity (REQ-012 scope). **Architect-approved
  clarification (Adam, 2026-06-30):** REQ-005 "type usage" resolution is exercised as the declared type
  **binding the variable's type** (the `@type-binding` that drives receiver typing), observable via the
  member access it enables — NOT as a standalone `USES` edge. A standalone type-usage `USES` edge is
  **deferred** (it would be a beyond-parity capability, akin to the type-level-annotation deferral
  REQ-106). This is the finding-#13 pattern recurring at Gate 3→Step 3b: a host-API behaviour the
  evidence-isolated spec could only FLAG, found false against the real host. Dogfood finding #20.

## 1. Design overview (the HOW, grounded in the host)

WI-2 reuses GitNexus's class-based resolution machinery (the same stack Java/Kotlin use) and supplies the
Apex-specific configs/hooks. **No resolution algorithm is reimplemented**; WI-2 provides the language
adapters the host's generic passes consume. All Apex logic lives under `languages/apex/`.

**Provider surface WI-2 fills (mirroring the JVM configs):**
- `typeConfig.extractDeclaration` / `extractParameter` — explicit-type bindings (`Account a;`) and
  parameter types for the **type-binding / receiver-typing** path, mirroring `type-extractors/jvm.ts`
  (simple-name extraction, generics stripped to the base name — `List<Account>` → `List` — because member
  lookup keys on the base type). **This representation does NOT drive REQ-008 overload disambiguation:**
  overload selection uses WI-1's raw `formal_parameter.type` **source-text** id segment (generics
  preserved, so `f(List<Account>)` and `f(List<Contact>)` stay the two distinct nodes WI-1 already emits —
  SDD-001 §3). The base-name-stripped type binding is only the receiver-typing input for member lookup.
- `callExtractor = createCallExtractor(apexCallConfig)` — extract call sites (method invocation,
  constructor `new`, property access), receiver, and argument shape.
- Ring-3 `ScopeResolver` hooks: `interpretApexTypeBinding`, `apexReceiverBinding` (instance methods bind
  `this`→enclosing type), `apexArityCompatibility` (**strict equal-arity**, on **explicit assumption
  A-WI2-1**: user-defined Apex methods take no optional/default-valued parameters and no user varargs, so
  arity is exact — a Gate-3-checkable language premise REQ-008's parameter-count narrowing depends on, not a
  silent pin; if false, an arity fixture catches it), `apexMergeBindings`
  (local-first precedence), and `emitApexScopeCaptures` — **authored** as Apex-specific scope captures
  (consistent with WI-1's own `APEX_QUERIES`; the JVM scope queries are NOT reused verbatim, because Apex's
  reference nodes — `method_invocation`/`super.x()`, `object_creation_expression`, `field_access`,
  `explicit_constructor_invocation`, `superclass`/`interfaces` — must be queried explicitly, per the
  RESEARCH-001 reference-grammar addendum, 2026-06-29).
- Edge labels are host-existing — `graph-bridge/edges.ts:42` returns `CALLS` (invocations/constructors),
  `ACCESSES` (field/property reads), `EXTENDS` (class inheritance); `IMPLEMENTS` is a
  host relationship label (`gitnexus-shared/src/lbug/schema-constants.ts:57`; `edges.ts:91` selects
  EXTENDS-vs-IMPLEMENTS by target type). (`USES` exists in the host label set, but **WI-2 emits no
  standalone `USES` edge for a bare type declaration** — type usage is realised as a type *binding*, per
  the 2026-06-30 clarification above and §8.) WI-2 emits no new label. *That the host
  resolution passes consume WI-2's captures/configs and emit these edges is a host **behaviour** —
  [Gate-3 reliance], not pinned here; what WI-2 pins is the capture/config it supplies.*

**Case-insensitivity mechanism (the WI-2-defining design — RESEARCH-002, option a).** Apex identifiers
and type names are case-insensitive, but the host resolves via **exact-string keys** at three name-key
surfaces — the member registries (`${ownerNodeId}\0${memberName}`), scope bindings, and type bindings —
none of which has a provider normalization hook, and the member-index *register* side is populated in
shared code from extracted names (so it cannot be folded Apex-locally without naming Apex in shared code).
WI-2 therefore adds a **generic §2.2 seam**: a provider-supplied
`normalizeIdentifier?: (s: string) => string` (identity default for case-sensitive peers; `toLowerCase`
for Apex). **As built, the seam folds the two surfaces whose keys are populated in *shared* code from
extracted names** — the **member registries** (insert+lookup: `registration-table`, `receiver-bound-calls`,
and the scope-resolution re-registration in `reconcile-ownership`) and the **scope-extractor class/type
declaration keys** (so the class-name binding keyspace matches the folded type bindings). The remaining
case-insensitivity is achieved **inside the Apex adapter**, not through the shared seam: **type names** are
folded where the binding is interpreted (`interpretApexTypeBinding` lower-cases the bound type name, with
`normalizeApexParamType` folding declared/inferred parameter types for the REQ-008 narrowing scan).
**Receiver-*variable* name keys are NOT folded in WI-2** — this is the documented **§2.2 ceiling**: no
single-declaration-unit fixture varies a *variable's* case (only type and member names need folding to pass
the in-unit scenarios), so variable-name normalization is deferred and revisited with the cross-file work
(WI-3). **Node ids stay case-preserving** (lookup-key ≠ display-id; the two are already decoupled in the
host). The seam names no language and is identity-transparent for every peer (NFR-002, measured). This is
the same class of generic seam §2.2 v1.1.0 sanctioned for WI-1, and is architecturally consistent with the
host's existing per-language *type* normalizer.

**Acceptance boundary.** WI-2's mechanics are verified within a **single declaration unit** (one
top-level type + its nested types) — the scope that exercises every mechanic without the cross-file
enabler (WI-3/REQ-010). Inherently cross-file epic §9 scenarios complete at WI-3; WI-2 stays independently
deployable (it resolves intra-unit references immediately).

## 2. Behavioural contract (each REQ → clause; host-structural vs Gate-3 reliance marked)

> **Verification split (finding #13).** Clauses tagged **[structural]** are pinned here (provider/seam
> wiring, edge labels, conservative-skip default — read-verifiable against the host API). Clauses tagged
> **[Gate-3 reliance]** are host-API *behaviours* that only the real host can confirm — they are
> **design obligations to validate at Gate 3 (tests vs host)**, not Gate-2 pins. The Gate-2 adversary
> reviews the wiring and the split's correctness, NOT the truth of the host-API behaviours.

- **REQ-005 (resolve unambiguous user-defined reference → resolved edge).**
  - *Precondition:* a reference (method invocation, constructor invocation, type usage, field/property
    access) whose target is a single user-defined Apex symbol reachable within the declaration unit.
  - *Postcondition:* for a **method/constructor invocation** or **field/property access**, a resolved edge
    of the host's kind (`CALLS` for invocations/constructors, `ACCESSES` for field/property reads) from the
    referencing node to the target node. For a **type usage** (a bare declared type, `Account a;`),
    resolution is the declared type **binding the variable's static type** — observable via the member
    access it enables — **not** a standalone `USES` edge (the 2026-06-30 clarification above; no benchmark
    language emits an edge for a bare declaration — REQ-012 parity). (Inheritance edges are REQ-007's, not
    duplicated here.) **[structural]** that WI-2 supplies the call capture/`apexCallConfig` (and the
    type-binding extractor) for these reference nodes (the WI-2-code fact); **[Gate-3 reliance]** that the
    host pass consumes them and selects the correct target given Apex input + the `normalizeIdentifier` seam.
  - *Invariant:* matching is case-insensitive (the seam); the emitted target id is the case-preserving id.
- **REQ-006 (no false unresolved for a REQ-005-resolved reference).** *Postcondition:* a reference that
  REQ-005 resolves emits no "unresolved" record. **[structural]** (WI-2-code fact, the only thing pinnable
  here) the `normalizeIdentifier` seam only transforms name-keys; WI-2 adds no resolution branch and no
  second unresolved-emission path. **[Gate-3 reliance]** the host's own emit-edge-XOR-record-unresolved
  behaviour — that a reference the host resolves under the seam emits no unresolved record — including the
  existence and single-pointedness of that decision in host code, validated against the real host.
- **REQ-015 (ambiguous → no binding, record unresolved; conservative).** *Postcondition:* when a reference
  does not resolve to a single target (no match, multiple matches, or unresolved receiver type), the system
  (i) emits **no binding edge** AND (ii) **records the reference as unresolved** (it appears in the host's
  unresolved/skipped-reference set — the same set REQ-006 forbids a *resolved* reference from entering, and
  that the epic acceptance metric `{ skipped: 0 for in-scope refs }` reads) — never a mis-binding, never a
  throw. **[structural]** WI-2's design decision: add no override to the host's conservative-skip default.
  **[Gate-3 reliance]** that the host at runtime both (i) skips-on-ambiguity (ambiguous-or-miss → no edge)
  AND (ii) produces the unresolved record, for Apex input — the concrete host mechanism left to Gate-3
  discovery — including case-only collisions (two symbols differing only in case → ambiguous → unresolved).
- **REQ-007 (resolve `extends`/`implements` between user-defined types → edges).** *Postcondition:*
  `EXTENDS` (class→class) and `IMPLEMENTS` edges between user-defined Apex types — `IMPLEMENTS` covering
  both class→interface (a class `implements`) **and interface→interface** (an interface `extends` of
  another interface, which the host models as `IMPLEMENTS`, Java parity — `run.ts` selects the label by
  target kind).
  **Acceptance scope (single declaration unit):** in Apex every *top-level* type is its own file (filename
  = type name), so top-level `extends`/`implements` is **inherently cross-file** — its end-to-end
  resolution completes at WI-3 via the REQ-010 enabler, exactly like REQ-005/009's cross-file forms. WI-2's
  REQ-007 acceptance is therefore the **nested-type-within-one-unit** form
  (`class Outer { virtual class Base {} class Derived extends Base {} }`), the only inheritance reachable
  inside a single declaration unit. **[structural]** that WI-2 supplies the Apex captures over the
  `superclass`/`interfaces` children of `class_declaration` (RESEARCH-001 reference-grammar addendum — Apex
  uses `superclass`/`interfaces`, not a `@reference.inherits` node). **[Gate-3 reliance]** that the host
  inheritance-edge pass emits the EXTENDS/IMPLEMENTS edge and the base-type name resolves under the seam.
  Apex has single *class* inheritance (one `superclass`), so no multiple-parent MRO walk.
- **REQ-005 delegation sub-clause (`this()`/`super()`/`super.method()` — RESEARCH-001 addendum).** Apex
  constructor delegation (`this(...)`, `super(...)`) parses as `explicit_constructor_invocation`; a
  `super` method call parses as a `method_invocation` with a `super` receiver. *Postcondition:* `this(...)`
  resolves to the sibling constructor (same type, by arity+param-type) — **always intra-type, so squarely
  single-unit**; `super(...)`/`super.method()` resolve to the parent type's member — **in-unit only when
  the parent is a nested sibling type** (top-level-parent `super` is cross-file, completing at WI-3 with
  REQ-007's top-level form). **[structural]** `apexReceiverBinding` binds a `super` receiver to the
  resolved parent type (in addition to `this`→enclosing type); **[Gate-3 reliance]** that the host resolves
  the delegated target correctly under the seam.
- **REQ-008 (overload resolution by arity + exact declared param types; SRS v1.2 head).** *Postcondition:*
  an overloaded call resolves to the overload the host's arity + exact-type narrowing uniquely selects —
  exact-type narrowing requiring **every** parameter position identical to the corresponding argument's
  static type (multi-parameter overloads) — with param-type tokens compared case-insensitively; a
  genuinely-undisambiguable assignable case (no equal-arity overload matches every position exactly) is
  recorded unresolved (REQ-015). **Argument static-type inference scope (WI-2 / WI-4 boundary):** WI-2
  infers the argument's static type for local-variable, field, literal, and constructor-expression
  arguments; a **method-parameter used as an argument** is conservatively left **untyped** in WI-2 (it
  degrades to arity-only → REQ-015 unresolved when arity cannot disambiguate, never a mis-binding).
  **Parameter-typed argument narrowing is owned by WI-4**: typing a parameter argument by its declared
  type string would equally match an *external* parameter type (e.g. `caller(Account x){ k(x) }` with
  external `Account`), wrongly resolving the §4 external-arg case that must stay unresolved — separating
  user-defined from external parameter types requires WI-4's REQ-013 external-type detection. (This mirrors
  WI-3/REQ-010 completing WI-2 mechanics' cross-file forms; the untyped parameter is exactly what keeps the
  §4 external case conservatively unresolved in WI-2.) *Comparison-symmetry invariant (like
  `normalizeIdentifier`'s insert/lookup symmetry): the argument-side type token MUST be rendered in the
  **same** raw `formal_parameter.type`
  source-text form as WI-1's declared param-type id segment (generics preserved, same whitespace/
  qualification), with the case-fold applied to **both** sides. A rendering asymmetry degrades to a false
  non-match → conservative REQ-015 unresolved (never a mis-binding).* **[Gate-3 reliance]** (c) that the
  argument-token and declared-segment renderings actually match under the host. **[structural]** the *wiring*: WI-2 supplies `apexArityCompatibility`,
  reuses the collision-triggered `~Type` id segments WI-1 already emits, **and applies the Apex-local
  param-type case-fold** (the C++ `arity-metadata` pattern — §3) so case-varied param types compare equal.
  **[Gate-3 reliance]** (a) that the shared overload-narrowing consumes the folded strings **without
  over-collapsing distinct types** (RESEARCH-002 residual reliance #3); and (b)
  the *selection outcome* — that the host's arity+exact-type narrowing picks the fixture's expected
  overload. *Derivation: the selection rule is bound by **REQ-008's own SRS v1.2 amended text** (reuse the
  Java/Kotlin benchmark's arity+exact-type narrowing), NOT by REQ-012 — REQ-012 governs node/edge **kind**
  parity only (and is WI-4's). The acceptance fixture (§8) pins a host-resolvable case.* **(See the
  Architect-decision note at the end of §2.)**
- **REQ-009 (field/property-access chains across user-defined types).** *Postcondition:* `a.b.c` resolves
  each segment's type through the host's field-access fixpoint and emits a resolved `ACCESSES` edge for
  **each** access segment of the chain (`a.b` and `(a.b).c`, to each declaring member — SRS §9's
  "declaring members", plural — consistent with REQ-005's per-access edge), not only the terminal.
  **[structural]** that WI-2 supplies the field-access capture + the `normalizeIdentifier` seam the
  fixpoint's member lookup keys on; **[Gate-3 reliance]** that the host type-env fixpoint + member lookup
  resolves the chain end-to-end under the seam within the declaration unit (cross-file chains are WI-3).

> **Architect-decision note (REQ-008 — Gate-2 R1/R3/R4; RESOLVED via SRS v1.2 amendment).** The adversary
> flagged that routing a genuinely-undisambiguable assignable-argument overload to REQ-015 (unresolved)
> weakens REQ-008's original SHALL-select. **Architect disposition (Adam, 2026-06-29): a deliberate scope
> reduction of REQ-008's selection algorithm**, formalised as **SRS amendment v1.2** (REQ-008 head + the §9
> assignable scenario, re-entering Gate 1). The operative rule is the Java/Kotlin benchmark's arity +
> exact-type narrowing — the host implements no assignability ranking for *any* language, so this is parity
> in *capability*, but it is **NOT entailed by REQ-012** (which scopes parity to node/edge kind only); it is
> an explicit narrowing under Conservatism (Constitution §1.2), documented — not a silent exception (§7).
> The acceptance fixture (§8) uses a host-resolvable case; a genuinely-undisambiguable case is REQ-015
> -unresolved, matching the benchmark. (Rejected: (c) build a conversion-rank engine — host-wide, out of
> WI-2's parity scope.)

## 3. Interface definition (what WI-2 adds)

- **`languages/apex/type-config.ts`** — fill `extractDeclaration(node)`, `extractParameter(node)`:
  return the declared simple type name (mirror `type-extractors/jvm.ts`; reuse `extractSimpleTypeName`).
- **`languages/apex/call-config.ts`** (new) + `callExtractor` in `index.ts` — `apexCallConfig` for
  `createCallExtractor`, over the RESEARCH-001 reference-grammar node types: `method_invocation` (incl. a
  `super` receiver), `object_creation_expression` (constructor), `field_access` (member/property access),
  and `explicit_constructor_invocation` (`this(...)`/`super(...)` delegation); supply receiver + arg-count
  (+ arg-type tokens where statically present). **REQ-005 "type usage"** (a declared type `Account a;`) is
  realised as the declared-type **binding** (the `@type-binding` extracted by `type-config.ts`, driving
  receiver typing), observable via the member access it enables — **not** a standalone `USES` edge (the
  2026-06-30 clarification: a Gate-3 reliance found false against the host, dogfood #20). WI-2 pins the
  type-binding extractor; a standalone type-usage `USES` edge is deferred (beyond Java/Kotlin parity).
- **`languages/apex/scope-resolver.ts`** (new) — the Ring-3 hooks (`interpretApexTypeBinding`,
  `apexReceiverBinding`, `apexArityCompatibility`, `apexMergeBindings`, scope-capture emission), wired in
  `index.ts`. Mirrors `java/*` hook shapes.
- **Generic §2.2 seam** — `normalizeIdentifier?: (s: string) => string` on the provider (or the
  resolver-config), threaded through the shared name-key sites enumerated in RESEARCH-002. **Names no
  language**; Apex supplies `toLowerCase`; default identity. Insert/lookup symmetry is the correctness
  invariant. Regression-measured against peers (NFR-002).
- **Apex-local param-type case-fold (for REQ-008 overload comparison)** — Apex normalizes its **own**
  param-type comparison strings (`toLowerCase`) so case-varied param types compare equal, the same
  **language-local** pattern C++ uses (`languages/cpp/arity-metadata.ts:normalizeCppParamType`); the shared
  overload-narrowing (`scope-resolution/passes/overload-narrowing.ts`) consumes the already-normalized
  strings. **[structural]** the Apex-local fold (the C++ precedent — a language normalizes its own
  param-type strings; no shared seam, names no language). Distinct from `normalizeIdentifier` (which keys
  member/type/binding names) and from WI-1's raw case+generics-preserving `~Type` *id* segment (node
  identity, untouched). **[Gate-3 reliance]** that overload-narrowing consumes the folded strings and
  selects correctly **without over-collapsing distinct types** (RESEARCH-002 residual reliance #3).
- **`index.ts`** — register `callExtractor`, the scope-resolver hooks, `arityCompatibility`, and
  `normalizeIdentifier`. `importResolver` stays the no-op stub (cross-file is WI-3).

## 4. Edge-case catalog (per-input checklist → each traces to a Gate-3 test, except the
param-type-rendering-asymmetry reliance, which cannot be expressed from Apex source — its
positive i-fold path is tested instead, justified in `.vsdd/tdd/WI-2-red-gate.md`)

- **Case-varied reference** — `ACCOUNT a = new account(); a.NAME` against `class Account { String name; }`
  resolves (the seam). The defining WI-2 fixture.
- **Ambiguous / case-only collision** — two members differing only in case → unresolved, not mis-bound
  (REQ-015).
- **Unresolved receiver type** — a call on a variable with no inferable user-defined type → no edge.
- **Overload resolves by exact type** — two equal-arity overloads of different declared types; the
  argument's static type is identical to exactly one → resolves to it (stage-2 exact-type narrowing).
- **Assignable arg, arity-disambiguated** — overloads of *different* arity; the argument is assignable-but
  -not-identical to the matching-arity overload → resolves by arity (assignability does not block arity
  selection). *Note: an assignable-not-identical argument can resolve ONLY by arity — stage-2 exact-type
  narrowing requires identity, so it never singles out an assignable-not-identical argument.*
- **Genuinely-undisambiguable assignable arg** — same-arity overloads of different declared types, argument
  assignable-not-identical to all → no exact match → unresolved (REQ-015), not a guess.
- **Overload disambiguable only by an external/unresolvable arg type** — overloads differing by a param
  type the argument resolves to only as an external/unresolvable symbol (sObject/stdlib) → no unique
  exact-type match → REQ-015 unresolved, no throw. *(In the acceptance fixture `OverExternalArg` the
  disambiguating argument is a method **parameter** of an external type; WI-2 leaves parameter arguments
  untyped, which is what keeps this case conservatively unresolved. Parameter-typed argument narrowing —
  which would need to tell a user-defined parameter type from an external one — is owned by WI-4 with
  REQ-013 external-type detection; see §2 REQ-008.)*
- **Param-type rendering asymmetry** — the argument-side type token rendered differently from WI-1's raw
  `formal_parameter.type` declared segment (whitespace, generic-arg spelling, qualification) → false
  non-match → conservative REQ-015 unresolved, never a mis-binding. (The comparison-symmetry invariant,
  REQ-008 §2; a Gate-3 reliance that the renderings match.)
- **Self / recursive reference** — a method calling another method on `this` resolves to the enclosing
  type's member.
- **Forward / out-of-source-order reference** — Apex resolution is declaration-order-independent: a method
  may reference a member (or nested sibling type) declared *later* in the same unit. The design relies on
  the host being **populate-then-resolve** (registries materialised before the reference pass — the host's
  two-phase finalize→emit). **[Gate-3 reliance]** that the host's pass ordering is in fact populate-then
  -resolve (a host-API behaviour, not pinned here); asserted by a fixture whose call precedes the callee's
  declaration.
- **Resolved receiver, absent member** — the receiver type resolves to a user-defined type but the named
  member does not exist on it (typo/wrong member) → no edge, recorded unresolved (REQ-015, "no match"), no
  throw. (Distinct from the unresolved-receiver-type case above.)
- **Cyclic / self-referential type chain** — a self-type (`class A { A self; }`, access `a.self.self.self`)
  cycles the receiver-type graph **within one declaration unit** (the in-unit form; the two-class mutual
  form `class A { B b; } class B { A a; }` is two top-level files = cross-file, deferred to WI-3).
  **Termination is the host field-access fixpoint's bounded convergence** (it iterates to a fixed cap, not
  the chain length) — WI-2 adds no unbounded walk of its own; **[Gate-3 reliance]** that the host fixpoint
  terminates and yields a conservative outcome (no hang, no throw) on a genuinely cyclic graph. Traced to a
  Gate-3 test whose chain exceeds the fixpoint's iteration bound.
- **External reference** — a reference to a non-user-defined symbol (sObject/stdlib) → unresolved, no
  Apex-specific defect (REQ-013 is WI-4, but the resolution slice must not throw on it).
- **Reference into a skipped/malformed file** — NFR-001 resolution slice: resolution completes, the
  reference is left unresolved, no throw.
- **Partial / error-recovery tree** — a reference inside a malformed unit → conservative skip, no throw.
- **Null/empty** — empty unit, no references → no edges, no crash.

## 5. Non-functional requirements (baked in)

- **NFR-001 (resolution-stage slice).** Resolution completes without crashing on partial/error-recovery
  trees and on references into skipped files; an unresolvable reference is left unresolved, never a throw.
  (WI-1 owns the parse-stage slice; this is the resolution-stage slice the work-items doc assigns WI-2.)
- **NFR-002.** No regression of peer-language resolution — the `normalizeIdentifier` seam is identity for
  every case-sensitive language; measured by the peer resolver suites staying green.
- **Performance:** WI-2 adds no new per-file pass; it populates configs the existing passes consume. The
  seam is an O(1) string transform at each key computation.

## 6. Security-critical tag & clauses

**security-critical = false.** WI-2 consumes WI-1's safe-parsed model; it opens no new trust boundary and
authors no SEC clause (SECT-001 remains WI-1's). The conservative-skip default (REQ-015) means a
resolution failure degrades to an unresolved reference, never an unsafe binding.

## 7. Verification architecture (Step 2b — Builder proposal, Architect approval pending)

- **Provable properties (§A.3): none.** Resolution guards no security/financial/data-integrity/safety/
  concurrency invariant — every property is test-only (same calibration as WI-1, ADR-001). Gate 5 for WI-2
  reduces to the resolution-slice no-crash fuzz + mutation over the new `languages/apex/` resolution code.
- **Purity boundary.** Pure core = the Apex resolution configs/hooks and the `normalizeIdentifier`
  transform — pure functions over the parsed model; no I/O, no mutable module state (carried from WI-1's
  audited pattern). Effectful shell = host-owned: the registry/scope-binding *insert* the normalizer feeds
  (`MethodRegistry.register` et al., per RESEARCH-002 finding 1) is the host's mutation, not WI-2's.
  Dependency direction is shell→core (the host shell calls the pure Apex transform), matching SDD-001 §7.
- **Tooling.** Host test framework (vitest) — integration resolution tests (single-declaration-unit
  fixtures) + main-thread unit anchors for the new pure functions (so the resolution logic is
  coverage-attributable, per dogfood #16 — the configs run in the parse worker_thread otherwise).
- **Gate-3 reliances (finding #13 — the explicit list to FLAG, not pin):** every host-API resolution
  *behaviour* in §2 tagged [Gate-3 reliance] — (1) target selection under the seam; (2) the runtime
  emit-edge-XOR-record-unresolved (REQ-006) and host conservative-skip-on-ambiguity (REQ-015); (3)
  MRO/receiver binding; (4) overload-selection outcome on assignable args; (5) **param-type folding
  composes with the host's overload-narrowing without over-collapsing distinct types, and the
  argument-token vs declared-segment param-type renderings actually match under the host (comparison
  symmetry, REQ-008 §2)**
  (RESEARCH-002 residual reliance #3); (6) end-to-end chain resolution incl. bounded termination on a
  cyclic type chain. Gate 3 (tests vs the real host) validates these; the Gate-2 adversary validates the
  *wiring* and the *split*, not the behaviours.

## 8. Tracker integration & Gate-3 acceptance

Each REQ clause, edge case, and the seam map to sub-items. **Gate-3 acceptance assertions** (single
declaration unit, automated): **one explicit assertion per REQ-005 reference kind, each case-varied + via
the seam** — method invocation → `CALLS`, constructor `new UserType()` → `CALLS`, type usage `UserType v;`
→ **binds the variable's type** (drives receiver typing — NOT a standalone `USES` edge; see the
2026-06-30 clarification), field/property access → `ACCESSES`; **AND each emits no unresolved record** (REQ-006's negative
— SRS §9 "no unresolved symbol is recorded"). *(The illustrative `ACCOUNT a = new account(); a.NAME` fixture
exercises type-usage + constructor + field-access; a separate fixture supplies the method-invocation case.)*
Ambiguous/case-only reference unresolved **AND recorded in the unresolved set** (REQ-015's two obligations);
resolved-receiver-but-absent-member → unresolved
(REQ-015); **nested-type** `extends`/`implements` edges (class→class `EXTENDS`; class→interface and
interface→interface `IMPLEMENTS`) + `this()` / nested-parent `super()`/`super.method()`
delegation resolve (REQ-007/005 — the in-unit form; the top-level two-class/two-file form completes at
WI-3); overload resolution (REQ-008), with all three SRS v1.2 cases pinned to intrinsic outcomes (the named
overload, by arity/exact-type — NOT "as the benchmark does"; benchmark equivalence is REQ-012/WI-4):
(i) two equal-arity overloads `f(Integer)`/`f(String)`, an `Integer`-typed argument → resolves to
`f(Integer)` by exact type; (i-fold) two **competing same-arity** overloads `f(Account)`/`f(Contact)`, an
argument statically typed `ACCOUNT` → resolves to `f(Account)` via the **param-type case-fold** (the
competing overload forces exact-type narrowing, so the fold is genuinely on the resolution path — a single
overload would bind by name+arity without entering narrowing);
(ii) different-arity overloads, an assignable-not-identical argument → resolves to the matching-arity
overload by arity; (iii) same-arity overloads, assignable-not-identical to all → REQ-015-unresolved;
(iv) multi-parameter — two equal-arity 2-param overloads, an argument tuple identical to exactly one at
**every** position → resolves; identical at some positions only → REQ-015-unresolved; the plain
count-disambiguation case (identical-typed arg, different counts → resolves) is case (ii) without the
assignable wrinkle; forward (out-of-source-order) reference resolves;
field/property chain resolves incl. bounded termination on a cyclic type graph (REQ-009); resolution-slice
no-crash on partial tree + reference into a skipped file (NFR-001); peer resolver suites green (NFR-002).
**REQ-006's negative assertion (no false "unresolved" record) is checked on *every* resolved reference
above — not only the case-varied call: the resolving overload cases (i)/(ii), the nested-inheritance and
delegation edges, the chain, and the forward reference each also assert zero unresolved record for the
reference they resolve.** The cross-file forms of REQ-005/007/009 are **not** claimed here — they complete
at WI-3.

# SDD-003 — WI-3: Cross-file binding & trigger resolution

- **Consumes:** SRS-001 (**v1.28**) **REQ-010** (cross-file binding enabler) and **REQ-011** (trigger-body
  resolution). The bounded limitations this SDD's §3/§4 handling implements are now catalogued in the SRS
  **§5.1 Bounded Limitations Register (BL-1…BL-14)** — the single normative source of truth; the
  amendment-version citations retained in §3/§4 below each trace to a BL row via the register's Source
  column. In register terms: the **valid-source heritage-form limitations** BL-1…BL-8 (REQ-007 v1.8/v1.10,
  with the v1.12/v1.28 super-arm correction — BL-8 covers the BL-1 case-varied AND BL-5 same-case-twin
  simple-name-superclass shapes, whose `super` arms resolve to the parent; BL-7 the BL-3 nested/dotted
  shape — and the v1.13 poisoned-MRO ratification folded into REQ-005/REQ-009
  v1.15), and the **invalid-source shapes** — BL-9 class-in-`.trigger` (REQ-010 v1.6), BL-10/BL-11
  misfiled / type-referenced trigger (**REQ-010 v1.14** — relocated here from the former REQ-004 v1.6),
  BL-12 duplicate case-fold collision (**REQ-015 v1.16** — the consolidation of the former v1.5 exact-case
  exception + v1.7 observability split; the same-case arm records nothing per v1.28 F1), BL-13 fragment
  collision (REQ-010 v1.9), and BL-14 misfiled-trigger
  collision (REQ-010 v1.11(c)); the NFR-001 **resolution-stage slice** + NFR-002 (cross-cutting). **RESEARCH-003** (§A.6 host-API spike,
  Architect-approved 2026-06-30; **addenda 4–17**, 2026-07-02 (Addendum 15: v1.5 per-pass arm + twin static-member probes;
  Addendum 16: heritage-downstream + poisoned-MRO probes; Addendum 17: the super-arm self-loop probe) — note Addendum 5 corrects Addendum 4's
  mechanism attribution, Addendum 7 supersedes the v1 discriminant, Addendum 12 retires the §7(8)
  cross-language reliance, and Addendum 13 retracts the exact-case-channel mechanism pin in favour of
  the behavioural shape table) — the cross-file-binding seam
  (A-3 confirmed; Seam B chosen) + the channel-model probe evidence.
- **Constitution:** CONST-gitnexus-apex v1.1.3 (§1.2 admits the bounded documented-limitation classes
  **(a) valid-source false edges** and **(b) invalid-source channel binds**, cited by BL-row against the
  SRS §5.1 register). **Security-critical = false** (operates on WI-1's safe-parsed
  output + WI-2's resolution model; introduces no new untrusted-source parse path — SECT-001 stays WI-1's).
  No new SEC clause.
- **Builds on / completes:** WI-2's resolution mechanics (SDD-002), all verified within a **single
  declaration unit**. WI-3 supplies the one **cross-file enabler** that lets every WI-2 mechanic reach across
  files, thereby **completing** (not re-owning) the inherently-cross-file epic §9 forms WI-2 deferred:
  two-class calls (REQ-005), cross-file field/property chains (REQ-009), top-level `extends`/`implements`
  (REQ-007), top-level-parent `super()`/`super.method()` delegation (REQ-005 sub-clause), and the
  cross-file-receiver form of REQ-008 overload resolution (added to ITEM-003 at Gate-2 round 3,
  Architect-approved 2026-06-30 — §1/§4/§8). WI-3 owns no
  WI-2 mechanic REQ; it owns the enabler (REQ-010) + trigger-body resolution (REQ-011).

## 1. Design overview (the HOW, grounded in the host)

Apex has **no imports and no packages**: each top-level user-defined type is its own file and is visible
**globally by its simple name** across the analysed repository. WI-2 set `resolveImportTarget: () => null`
and resolved only within a single file; the missing piece is the **cross-file visibility hook**
(RESEARCH-003 finding 5) — the host's name-lookup is already global-aware.

**Two host channels (validated against the real host, 2026-07-02, Architect-accepted).** The host
resolves cross-file names through two distinct channels, and WI-3 controls only one of them:
- **The pre-existing exact-case channel (hook-independent; BEHAVIOURALLY pinned, mechanism NOT
  pinned).** The host resolves several cross-file reference forms with no provider hook, exact-case
  only. **Its internal selection is host-interior and is not pinned** (Addendum 13 — successive
  mechanism readings mispredicted probes: a class's explicit-ctor def shares its key yet heritage
  binds; a same-named method def elsewhere does not defeat the class); it is not WI-3's design surface
  (WI-3 only registers the hook). What the SDD pins is the channel's **probe-established shape table**
  (RESEARCH-003 Addendum 13, consolidating Addenda 4–12): binds — top-level-class ctor/heritage/
  static-Property/super (incl. ctor-declaring classes and class+member name shares), the unique
  exact-case match of a case-variant duplicate pair, the lone trigger, the case-variant twin's ctor
  (the trigger — the §4 committed-to-fix shape); binds nothing — same-case duplicates, the same-name
  trigger+class twin, bare/nested references (± decoy), nested-parent heritage without a decoy, enum
  constants, and EVERY case-varied form; mis-binds — nested-parent heritage onto a same-tail top-level
  decoy (the v1.10(iv) limitation). Every limitation boundary and already-green justification below
  keys on that table, not on a mechanism narrative. One heritage-chain surface IS read-pinned as
  Apex-inert: `resolveAmbiguousInheritanceBaseViaImports` (call site `walkers.ts:364`; declaration `:530`, doc
  block `:501-529`) keys on finalized
  `ImportEdge[]`, which Apex never emits (`resolveImportTarget: () => null`). Through this
  channel the host already resolves, with no WI-3 code: cross-file **constructor calls** (`new B()`),
  **top-level `extends`/`implements`** (incl. the EXTENDS/IMPLEMENTS edge-label selection, §7(6)),
  **`super()`/`super.method()`** delegation to a cross-file parent, and **static type-name-receiver
  member access** (`B.FIELD` → ACCESSES for a static Property; also the trigger static call/field
  forms, with the edge source natively attributed to the trigger container — §7(3) static arms and the
  REQ-011 edge-source obligation hold on the real host).
- **The bindings channel (what WI-3 registers).** `walkScopeChain`'s local-first walk (per-scope
  `scope.bindings`, `walkers.ts:639-657`) over `lookupBindingsAt`'s finalized → augmented → namespace →
  `workspaceFqnBindings` channels (`walkers.ts:76-107` — the lookup itself has NO local arm; local
  precedence is the walk's per-scope check, which is exactly why §7(2)'s enclosing-scope risk exists) —
  the workspace channel is what `populateNamespaceSiblings` feeds. **Channel
  interaction (Addendum 5, ordering corrected Addendum 9):** the POST-HOOK exact-case-channel passes
  (free-call/ctor `run.ts:757`, receiver-bound `run.ts:732` — both after the hook at `run.ts:640`) run
  this same lookup BEFORE their QualifiedNameIndex fallback, so WI-3's folded workspace keys are
  reachable by them — iff each callsite's lookup name is folded (the WI-2 §2.2 seam folded the
  receiver-bound-calls and declared-type keyspaces; the SHARED ctor/free-call callsite is read-pinned
  RAW — Addendum 14 — and the reliance is whether the WI-2 Apex folding ctor path reaches the workspace
  key and precedes the raw channel, §7(11)). **The heritage pre-emit pass is PRE-hook** (`run.ts:573` < `:640`) and
  suppresses every `inherits` site from downstream retry (`run.ts:155-163`) — the workspace keys are
  structurally UNREACHABLE for heritage clauses, so the case-varied heritage forms are the ratified
  SRS v1.8 limitations, not §7(11) arms. The §3 inject-none guard governs everything the workspace
  channel serves; the QualifiedNameIndex fallback is guard-independent but itself conservative on ties. The REQ-010 gap the
  hook closes is exactly the forms the fallback channel does NOT provide: **declared-type bindings**
  (instance receivers — `B b; b.member()`, field/property chains, cross-file inherited-member lookup),
  every **case-varied** reference EXCEPT the heritage forms (the channel is exact-case; the folded key
  lives here — heritage rides the pre-hook pass where the key is unreachable, the ratified SRS v1.8(i)
  limitation),
  **enum-constant access** (`MyEnum.VALUE`, unlike static Property access), **overload narrowing**
  (all argument kinds and both receiver forms), **nested-type qualified access** (`Outer.Inner`), and
  **trigger-scope instance receivers**.

**REQ-010 — the cross-file enabler (Seam B, `populateNamespaceSiblings`).** WI-3 registers the host's
per-language `populateNamespaceSiblings` hook (contract `scope-resolver.ts:928`) on the Apex resolver. The
hook runs after `finalizeScopeModel` and before `resolveReferenceSites` (`run.ts:640` → `:687`), and injects
**every top-level user-defined Apex type** (class, interface, enum) into the host global registry
`workspaceFqnBindings`, keyed by its **`normalizeIdentifier`-folded simple name** (so the §2.2
case-insensitivity seam composes — a cross-file `ACCOUNT`/`account` reference folds to the same global key).
`lookupBindingsAt` (`walkers.ts:63`) consults `workspaceFqnBindings`. The **[structural]** facts are the
registration and the injected key set; that the lookup ranks the global channel **below** local/lexical
bindings (so a same-unit declaration shadows a same-named global) and that **every WI-2 mechanic resolves
cross-file unchanged** once the registry is populated are **host behaviours — [Gate-3 reliance]** (§2/§4/§7;
RESEARCH-003 residual #2), expected by design but validated at Gate 3, not pinned here. The receiver-typing,
member lookup, inheritance-edge, and **overload-narrowing** passes all flow through that same global-aware
lookup. The
**cross-file overloaded call is the dominant real-world Apex case** (every class is its own file, so a call
to an overloaded method on another class crosses a file boundary): REQ-010 resolves the receiver type
globally, then WI-2's REQ-008 narrowing runs over that cross-file type's overload set — it is acceptance-
tested (§4/§8), not merely asserted. **An *instance* receiver** (`B b = …; b.f(arg)`, `new B().f(arg)`) uses
WI-2's validated receiver-typing path; **a *static type-name* receiver** (`B.f(arg)`) is the shared
static-type-name-receiver resolution reliance (§2 REQ-011, §4) with its one committed fallback. **Scope
boundary:** WI-3's overload completion covers the **four argument kinds WI-2 supports** — local-variable,
**field**, literal, and constructor-expression — reached cross-file (§8); a cross-file overload whose
disambiguating argument is itself a **method-parameter** (the one kind WI-2 defers, per the ratified
SDD-002 §2 WI-2/WI-4 argument-typing boundary — parameter-typed narrowing is owned by WI-4 because it
requires WI-4's REQ-013 external-type detection to tell a user-defined parameter type from an external one)
is the intersection of
WI-3 (cross-file receiver) and WI-4 (parameter-typed-arg narrowing) and **completes at WI-4** — until then
it stays conservatively unresolved (never mis-bound), owned by neither prematurely. **Seam B over Seam A
(`emitImplicitImportEdges`):** Apex has no imports, so synthetic `IMPORTS` edges would be beyond-parity graph
noise; Java models the identical no-import same-package case with Seam B (RESEARCH-003 finding 4; Architect
sign-off 2026-06-30). This is **registration of an existing generic host seam** (Constitution §2.2) — it
names no language, is configured by the isolated provider, and is inert for every peer (each peer registers
or omits its own hook; NFR-002). **WI-3 is pure registration — no *committed* shared-code edit** (the
injection discriminant, the trigger exclusion, and the inject-none collision guard are all Apex-local, §3).
*(Superseded 2026-07-02 — a reserved, Gate-3-conditional shared edit for trigger edge-source attribution
was held here; RESEARCH-003 Addendum 4 validated the host's native trigger-container source attribution
TRUE, so that contingency is discharged. WI-3 commits NO shared edit; the one surviving CONDITIONAL
remediation that could touch shared code is §7(7)'s reserved lookup-visibility seam — subject to its own
§2.2 review at selection, never pre-sanctioned.)* *(The §2.2 receiver-**variable**-name fold WI-2 deferred as its ceiling
stays deferred — to **WI-4** parity hardening: a variable is method-local and never crosses a file boundary,
so cross-file reach, which keys on type and member names — already folded — does not need it. Closing the
WI-2→WI-3 handoff: re-deferred with rationale, not actioned.)*

**REQ-011 — trigger-body resolution.** WI-1 emits trigger container nodes and the scope query tags
`trigger_declaration` as `@scope.class` (`query.ts:41,56`); WI-2 explicitly excluded triggers from
`this`/`super` receiver-binding (a trigger declares no methods — `receiver-binding.ts:17-24`). WI-3 makes a
**trigger body's references to user-defined symbols** resolve. The canonical Apex form is a **static-style
call on a type name** — `trigger T on Account (before insert) { AccountHandler.handle(Trigger.new); }` — or
a `new AccountHandler()`. The trigger-body reference **capture** is already confirmed (the RESEARCH-003
grammar-probe addendum: a trigger body parses like a class body and the WI-2 captures fire on it), so the
**residual WI-3 design risk is purely the *resolution*** of the static type-name receiver — `AccountHandler`
typing to the class node so the member lookup finds `handle` — a shape WI-2 did not exercise (a trigger has
no `this`). SDD-003 treats this as a **design obligation validated by a concrete Gate-3 trigger fixture**.
**One committed fallback if that fixture is red:** a **trigger-scope type-binding synthesis** that binds the
static receiver's type-name to the class node it resolves to in `workspaceFqnBindings` (mirroring
`apexReceiverBinding`'s `this`/`super` synthesis, but for a type-name receiver via the global registry), all
under `languages/apex/`. It is NOT asserted as automatic, but the fallback is a single named mechanism, not
an open choice.

**Acceptance boundary.** WI-3's acceptance is the **cross-file / multi-file** form: fixtures with ≥2
top-level types in separate files (and a trigger file), completing end-to-end the §9 scenarios WI-2 verified
same-unit. WI-3 reuses every WI-2 mechanic; it adds no resolution algorithm.

## 2. Behavioural contract (each REQ → clause; host-structural vs Gate-3 reliance marked)

> **Verification split (finding #13).** **[structural]** = pinned here (hook registration, the injected def
> set, the folded global key, edge labels — read-verifiable against the host API). **[Gate-3 reliance]** =
> host-API *behaviour* only the real host confirms — design obligations validated at Gate 3 (tests vs host),
> not Gate-2 pins. The Gate-2 adversary reviews the wiring + the split, NOT the truth of the behaviours.

- **REQ-010 (resolve references between user-defined symbols in different files, no import).**
  - *Precondition:* a reference in file A whose unambiguous target is a top-level user-defined Apex type (or
    a member reached through one) declared in a different file B of the analysed repository.
  - *Postcondition:* the reference resolves to B's symbol **identical to the same reference's in-unit form**,
    by reference kind: a method/constructor **invocation** → `CALLS`; a **field/property access** →
    `ACCESSES`; an **inheritance reference** (`extends`/`implements`, REQ-007) → `EXTENDS`/`IMPLEMENTS`; a
    **bare declared-type usage** (`B b;` where B is in another file) → the declared-type **binding** (no
    standalone edge, per REQ-005 v1.3 — observable via the member access it enables) — all with **no import
    statement and no synthetic IMPORTS edge**. The match is case-insensitive (the
    folded global key) for every reference kind EXCEPT the heritage forms — for the ctor/free-call kind
    this rides the §7(11) [Gate-3 reliance] (committed WI-2-machinery extension — the folding ctor path
    reaching the workspace key; for the hit-shape the extension must precede the raw exact-case channel,
    else Phase-5 escalation), and for the qualified nested forms it rides §7(13) (outer segment) and §7(5)'s
    fold-extended fallback (tail segment), and for the static type-name-receiver member kind it rides
    §7(15)/(3)'s reliance and committed (fold-extended) fallback — reliance-backed commitments, not
    pinned host behaviour.
    The postcondition is further bounded by the ratified SRS v1.5–v1.11 exceptions — in particular the
    v1.6 class-misfiled-in-`.trigger` exclusion, the v1.9 fragment-collision inject-none, the v1.11(c)
    misfiled-trigger collision (a `.cls`-misfiled trigger poisons a valid class's folded key), and the
    heritage-downstream shapes (per §5.1 register: **BL-7** for the v1.10(iii) nested-parent shape only
    (qualified/dotted superclass) — `super()` +
    inherited-member unresolved AND the `super.method()` self-loop, a ratified mis-bind carve-out that
    rides the receiver-binding synthesis, NOT the bindings-channel lookup, so the clause's bindings-channel
    no-mis-bind invariant stands; **BL-8** for the v1.8(i) case-varied AND the v1.10(v) same-case-twin
    shapes (simple-name superclass; v1.12/v1.28-corrected) —
    `super()`/`super.method()` instead RESOLVE to the parent, only the inherited-member implicit-this arm
    unresolved, as §4/§8 state) also defeat resolution for
    their target shapes, exactly as §3/§4 catalogue — the host's inheritance
    pre-pass precedes the registration and suppresses retry, so case-varied `extends`/`implements` is
    the ratified SRS v1.8(i) bounded liveness limitation (exact-case heritage resolves via the host's
    own channel); the emitted target id is the case-preserving id. **[structural]** WI-3 registers
    `populateNamespaceSiblings`, which injects each top-level **non-`.trigger`-filed** (the §3
    extension filter — kind-agnostic: it excludes a class misfiled in a `.trigger` file and admits a
    trigger misfiled in a `.cls` file, the two v1.6 exceptions) user-defined type def
    (class/interface/enum; the §3 predicate — a host access-modifier visibility filter blocking resolution
    is the §7(7) REQ-010 [Gate-3 reliance] with its reserved remediation; whether resolving a
    non-exported type is *parity-correct* is WI-4 REQ-012 — the §3 two-dispositions split) into `workspaceFqnBindings` under its `normalizeIdentifier`-folded simple name **iff that folded key
    is unique** — a key with ≥2 distinct-`nodeId` defs injects NOTHING (the §3 inject-none guard; the
    same def seen twice dedups by `nodeId` and still injects).
    **[Gate-3 reliance]** that the host, with the global registry so populated, resolves each WI-2 mechanic
    end-to-end across files (two-class call REQ-005, cross-file chain REQ-009, top-level `extends`/`implements`
    REQ-007, top-level-parent `super` delegation, and qualified nested-type access `Outer.Inner` via the
    outer's global binding), and that the `workspaceFqnBindings` precedence shadows correctly
    (local-over-global).
  - *Invariant:* conservative skip is preserved **on the bindings channel** — a cross-file reference whose
    resolution flows through `lookupBindingsAt` and finds no unique global target (none, or two
    folded-same-name top-level types) emits no edge and is recorded unresolved (REQ-015). **The single record-observability rule (ratified as the SRS
    v1.7 REQ-015 observability interpretation; §8 aligns to it):** a positive `suppressed` outcome on the pipeline result is
    assertable **iff the ambiguity reaches the host resolver** — competing in-repository candidates of
    equal precedence (§2): overload-ambiguity among live candidates, or a member-name case-collision. A
    **type-name collision** — including a same-case duplicate top-level type name on the §1 exact-case
    channel — does **NOT** record: it binds nothing and emits no positive record, discharged by
    edge-absence alone (BL-12's same-case arm, probe-verified 2026-07-06; no mis-bind — the conservative
    default, not a §1.2(b) exception, per SRS §2/REQ-015/§9). A **guard-suppressed collision** (a duplicate/colliding folded key: two in-repository
    candidates exist, but the §3 inject-none guard never creates the key, so the ambiguity is stopped
    BEFORE it reaches the resolver — a competing-candidate ambiguity per §2, NOT a plain miss, which by §2
    requires no in-repository candidate at all) has edge ABSENCE as its black-box observable: because the
    ambiguity never reaches the resolver on the bindings channel, the positive-record obligation (which
    §2/REQ-015 attach to an ambiguity that DOES reach the resolver) does not fire there — the record, if
    any, is host-internal, not exposed on the pipeline result. Whether the host's internal unresolved counter
    fires for a pass-level typed-receiver miss is unprobed — a non-blocking **[Gate-3 reliance]** on the
    record's internal mechanism; the *observable* contract (edge absence, no mis-bind) is what §8
    asserts. So the
    §8 collision fixture asserts edge absence (guard-miss shape) while the §8 trigger-overload
    undisambiguable fixture asserts edge absence AND the `suppressed` record (ambiguity-reaches-resolver
    shape) — consistent, not divergent. Cross-file does
    not relax conservatism. **For Apex-internal duplicates this no-mis-bind property is guaranteed
    Apex-locally on that channel** by the §3 collision guard (it injects ≤1 binding per folded key), so it
    does **not** depend on the host's >1-bucket handling — that host reliance is **foreclosed** for Apex
    (§3, §7(4)). No multi-binding case is reachable on the bindings channel: the Apex-internal case is
    foreclosed by the §3 guard, and the cross-language case is structurally foreclosed (per-language-run
    registry instances — Addendum 12; §7(8) retired), covered by the §8 mixed-language NFR-002
    regression pin, not by a reliance. **The invariant does
    NOT extend to the §1 exact-case channel** (ctor/heritage/static-receiver forms): a
    case-variant duplicate binds its unique exact-case key there (BL-12's exact-case arm, Constitution
    §1.2(b)); a same-case duplicate binds nothing and emits **no record** — a type-name collision
    discharged by edge-absence alone (BL-12's same-case arm, probe-verified 2026-07-06; no mis-bind — the
    retained REQ-015 conservative default, NOT a §1.2(b) exception) (the Addendum-13 shape-table rows — probed
    behaviour, not a mechanism pin) — the documented §3 limitation (the exact-case bind is
    invalid-source-only, Architect-accepted + probe-corrected 2026-07-02), not a WI-3-controllable outcome.
- **REQ-011 (trigger body references a user-defined type/method/field → resolved edge).**
  - *Precondition:* a user-defined Apex trigger whose body references a user-defined Apex type, method, or
    field (canonically a static-style call on a user-defined handler type, or `new Handler()`).
  - *Postcondition* (per **REQ-011 v1.4**, which received REQ-005 v1.3's parity clarification): a
    method/constructor invocation (incl. a static `Type.method()`) or a field/property access resolves to an
    edge **from the trigger** (the trigger container node, per REQ-011's "from the trigger") — CALLS for an
    invocation/constructor, ACCESSES for a field/property — at parity with the same reference from a class
    body; a **bare declared-type usage** in the trigger body (`Account a;`) resolves to the declared-type
    **binding** (observable via the member access it enables), **not** a standalone edge (REQ-011 v1.4 = the
    Java/Kotlin parity behaviour, mirroring REQ-005 v1.3). **[structural — probe-confirmed]**
    the trigger-body reference *capture* is a settled grammar fact: a trigger body parses to the same
    `method_invocation`/`object_creation_expression`/`field_access` node types as a class body, and the WI-2
    reference query patterns (**unanchored** — not scoped to a `class_body`) fire on them tree-wide, with
    `trigger_declaration` tagged a container scope (`@scope.class`). Verified by the RESEARCH-003 trigger-body
    grammar-probe addendum (`AccountHandler.handle(...)` → `@reference.call.member`, `new AccountHandler()` →
    `@reference.call.constructor`, `h.name` → `@reference.read.member`). So the trigger's references are
    captured and the trigger participates as a scope like any container. The edge **originating from the trigger
    container node** is a **[structural obligation]** (REQ-011 *requirement text*, "from the trigger" — a
    target WI-3 must meet, the §8 fixture asserts it); whether the host's **default** edge-attribution already
    puts the source on the trigger (vs an inner body scope) was an **Architect-accepted [Gate-3 reliance]**
    (held 2026-06-30) — **validated TRUE 2026-07-02** (RESEARCH-003 Addendum 4: the host natively
    attributes trigger-body edge sources to the trigger container node; fixture-pinned). **The reserved
    source-attribution contingency below is therefore discharged/moot.** The source for a body
    reference is set from its enclosing scope (for a trigger body, the trigger container) — confirmed by
    the Addendum-4 probe **for the exact-case-channel forms** (static call / ctor / static access) and
    pinned by their §8 fixtures. The **instance-receiver trigger forms** (`h.process()`, `h.name` —
    emitted by the receiver-bound pass once the bindings channel serves them) were red pre-hook — as was
    every other bindings-channel trigger form, incl. the case-varied static type-name form
    (`ACCOUNTHANDLER.notify()`, outside Addendum 4's exact-case validation) — so their
    edge-source attribution is a **residual [Gate-3 reliance]** (expected identical — same
    enclosing-scope source resolution — but unobserved), with its OWN disposition split from §7(3b)'s
    typing half: the typing fallback cannot correct a wrong-source edge (source attribution lives in the
    shared emission path with no Apex-local knob), so a fixture that resolves but mis-attributes →
    Apex-local correction only if a registration-conformant hook exists, else **Phase-5 escalation**
    (the §7(2) no-Apex-local-knob pattern);
    their §8 fixtures assert the trigger-container source and validate it.
    **[Gate-3 reliance]** that the host *resolves* the captured trigger-body reference end-to-end —
    specifically the **static type-name-receiver** shape where the receiver is a *type name*, not a typed
    variable. This covers **both** a static **call** (`Handler.handle()` → CALLS) **and a static field /
    property / enum-constant access** (`MyClass.FIELD`, `MyEnum.VALUE` → ACCESSES — REQ-011's explicit "field"
    arm and REQ-010, equally a type-name receiver). It is the **shared static-type-name-receiver resolution
    reliance** (§4) — the SAME shape as a cross-file static reference `B.f(...)` / `B.CONST`; it is not
    trigger-specific, and WI-2's receiver binding covers only `this`/instance receivers, so it is unvalidated
    for both. **Enum-constant arm-specific disposition:** Addendum 4 shows the static
    Property arm resolving exact-case pre-hook while exact-case `Color.RED`/`Level.HIGH` do NOT — the
    working HYPOTHESIS (probe observes edge absence only; it cannot localise the failing half, and
    Addendum 13 retracted channel-interior inference) is a member/constant-lookup miss. The committed
    fallback therefore covers BOTH halves: the static-receiver type-binding synthesis (receiver half,
    already committed for the shared shape) PLUS an Apex-local enum-constant member-lookup arm (under
    `languages/apex/`); if the miss proves to sit in a shared surface not correctable Apex-locally →
    Phase-5 escalation (named here so a red fixture leaves nothing to improvise). **Committed fallback (one mechanism, shared across the call and field/enum-constant arms):** if
    any static-receiver fixture (trigger or cross-file, call or field) is red, a **static-receiver
    type-binding synthesis** binds the receiver's type-name — **folded via the §2.2 seam before the
    workspace lookup** — to the class/enum node it resolves to in
    `workspaceFqnBindings` (mirroring `apexReceiverBinding`'s `this`/`super` synthesis, but for a type-name
    receiver via the global registry), so the subsequent member/constant lookup proceeds — all under
    `languages/apex/`. Not an open choice.
    **[Gate-3 reliance]** that a **trigger-body local-variable (instance) receiver** also resolves — e.g.
    `AccountHandler h = new AccountHandler(); h.name` (the RESEARCH-003 probe's own instance case): resolving
    `h.name` needs the trigger-scope local `h` to receive its declared-type binding via
    `interpretApexTypeBinding`, but WI-2 validated instance-receiver typing only inside a *class* declaration
    unit and excluded triggers from receiver-binding — so trigger-scope instance-receiver typing is **not free
    fallout** of WI-2. Committed fallback if its §8 fixture is red: extend the type-binding interpretation to
    the trigger scope (under `languages/apex/`), the same class of Apex-local addition as the static-receiver
    synthesis.
  - *Invariant:* a trigger body reference to an external symbol (sObject/stdlib, e.g. `Trigger.new`,
    `Database.insert`) is left unresolved, no Apex-specific defect, no throw (REQ-013 is WI-4, but the slice
    must not throw — NFR-001).

## 3. Interface definition (what WI-3 adds)

- **`languages/apex/namespace-siblings.ts`** (new) — `populateApexNamespaceSiblings(parsedFiles, indexes,
  ctx)`: iterate each **`parsedFile.scopes`**, mirroring the Java package-siblings SCOPE-SELECTION
  discriminant only (`java/package-siblings.ts:95-105` — class-kind scope, Module-scope parent; Java
  then takes the FIRST class-like def and breaks, `:98-101`): select those scopes and — a **deliberate
  WI-3 divergence from the Java take-first** — take EVERY class-like `SymbolDefinition` from each such
  scope's `ownedDefs` into the def
  universe (a class-kind scope's `ownedDefs` also carries Property/member defs — those are excluded by
  Predicate 1; a degenerate error-recovery scope can carry more than one class-like def — ALL enter the
  universe, so the §2 no-mis-bind guarantee holds per EXISTING def and a same-folded-name pair co-owned
  by one degenerate scope still trips inject-none; a unique-keyed second def simply injects too — no
  liveness loss, nothing to ratify). **The `.trigger`-extension exclusion (case-folded) filters defs
  OUT OF this universe before grouping** — a trigger-filed def contributes NO folded key to the
  collision count (which is what preserves the §4 twin commitments: the class alone occupies the key) (the defs carry
  `nodeId`, `type`, `filePath` — the discriminant fields below). All four Apex type-declaration kinds
  create class-kind scopes (`class`/`interface`/`enum`/`trigger_declaration` → `@scope.class`,
  `languages/apex/query.ts:38-41`), so the scope shape is total over the injectable kinds. This selects
  the **top-level non-trigger user-defined type defs** (class / interface / enum) to inject.
  **Predicate 1 — def kind:** `def.type ∈ {Class, Interface, Enum}` (`SymbolDefinition.type: NodeLabel`,
  `gitnexus-shared/src/scope-resolution/symbol-definition.ts:30` — the def carries no `label` field) (inject **only type defs**, never a
  method/field/property/enum-constant member — a member must never enter `workspaceFqnBindings` as a global
  type binding, else `new foo()` could mis-bind to a method; **[structural]**). **Predicate 2 — top-level by
  OWNING-SCOPE shape (re-grounded 2026-07-02, Architect-approved):** a def is top-level **iff its declaring
  class-kind scope's `parent` is the file's Module scope** — the Java package-siblings discriminant
  (`java/package-siblings.ts:95-105`); a nested type's scope is parented to the OUTER type's class scope,
  never the module scope. It injects under its folded bare simple name. **[structural]** — read-verifiable
  scope shape on the iterated `ParsedFile.scopes`, no host-runtime/pass-ordering dependency, and it
  **reliably excludes nested types** (a bare `Inner` reference cannot mis-bind to a nested type via the
  injection, §4). **The superseded v1 discriminant** (top-level iff `qualifiedName` has no `.`) was found
  structurally FALSE on the iterated data: the Apex scope query emits no `@declaration.qualified_name`
  capture, so a nested type's resolution-side def carries a BARE `qualifiedName` (scope-extractor: capture read at
  `scope-extractor.ts:565`, bare-name fallback lands at `:591`; corroborated by the Addendum-6 probe — both nested and top-level `Inner`
  indexed under one bare key — and recorded as RESEARCH-003 Addendum 7). The graph-side `Outer.Inner`
  qualified ids (`class-config.ts` `qualifiedNodeId`) are a parse-worker surface that does not feed
  `localDefs`. This injects **every genuine
  top-level type, including a *misfiled* one** (`class Helper` in `Utils.cls` — reachable in uncompiled
  source; still bare `qualifiedName`), so no validly-named top-level target REQ-010 SHALL-resolves is silently
  dropped. (Nested cross-file access is `Outer.Inner`, resolved via `Outer`'s global binding + member lookup,
  §4 — not by injecting `Inner` globally.) It is NOT the `File→type DEFINES` edge: SDD-001 v1.2 (REQ-002) gives a
  nested type the same `File→DEFINES` edge as a top-level one, so `DEFINES` is non-discriminating.
  **Collision handling — conservative inject-none (REQ-015, parity, no invention):** when **>1
  distinct-`nodeId` def folds to one key** the injection emits **nothing** for that key (the key is absent →
  the reference falls through to REQ-015-unresolved on the bindings channel, **no mis-bind**, no sentinel
  node). This is pure REQ-015
  conservatism — no winner is picked, no Apex-specific liveness heuristic, no benchmark-anchorless invention
  (Constitution §1). In **valid** Apex this never fires (one type per file, name = filename, no duplicate type
  names). **Documented limitation (§A.13, Architect-accepted 2026-06-30; promoted to the SRS v1.9 REQ-010
  bounded exception, 2026-07-02; mechanism re-derived on the owning-scope discriminant and
  probe-confirmed, Addendum 12):** in the error-recovery parse the malformed outer's scope and def
  VANISH and the nested fragment's Class scope re-parents to the MODULE scope on the resolution side —
  so the §3 owning-scope discriminant selects it and it is injected; if its folded name collides with a legitimate
  top-level type's, the key injects nothing → that **valid** type is left cross-file-**unresolved** (never
  mis-bound). Triple-narrow (a malformed file + a re-parented fragment + an exact folded-name collision with a
  valid type), invalid-source-only, a **liveness** limitation only — safety (no mis-bind) is preserved
  unconditionally **on the bindings channel**.
  **Exact-case-channel limitation (§A.13, Architect-accepted 2026-07-02; ratified at SRS level as the
  v1.5 REQ-015 bounded exception, text probe-corrected + re-ratified same day):** the guard governs only
  the channel WI-3 writes. The pre-existing §1 exact-case channel (all languages, no
  provider hook) resolves a ctor / heritage / static-type-name-receiver reference to a duplicate simple
  name by binding the unique exact-case key when the duplicates are case-variants (`new Dupe()` bound
  with `DUPE` present — distinct keys); a SAME-case duplicate binds **nothing** (probed — the
  Addendum-13 same-case-duplicate row, conservative). Suppressing the channel for Apex would require a shared-code edit or a
  new §2.2 seam — an Apex-specific deviation from parity of exactly the kind the Gate-2 tiebreaker
  revert removed — so the behaviour is **parity-accepted and documented**: a case-variant duplicate type
  name — **invalid Apex, uncompiled-source-only** — can mis-bind those three reference forms via the
  host's language-uniform channel. Member resolution through a typed receiver stays guarded (the
  declared-type binding comes from the bindings channel, where inject-none holds). Same disposition for
  the `.trigger` exclusion below: it governs injection only; the exact-case channel binds a class-like
  def wherever it parses — one misfiled in a `.trigger` file, and (REQ-010 v1.14 corrected exception, ratified v1.6) a
  correctly-filed LONE trigger referenced as a type from invalid source (`new T()` → the trigger def;
  probe-verified) — while a trigger twinned with a same-EXACT-CASE-named class binds nothing (probed — Addendum 5/13); a
  CASE-VARIANT same-named class does NOT suppress the exact-case channel (the trigger's key stays
  unique — probed, Addendum 8), so that shape is a committed-to-fix §7(11) safety case (§4), not a
  limitation.
  **Exclude triggers by source-file extension `.trigger`, compared case-folded** — a trigger's
  `qualifiedName` is also bare (no
  `.`), so the predicate above does not exclude it; the discriminant is the def's **`filePath` ending in
  `.trigger` under a case-insensitive comparison** (the host classifies extensions case-insensitively —
  `getLanguageFromFilename` lowercases, `gitnexus-shared/src/language-detection.ts:88` — so `T.TRIGGER` /
  `H.CLS` are Apex files whose defs reach the hook with case-preserved `filePath`; a literal
  `endsWith('.trigger')` would mis-classify both) (read-verifiable on `SymbolDefinition.filePath` — the interface field
  `gitnexus-shared/src/scope-resolution/symbol-definition.ts:29`, set by the `scope-extractor.ts` def
  construction that feeds `localDefs` (Addendum 7) — NOT the
  graph-only `apexConstruct`, which lives on the `ParsedNode`, not the resolution-side def). Triggers are
  declared only in `.trigger` files; classes/interfaces/enums only in `.cls` — so inject only `.cls`-sourced
  defs. (A trigger is a *referencing* container, never a *referenced* type; injecting one would let
  `new Foo()` / `Foo.x` mis-bind to a trigger — REQ-004 non-referenceability / REQ-015.)
  **Mirror limitation — trigger misfiled in a `.cls` file (§A.13, Architect-accepted 2026-07-02; ratified
  at SRS level as the REQ-010 v1.14 bounded exception (ratified v1.6); ground corrected + re-affirmed same day):** the
  extension discriminant is a **deliberate, Architect-owned trade-off**, not an impossibility: the hook
  ctx's `treeCache` (`scope-resolver.ts:928-939` — the hook signature; the `treeCache` field at `:939`) would permit a registration-conformant
  declaration-node-kind check, but it costs a cache-miss re-parse fallback + worker-path complexity to
  fix INVALID-SOURCE-ONLY corner shapes (triggers and classes share `type=Class` on the resolution-side
  def; `apexConstruct` is graph-only) — rejected on cost/complexity grounds, re-affirmed by the
  Architect with the corrected ground. **(Constitution §1.2 basis, R3-clarified:** the suppression the
  discriminant forgoes is genuinely Apex-local (a `treeCache` AST node-kind check, the pattern the csharp
  namespace hook uses) but NOT cheap — in worker mode `treeCache` is empty (native tree-sitter Trees cannot
  cross MessageChannels), so a robust check needs a bespoke Apex-local worker-mode fallback scanner, exactly
  as csharp built `extractCsharpStructureViaScanner` (`csharp/namespace-siblings.ts:294,308`); that build
  cost, for an INVALID-SOURCE-ONLY corner, is BL-10's departure ground. Constitution §1.2's enumerated
  grounds — shared-code coupling / trade-one-inconsistency — are the *illustrative* typical cases, not an
  exhaustive gate; BL-10 is admitted under §1.2's general Architect-ratified, fixture-pinned, narrow,
  uncompiled-source-only bounded-limitation framing.)** So a
  `trigger_declaration` *mis-declared* in a `.cls` file passes both predicates and **is injected** as a
  referenceable global name: a reference to that name can bind the trigger def (for a correctly-filed
  trigger the exclusion prevents exactly this). **Invalid Apex** (a trigger is declared only in a
  `.trigger` file), uncompiled-source-only, bounded to the misfiled def's own name; symmetric with the
  class-in-`.trigger` mirror (§4) and pinned by a §8 fixture.
  **Injection policy = inject-all (REQ-010 determinate, a deliberate *permissive* choice — NOT the
  Constitution §1.2 "conservatism" term):** WI-3 injects every top-level non-trigger type **irrespective of
  access modifier** (`public`/`global`/`private`) — the **denotational code-graph default** (GitNexus graphs
  and resolves symbols; it does not enforce Apex compile-time visibility). This is deliberately permissive
  (it resolves references Apex's compiler would reject), not the §1.2 "conservatism" term. **[Gate-3
  reliance]** that a non-exported top-level type so injected actually resolves cross-file — i.e. that the host
  global lookup does **not** itself visibility-filter (WI-1 built an `exportChecker` precisely because the
  host tracks `isExported`, so whether the lookup honours it is an unprobed host behaviour, not pinned).
  **Two distinct dispositions (do not conflate):** (a) *whether it resolves* — a cross-file reference to a
  `private`/no-modifier top-level type is **invalid Apex** (outside §1's valid-source SHALL boundary), so
  its resolution is a **disclosed forward-dependency**, not a committed REQ-010 SHALL: WI-3 does not
  visibility-filter (inject-all is the code-graph default), so it resolves *under the current design*, but
  the resolve-vs-filter decision is deferred; (b) *whether resolving it is parity-correct* — a **WI-4
  REQ-012** question (WI-4 may add a visibility filter to match the benchmark), a disclosed
  forward-dependency in the manner SDD-001 disclosed for the `Property` label. The §8 acceptance therefore
  pins only no-throw and no-mis-bind; the resolve/filter outcome is not a committed WI-3 SHALL. **Injection algorithm (one procedure, no get-or-create-then-push):** first
  **group the def universe** (every class-like def owned by a Module-parented class-kind scope, MINUS
  `.trigger`-filed defs — the case-folded extension filter runs before grouping) by the
  `normalizeIdentifier`-folded simple name; then for each key
  inject a binding into `workspaceFqnBindings` — the key is **`normalizeIdentifier(def.qualifiedName)`**
  (the def's only name-bearing field; guaranteed BARE for the owning-scope-selected top-level defs by the
  extractor fallback `qualifiedName: nameCap.text`, `scope-extractor.ts:591`) — **iff the group has
  exactly one distinct `nodeId`**; a key
  with ≥2 distinct-`nodeId` defs injects **nothing** (it is never created). No candidacy tier exists —
  any unique-keyed universe def injects (no non-first liveness loss). The injected value is
  **`{ def, origin: 'namespace' }`** with no `via` — the csharp workspace-channel precedent
  (`csharp/namespace-siblings.ts:688`; `origin` is required on `BindingRef` and at least one host
  consumer discriminates on it). So a folded key carries **at most
  one** Apex binding by construction; the no-mis-bind safety property is **guaranteed Apex-locally at
  injection** (no 2-binding Apex bucket can ever form). **This forecloses the §2 / §7(4) "host treats a
  >1-bucket as ambiguous" reliance for Apex-internal duplicates** — a >1 Apex bucket can never reach the host
  lookup (the guard injects ≤1 per key), so that reliance is moot for Apex; the only reachable multi-binding
  case is the cross-language one (next).
  **Cross-language registry non-interference is structurally FORECLOSED (read-verified 2026-07-02,
  Addendum 12 — retires the formerly Architect-accepted §7(8) reliance):** `workspaceFqnBindings` is a
  FRESH per-language-run map (`finalizeScopeModel` constructs `new Map()` per call,
  `finalize-orchestrator.ts:155`; the phase runs `runScopeResolution` once per registered language over
  extension-partitioned files, `phase.ts:306,425`) — the `scope-resolution-indexes.ts:81` doc's "shared"
  means shared across SCOPES, not languages. A peer entry and an Apex reference can never meet in one
  map, so NFR-002 safety on this surface is **pinned structurally**; the §8 mixed-language fixture is an
  ordinary NFR-002 regression pin, not a reliance vehicle. **Single-registry pin (R4-2, Architect-approved 2026-07-02):** WI-3 writes `workspaceFqnBindings`
  ONLY. The csharp global-namespace precedent additionally writes `workspaceTypeBindings`
  (`csharp/namespace-siblings.ts:484-493`, the receiver-type walker's final fallback); WI-3 deliberately
  omits that second write — **[Gate-3 reliance]** (§7(12)) that Apex declared-type/instance-receiver
  typing resolves the injected type names through `lookupBindingsAt` (the WI-2 `interpretApexTypeBinding`
  path with folded names) without the `workspaceTypeBindings` channel; **committed remediation surface if
  a receiver-typing fixture is red:** add the `workspaceTypeBindings` write to the same Apex hook (an
  Apex-local addition, no new seam). Mirrors `languages/csharp/namespace-siblings.ts` (the
  global-namespace path) in mechanism, scoped to the single registry. **WI-3 is pure registration — no shared-code edit, no new seam** (the discriminant, the trigger
  exclusion, and the collision guard are Apex-local). **Purity boundary (restated):** the pure core is the def-selection + key-folding computation (a
  standalone helper, unit-anchored per §7); the hook itself is the **effectful shell writer** — it
  performs the sanctioned post-finalize append into `workspaceFqnBindings` via the localized
  ReadonlyMap→Map cast, exactly as the csharp precedent does (`csharp/namespace-siblings.ts:639`).
- **`languages/apex/scope-resolver.ts`** — register `populateNamespaceSiblings: populateApexNamespaceSiblings`
  on `apexScopeResolver`. (`resolveImportTarget` stays `() => null`; `propagatesReturnTypesAcrossImports`
  stays `false` — no imports.)
- **Trigger-body / static-receiver resolution (REQ-011 + cross-file static call)** — capture is
  probe-confirmed (§2), so the only addition the Gate-3 fixtures might force is the **single committed
  mechanism**: a **static-receiver type-binding synthesis** that binds a static *type-name* receiver
  (`Handler.handle()`, `B.f()`) to the class node it resolves to in `workspaceFqnBindings` — **folding
  the receiver type-name via the §2.2 `normalizeIdentifier` seam before the workspace lookup** (the
  workspace keys are folded; `apexReceiverBinding` performs no fold — the §7(5) fold-extended wording
  pattern) — mirroring
  `apexReceiverBinding`'s `this`/`super` synthesis but for a type-name receiver — under `languages/apex/`
  (Constitution §2.1). Built only if a static-receiver fixture is red (the host may already resolve it via
  REQ-010); not pre-built speculatively. One mechanism, one hook site — not an open choice.
- **Nested-type cross-file resolution (REQ-010 SHALL — `Outer.Inner`)** — `Outer` resolves globally (the
  injection); `.Inner` resolves as a nested-type member lookup on `Outer`'s binding. This is an **unambiguous
  reference REQ-010 SHALL resolve** — so it is **committed to resolve**, NOT de-scoped: if the host's member
  lookup does not natively resolve a nested *type* as a member of its outer's global binding (a Gate-3
  reliance), the **committed fallback** is a nested-type member-resolution addition under `languages/apex/`
  (the same "commit a mechanism to satisfy the SHALL" pattern as the static-receiver fallback) — never a
  silent conservative-unresolved (which would be an unsanctioned REQ-010 reduction, Constitution §7).
- **No committed shared-code edit, no new seam, no new dependency, no new edge label.** WI-3 registers the
  existing `populateNamespaceSiblings` hook and reuses WI-2's captures/labels and the `normalizeIdentifier`
  seam; the top-level discriminant, the trigger exclusion, and the inject-none collision guard are Apex-local
  in `namespace-siblings.ts`. There is NO COMMITTED shared edit; the sole prior
  contingency (trigger edge-source attribution, §1/§2) was validated moot 2026-07-02 (Addendum 4), and the
  one surviving conditional remediation that could touch shared code is §7(7)'s reserved
  lookup-visibility seam (its own §2.2 review at selection).

## 4. Edge-case catalog (per-input checklist → each traces to a Gate-3 test)

- **Two-class cross-file call** — file A's method calls a method on a top-level type in file B → `CALLS`
  across files (REQ-005 two-file form, completing the WI-2 same-unit case).
- **Cross-file field/property chain** — `a.b.c` where the declaring types span files → per-segment
  `ACCESSES` across files (REQ-009 cross-file form).
- **Top-level inheritance** — `class Derived extends Base` / `class Impl implements Iface` with the
  parent/interface a top-level type in another file → `EXTENDS`/`IMPLEMENTS` (REQ-007 top-level form).
- **Top-level-parent `super`** — `super()` / `super.method()` where the superclass is a top-level type in
  another file → resolves to the parent member (REQ-005 delegation top-level form).
- **Cross-file overloaded call (the dominant real-world case)** — file A calls an overloaded method on
  top-level type B (in file B) declaring `f(Integer)`/`f(String)`, `arg` statically `Integer` → resolves to
  `f(Integer)`; an undisambiguable case → unresolved (REQ-015). REQ-008 narrowing (WI-2) composes with REQ-010
  global receiver resolution. **Two receiver forms:** an **instance** receiver (`B b = …; b.f(arg)` /
  `new B().f(arg)`) uses WI-2's validated receiver-typing path; a **static type-name** receiver (`B.f(arg)`)
  is the **shared static-type-name-receiver resolution reliance** (§2 REQ-011) with its one committed
  fallback — the same shape as the trigger static call, not assumed free. **[Gate-3 reliance]** that global
  receiver resolution + overload narrowing compose end-to-end across files (both receiver forms).
- **Cross-file inherited-member resolution** — child type in file C `extends` a parent type in file B, the
  referenced member is declared on the parent → resolves to the parent member (REQ-005/007 cross-file
  inheritance ∘ member lookup). **[Gate-3 reliance]** that the host's MRO/member lookup walks the cross-file
  parent once the parent is globally visible (expected to be fallout of REQ-010 + the host `buildMro`/member
  lookup WI-2 configures — the MRO includes C's now-globally-visible superclass B). **Committed fallback if
  its §8 fixture is red:** a cross-file superclass member-walk addition under `languages/apex/` (the same
  class of Apex-local addition as the nested-type and static-receiver fallbacks) — **never** a silent
  conservative-unresolved, which would reduce a REQ-005/007 SHALL without an SRS amendment (Constitution §7).
- **Heritage-limitation downstream family (SRS v1.11(a)/(b) → v1.12/v1.28-corrected)** — WHERE a heritage
  clause is unresolved (v1.8(i)/v1.10(iii)/(v) shapes), the subtype's MRO lacks the parent, so its
  **MRO-dependent inherited-member implicit-this** references remain unresolved (Addendum 16). The
  **`super` arms diverge from the MRO path for the simple-name-superclass shapes (SRS v1.12/v1.28,
  Step-3b probe-confirmed — the v1.8(i) case-varied shape AND the v1.10(v) same-case twin, register
  BL-8):** `super()` and `super.method()` DO resolve to the parent — the `super`-receiver
  synthesis folds the superclass identifier from the `extends` clause and consults the cross-file
  registration channel independently of the heritage pre-pass, reaching the parent even though the
  EXTENDS/IMPLEMENTS *edge* stays unresolved (`CaseKid` → CALLS into `Base.Base`/`Base.greet`, with no
  EXTENDS edge to Base — the two mechanisms have independent cross-file reach). This supersedes the
  earlier v1.11(a) `super()`-unresolved / `super.method()`-self-loop pins for BOTH simple-name-superclass
  shapes (v1.8(i) case-varied at v1.12, v1.10(v) same-case twin at v1.28); **only the v1.10(iii)
  nested-parent shape (qualified/dotted superclass, register BL-7) remains on those pins** — `super()` +
  inherited unresolved, `super.method()` self-loops to the subtype's own override. The v1.10(iv) MIS-BOUND-heritage MRO
  **tripwire FIRED at Step 3b and is RATIFIED (SRS v1.13)**: a typed-receiver member call on the subtype
  (`Sub s; s.decoy2()`) rides the mis-bound MRO into the decoy's member and resolves there — the
  internally-consistent consequence of the ratified mis-bound EXTENDS edge (pin 767). Pinned as a
  documented, bounded false edge (the triple-narrow v1.10(iv) shape), NOT suppressed: keeping the EXTENDS
  edge while dropping its members would trade one inconsistency for another (an edge absent from its own
  MRO). **Committed fix = the WI-4 pipeline reorder** (heritage resolved after the WI-3 registration binds
  the real `TOuter.TInner`) — see ITEM-004.
- **Non-colliding re-parented fragment (error-recovery input; documented behaviour, not a
  limitation)** — a malformed outer's nested fragment re-parents to the Module scope (Addendum 12), so
  when its folded name is UNIQUE the §3 algorithm deterministically injects it: a cross-file reference
  to the fragment's name (incl. case-varied, via the folded key) binds the fragment — consistent with
  WI-1's NFR-001 re-parent precedent (the recovered parse makes the fragment a de-facto file-scoped
  top-level def; no SHALL is narrowed — added liveness on invalid source, no mis-bind: the key is
  unique by hypothesis, and the colliding branch is the ratified v1.9 inject-none). §8 fixture pins the
  bind.
- **Misfiled-trigger collision (SRS v1.11(c), probe-corrected)** — a trigger mis-declared in a `.cls`
  file enters the injection universe (the round-26 extension-discriminant trade-off), so a
  same-folded-name VALID class gets inject-none: its bindings-channel forms remain unresolved. The
  CASE-VARIANT sub-shape's exact-case forms still resolve via the host channel; the SAME-case sub-shape
  loses those too (the Addendum-13 twin-analog refusal row). Misfile-triggered, liveness-only;
  fixture-pinned per sub-shape (the §8 fixture pins the case-variant sub-shape; the same-case sub-shape
  is family-pinned by the **same-case-duplicate fixture** — the mechanically identical shape: two
  same-folded-key universe defs trip inject-none AND two same-exact-case class-like defs refuse on the
  exact-case channel; the valid-twin fixture is NOT the anchor — there the trigger def is
  extension-filtered OUT of the universe and the class wins).
- **Nested-parent heritage (`class Sub extends Outer.Inner` — valid Apex, SRS v1.10)** — rides the
  PRE-hook heritage pass (Addendum 9), unreachable by the injection and every WI-3 fallback; probed
  (Addendum 11): no-decoy → **unresolved** (the v1.10(iii) liveness limitation); with an unrelated
  same-named top-level type → the clause **mis-binds to that type** (the v1.10(iv) safety limitation).
  Both fixture-pinned as documented behaviour, never as correct resolution. (The nested-qualified
  RESOLUTION commitments — §7(5)/(13) — cover the post-hook reference kinds only: declared-type/member
  and constructor forms, NOT the heritage form.)
- **Cross-file interface-typed declared variable (`Iface v; v.act()` — the Interface arm of
  Predicate 1)** — an interface-typed declaration binds via the injected Interface entry and enables the
  member resolution (exact AND case-varied forms) — the only acceptance that observes an Interface def's
  workspace entry doing work (the heritage fixtures ride the pre-hook channel and cannot). §8 fixture.
- **Cross-file member case-collision (ambiguity-reaches-resolver, REQ-015 two obligations)** — a
  cross-file typed receiver onto a class declaring case-colliding members (`class CaseColl { act; ACT; }`,
  cross-file `c.Act()`) → no edge AND a positive `suppressed` record (the WI-2-validated case-collision
  shape reached through the WI-3 binding; the §2/SRS-v1.7 assertable-record shape beyond the two
  overload forms). §8 fixture.
- **Cross-file constructor-overload completion (REQ-005 ∘ REQ-008 ∘ REQ-010)** — `new B(7)` against a
  cross-file `B(Integer)`/`B(String)` → CALLS targeting the **`B(Integer)` Constructor node** (pinning
  target-node identity with the in-unit form — the workspace binding is the Class def, so whether the
  ctor edge refines to the declared Constructor node as in-unit is part of the §7(1) end-to-end
  reliance, fixture-validated; the EXACT-case form validated TRUE pre-hook — the host channel already
  refines to the Constructor node, an already-green acceptance per the red-gate ledger); a same-arity undisambiguable ctor argument → unresolved + `suppressed`
  record (the ambiguity-reaches-resolver shape). Constructor-overload selection is a WI-2 mechanic
  (SDD-001 Constructor nodes; SDD-002 arity+param-type delegation), so its cross-file completion falls
  under the header's "every WI-2 mechanic" claim, mirroring the method-overload fixtures.
- **Cross-file mutual / cyclic type chain** — `class A { B b; }` in file A and `class B { A a; }` in file B
  (the two-file mutual form SDD-002 §4 deferred to WI-3), access `a.b.a...` → resolves the reachable
  segments and **terminates** (the host field-access fixpoint's bounded convergence, as in the WI-2 in-unit
  cyclic case), no hang/throw. **[Gate-3 reliance]** that the fixpoint terminates on a cross-file cyclic
  receiver-type graph.
- **Case-varied cross-file reference** — `ACCOUNT`/`account` referencing a type defined in another file
  resolves via the folded global key (the §2.2 seam composing with REQ-010).
- **Trigger static handler call** — `trigger T on Account (...) { Handler.handle(...); }` → `CALLS` to the
  user-defined `handle` (REQ-011 canonical form).
- **Trigger constructor / field reference** — `new Handler()` or a user-defined type/field reference in a
  trigger body → resolved edge (REQ-011).
- **Cross-file reference to a non-existent or external type** — no unique user-defined global target →
  unresolved (REQ-015), no throw; an external sObject/stdlib reference is benign-unresolved (REQ-013/WI-4,
  but no throw here). Asserted by a dedicated §8 fixture reference (`new Missing()` / `m.poke()` with no
  `Missing` declared anywhere → zero edges, run completes).
- **Duplicate global simple name** — two top-level types folding to one global key → the §3 guard injects
  **nothing** for that key → the **member path** (typed-receiver resolution, e.g. `Dupe d; d.hit()`) is
  unresolved Apex-locally, never mis-bound (REQ-015), with **no reliance on the
  host's >1-bucket handling** (foreclosed, §3/§7(4)). The **ctor/heritage/static-receiver forms** flow
  through the §1 exact-case channel: a case-variant duplicate binds its unique exact-case
  key; a SAME-case duplicate binds nothing (probed — Addendum 13) — the documented §3
  limitation (parity-accepted 2026-07-02), pinned by fixture as host behaviour, not a
  WI-3 outcome. Reachable because GitNexus graphs **uncompiled** source
  (SDD-001 §4) — Apex *compilation* would forbid a duplicate type name, but the analyser must not.
- **Local shadows global** — a same-unit declaration of a name that also names a top-level type elsewhere →
  the local binding wins (the SRS-required outcome, REQ-015 no-mis-bind on valid source). **[Gate-3
  reliance]** on the host precedence — genuinely at risk for the **enclosing-scope shape** (§7(2)): the
  canonical Apex form is a nested type declared in the outer type, referenced from the outer's METHOD
  body, while another file's top-level same-named class sits injected under the folded key; the
  scope-independent workspace channel is consulted at the method scope first, so the walk may return the
  global before reaching the declaring class scope. The §8 fixture pins this exact shape; red → Phase-5
  escalation (§7(2)). *(A method-local shadowing TYPE declaration — the other chain-level shape — is not
  expressible in Apex: types cannot be declared in method bodies, so the nested-type shape is the only
  reachable enclosing-scope case.)*
- **User-defined top-level type shadows an external/sObject of the same name** — inject-all registers a
  user-defined `class Account` under the folded key `account`; a reference `new Account()` / `Account a;` then
  resolves to the **user-defined** node, not the external sObject `Account`. This is the **intended
  precedence** (REQ-005 resolves in-repository user-defined symbols; the external/sObject interpretation,
  REQ-013/WI-4, is the fallback **only** for a name with *no* user-defined top-level type). The resolution
  outcome rides the §7(1) end-to-end [Gate-3 reliance] (the injected binding winning for the typed-receiver
  member form) — asserted by a §8 fixture, not pinned. No throw; the
  external case stays unresolved precisely when there is no user-defined type of that name.
- **Nested-enum constant access (`Outer.Mood.UP`, valid Apex)** — the nested-member lookup composed
  with the enum-constant arm (§7(5)/(13) ∘ §2), exact-case + case-varied; committed under the same
  fallback classes, never de-scoped (the earlier not-expressible claim covered inner-CLASS statics
  only). §8 fixture.
- **Nested-type cross-file qualified access, all case dimensions** — `Outer.Inner`, outer-varied
  `OUTER.Inner` (§7(13)), and tail-varied `Outer.INNER` (§7(5)'s fold-extended fallback) each referenced
  from another file **resolve** — the REQ-010 case-insensitivity SHALL has no silent gap in the
  qualified form. Base bullet: `Outer.Inner` referenced from another file **resolves**
  (REQ-010 SHALL — an unambiguous user-defined cross-file reference): `Outer` is globally visible (REQ-010)
  and `.Inner` resolves as a nested-type member lookup on it. **[Gate-3 reliance]** that the host resolves a
  nested *type* as a member of its outer's global binding (RESEARCH-003 validated simple-name visibility, not
  this); but resolution is **committed, not de-scoped** — if the host lacks it, the **committed fallback is a
  nested-type member-resolution addition** under `languages/apex/` (the "commit a mechanism to satisfy the
  SHALL" pattern, §3), NOT a silent conservative-unresolved (which would reduce REQ-010 without an SRS
  amendment — Constitution §7). §8 asserts resolution.
- **Dotted-tail collision (nested `TOuter.TInner` + unrelated top-level `class TInner`)** — the
  exact-case channel binds **nothing** into the decoy (probed 2026-07-02, Addendum 6/13 — behaviour
  pin, not a mechanism claim);
  post-injection the qualified reference resolves to the NESTED type via the outer's global binding +
  member lookup (§7(5)), never to the same-named top-level decoy. Fixture asserts both halves.
- **Nested type not injected by bare simple name (no mis-bind via the injection; WELL-FORMED parses)** —
  a nested type's scope is parented to the outer type's class scope, so the §3 owning-scope discriminant
  **excludes** it from the global injection (on error-recovery input the Addendum-12 exception applies —
  the re-parented-fragment bullet below); a bare `Inner` reference from another file finds no WORKSPACE `Inner` binding
  and stays conservatively unresolved on the bindings channel (REQ-015). (Nested types are reachable only
  as `Outer.Inner`, the bullet above. The exact-case channel indexes the nested def under its BARE
  `qualifiedName` — Addendum 7 — but the ctor/free-call arm binds TOP-LEVEL types only: probed in BOTH
  repo shapes (Addendum 10 — no-decoy single-candidate: no edge; with a top-level decoy: no edge), so
  the bare cross-file reference emits nothing either way; the internal reason the
  ctor arm skips nested defs is unpinned — the OUTCOME is fixture-pinned per shape, black-box.)
- **Valid nested/top-level name share (`class Outer { class Helper {} }` + top-level `class Helper` —
  LEGAL Apex)** — under the owning-scope discriminant only the TOP-LEVEL `Helper` is selected, so the
  inject-none guard sees ONE def per folded key: the top-level type injects and resolves cross-file
  (REQ-010 preserved on valid source — the v1 discriminant would have falsely collided here); the nested
  `Helper` stays reachable as `Outer.Helper`. §8 fixture pins the share.
- **Class misfiled in a `.trigger` file vs a same-named correctly-filed class** — the misfiled def is
  filtered out of the injection universe (the extension filter), so it does NOT guard-collide: the
  valid `.cls`-filed class injects alone and resolves (no poisoning; the misfile costs only its own
  def's visibility, per the v1.6 exception).
- **Class misfiled in a `.trigger` file (documented limitation; ratified as the REQ-010 v1.6 bounded
  exception)** — the trigger exclusion keys on
  the `.trigger` extension (triggers and classes share `type=Class`, and `apexConstruct` is graph-only, §3),
  so a class/interface/enum *mis-declared* in a `.trigger` file is excluded from **injection**: its
  case-folded / typed-receiver-member forms stay cross-file-unresolved on the bindings channel. Its
  exact-case ctor/heritage/static-receiver forms still bind via the §1 fallback channel (verified:
  `new Rogue()` binds the misfiled class) — the same parity-accepted fallback-channel disposition as the
  duplicate case (§3). This is **invalid Apex** (a `.trigger` file holds exactly one trigger; types go in
  `.cls`), so it is an invalid-source-only limitation — symmetric in spirit to the `.cls`-misfile
  case (which *is* injected) but dropped from injection because the extension is the only available
  trigger discriminant. No throw.
- **Same-case duplicate type name (`class Samey` in two files)** — the exact-case channel binds
  **nothing** and emits **no record** — a type-name collision discharged by edge-absence alone (BL-12's
  same-case arm, probe-verified 2026-07-06; no mis-bind — the retained REQ-015 conservative default, not a
  §1.2(b) exception) (the Addendum-13 same-case-duplicate row — probed); and the §3
  inject-none guard keeps the bindings channel empty for the folded key → the typed-receiver member form
  is edge-absent there → all forms conservatively unresolved (no bind, no record); pinned by fixture (the
  REQ-015 type-name-collision no-record shape governs, no v1.5 exception fires).
- **Lone correctly-filed trigger referenced as a type (`new T()`/`extends T`, only `T.trigger` in the
  repo)** — invalid referencing source; the exact-case channel **binds the trigger** (the Addendum-13
  lone-trigger row — probed behaviour) (probed: CALLS/EXTENDS into `Class:T.trigger:T`)
  — the REQ-010 v1.14 corrected exception (ratified v1.6), pinned by fixture as documented-limitation behaviour. The
  bindings channel never serves it (the §3 exclusion), and a same-named class flips it to the twin case
  below.
- **Case-variant trigger/class twin (`Twist.trigger` + `class TWIST` — valid Apex)** — the trigger's
  exact-case key stays unique, so pre-impl the exact-case channel binds `new Twist()` to the TRIGGER
  (probed, Addendum 8) — a REQ-004 breach / mis-bind on valid source. **Committed to fix (Architect,
  2026-07-02):** post-injection the folded workspace key `twist` holds the class (trigger excluded), and
  the reference MUST bind the class — riding the sharpened §7(11) reliance — the class-wins outcome
  holds iff the WI-2 folding ctor path (which already folds in-unit ctor references) reaches the
  injected workspace key AND claims the reference before the raw exact-case channel; **if the fixture is
  red at Gate 3 the remediation is the §7(11) committed fallback (extend the WI-2 machinery) where
  ordering permits, else Phase-5 escalation** — nothing left to improvise.
  §8 fixture asserts class-wins for the ctor, instance-member, AND static-type-name-member
  (`Twist.buzz()` — probed binding NOTHING pre-hook, Addendum 15: no mis-bind; class-wins rides the
  §7(15) receiver-bound reliance with its single committed fallback) forms. **The heritage arm of the twin**
  (`class Sub extends Twist`) is DIFFERENT: it resolves in the PRE-hook heritage pass (Addendum 9),
  where the injection can never intercept — the trigger binds (the Addendum-5 lone-trigger analog) —
  ratified as the SRS v1.8(ii) bounded safety limitation, fixture-pinned as documented behaviour.
- **Valid same-name trigger + class (`Foo.trigger` + `Foo.cls`, the SDD-001 §4 valid pair)** — the §3
  exclusion drops the trigger def from injection, so the **class alone** is injected under the folded key:
  a cross-file reference (`Foo f = new Foo(); f.run()`) resolves to the **class**, and **no resolution
  edge ever targets the trigger def** (REQ-004 non-referenceability, fulfilled on the bindings channel).
  Probed on the real host (2026-07-02): pre-injection the exact-case channel does NOT mis-bind the twin
  pair — it resolves neither (a pre-WI-3 liveness miss on valid source that the injection closes). **The heritage arm** (`class Sub extends Foo`) is the SRS v1.10(v) limitation: the pre-hook pass sees
  two defs under the exact-case key and conservatively refuses — unresolved, no mis-bind (probed;
  fixture-pinned). **The other
  two arms differ mechanically but are BOTH asserted:** `Foo f`/`f.run()` rides the folded declared-type
  keyspace (WI-2-validated fold) and is asserted as the injection's outcome (genuinely red pre-impl); the
  `new Foo()` ctor edge cannot come from the exact-case channel post-injection (the twin key still holds
  2 defs → nothing) and reaches the folded workspace key via the §7(11) callsite-folding reliance — an
  unambiguous valid-source REQ-005/REQ-010 SHALL, so it is asserted under the SAME §7(11) reliance +
  committed fallback class as the `new ENGINE()` fixture (consistent §8 assertion policy for the two
  mechanically identical forms).
- **Trigger misfiled in a `.cls` file (documented §A.13 limitation, the mirror case; ratified as the
  REQ-010 v1.14 bounded exception, ratified v1.6)** — a
  `trigger_declaration` saved in a `.cls` file passes the §3 predicates (`type=Class`, bare
  `qualifiedName`, `.cls` extension) and **is injected**: a reference to its name — including a
  case-varied one via the folded key — binds the trigger def (a REQ-004 non-referenceability breach,
  bounded to invalid, uncompiled source; Architect-accepted 2026-07-02). Pinned by fixture as the
  documented behaviour, not asserted as correct resolution.
- **Trigger-body cross-file chain (REQ-011 ∘ REQ-009)** — a multi-segment field chain rooted in a
  trigger body (`h.next.name` — the field-access fixpoint operating from trigger scope): per-segment
  ACCESSES from the trigger container. The §2(3b) not-free-fallout reasoning applies to the chain pass
  as to the argument side — covered by the §7(3b) reliance class and its committed fallback. §8 fixture.
- **Trigger-body overloaded call (REQ-011 ∘ REQ-008)** — a trigger body calls an overloaded user-defined
  static method (`Handler.log(7)` with `log(Integer)`/`log(String)` declared) → REQ-008 narrowing runs
  over the cross-file overload set from trigger scope: the exact-type match resolves (CALLS from the
  trigger container); an undisambiguable same-arity call (argument's static type matching neither
  overload exactly) → unresolved + recorded (REQ-015). **[Gate-3 reliance]** — trigger-scope
  argument typing is not free fallout of WI-2 (the §2 3b reasoning applies to the argument side as it
  does to the receiver side); covered by the §7(3b) reliance arm and its committed fallback class.
- **Case-varied source-file extension (`Handler.CLS`, `T.TRIGGER`)** — the host classifies extensions
  case-insensitively, so both reach the hook; the §3 case-folded extension comparison keeps the
  behaviour identical to the lowercase forms: a `.CLS`-filed class **is injected** (a literal
  case-sensitive check would silently reduce REQ-010), a `.TRIGGER`-filed trigger **is excluded** (a
  literal check would inject it — a REQ-004 breach on source whose only oddity is filename case, which
  is not an Apex validity condition and so sits OUTSIDE the v1.6 invalid-source bound). §8 fixtures pin
  both.
- **Reference into a skipped/malformed sibling file** — NFR-001 cross-file slice: cross-file resolution
  completes, the reference is left unresolved, no throw.
- **Duplicate / colliding folded key (incl. malformed re-parented fragment) → inject none (REQ-015)** — when
  >1 def folds to one key (two duplicate-named valid types, or a re-parented fragment colliding with a valid
  type), the §3 guard injects **nothing** → the bindings-channel reference (typed-receiver member forms) is
  left unresolved Apex-locally, **never mis-bound**,
  no reliance on the host's >1-bucket handling. **Documented §A.13 limitation (Architect-accepted):** in the
  fragment-collision case the valid same-folded-name type is left cross-file-unresolved (a malformed file
  causes a triple-narrow, invalid-source-only **liveness** loss for a colliding valid peer — safety
  preserved on the channel). No throw. (Ctor/heritage/static-receiver forms: the §3 fallback-channel
  limitation applies as in the duplicate bullet above.)
- **Trigger with a partial / error-recovery body** — conservative skip of the malformed reference, no throw
  (NFR-001).
- **Single-file repo / no cross-file references** — the injection is a no-op for resolution outcomes; no
  regression of WI-2's same-unit behaviour. **Evidence: the full WI-2 same-unit suite staying green**
  (regression evidence, not a new fixture — the WI-2 fixtures ARE the single-unit corpus).

## 5. Non-functional requirements (baked in)

- **NFR-001 (resolution-stage slice, cross-file/trigger).** Cross-file and trigger-body resolution complete
  without crashing on partial/error-recovery trees and on references into skipped files; an unresolvable
  reference is left unresolved, never a throw.
- **NFR-002.** No peer regression — `populateNamespaceSiblings` is registered **only** on the Apex resolver;
  every other language is untouched (it registers or omits its own hook). The folded global key uses the §2.2
  `normalizeIdentifier` seam, identity for case-sensitive peers. WI-3 adds no new shared seam (pure
  registration), so there is no new peer-facing behaviour from the wiring. Cross-language non-interference on the registry surface is **structurally
  foreclosed** (per-language-run map instances — Addendum 12; the formerly held §7(8) reliance is
  retired as moot). Measured by peer resolver
  suites green + the §8 mixed-language regression pin.
- **Performance:** one O(scopes) selection traversal at finalize (the owning-scope discriminant visits
  each file's class-kind scopes) producing an O(top-level-type-defs) injected set; no new per-reference
  cost (the global lookup already runs). The injection is a bounded map population.

## 6. Security-critical tag & clauses

**security-critical = false.** WI-3 consumes WI-1's safe-parsed model and WI-2's resolution model; it opens
no new trust boundary and authors no SEC clause (SECT-001 remains WI-1's). The conservative-skip default
(REQ-015) holds across files: an unresolved cross-file reference degrades to no edge, never an unsafe binding.

## 7. Verification architecture (Step 2b — **APPROVED — Adam (Architect), 2026-07-02**)

- **Provable properties (§A.3): none** — but this is an **explicit per-property disposition, not a blanket
  denial** (matching SDD-001 §7). The one property that *reads* as a candidate is the **cross-file
  no-mis-bind** safety property (REQ-015: a duplicate/ambiguous global key never mis-binds). Per the §A.3
  decision table it is **test-only**: it is **graph-resolution correctness** — finitely example-verifiable by
  fixtures (the collision injects ≤1 binding ⇒ no edge to a wrong target) — **not** a data-integrity or
  trust-boundary invariant over unbounded state (WI-3 opens no trust boundary, §6; it operates on WI-1's
  safe-parsed output). It guards no security/financial/data-integrity/safety/concurrency invariant, so no
  Prove obligation arises. Gate 5 for WI-3 reduces to the resolution-slice no-crash fuzz + mutation over the
  new `languages/apex/` cross-file code (same calibration as WI-1/WI-2, reached by per-property reasoning).
- **Purity boundary.** Pure core = the def-selection + key-folding **helper** (a pure function of
  `parsedFiles` — no I/O, no module state, deterministic; the §7 unit-anchor target).
  `populateApexNamespaceSiblings` itself is the **effectful shell writer**: it appends the computed
  bindings into `workspaceFqnBindings`, the host's sanctioned post-finalize append channel, via the
  localized ReadonlyMap→Map cast — identical to the csharp/java precedent. Dependency direction is shell→core (the
  host pipeline invokes the Apex hook). Any trigger-scope addition (REQ-011) is likewise a pure capture/
  binding computation under `languages/apex/`.
- **Tooling.** Host test framework (vitest) — integration resolution tests over **multi-file fixtures**
  (≥2 top-level types in separate files; a trigger file), plus main-thread unit anchors for the new pure
  function(s) — constructed on the §3 owning-scope shape (Module + class-kind scopes with `ownedDefs`) —
  so the cross-file logic is coverage-attributable (dogfood #16 — the hook runs in the
  resolution phase, but the def-selection helper is unit-testable on the main thread).
- **Gate-3 reliances (finding #13 — the explicit list to FLAG, not pin).** *Step-3a validation
  (2026-07-02) found several of these TRUE on the real host before any WI-3 code, via the §1 fallback
  channel: the ctor/heritage/super/static-Property arms of (1), (3)'s static-call and static-field arms
  (incl. the REQ-011 edge-from-trigger source attribution), and (6) — all **exact-case-only** (the fallback
  channel does not fold): the CASE-VARIED static type-name-receiver forms remain bindings-channel
  obligations, genuinely red, with their own §8 fixtures. The corresponding acceptance tests
  are already-green with committed no-red justifications (`.vsdd/tdd/WI-3-red-gate.md`); the bindings-
  channel arms below remain genuinely red and Gate-3-validated at Step 3b.* (1) end-to-end cross-file
  resolution of each WI-2 mechanic once `workspaceFqnBindings` is populated — **committed remediation
  class if any arm's fixture is red:** an Apex-local addition to the hook (the `workspaceTypeBindings`
  write of §7(12), a `bindingAugmentations` append, or the named §3 fallbacks), never a silent
  de-scope (Constitution §7); (2) the local-over-global
  precedence shadowing — the cited ordering (`walkScopeChain` local-first `walkers.ts:629-634`;
  `lookupBindingsAt` ranks `workspaceFqnBindings` last `walkers.ts:84-94`) grounds only the SAME-scope
  case: the walk consults the scope-independent workspace channel at EVERY scope from the innermost out,
  so an ENCLOSING-scope declaration (a nested type referenced from the outer type's method body) is
  structurally AT RISK of losing to the injected global — the workspace hit can return at the method
  scope before the walk reaches the declaring class scope. Genuinely unverified either way →
  fixture-asserted with the required (SRS) local-wins outcome, the enclosing-scope shape pinned (§8); a
  red fixture here is a mis-bind on valid source → Phase-5 escalation to the
  Architect (no Apex-local knob exists over the shared rank order); (3) **static type-name-receiver resolution** — the shape SHARED by a trigger call
  `Handler.handle()` (REQ-011) and a cross-file static call `B.f()` (the WI-3 design risk; capture is
  probe-confirmed [structural], the edge-from-trigger is a [structural obligation]; the host's *default*
  edge-attribution for the exact-case forms is **validated TRUE** (Addendum 4 — the formerly held
  Architect-accepted reliance is discharged; only the instance-receiver residual (3b) remains held) and
  the *resolution* reliances carry one committed fallback each), **and (3b) trigger-scope typing** — instance-receiver
  typing (a trigger-scope local `h = new …; h.x` getting its type binding — not free fallout of WI-2, §2)
  AND overload-argument typing from trigger scope (the REQ-011 ∘ REQ-008 composition, §4 — the same
  not-free-fallout reasoning on the argument side; same committed-fallback class); (4) **FORECLOSED
  for Apex-internal duplicates ON THE BINDINGS CHANNEL** — the §3 collision guard injects ≤1 binding per
  folded key, so a >1 *Apex*
  bucket never reaches the host lookup; the host's ">1-bucket → ambiguous, not first-match" behaviour is moot
  for Apex (the safety is Apex-local, not host-dependent). The §1 fallback channel is OUTSIDE this
  foreclosure — its exact-case first-match behaviour on duplicates is the §3 parity-accepted limitation
  (validated 2026-07-02). No multi-binding case is reachable on the bindings channel — the Apex-internal case is foreclosed by
  the §3 guard and the cross-language case structurally (retired (8)); (5)
  qualified nested-type access (`Outer.Inner`) resolving via the outer's global binding + nested-type member
  lookup — incl. the TAIL-varied form (`Outer.INNER`): the committed nested-type member-resolution fallback
  folds the member segment if the host lookup does not; (6) the host edge-label selection (EXTENDS vs IMPLEMENTS by target kind) for a cross-file
  interface-extends-interface source (the REQ-012-parity behaviour); (7) whether a non-exported top-level
  type so injected actually **resolves cross-file** — that the host global lookup does not visibility-filter.
  A cross-file reference to a non-exported top-level type is **invalid Apex** (outside §1's valid-source
  SHALL), so its resolution is a **disclosed forward-dependency**, not a committed REQ-010 SHALL: WI-3 does
  not visibility-filter (inject-all default), and whether a private type *should* resolve or be filtered is
  the deferred **WI-4 REQ-012** parity question. The §8 fixture pins only no-throw and no-mis-bind, not a
  resolve outcome; if WI-4 elects to filter, that is a parity refinement, not a WI-3 gap; (8)
  **RETIRED (2026-07-02, Addendum 12)** — the formerly Architect-accepted cross-language registry
  partitioning reliance is moot: `workspaceFqnBindings` is a per-language-run instance (fresh map per
  `finalizeScopeModel` call; one `runScopeResolution` per language over extension-partitioned files), so
  a peer entry and an Apex reference can never meet — non-interference is a pinned structural fact, a
  strictly stronger position than the held reliance. The §8 mixed-language fixture (Apex + Python + C#
  sharing one folded key) remains as an ordinary NFR-002 regression pin; (9) **cross-file cyclic-chain fixpoint termination** (§4) — that the host
  field-access fixpoint terminates (no hang/throw) on a *cross-file* mutual/cyclic receiver-type graph
  (`class A{B b;}`/`class B{A a;}`), an NFR-001 robustness reliance; the remediation if it does not is the
  host fixpoint's existing bounded-iteration cap (the same mechanism that bounds the WI-2 in-unit cyclic
  case — no unbounded Apex walk is added), and a cross-file cyclic fixture pins no-hang; (10) **cross-file
  inherited-member resolution** (§4, a REQ-005/007 SHALL) — that the host MRO / member-lookup walk reaches a
  member declared on a parent type in another file once the parent is globally visible; expected to be fallout
  of (1) + the host `buildMro`, with a **committed Apex-local fallback** (a cross-file superclass member-walk
  addition) if its fixture is red — not a silent de-scope (symmetric with the nested-type/static-receiver
  reliances). (11) **Ctor-arm folded-path reach (sharpened 2026-07-02, round 21)** — the shared free-call fallback
  passes the RAW reference name (`free-call-fallback.ts:137-142`; no `normalizeIdentifier` on that path —
  read-pinned), so it can never meet the folded workspace key. BUT an Apex-configured FOLDING ctor path
  exists — behaviourally proven by WI-2's in-unit case-varied ctor resolution (`new account()` → CALLS,
  green since WI-2, riding the WI-2 call-config/registration-table folded keyspaces). The reliance is
  whether THAT path reaches the workspace channel cross-file (serving `new ENGINE()`, the valid twin's
  `new Foo()`, and the case-variant twin's `new Twist()` before the raw exact-case channel). **Committed
  fallback (named mechanism + attachment):** extend the WI-2 Apex call-config/receiver-bound machinery —
  the existing Apex-local surface that already folds ctor references in-unit — to consult the workspace
  key; no new seam. **Scope (Addendum 9): the ctor/free-call arm only** — the heritage arm is moot (the pre-hook pass
  cannot reach the workspace keys; SRS v1.8). **The ctor arm is SAFETY-BEARING for the case-variant
  trigger/class twin's ctor form (§4):** there the raw exact-case channel would bind the trigger, so the
  WI-2 folding ctor path (or the committed fallback extending it) must claim the reference FIRST — a
  fold-retry that runs only after the raw channel binds is insufficient. If the folding path cannot be
  made to precede the raw channel for the hit-shape, the remediation is **Phase-5 escalation to the
  Architect** (a further v1.6-family ratification or a sanctioned mechanism beyond pure registration) —
  stated here so a red fixture leaves nothing to improvise. (12) **Single-registry sufficiency** (§3 pin) — Apex declared-type/instance-receiver typing
  resolves injected names via `lookupBindingsAt` without the `workspaceTypeBindings` channel; committed
  remediation: add that second write to the Apex hook. (13) **Qualified-outer folding** — whether the
  `OUTER` segment of a qualified nested reference (`OUTER.Inner`) folds before reaching the workspace
  key (the WI-2 seam folded the receiver-bound and declared-type keyspaces, not the dotted-name path;
  distinct from (5), the member-lookup half) — committed fallback class: the §3 nested-type
  member-resolution addition under `languages/apex/` (the same mechanism class as (5)'s), extended to
  fold the outer segment. (14) **Guard-suppressed-collision internal record** — whether the host's internal unresolved
  counter fires for a
  pass-level typed-receiver guard-suppressed collision (a duplicate folded key the §3 guard stops before
  the resolver — a competing-candidate ambiguity per §2, not a plain miss; non-blocking for the black-box
  contract, whose observable is edge absence). Validation vehicle: inspect the host's resolve stats/log
  output at Gate 3; **if no internal record fires**, the disposition is a named escalation to ratify at the
  SRS level that a guard-suppressed collision (ambiguity stopped before the resolver) discharges by
  edge-absence with no positive record — never a silent discharge. (15) **Receiver-bound
  static-type-name-member workspace reach** — whether the WI-2 folded receiver-bound path resolves a
  static member through a workspace-injected type binding (`Twist.buzz()`, `Foo.stat2()` — the twin
  static-member arms; distinct from (11)'s ctor/free-call arm and from (3)'s single-segment reliance):
  **one committed fallback — §7(3)'s static-receiver type-binding synthesis** (the same mechanism
  family), extended to consult the workspace key **with the receiver name folded via the §2.2 seam**;
  if the hit-shape ordering (the raw exact-case channel
  claiming first) defeats it, Phase-5 escalation. Gate 3 (tests vs the real host) validates
  all of these; the Gate-2 adversary validates the wiring (Seam-B registration, the injected def set, the
  collision guard, the folded key) and the split, not the behaviours.

## 8. Tracker integration & Gate-3 acceptance

Each REQ clause and edge case maps to a sub-item. **Gate-3 acceptance assertions** (multi-file fixtures,
automated), completing the WI-2-deferred §9 cross-file scenarios:
- **REQ-010 two-class call** — file A calls a method on a top-level type in file B → `CALLS` across files,
  no unresolved record (REQ-006 negative);
- **REQ-009 cross-file chain** — a property chain whose declaring types span files → per-segment `ACCESSES`;
- **REQ-007 top-level inheritance** — top-level `extends` (→ `EXTENDS`) and `implements` (→ `IMPLEMENTS`),
  and interface-extends-interface (→ `IMPLEMENTS` by the host's edge-label selection on target kind — the
  REQ-012-parity behaviour SDD-002 established, a Gate-3 reliance, not bare REQ-007), the parent/interface in
  another file;
- **REQ-005 top-level `super`** — `super()` / `super.method()` to a top-level parent in another file;
- **cross-file overloaded call** (the dominant real-world case) — B (file B) has `f(Integer)`/`f(String)`,
  `arg` statically `Integer` → resolves `f(Integer)`, must not bind `f(String)`; undisambiguable →
  unresolved **+ recorded (a `suppressed` outcome — the ambiguity reaches the resolver, so the §2
  observability rule licenses the positive record assertion, matching the trigger-overload bullet)**
  (REQ-015 ∘ REQ-010). Asserted for **both** receiver forms: an **instance** receiver (`new B().f(arg)` /
  typed variable, the validated path) and a **static type-name** receiver (`B.f(arg)`, carrying the
  static-receiver reliance + fallback); and the disambiguating argument is exercised across WI-2's supported
  kinds — a **field-typed** argument (`this.acct` of a user-defined field type) as well as
  local/literal/constructor — reached cross-file (the method-parameter kind stays WI-4);
- **cross-file constructor overload** — `new CtorTarget(7)` with `CtorTarget(Integer)`/`CtorTarget(String)`
  declared in another file → CALLS targeting the Integer **Constructor node** (in-unit target-node
  identity); an undisambiguable same-arity ctor argument → unresolved + recorded (`suppressed`);
- **cross-file inherited member** — child (file C) `extends` parent (file B), member declared on the parent
  → the call resolves to the parent member across files, asserted for BOTH call forms (materially
  different paths): the **typed-receiver** form (`Child c = …; c.inherited()` — receiver-typing ∘ member
  lookup) and the **unqualified implicit-`this`** form (`inherited()` inside Child's own body — the
  own-scope MRO walk);
- **cross-file mutual/cyclic chain** — `class A{B b;}` (file A) / `class B{A a;}` (file B), `a.b.a…` resolves
  the reachable segments and terminates (bounded fixpoint), no hang/throw;
- **case-varied cross-file** — `ACCOUNT`/`account` resolving across files via the folded global key —
  including the **enum-constant receiver** (`COLOR.BLUE` with `enum Color` — the weakest arm's
  case-dimension: the folded workspace key composed with the §2 enum-constant member-lookup fallback) —
  asserted for the instance-receiver form AND for the **static type-name-receiver forms** (a case-varied
  cross-file static field read `CONSTS.FLOOR` and a case-varied trigger-body static call
  `ACCOUNTHANDLER.notify()`) AND for the **constructor** (`new ENGINE()`) form — delivered by the WI-2 folding ctor path reaching
  the injected workspace key (§7(11)) or, if that path stops at unit scope, by the committed fallback
  extending it — NOT by the injection alone (the shared free-call fallback passes raw names, read-pinned
  §7(11)).
  The **heritage** forms (`class CaseKid extends BASE implements IFACE`) are the ratified SRS v1.8(i)
  limitation — pinned as UNRESOLVED (the pre-hook pass, Addendum 9), not asserted as resolving;
- **user-defined type shadows an external/sObject name** — `Account a = new Account(); a.save()` resolves
  to the user-defined `Account.cls` node (the §4 precedence bullet's fixture);
- **nested type not injected by bare simple name** — a cross-file bare `Inner` reference emits no edge and
  never mis-binds (the §4 no-mis-bind bullet's fixture);
- **cross-file interface-typed declared variable (declaration-only — isolated from constructor-type
  inference, the same discipline as the trigger `AccountHandler d;` fixture)** — `Iface v; v.act()`
  (and the case-varied `IFACE` form) → CALLS **targeting the interface's own member declaration**
  (`Iface.act` in Iface.cls) via the injected Interface entry — the discriminated Predicate-1
  Interface-arm observable;
- **cross-file bare type-usage binding** — a bare declared-type usage of a cross-file type (`B b;`, B in
  another file) binds `b`'s static type (**no standalone edge**, REQ-005 v1.3), observably enabling
  `b.member` to resolve to B's member across files;
- **nested-type qualified access** — `Outer.Inner` referenced from another file **resolves** (REQ-010 SHALL)
  via `Outer`'s global binding + nested-type member lookup; resolution is required (committed mechanism, not
  de-scoped), never a mis-bind; asserted for the exact-case, the **outer-varied** (`OUTER.Inner` — the §7(13)
  qualified-outer-folding reliance) AND the **tail-varied** (`Outer.INNER` — the §7(5) nested-member
  lookup's case dimension, its committed nested-type member-resolution fallback extended to fold the
  member segment) qualified forms — each fixture exercising BOTH the constructor form
  (`new Outer.Inner()`) and the declared-type/instance-member form (`Outer.Inner v; v.ping()`), the two
  post-hook reference kinds (a single-kind green does not discharge the others). *(A qualified static field/method on a nested CLASS — `Outer.Inner.MAX` — is not expressible in
  valid Apex: inner classes cannot declare static members. A **nested ENUM's constants** are exactly
  this shape and ARE valid — `Outer.Level.HIGH` — covered by the nested-enum bullet below.)* The **doubly-varied** form (`OUTER.INNER` —
  §7(13) outer folding ∘ §7(5) fold-extended tail lookup, the composition of the two reliance-backed
  mechanisms) is fixtured too — compositions are not assumed free;
- **heritage-downstream (SRS v1.11(a) → v1.12/v1.28-corrected) + poisoned-MRO tripwire (v1.11(b))** — under a
  case-varied heritage clause: the subtype's **MRO-dependent implicit-this inherited member** stays
  unresolved (pinned liveness — the MRO lacks the parent). The **`super` arms resolve to the parent**
  (SRS v1.12, Step-3b probe-confirmed): `super.method()` → CALLS into the parent's member
  (`CaseKid.greetUp()` → `Base.greet`, NOT the self-loop) and `super()` → CALLS into the parent ctor
  (`Base.Base`), both via the heritage-pre-pass-independent `super`-receiver synthesis — so the subtype
  carries `super`-sourced CALLS into Base with NO EXTENDS edge to it. This supersedes the earlier
  v1.11(a) `super()`-unresolved / `super.method()`-self-loop pins for BOTH simple-name-superclass shapes
  (v1.8(i) case-varied at v1.12, v1.10(v) same-case twin at v1.28); through the v1.10(iv)
  mis-bound EXTENDS, the tripwire FIRED and is RATIFIED (SRS v1.13): a typed-receiver `s.decoy2()` DOES ride
  the mis-bound MRO into the decoy's member (`TInner.cls:TInner.decoy2`) — pinned as a documented bounded
  false edge, WI-4 pipeline reorder committed as the fix (ITEM-004);
  the v1.10(iii) and v1.10(v) downstream **inherited-member implicit-this** arms are family-pinned
  unresolved (same suppressed-MRO mechanism-independent behaviour, per the Addendum-16 determinacy), but
  their **`super` arms differ**: v1.10(v)'s simple-name superclass resolves to the parent (BL-8, like the
  case-varied shape above) while v1.10(iii)'s qualified/dotted superclass self-loops (BL-7);
- **misfiled-trigger collision (SRS v1.11(c), BOTH halves)** — a `.cls`-misfiled trigger + a
  same-folded-name valid class (case-variant sub-shape) → the valid class's typed-receiver form stays
  unresolved (the limitation's interior) AND its exact-case ctor form still binds via the host channel
  (the limitation's boundary — an over-broad implementation that suppresses the valid def entirely
  fails this half);
- **nested-parent heritage (SRS v1.10 pins)** — `class Sub extends Outer.Inner`: no-decoy →
  NO heritage edge (v1.10(iii)); with a same-named top-level decoy → EXTENDS into the decoy, pinned as
  the v1.10(iv) documented limitation (never as correct resolution); the SAME-case valid twin's
  heritage clause (`class Twin2 extends Foo` shape, trigger + class both present) → NO heritage edge
  (v1.10(v), conservative refusal pinned). The `extends` form is the REPRESENTATIVE heritage fixture for
  the v1.10 family; the `implements` nested-parent/twin arms ride the SAME pre-hook pass and carry the
  same v1.10 dispositions (pinned by the family, not separately fixtured);
- **dotted-tail decoy (both halves)** — nested `TOuter.TInner` + unrelated top-level `class TInner`:
  the qualified reference resolves to the NESTED type (post-injection, via the outer's binding) and
  ZERO edges ever land on the top-level decoy (pre-injection the tail arm binds nothing — Addendum 6);
- **nested-enum constant (valid Apex — the qualified static-member shape that IS expressible)** —
  cross-file `Outer.Mood.UP` → ACCESSES to the nested enum's constant (exact-case AND case-varied
  `OUTER.MOOD.UP` — the §7(5)/(13) nested-member lookup ∘ the §2 enum-constant arm, doubly composed,
  fixtured per the compositions-not-free policy); the declared-type form `Outer.Mood m;` binds
  (observable via the constant access);
- **valid nested/top-level name share** — nested `Outer.Helper` + top-level `class Helper` (legal Apex) →
  the top-level `Helper` injects alone (owning-scope discriminant) and resolves cross-file; no false
  collision (REQ-010 on valid source);
- **cross-language folded-key share (NFR-002 regression pin; the §7(8) reliance is retired —
  per-language registry, Addendum 12)** — an Apex type, a Python symbol, and a C# global-namespace type
  sharing one folded key in one repo → each language's reference resolves only to its own def (a
  regression guard over the structurally foreclosed surface, not a reliance vehicle);
- **cross-file member case-collision** — `CaseColl c = …; c.Act()` with `act`/`ACT` declared on the
  cross-file target → no edge + a positive `suppressed` record (REQ-015 two obligations,
  ambiguity-reaches-resolver);
- **non-colliding re-parented fragment** — a malformed outer's uniquely-named nested fragment injects
  and a cross-file (case-varied) reference to it binds — the documented Addendum-12 behaviour,
  WI-1-precedent-consistent (asserted as behaviour on invalid source, not correct-Apex resolution);
- **collision / non-poisoning (REQ-015)** — two defs folding to one key (duplicate-named types, or a
  re-parented fragment colliding with a valid type) → **no member edge** through a typed receiver
  (`Dupe d; d.hit()` — the §3 inject-none guard; two candidates exist but the guard stops the ambiguity
  before the resolver — a competing-candidate ambiguity per §2, not a plain miss — so no positive record
  fires on the bindings channel and the fixture asserts the observable, edge ABSENCE, only). The **case-varied/mismatched forms to the colliding pair** (`new dupe()`, `dupe d;` —
  the exact-case channel misses both keys, the folded key is guard-suppressed) emit nothing: asserted as
  exactly ONE ctor edge from the caller to the pair (the exact-case v1.5-exception bind) and zero member
  edges — the v1.5 scenario's second Then-clause. **All three v1.5 forms are per-pass probed and fixtured** (Addendum 15 — the family's arms ride
  three different passes, so representativeness was not assumed): the heritage arm (`DupSub extends
  Dupe` → EXTENDS to the unique exact-case match) and the static-type-name arm (`Dupe.stat()` → CALLS
  to `Dupe.stat`) each get their own already-green pin alongside the ctor fixture. The ctor form (`new Dupe()`) binds exact-case-first via the §1 fallback channel — asserted as
  pinned host behaviour under the §3 parity-accepted limitation, NOT as a WI-3 resolution claim. The
  fragment-collision liveness loss for a colliding valid
  type is the documented §A.13 limitation (a black-box-observable absence of edge, not a mis-bind);
- **misfiled-class + same-named valid class (filter-before-grouping pin)** — `class Poison` misfiled
  in a `.trigger` file + a correctly-filed `Poison.cls`: the misfiled def is filtered out of the
  universe BEFORE grouping, so the valid class injects alone and its cross-file typed-receiver
  reference resolves (a filter-AFTER-grouping implementation would trip inject-none and strip the
  valid class — this fixture discriminates the §3 ordering);
- **misfiled valid top-level type** — `class Helper` saved in `Utils.cls` (name ≠ filename) is still injected
  (its `qualifiedName` is bare) and resolves cross-file when its key is unique (no silent REQ-010
  reduction, §3); a class misfiled in a `.trigger` file is excluded from injection (member/case-folded
  forms unresolved — the REQ-010 v1.6 bounded exception) while its exact-case ctor form binds via the
  fallback channel — both asserted as the §4 documented-limitation behaviour;
- **non-exported top-level type** — black-box: a cross-file reference to a `private`/no-modifier top-level
  type is injected inject-all; a private cross-file reference being **invalid Apex** (outside §1's
  valid-source SHALL), its resolution is a **disclosed forward-dependency** — WI-3 does not visibility-filter,
  so it resolves under the current design, but the resolve-vs-filter decision is the deferred **WI-4 REQ-012**
  question. The fixture asserts only **no throw and no mis-bind**, not a committed "resolves" acceptance
  (SDD-001 `Property`-label forward-dependency precedent);
- **static field / enum-constant via a type-name receiver** — a cross-file (and trigger-body) `MyClass.FIELD`
  / `MyEnum.VALUE` → `ACCESSES` to the user-defined field/constant (the static-receiver field arm, §2 — same
  reliance + fallback as the static call);
- **REQ-011 trigger** — a trigger body's static call on a user-defined handler → `CALLS`, and `new Handler()`
  → `CALLS`; a trigger body field/property access → `ACCESSES`, incl. the trigger-body **enum-constant** read
  (`Level.HIGH`) and its case-varied form (`LEVEL.LOW` — trigger scope ∘ the folded key ∘ the §2
  enum-constant arm, composed) — **each edge asserted as originating from the
  trigger container node** (REQ-011 v1.4 "from the trigger", for CALLS *and* ACCESSES — incl. the
  case-varied bindings-channel forms, whose source attribution is the §2 residual reliance); a bare declared-**type**
  usage in a trigger body follows REQ-005 v1.3 (binds the variable's type — **no standalone edge**, not a
  "resolved edge"); no unresolved record for any reference that resolves;
- **trigger-body instance receiver** — in a trigger body `AccountHandler h = new AccountHandler();` then both
  `h.name` → `ACCESSES` to `name` **and** `h.process()` → `CALLS` (the canonical instance method
  dispatch), each from the trigger — the trigger-scope local-variable type-binding case (§2 reliance), a
  distinct fixture from the static-receiver case; **plus a declaration-only typed variable**
  (`AccountHandler d;` with no initializer, then `d.size`) so the trigger-scope DECLARED-type binding via
  `interpretApexTypeBinding` is isolated from constructor-type inference (REQ-011 v1.4's bare
  declared-type arm, discriminating acceptance); **plus the case-varied trigger-scope declared type**
  (`ACCOUNTHANDLER cv = …; cv.wake()` — §7(3b) trigger-scope typing ∘ the folded workspace key,
  composed; compositions are not assumed free);
- **conservatism** — a duplicate/ambiguous global simple name and a local-shadows-global case → the local or
  the conservative-unresolved outcome on the bindings channel, never a mis-bind there (REQ-015). The
  local-shadows-global fixture pins the **enclosing-scope shape** (§4): a nested type in the outer class,
  the reference in the outer's method body, a same-named top-level type injected from another file → the
  member edge targets the NESTED type's member, never the global's;
- **trigger-body cross-file chain** — `h.next.name` from the trigger body → per-segment ACCESSES
  (`next`, then `name`) from the trigger container (REQ-011 ∘ REQ-009, §7(3b));
- **trigger-body nested-qualified** — `Kit.Part p = new Kit.Part(); p.snap()` in the trigger body →
  CALLS from the trigger container (REQ-011 ∘ the §7(5)/(13) qualified resolution — the trigger-scope
  composition is not assumed free, mirroring the chain/overload compositions);
- **trigger-body interface-typed declared variable** — `Alarm a2; a2.ring()` (declaration-only) in the
  trigger body → CALLS targeting the interface's own member (REQ-011 ∘ §7(3b) ∘ the Predicate-1
  Interface arm, composed);
- **trigger-body case-varied constructor** — `new ACCOUNTHANDLER()` in the trigger body → a second ctor
  CALLS from the trigger container (REQ-011 ∘ §7(3b) ∘ the §7(11) folding-ctor reach, composed — the
  exact-case trigger ctor fixture alone does not discharge it);
- **trigger-body external reference (REQ-011 invariant)** — `System.debug(...)` and `Trigger.new` in the
  trigger body → no edge, no Apex-specific defect record, run completes (the §2 invariant's acceptance);
- **trigger-body overloaded call** — `Handler.log(7)` with `log(Integer)`/`log(String)` from a trigger body
  → resolves `log(Integer)` (CALLS from the trigger container), must not bind `log(String)`; an
  undisambiguable same-arity trigger-body call → unresolved + recorded (REQ-015) — the REQ-011 ∘ REQ-008
  composition (§4); asserted for the STATIC-receiver form AND the **instance-receiver** form
  (`h.ilog(9)` — §7(3b) receiver typing ∘ argument typing, composed from trigger scope);
- **trigger-body inherited member** — `h.tag()` where `tag` is declared on AccountHandler's cross-file
  parent → CALLS to the parent member from the trigger container (REQ-011 ∘ §7(10), the MRO walk from
  trigger scope — compositions are not assumed free);
- **same-case duplicate** — two `class Samey` files → all reference forms conservatively unresolved
  (the Addendum-13 same-case-duplicate row + the §3 inject-none guard), never a bind; the exact-case-channel
  arm (ctor/heritage/static) emits **no edge and no record** — BL-12's same-case arm, a type-name collision
  discharged by edge-absence alone (probe-verified 2026-07-06, no mis-bind) — and the
  bindings-channel typed-receiver form is likewise edge-absence (guard-miss);
- **lone-trigger reference** — `new Lone()` with only `Lone.trigger` present → binds the trigger def via
  the exact-case channel (pinned REQ-010 v1.14 corrected-exception behaviour, ratified v1.6 — not correct resolution);
  BOTH arms are fixtured (the two arms ride different passes, so representativeness was not assumed —
  the Addendum-15 policy): the ctor form and the `extends` arm (`class LoneSub extends Lone` → EXTENDS
  into the trigger def, per the Addendum-5 probe) each pinned as documented-limitation behaviour;
- **case-variant trigger/class twin** — `Twist.trigger` + `class TWIST`, reference `new Twist()` /
  `w.turn()` → binds the CLASS, never the trigger (the committed-to-fix §7(11) safety case — red
  pre-impl, the probe shows the trigger bound); its **heritage arm** (`class Sub extends Twist`) →
  EXTENDS into the trigger def, asserted as the documented SRS v1.8(ii) limitation behaviour (the
  pre-hook pass; NOT correct resolution);
- **trigger misfiled in a `.cls` file** — pinned §A.13 limitation behaviour (the REQ-010 v1.14 bounded
  exception, ratified v1.6): the misfiled trigger def is
  injected, so a (case-varied) reference to its name binds it (documented breach of REQ-004
  non-referenceability, invalid-source-only — asserted as the limitation, not as correct resolution);
- **valid twin (trigger + class sharing a name)** — `Foo f = …; f.run()` from another file → resolves to
  the **class** (the injected def, via the folded declared-type keyspace); the `new Foo()` ctor edge →
  CALLS to the class, asserted under the §7(11) reliance + committed fallback (same policy as the
  case-varied ctor fixture); the **static-type-name-member arm** (`Foo.stat2()` — a different
  receiver-bound shape from the case-variant twin: the exact-case key holds TWO defs) → CALLS to the
  class static, asserted under §7(15); no resolution edge targets the trigger def across ALL asserted
  arms (REQ-004);
- **non-existent type** — a cross-file reference to an undeclared type (`new Missing(); m.poke()`) →
  zero edges, run completes (REQ-015/NFR-001);
- **single-file / no-op** — evidenced by the WI-2 same-unit suite staying green (regression), not a new
  fixture;
- **case-varied extensions** — a class in a `.CLS` file resolves cross-file (injected); a trigger in a
  `.TRIGGER` file stays un-injected (its case-varied-name reference finds nothing);
- **no synthetic IMPORTS edge** — the Apex cross-file fixtures' graphs contain **zero** Apex
  file-to-file `IMPORTS` edges (the REQ-010 postcondition's Seam-B observable: cross-file resolution
  with no import machinery);
- **NFR-001** — cross-file/trigger resolution no-crash on a partial tree + a reference into a skipped sibling
  file; **NFR-002** — peer resolver suites green.

**REQ-006's negative assertion (no false "unresolved" record) is checked on *every* cross-file reference
SDD-003 claims to resolve** — not only the two-class call and the trigger ref: the cross-file chain,
top-level inheritance, top-level `super`, cross-file overload, cross-file inherited member, case-varied, and
nested-qualified resolved references each also assert zero unresolved record for the reference they resolve
(mirroring SDD-002 §8).

The cross-file forms of REQ-005/007/009 that WI-2 verified only same-unit are **claimed here** (this is the
WI-3 completion); the parity-fixture (REQ-012) and external-handling (REQ-013) forms remain **WI-4**.

---

# SDD-004 — WI-4: Parity hardening & external handling

*Phase 2 spec for ITEM-004. Grounded in **RESEARCH-004** (§A.6 host-API spike, 2026-07-07). WI-4 demonstrates
Java/Kotlin-tier resolution parity (REQ-012), handles external references as benign-unresolved (REQ-013),
**discharges the WI-3-carried heritage limitations BL-1…BL-8** via the committed heritage/namespace-sibling
pipeline reorder, **completes REQ-008's parameter-typed-argument narrowing** (deferred by WI-2), and folds a
receiver **variable**'s name for case-insensitivity completeness. Unlike WI-1 (parse) and WI-3 (pure
registration), WI-4 commits **one generic shared-code edit** — the pipeline re-sequence — which owes its own
§2.2 legitimacy + adversary review + NFR-002 measurement at Gate 4.*

- **Consumes:** SRS-001 (**v1.28**) **REQ-012** (Java/Kotlin parity), **REQ-013** (external-reference
  handling), **NFR-004** (automated resolution test); the **§5.1 Bounded Limitations Register** rows
  **BL-1…BL-8** (every row marked `Fix=WI-4` — the valid-source heritage-form limitations WI-4 discharges);
  the **REQ-008 parameter-typed-argument narrowing** deferral (SDD-002 §2, the WI-2→WI-4 argument-typing
  boundary); and the receiver-**variable**-name case-fold completeness item (the WI-2→WI-3→WI-4 re-deferral).
  **RESEARCH-004** (§A.6 host-API spike, 2026-07-07 — the heritage-reorder feasibility + the necessary-but-
  insufficient trace for the dotted nested-parent form, the REQ-013 host-default-benign finding, and the
  REQ-008 workspace-membership oracle).
- **Constitution:** CONST-gitnexus-apex **v1.1.3** (this SDD section is authored under, and Gate 2 checks it
  against, v1.1.3 — matching SDD-003). **Security-critical = false** (operates on WI-1's safe-parsed output +
  WI-2/WI-3's resolution model; introduces no new untrusted-source parse path — SECT-001 stays WI-1's). No
  new SEC clause. WI-4 commits the **one generic shared-code edit** of the epic (the pipeline re-sequence),
  which rests its §2.2 legitimacy (a reorder of existing generic passes, naming no language) on this version.
- **Builds on / completes:** WI-2's REQ-008 overload mechanic (SDD-002) — WI-4 **completes** its
  parameter-typed-argument sub-case (not re-owning it); and WI-3's REQ-010 registration (SDD-003) — the
  reorder makes WI-3's `workspaceFqnBindings` channel reachable by the heritage pass, discharging the
  WI-3-carried BL-1…BL-8. WI-4 **owns** REQ-012, REQ-013, NFR-004, the committed heritage reorder, and the
  receiver-var fold.

## 1. Design overview (the HOW, grounded in the host)

WI-4 adds **no new resolution algorithm**; it (a) reorders an existing shared pass, (b) reuses existing host
oracles, and (c) provides parity/external evidence. Four workstreams, each grounded in RESEARCH-004:

**(1) The heritage/namespace-sibling pipeline reorder (discharges BL-1…BL-8) — the one generic edit.**
RESEARCH-004 finding 1 read-verified the root cause: the heritage pre-pass `preEmitInheritanceEdges`
(`run.ts:573`) and the `buildMro` derived from it (`:601`) both run **before** the WI-3 cross-file
registration `populateNamespaceSiblings` (`:640`) — so a heritage clause resolves its base *before*
`workspaceFqnBindings` holds any Apex type, and the base misses the cross-file channel. The fix is the
**generic reorder** of the **contiguous heritage-resolution + MRO block** `run.ts:573-602` — enumerated as
`{preEmitInheritanceEdges :573, provider.emitHeritageEdges? :579, provider.emitImplicitImportEdges? :584,
the postHeritageNodeLookup rebuild :591-592, emitDetectedInterfaceImplementations :593, buildMro :601,
provider.buildExtendsOnlyMro? :602}` — to run **after** `populateNamespaceSiblings` (`:640`), **as a unit,
preserving the passes' internal relative order** (so no pass's order *relative to another moved pass*
changes — in particular `preEmitInheritanceEdges` stays before `emitImplicitImportEdges`, `buildMro` stays
after every heritage emit that feeds it, and the `postHeritageNodeLookup` rebuild stays after
`emitHeritageEdges`). `emitImplicitImportEdges` (:584) **moves with the block** rather than being left in
place, precisely to keep that heritage-before-implicit-imports order intact for peers (leaving it behind
would flip `preEmit`↔`emitImplicitImport` and expose peer heritage to implicit-import edges it does not see
today — a gratuitous NFR-002 change). The re-sequence of the enclosing `run.ts:554-641` region: build
`indexes` with the **empty** `methodDispatch` `finalizeScopeModel` supplies by design (`:608` comment) →
`buildWorkspaceResolutionIndex` (`:632`) → `populateNamespaceSiblings` (`:640`, workspace channel now
populated) → the moved heritage block (base resolution now sees the workspace keys, via the read-verified
`resolveInheritanceBaseInScope → findClassBindingInScope → lookupBindingsAt → workspaceFqnBindings` path,
finding 2) → swap the populated `methodDispatch` (from the moved `buildMro`) into `indexes` before
`resolveReferenceSites` (`:687`) consumes it. `buildMro` must stay after heritage emit (it reads the edges —
`mro.ts:49`); moving the whole block preserves that. **The single peer-visible change is the block's position
relative to `{buildWorkspaceResolutionIndex, populateNamespaceSiblings}`** — the one NFR-002 measurement
point (§5), gated-fallback if any peer regresses. **This names no language** (Constitution §2.2 — it reorders existing generic passes); it is
the first WI to commit a shared control-flow change, so it carries a Gate-4 **§2.2 legitimacy + adversary +
NFR-002 measurement** obligation. **Architect-ruled committed fallback (2026-07-07): a per-language gate** (an
Apex-only flag on the resolver/`ScopeResolutionIndexes`, mirroring WI-3 inc 15's
`resolveInheritedImplicitThisCall`) that confines the after-registration heritage timing to Apex, engaged
**iff** the Gate-4 NFR-002 measurement shows a peer regression — the SHALL has a named satisfaction path
either way (finding #29). **[structural]** = the re-sequence wiring and the movable-block boundary
(read-verifiable against `run.ts`); **[Gate-3/Gate-4 reliance]** = that each heritage form resolves and that
peers stay byte-identical.

**(2) Committed Apex-local nested-aware heritage base resolution (BL-3/BL-4 — the dotted form).** RESEARCH-004
finding 4 read-traced that the reorder is **necessary but not sufficient** for the dotted nested-parent form
(`class Sub extends Outer.Inner`): `workspaceFqnBindings` is keyed by folded **simple** name, so
`lookupBindingsAt('Outer.Inner')` misses (both raw and folded are dotted), and the **QNI dotted-tail
single-match fallback** (`walkers.ts:320-329`) still binds the same-tail top-level decoy (BL-4) or nothing
(BL-3). The reorder therefore discharges the **simple-name** heritage forms outright (BL-1 case-varied
`extends BASE` folds to a workspace hit; BL-2 case-variant twin's `extends Twist` folds to the class before
the exact-case trigger bind; BL-5 same-case twin's `extends Foo` hits the injected class; BL-8's super/
inherited arms follow once the EXTENDS edge exists and `buildMro` includes the parent — inc-15's gated MRO
walk then reaches the inherited implicit-this), and needs, **additionally for the dotted form**, a
**nested-aware base resolution**: resolve the OUTER segment via the workspace channel, then find the nested
tail among the outer's owned nested defs, **before** the dotted-tail fallback — the same OUTER-first nested
lookup WI-3 inc 11 built Apex-local for the ctor/declared-type paths (`languages/apex/`). This is a
**committed deliverable, NOT an iff-red contingency:** RESEARCH-004 finding 4 read-traces *structurally* (not
behaviourally) that the reorder alone cannot resolve the dotted form — `workspaceFqnBindings` is
folded-**simple**-name-keyed, so `lookupBindingsAt('Outer.Inner')` misses and the QNI dotted-tail fallback
(`walkers.ts:320-329`) still binds the decoy — so BL-3/BL-4 are **certain** to require it, and it is committed
up front. **Preferred mechanism — pure registration of the existing generic `emitHeritageEdges` hook**
(`run.ts:579`, already inside the moved block and thus running post-reorder, so it sees the populated
workspace channel): the Apex resolver registers `emitHeritageEdges` to resolve a dotted nested-parent base
OUTER-first (workspace binding → nested-member lookup among the outer's owned defs) and emit the correct
EXTENDS edge — **pure registration of an existing generic hook, exactly like WI-3's Seam-B**: no shared-code
edit, no §2.2 concern (the hook already exists; Apex supplies an Apex-local implementation). If pure
registration proves insufficient (e.g. the shared `preEmitInheritanceEdges` decoy mis-bind must be
additionally suppressed for the dotted site), the mechanism escalates to a **generic per-language
heritage-base seam** — a shared edit, §2.2-reviewed at selection (the epic's second shared edit, same §2.2
argument as the reorder), never a language-named branch. **Committed satisfaction path either way (finding
#29):** if no §2.2-clean mechanism resolves the dotted form, the fallback is **Architect escalation → SRS
amendment** (re-ratify BL-3/BL-4 as bounded limitations, or sanction a mechanism) — so BL-3/BL-4 and their
fallout BL-6/BL-7 **never rest solely on an un-pre-sanctioned seam**. Discharging BL-3/BL-4 removes the false
EXTENDS edge, so `buildMro` no longer carries the decoy into the MRO and the **BL-6 poisoned member**
(`s.decoy2()`) and **BL-7 super/inherited fallout** discharge as consequences — no separate MRO edit.

**(3) REQ-008 parameter-typed-argument narrowing completion (the WI-2-deferred sub-case).** RESEARCH-004
findings 7-8: the argument-typing path already resolves a parameter's declared type from the local
`varTypes` map (`captures.ts:415-450`, built from `@type-binding` captures incl. parameters); WI-2 left
parameter args untyped only because narrowing on an **external** parameter type would mis-resolve. WI-4
**gates** the parameter-type narrowing on the **user-defined-vs-external oracle** — `workspaceFqnBindings`
membership (`workspaceBindingsFor`, `walkers.ts:65-73`; the registry WI-3's REQ-010 populates): a parameter
whose declared type is in the workspace is user-defined → narrow; absent → external → leave untyped
(arity-only, conservative, **never mis-bound**). Apex-local (`languages/apex/captures.ts`); **no shared
edit**. This **completes** WI-2's REQ-008 mechanic (SDD-002 §2 / work-items REQ-008 note) without re-owning
it — mirroring how WI-3/REQ-010 completed WI-2's cross-file forms.

**(4) REQ-013 external handling; REQ-012 / NFR-004 parity; receiver-variable case-fold.** RESEARCH-004
finding 6: "external = benign unresolved" is the **host default** — an unresolved reference emits no edge and
no defect (`resolve-references.ts:127-129`; `resolution-outcome.ts` has only `resolved`/`suppressed`, no
`external` kind). REQ-013 acceptance = a stdlib/sObject/managed-package reference emits no edge and no
unresolved *defect*, verified by a parity fixture; the only possible addition is an Apex `builtInNames` reuse
(`language-provider.ts:379/423`) **iff** a parity fixture shows a false-positive external *attempt* — an
Apex-local config, not a new mechanism. **REQ-012 / NFR-004** are the parity *evidence*: a resolution test
suite comparable to peers (the NFR-004 `apex-resolution` suite — `apex-resolution.test.ts`, with WI-4 parity
fixtures as §2.5-permitted additive siblings) over the full same-file + cross-file surface, demonstrating
Java/Kotlin-tier resolution. The **receiver-variable-name case-fold** (the WI-2→WI-3→WI-4 re-deferred
case-insensitivity completeness item) folds a receiver variable's name at its lookup, Apex-local against
REQ-005/REQ-008 case-insensitivity; no epic §9 scenario varies a variable's case, so it is parity hardening,
not a SHALL gap.

**Acceptance boundary.** WI-4's acceptance is the parity + external + discharged-limitation forms: the BL-1…
BL-8 fixtures flip from documented-limitation pins to **correct-resolution** assertions; a parity-fixture
suite; an external-reference fixture; a parameter-typed cross-file overload fixture. The BL-1…BL-8 discharge
updates the **SRS §5.1 register** (those rows carry `Fix=WI-4`) and the governing **REQ-007 / REQ-005 /
REQ-009** limitation clauses (REQ-009 v1.15 co-governs BL-6's poisoned-MRO field/property-chain carve-out) —
a documented SRS amendment **upon Gate-3 verification** of the discharge (a Phase-5 cascade, not
authored pre-verification, so the register is not mutated ahead of the evidence).

## 2. Behavioural contract (each REQ → clause; host-structural vs Gate-3 reliance marked)

> **Verification split (finding #13).** **[structural]** = pinned here (the pass re-sequence wiring, the
> movable-block boundary, the oracle's existence — read-verifiable against the host API). **[Gate-3 reliance]**
> = host-API *behaviour* only the real host confirms — design obligations validated at Gate 3 (tests vs host)
> or Gate 4 (NFR-002 measurement), not Gate-2 pins. The Gate-2 adversary reviews the wiring + the split, NOT
> the truth of the behaviours.

- **REQ-012 (Java/Kotlin resolution parity).**
  - *Precondition:* a repository of user-defined Apex types exercising the same resolution shapes peer
    languages resolve (calls, types, inheritance, overloads, field chains — same-file and cross-file).
  - *Postcondition:* Apex resolves each shape to the same edge kinds a peer-language equivalent would, with
    no Apex-specific gap — demonstrated by a parity fixture suite. **[Gate-3 reliance]** (the resolution
    outcomes vs the real host); **[structural]** only that the suite exists and runs (NFR-004).
- **REQ-013 (external references are benign, not defects).**
  - *Precondition:* an Apex reference whose target is a standard-library, sObject, or managed-package type
    (not user-defined, absent from `workspaceFqnBindings`).
  - *Postcondition:* the reference emits **no edge and no unresolved *defect*** — the host default (finding
    6). **[Gate-3 reliance]** on the host no-edge-on-miss behaviour; committed Apex-local remediation iff a
    parity fixture shows a false-positive external attempt: the `builtInNames` reuse (never a silent
    de-scope).
- **REQ-008 completion (parameter-typed-argument narrowing) — a *completion* of WI-2's mechanic, not
    re-ownership.**
  - *Precondition:* an overloaded call whose disambiguating argument is a **method-parameter reference**
    whose declared type is a **user-defined** (in-workspace) type.
  - *Postcondition:* the overload narrows by the parameter's declared type (same arity-then-exact-type
    narrowing WI-2 verified for local/field/literal/ctor args); when the parameter's type is **external**
    (absent from `workspaceFqnBindings`) the argument is left untyped (arity-only) and **never mis-bound**.
    **[structural]** = the oracle is `workspaceFqnBindings` membership (finding 8); **[Gate-3 reliance]** =
    that gating the existing `resolveVarTypeBindings` narrowing on that oracle resolves the user-defined case
    and conservatively skips the external case.
- **REQ-007 / REQ-005 / REQ-009 heritage-limitation discharge (BL-1…BL-8) — completion via the reorder, not
    a new REQ.** The reorder makes WI-2's REQ-007 heritage mechanic and REQ-005 super-delegation reach the
    cross-file channel at heritage-resolution time, exactly as REQ-010 made the other WI-2 mechanics reach
    across files; REQ-009 v1.15 co-governs BL-6 (the typed-receiver member call on a mis-bound subtype).
  - **BL-1** (case-varied `extends BASE`): *postcondition* — EXTENDS edge emitted (the folded workspace key
    resolves the base). **Reorder discharges.**
  - **BL-2** (case-variant trigger/class twin `extends Twist`, `Twist.trigger`+`class TWIST`): *postcondition*
    — EXTENDS to the **class** (the folded workspace key hits the injected class before the exact-case trigger
    bind), never the trigger. **Reorder discharges** (the §7(11)-family class-wins ordering, now on the
    heritage path).
  - **BL-3** (nested-parent `extends Outer.Inner`, no decoy): *postcondition* — EXTENDS to the real nested
    `Inner @ Outer`. **Reorder + the committed nested-aware base resolution discharges** (a committed
    deliverable, not iff-red — §1(2)).
  - **BL-4** (nested-parent + same-tail top-level decoy): *postcondition* — EXTENDS to the real nested
    `Inner @ Outer`, **never** the decoy. **Reorder + nested-aware base resolution discharges** (the v1.10(iv)
    target; the reorder alone leaves the QNI dotted-tail decoy mis-bind, finding 4).
  - **BL-5** (same-case valid trigger/class twin `Foo.trigger`+`Foo.cls`, `extends Foo`): *postcondition* —
    EXTENDS to the injected class `Foo` (trigger excluded from injection; the class is the unique workspace
    key). **Reorder discharges.**
  - **BL-6** (typed-receiver `s.decoy2()` on a BL-4 subtype): *postcondition* — no false member edge into the
    decoy (the MRO is clean once BL-4's EXTENDS is correct). **Discharged as BL-4 fallout.**
  - **BL-7** (super/inherited arms of a BL-3 nested-parent subtype): *postcondition* — `super()`/
    `super.method()`/inherited implicit-this resolve to the real parent (no self-loop, no unresolved).
    **Discharged as BL-3 fallout.**
  - **BL-8** (super/inherited arms of a BL-1/BL-5 simple-name subtype): *postcondition* — the EXTENDS edge now
    exists (BL-1/BL-5 discharged), so super resolves to the parent *with* the EXTENDS edge and `buildMro`
    includes the parent → inc-15's gated MRO walk resolves the inherited implicit-this. **Discharged as
    BL-1/BL-5 fallout.**
  - *All BL-1…BL-8: **[Gate-3 reliance]*** on the post-reorder resolution outcome (fixtures flip from
    limitation-pins to correct-resolution); the nested-aware base resolution is a **committed deliverable**
    for BL-3/BL-4 (§1(2)), with the Architect-escalation-→-SRS-amendment fallback if no §2.2-clean mechanism
    resolves the dotted form; no silent de-scope (Constitution §7).
- **REQ-005/REQ-008 receiver-variable case-fold (case-insensitivity completeness).**
  - *Postcondition:* a case-varied receiver **variable** name (`Account a; A.foo()` where `A` refers to the
    variable `a`) folds to its declaration. Apex-local; **[Gate-3 reliance]** on the folded lookup resolving.

## 3. Interface definition (what WI-4 adds)

- **The pipeline re-sequence** (`scope-resolution/pipeline/run.ts`, `:554-641`): the contiguous
  heritage-resolution + MRO block `:573-602` (the seven passes enumerated in §1(1) — `preEmitInheritanceEdges`,
  `emitHeritageEdges?`, `emitImplicitImportEdges?`, the `postHeritageNodeLookup` rebuild,
  `emitDetectedInterfaceImplementations`, `buildMro`, `buildExtendsOnlyMro?`) moves **as a unit, internal
  order preserved**, to after `populateNamespaceSiblings` (`:640`); the `indexes`/`methodDispatch`
  construction splits (empty dispatch built pre-block so `populateNamespaceSiblings` can consume `indexes`,
  populated dispatch swapped in post-`buildMro` before `resolveReferenceSites`). **Generic** — no language
  named. Plus the committed **per-language gate**: an optional `resolveHeritageAfterSiblings?: boolean` (or
  equivalent) on the resolver contract, default matching the current order for peers, set true by the Apex
  resolver — engaged **iff** the Gate-4 NFR-002 measurement shows a peer regression. *(The default —
  generic-for-all vs gated-from-start — is settled by the measurement, per the Architect ruling; the SDD pins
  the generic reorder as primary and the gate as the measured fallback.)*
- **Committed nested-aware heritage base resolution** (a committed deliverable for the dotted form — §1(2),
  RESEARCH-004 finding 4): resolves a dotted nested-parent base OUTER-first (workspace binding →
  nested-member lookup) — the inc-11 mechanism on the heritage path. **Preferred: pure registration of the
  existing generic `emitHeritageEdges` hook** (`run.ts:579`, Apex-local impl, no shared edit — like WI-3's
  Seam B); escalating to a generic per-language heritage-base seam (§2.2-reviewed) only if registration is
  insufficient; with the Architect-escalation-→-SRS-amendment fallback if no §2.2-clean mechanism resolves
  the dotted form.
- **REQ-008 parameter-arg narrowing gate** (`languages/apex/captures.ts`): `resolveVarTypeBindings` narrows a
  parameter-typed argument **only when** the parameter's declared type is in `workspaceFqnBindings`
  (user-defined); else arity-only. No shared edit.
- **External-oracle reuse** (`workspaceFqnBindings` membership) — no new type; the REQ-013 external
  classification is "absent from the workspace registry".
- **Parity + external fixtures** (`apex-resolution.test.ts` — the NFR-004 resolution suite, per Constitution
  §2.5; WI-4-specific parity fixtures may be §2.5 additive siblings, e.g. `apex-parity.test.ts`; the Gate-5
  fuzz follows the `apex-*-hardening.test.ts` sibling pattern): a parity suite comparable to peers; an external-reference
  fixture; a parameter-typed cross-file overload fixture; the BL-1…BL-8 correct-resolution fixtures (flipped
  from `apex-cross-file-collision` limitation pins).

## 4. Edge-case catalog (per-input checklist → each traces to a Gate-3 test)

- **Empty / no heritage:** a repo with no inheritance → the reorder is a no-op (no `inherits` sites); peers
  unaffected (NFR-002).
- **Peer heritage under the reorder:** a peer's cross-file heritage (Java `extends` an in-package type) —
  must resolve **byte-identically** to the current order (NFR-002; the Gate-4 measurement). *The load-bearing
  edge case:* if a peer's heritage newly resolves (a new edge) → the committed per-language gate.
- **Invalid-source Apex heritage/name-reference rows under the reorder (BL-9…BL-14, `Fix=—`):** the reorder
  fires for **every** Apex heritage clause, so it could perturb the ratified invalid-source rows that have a
  heritage/name-reference arm — and an Apex-only change here is invisible to the *peer* suites, so each is
  **explicitly pinned** (§8), per channel:
  - **BL-9** (class mis-filed in `.trigger`): the mis-filed class is `.trigger`-**excluded** from the §3
    injection → workspace never holds it → its `inheritance` reference still binds via the QNI exact-case
    channel, **unchanged**.
  - **BL-11** (correctly-filed trigger referenced as a type, no same-named class): the trigger is in a
    `.trigger` file → **excluded** from injection → workspace empty → the exact-case reference still binds the
    trigger via QNI, **unchanged**.
  - **BL-12** (duplicate case-folded-colliding top-level types, both correctly-filed): both index under one
    folded key → the §3 **inject-none** guard injects **neither** → the workspace channel is **empty** for the
    colliding key → the exact-case arm still binds the unique exact-case match via QNI, the same-case arm
    still binds nothing (2 QNI matches), **unchanged** (the inject-none guard forecloses the reviewer's
    "picks one folded candidate" concern — nothing is injected to pick).
  - **BL-13 / BL-14** (fragment / misfiled-trigger collision): the §3 guard **registers neither** → workspace
    empty for the colliding key → the valid type's cross-file forms stay unresolved as ratified, **unchanged**.
  - **BL-10** (trigger mis-filed in a `.cls` file — the one that is NOT purely byte-identical): a `.cls`-filed
    trigger def (type `Class`) **passes** the §3 extension discriminant → it **is** injected. Post-reorder its
    heritage/name reference routes through the workspace channel. **Exact-case arm:** binds the **same** trigger
    def the pre-reorder QNI channel bound → invariant *target*. **Case-varied arm:** the folded workspace key
    may **newly** bind (where pre-reorder, exact-case-only, it did not) — a delta **within BL-10's
    invalid-source `§1.2-(b)` "globally referenceable" ratification** (Apex is case-insensitive, so a
    case-varied bind to the same mis-filed trigger is consistent), but a **behaviour delta, not byte-identity**
    → a **[Gate-3 reliance]** pinned and **Architect-confirmed** (not assumed), routed as a BL-10 ratification
    refinement if the case-varied widening is undesired — never silently absorbed.
  None is `Fix=WI-4`; the reorder must leave every BL-9…BL-14 outcome as ratified (Constitution §7 — no
  silent change to a ratified row), with BL-10's case-varied arm the one flagged delta.
- **Dotted base, no nested target (external outer):** `extends Ext.Inner` where `Ext` is external → no
  workspace hit, no nested lookup → EXTENDS absent (benign; REQ-013-adjacent), never a mis-bind.
- **Dotted base, ambiguous nested tail:** `extends Outer.Inner` where two outers own an `Inner` → conservative
  (the nested lookup refuses on tie, never guesses — mirrors REQ-015 / `resolveQualifiedInheritanceBase`'s
  refuse-on-tie).
- **Parameter arg, external type:** an overload arg is a parameter of a stdlib type (`String s` param used as
  arg) → arity-only, never mis-bound (REQ-008 completion's conservative arm).
- **Parameter arg, user-defined type:** narrows by the parameter's declared type.
- **External reference (stdlib/sObject/managed pkg):** no edge, no defect (REQ-013).
- **Case-varied receiver variable:** folds to its declaration; a case-collision between two variables →
  conservative (WI-2's collision discipline).
- **Malformed / partial tree under the reorder:** the reorder introduces no new throw; a heritage site whose
  base is in a skipped file stays unresolved (NFR-001 resolution slice).
- **Cyclic cross-file heritage** (`A extends B`, `B extends A`): the host MRO's existing bounded-iteration cap
  bounds it post-reorder (no new unbounded walk) — NFR-001 no-hang.

## 5. Non-functional requirements (baked in)

- **NFR-002 (the load-bearing one for WI-4).** The reorder is a **generic** pass re-sequence, so — unlike
  WI-1/WI-3 — it *can* affect peers. Peer heritage resolution must stay byte-identical: **measured** at Gate 4
  by the full peer resolver suites + a cross-language regression sweep. If any peer's heritage edges change,
  the committed per-language gate confines the reorder to Apex. The parameter-arg gate, external oracle, and
  receiver-var fold are all Apex-local (no peer surface). NFR-002 is the primary Gate-4 obligation.
- **NFR-001 (resolution-stage slice).** The reorder + nested lookup + parameter-arg gate complete without
  crashing on partial/error-recovery trees and references into skipped files; an unresolvable base/reference
  is left unresolved, never a throw.
- **NFR-004.** An automated Apex resolution test comparable to peers exists (the `apex-resolution` suite —
  `apex-resolution.test.ts`, auto-discovered by the CI parity glob per Constitution §2.5) — the parity
  suite is its REQ-012 extension.
- **Performance:** the reorder adds no per-reference cost (it re-sequences existing passes; the workspace
  channel lookup already runs). The nested-aware base resolution (if engaged) is O(1) per dotted heritage site
  (one workspace lookup + a bounded owned-def scan). The parameter-arg gate is one map membership check per
  parameter-typed argument.

## 6. Security-critical tag & clauses

**security-critical = false.** WI-4 consumes WI-1's safe-parsed model + WI-2/WI-3's resolution model; it
opens no new trust boundary and authors no SEC clause (SECT-001 remains WI-1's). The conservative-skip default
(REQ-015) holds: an unresolvable heritage base, external reference, or external-typed parameter arg degrades
to no edge / no narrowing, never an unsafe binding. The reorder cannot *relax* conservatism — it can only make
a *correct* cross-file base reachable that was previously missed.

## 7. Verification architecture (Step 2b — **APPROVED — Adam (Architect), 2026-07-07**)

- **Provable properties (§A.3): none** — an **explicit per-property disposition** (matching SDD-001/002/003
  §7). The candidate is the **heritage no-mis-bind** safety property (the reorder never emits a *wrong*
  EXTENDS edge, and the nested lookup refuses on tie). Per the §A.3 decision table it is **test-only**:
  graph-resolution correctness, finitely example-verifiable by fixtures (the BL-4 decoy fixture asserts no
  edge to the decoy; the ambiguous-nested fixture asserts refuse-on-tie) — **not** a data-integrity or
  trust-boundary invariant over unbounded state (WI-4 opens no trust boundary, §6). It guards no
  security/financial/data-integrity/safety/concurrency invariant, so no Prove obligation arises. **NFR-002**
  is the reorder's real gate, discharged by *measurement* (peer suites), not proof. Gate 5 for WI-4 reduces to
  the resolution-slice no-crash fuzz + mutation over the new `languages/apex/` code and the reordered region
  (same calibration as WI-1/2/3, by per-property reasoning).
- **Purity boundary.** Pure core = the **def-selection / nested-lookup / oracle-membership helpers** — pure
  functions of `parsedFiles`/`workspaceFqnBindings` (no I/O, no module state, deterministic; the §7
  unit-anchor targets, dogfood #16). Effectful shell = (a) the `run.ts` **pass re-sequence** (host-structural
  control flow — the pipeline invokes passes; no new state), and (b) the parameter-arg gate's write into the
  existing `varTypes`/narrowing path. Dependency direction is shell→core. The reorder moves *existing*
  effectful passes; it introduces no new effect, only a new order.
- **Tooling.** Host test framework (vitest) — integration resolution tests over multi-file fixtures (the
  BL-1…BL-8 flipped fixtures; the parity, external, and parameter-arg fixtures) + main-thread unit anchors for
  the new pure helpers (nested-base resolution, oracle membership) so the logic is coverage-attributable
  (dogfood #16). Gate-4 adds the **NFR-002 measurement** (full peer resolver suites, cross-language sweep) as
  the reorder's objective evidence.
- **Gate-3 / Gate-4 reliances (finding #13 — the explicit list to FLAG, not pin).** (1) that the reorder
  resolves each simple-name heritage form (BL-1/BL-2/BL-5/BL-8) — validated by the flipped fixtures; (2) that
  the reorder + nested-aware base resolution resolves the dotted form (BL-3/BL-4) and clears the poisoned MRO
  (BL-6/BL-7) — the nested lookup is a committed deliverable (§1(2), structurally required per RESEARCH-004 finding 4, preferentially the `emitHeritageEdges` registration), with the Architect-escalation-→-SRS-amendment path if no §2.2-clean mechanism resolves the dotted form; (3) **(Gate-4 NFR-002)**
  that every peer's heritage edges stay byte-identical under the reorder — the committed per-language gate iff
  not; (4) that gating `resolveVarTypeBindings` on the workspace oracle narrows the user-defined
  parameter-arg case and conservatively skips the external case; (5) that an external reference emits no edge
  and no defect — committed `builtInNames` reuse iff a false-positive; (6) that a case-varied receiver
  variable folds to its declaration; (7) that the parity fixtures resolve at Java/Kotlin tier. Gate 3 (tests
  vs the real host) validates 1-2, 4-7; Gate 4 measures 3. The Gate-2 adversary validates the **wiring** (the
  re-sequence, the split of pure helpers from the reordered shell, the committed-fallback discipline) and the
  split, not the behaviours.

## 8. Tracker integration & Gate-3 acceptance

Each REQ clause, BL-row discharge, and edge case maps to a sub-item. **Gate-3 acceptance assertions**
(multi-file fixtures, automated):
- **BL-1…BL-8 discharge** — the `apex-cross-file-collision` (and heritage) fixtures flip from
  documented-limitation pins to correct-resolution: BL-1 case-varied `extends BASE` → EXTENDS; BL-2 twin
  `extends Twist` → EXTENDS to the class; BL-3/BL-4 nested-parent → EXTENDS to the real nested type (never the
  decoy); BL-5 same-case twin → EXTENDS to the class; BL-6 `s.decoy2()` → no false member edge; BL-7/BL-8
  super/inherited → resolve to the real parent. Each also asserts REQ-006 negative (no false unresolved
  record) for the newly-resolved reference.
- **REQ-008 cross-file parameter-arg overload** — file B has `f(UserType)`/`f(String)`; a call `b.f(p)` where
  `p` is a parameter declared `UserType` (user-defined) → resolves `f(UserType)`; where `p` is declared an
  external type → arity-only, unresolved-not-mis-bound.
- **REQ-013 external reference** — a call/type-use on a stdlib/sObject/managed-package name → zero edges, zero
  unresolved defect, run completes.
- **REQ-012 parity** — a parity fixture set resolving the peer-equivalent shapes at Java/Kotlin tier;
- **NFR-004** — the parity suite is an automated resolution test comparable to peers.
- **Receiver-variable case-fold** — a case-varied receiver-variable reference resolves to its declaration.
- **NFR-002** — every peer resolver suite green under the reorder (the Gate-4 measurement); a mixed-language
  regression sweep clean.
- **Invalid-source-row non-regression (intra-Apex, `Fix=—`)** — the reorder leaves every BL-9/BL-11/BL-12/
  BL-13/BL-14 outcome **byte-identical** (each resolves through a channel the reorder leaves empty for that
  row — BL-9/BL-11 `.trigger`-excluded; BL-12/BL-13/BL-14 §3-inject-none — so the QNI channel bind is
  unchanged), and **BL-10**'s exact-case arm binds the **same** mis-filed-trigger def (invariant target) while
  its **case-varied arm** is pinned as a flagged **[Gate-3 reliance]** delta (post-reorder the `.cls`-injected
  trigger's folded key may newly bind — Architect-confirmed within BL-10's `§1.2-(b)` ratification, §4).
  Pinned by the existing WI-3 collision/misfiled-heritage fixtures re-run under the reorder, plus a BL-10
  case-varied fixture — an Apex-only change the peer suites cannot see.
- **NFR-001** — the reorder + nested lookup + parameter-arg gate no-crash on a partial tree + a reference into
  a skipped sibling; cyclic cross-file heritage no-hang.

**Scope note (SRS cascade).** Discharging BL-1…BL-8 updates the SRS §5.1 register (those rows carry
`Fix=WI-4`) and the governing **REQ-007 / REQ-005 / REQ-009** limitation clauses (REQ-009 v1.15 co-governs
BL-6) — a documented SRS amendment authored **upon Gate-3 verification** of each discharge (a Phase-5
cascade), not pre-verification, so the register is never mutated ahead of the evidence. The parity (REQ-012) and external (REQ-013) forms complete the epic §9 scope
WI-1/2/3 left to WI-4.
