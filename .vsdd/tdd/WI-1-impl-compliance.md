# WI-1 (ITEM-001) — Phase 3 Step 3b TDD compliance log (§A.12)

Per-increment record: failing test(s) → minimal implementation → pass, with changed
files and a one-line justification the diff is confined to satisfying the targeted tests.
Minimality is checked against this log at Gate 4.

Grammar/build note: integration tests run the **compiled `dist/` worker**, and
`gitnexus-shared` resolves to its built `dist/`. Each shared/worker edit requires
`node scripts/build.js` (or `gitnexus-shared && npm run build`) before re-running the suite.

---

## Increment 1 — Recognition layer (REQ-001)

- **Targets (red→green):** `ingestion-utils.test.ts` 4 Apex anchors (`.cls`/`.trigger`
  classification ×3, provider routing ×1); the NFR-002 non-Apex regression test stays green.
- **Changes:**
  - `gitnexus-shared/src/languages.ts` — `Apex = 'apex'` enum member.
  - `gitnexus-shared/src/language-detection.ts` — `.cls`/`.trigger` → Apex in EXTENSION_MAP;
    `apex` in SYNTAX_MAP (both exhaustive `satisfies Record<SupportedLanguages,…>`).
  - `gitnexus-shared/src/scope-resolution/language-classification.ts` — Apex `'experimental'`
    (third exhaustive Record forced by the enum addition).
- **Justification:** §2.2 host registration (the same enum + extension-map onboarding every
  peer language uses); introduces no Apex-specific control flow into shared code.

## Increment 2 — Apex provider directory (REQ-001…004, REQ-014 happy paths)

- **Targets:** unit provider-routing anchor; the bulk of `apex.test.ts` (type containers,
  members, method/constructor overloads via host `typeTagForId`, isExported by context,
  enum constants, nested `Outer.Inner` ids, DEFINES/HAS_* edges, isolation, encoding,
  empty/whitespace, over-budget skip).
- **Changes (all §2.1-clean, consolidated under `languages/apex/`):** `queries.ts`,
  `class-config.ts` (mirrors JVM; `qualifiedNodeId:true` for nested ids — Apex diverges from
  Java here), `field-config.ts`, `method-config.ts` (method+constructor; param `rawType` for
  overload id), `export-checker.ts` (context-dependent Apex visibility rule), `type-config.ts`
  (minimal; WI-2 builds resolution), `import-resolver.ts` (no-op; Apex has no imports),
  `index.ts` (provider). Registered in `languages/index.ts`.
  - `tree-sitter-queries.ts` — Apex entry in the **unused** `LANGUAGE_QUERIES` exhaustive
    stub (worker reads `provider.treeSitterQueries`; canonical query lives in the provider dir).
- **Justification:** the provider is the §2.2 onboarding surface; all Apex behaviour is under
  `languages/apex/`. Reuses host factories unchanged.

## Increment 3 — Worker vendored-grammar registration (REQ-001 enablement)

- **Bug found:** the parse **worker** keeps its OWN module-local vendored-grammar table
  (`Swift/Dart/Kotlin/C` try-requires + `languageMap`) and a local `isLanguageAvailable`;
  the Gate-3 scaffold registered Apex in `parser-loader` (main-thread gate) but NOT here, so
  the worker skipped all `.cls`/`.trigger` files (`Skipped unsupported languages: apex: N`) and
  emitted zero Apex nodes.
- **Change:** `workers/parse-worker.ts` — add the guarded `requireVendoredGrammar('tree-sitter-apex')`
  + the `...(Apex ? { [Apex]: Apex } : {})` map entry, exactly parallel to Swift/Dart/Kotlin/C.
