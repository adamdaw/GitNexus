# WI-1 (SDD-001) — Red-Gate evidence & no-red justification

*VSDD Phase 3, Step 3a. Companion to the Gate-3 test-validator review. Records,
per the methodology's Red Gate, which new tests are forceably red now and which
have no forceable red state pre-implementation (Principle 3 — committed
justification). Pre-existing suite stays green throughout.*

## Authored tests (map to SDD-001 §8)

| Test | File | §8 assertion(s) | Red state at Gate 3 |
|---|---|---|---|
| filename → Apex (`.cls`/`.trigger`) + NFR-002 spot | `test/unit/ingestion-utils.test.ts` (Apex describe) | REQ-001 recognition | **RED now** |
| provider routing (`.cls`/`.trigger` → apex provider) | `test/unit/ingestion-utils.test.ts` (`getProviderForFile`) | REQ-001 dispatch | **RED now** |
| manifest apex entry + regeneration hold | `test/unit/apex-vendored-grammar.test.ts` | §1 vendoring / RESEARCH-001 §3 #3 | **RED now** |
| type kinds, nested, qualified id, DEFINES | `test/integration/resolvers/apex.test.ts` | REQ-002 | SKIP→red in 3b (see below) |
| member kinds, HAS_*, no-dangling | same | REQ-003 | SKIP→red in 3b |
| type-only overloads, identical-sig dup, multi-declarator | same | REQ-003 | SKIP→red in 3b |
| isExported per context (10 cases) | same | REQ-002 export rule | SKIP→red in 3b |
| trigger container (apexConstruct, isExported=false, DEFINES, vs class) | same | REQ-004 | SKIP→red in 3b |
| annotations on method/constructor/field/property | same | REQ-014 | SKIP→red in 3b |
| malformed no-crash (both name paths) + owner-cascade + no-dangling | same | NFR-001 / SEC-001 | SKIP→red in 3b |
| over-budget skip | same | NFR-003 | SKIP→red in 3b |
| grammar-unavailable degradation | same | NFR-001 (no-crash) | **no forceable red** (below) |

## No-red justification (Principle 3)

**Grammar-dependent integration suite (the SKIP→red rows).** Every behavioural
assertion that requires a parsed Apex tree is guarded by `apexAvailable =
isLanguageAvailable('apex')`. Until the Apex grammar is vendored, `apexAvailable`
is `false` and these `describe.skipIf` blocks skip rather than fail. They cannot
be forced red at Gate-3 time because the three things they exercise are all
**hook-blocked implementation/config** that the VSDD gate locks until Gate 3
clears:

1. the vendored grammar under `vendor/tree-sitter-apex/` (its `parser.c`,
   `grammar.js`, `*.cc` match the hook's gated `CODE_EXT`);
2. the `SupportedLanguages.Apex` enum value + `.cls`/`.trigger` extension map
   (`gitnexus-shared/src/…`, `src/config/…` — gated `.ts`);
3. the `apexProvider` and extractors under `languages/apex/` (gated `.ts`).

This is the host's own established pattern: every optional-grammar resolver suite
(`swift.test.ts`, the Dart suite) `skipIf`s when its grammar is unbuilt. The
transition to red→green happens in **Step 3b**: the first action after Gate 3
unlocks is to vendor the grammar and register the enum, at which point
`apexAvailable` becomes `true` and each assertion fails until its extractor is
implemented. That red→green per assertion is recorded in `WI-1-tdd-log.md`.

**The genuinely-red-now anchor.** The Red Gate is demonstrated concretely by the
three unit suites above (filename classification, provider routing, manifest
hold), which fail now against the unmodified host and pass only once the
registration/manifest edits land — no grammar required. They cover REQ-001 and
the §1 vendoring contract without depending on a built grammar.

**`grammar-unavailable degradation` — no forceable red, by nature.** This test
asserts a graceful-degradation invariant (recognised `.cls`/`.trigger` files
produce no nodes and never crash when the grammar is absent). It holds both
before implementation (no Apex support → no nodes) and after (skip-flag → no
nodes), so it has no red state. It is retained as regression protection for the
optional-grammar path, not as a red-gate driver.

## Evidence (run 2026-06-28, `vitest run`)

New Apex tests, run together:
- **6 failed (red, intended):** 3 filename-classification (`.cls`/`.trigger`/`.cls`-in-path),
  1 provider-routing, 2 manifest-hold. These are the forceably-red Gate-3 anchors.
- **45 skipped:** the grammar-gated integration suite (`apexAvailable === false`).
- **109 passed:** pre-existing assertions in the touched files + the NFR-002 spot-check
  + the grammar-unavailable degradation test (the no-forceable-red regression guard).

Full `test/unit` run: **9098 passed, 38 skipped, 26 failed.** Of the 26: **6 are the
intended Apex red anchors above.** The other **20 are pre-existing, environment-only
failures unrelated to Apex**, in files this change does not modify
(`git.test.ts`, `skip-git-cli.test.ts`, `incremental-orchestration.test.ts`,
`pdg-mode-flip.test.ts`, `sibling-clone-drift.test.ts`). They are git/CLI/incremental
filesystem-assumption failures on this fresh sandbox — e.g.
`findGitRootByDotGit('/tmp')` returns `/tmp` because the sandbox `/tmp` is itself under
a `.git` worktree, so the test's "tmpdir is outside any repo" precondition is false.
`git status` confirms none of those five files are in the working-tree diff, so the
failures cannot be regressions from this change. **Red-Gate condition met: this change
adds exactly the intended red tests and zero regressions.**

## Dogfood finding #10 (fold into the VSDD plugin)

The hard-gate hook's binary "all non-test/non-md source is locked until Gate 3"
conflates three distinct things for a **brownfield language-addition**: (a)
vendoring a third-party grammar/asset, (b) language registration (enum +
extension map), and (c) our implementation logic. Locking (a)+(b) forces the
spec's behavioural integration tests to be *skipped, not red,* at Gate-3 review
time — the bulk of the §8 contract cannot show a red state until after the gate
unlocks. The methodology's no-red-justification valve covers this, but the
finding is: VSDD should either (i) let Phase-3 vendor third-party
grammars/assets + language registration before Gate 3 (so behavioural tests are
red-capable at review), or (ii) explicitly document that brownfield
capability-additions satisfy the Red Gate via unit-level anchors + a
justification for the capability-gated suite. Architect to choose.