- **Justification:** §2.2 vendored-grammar onboarding (the file's own documented "add a
  try-require + languageMap entry" step), not Apex-logic. **Result: 50/65 integration tests green.**

---

## Remaining (Increment 4) — generic worker hooks for the 15 obligation tests

These are the SDD's "host-API behaviours verified at Gate 3" (§1 verification split). Each
requires a **generic** shared-worker hook (NOT naming Apex, §2.1) that the Apex provider
configures. **Design-fork checkpoint: pending Architect (Adam) sign-off before editing the
shared worker.**

1. **Trigger `apexConstruct` + trigger/class id distinction** (3 tests) — generic
   `provider.extractNodeProperties?(definitionNode, label)` merged into node properties.
2. **Field/property/multi-declarator annotations onto Property nodes** (4) — generic
   `FieldInfo.annotations` + a `config.extractAnnotations` field hook, spread in the worker's
   Property branch (currently spreads only type/visibility/static/readonly).
3. **Apex member-id construction** (4) — always-on canonical param signature + case-normalized
   identity (Apex case-insensitivity) with preserved-case `name`, + per-declaration-site
   (line:col) disambiguation for identical-signature/same-name duplicates. Generic provider id
   hook + a pure per-file collision fold (SDD §7 "Apex emission layer").
4. **Owner-name cascade drop** (3) — drop members/nested types of a nameless owner.
5. **Nested-type DEFINES suppression** (1) — no File→symbol DEFINES for a nested type.

### Increment 4a — the two clean mirrors (DONE, Architect-approved 2026-06-29)

Peer-handling evidence (3 parallel Explore agents) showed 2 obligations mirror an existing
host pattern and 3 diverge from how every peer language works. Adam approved: mirror the 2;
revert the 3 to host behaviour.

- **Field/property annotations (4 tests green):** mirror of the method-annotation pattern.
  - `field-types.ts` `FieldInfo.annotations?`; `field-extractors/generic.ts`
    `FieldExtractionConfig.extractAnnotations?` + spread in `buildField`; worker Property branch
    spreads `info.annotations`. Apex: `languages/apex/annotations.ts` (shared walk) wired into
    `field-config.ts` (multi-declarator propagation falls out — one FieldInfo per declarator name,
    all from the shared `field_declaration` modifiers) and `method-config.ts`.
- **Trigger `apexConstruct` (3 tests green):** class-level analogue of the `isPartial` marker.
  - `class-types.ts` `ExtractedClassSymbol.properties?` + `ClassExtractionConfig.extractProperties?`;
    `class-extractors/generic.ts` returns them; worker spreads `extractedClassSymbol?.properties`.
    Apex `class-config.ts` stamps `{apexConstruct:'trigger'}` for `trigger_declaration`.
  - All generic (no Apex names in shared code); §2.1 preserved. **57/65 green.**

### Increment 4b — the three reverts (PENDING Architect sign-off on Phase-5 revert scope)

Adam's direction: revert these to host behaviour rather than diverge. No new WI-1 impl; instead
revise the 8 Gate-3 tests to assert host behaviour + amend the SDD/SRS clauses (Phase-5 cascade).
1. **Nested-type DEFINES** — host emits File→nested DEFINES (so does the Java benchmark; REQ-012
   parity points this way). Revise the "does NOT emit" test to expect it.
2. **Member ids** — keep host ids: case-preserving (case-insensitivity is the resolver/WI-2 job,
   as in C#); param signature collision-triggered only; identical-signature duplicates collapse
   (host last-write-wins/dedup). Revise the 4 id tests.
3. **Owner cascade** — host re-parents a nameless owner's members to File scope (not dropped).
   Revise the 3 cascade tests; verify the "no degenerate node" case against actual host output.

### Increment 4c — no-degenerate-node generic guard (DONE, Architect-approved 2026-06-29)

Grounding in actual host output: for a nameless class (`public class { void m(){} class Inner {…} }`)
the host **re-parents** members to File (`Methods = [innerM, m, ok]`, `Inner` survives) AND emits a
**degenerate empty-named node** (`['']`). Adam: revert the structural divergences to host, but KEEP
the no-degenerate-node guarantee via a small generic guard.
- `workers/parse-worker.ts` — after `nodeName` is computed, `if (nodeName.trim() === '') continue;`
  (an error-recovery MISSING name node has empty text; never emit a degenerate node on any label).
  Empty owner-segment ids were already prevented by `buildQualifiedName`'s `.filter(Boolean)`.
- Generic (benefits every language). **Verified: Java 186 / Kotlin 233 / C# 217 resolver tests still
  green; Apex degenerate-node test green. Apex now 58/65.**

### Increment 4d — the 7 reverts (PENDING — VSDD Phase 5)

The 7 remaining failures encode the over-engineered divergences. Per Adam, revert to host behaviour.
This is a Phase-5 feedback action (route → Phase 2 SDD / Phase 1 SRS, cascade-invalidate Gate 2/3,
re-derive the 7 tests, re-clear gates). No new WI-1 implementation:
- REQ-002 nested-type: revise "does NOT emit a separate containment edge" → host emits File→nested
  DEFINES (Java benchmark agrees; REQ-012 parity).
- REQ-003 ids: case-preserving ids (case-insensitivity → WI-2 resolver, as in C#); param signature
  collision-triggered only; identical-signature duplicates collapse (host). Revise the 4 id tests.
- NFR-001 cascade: members/nested types of a nameless owner re-parent to File (host), not dropped.
  Revise the 2 cascade tests (keeping the no-degenerate / no-empty-segment assertions, now satisfied).
