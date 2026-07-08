# WI-1 (SDD-001) — Scaffold ledger

*VSDD Phase 3 test-scaffolding record. Each `// vsdd:scaffold`-tagged edit (and
the build/infra it accompanies) is logged here with the **red-stays-red
evidence**: after scaffolding, every *behavioural* target test stays red — only
infrastructure-presence tests green. The Gate-3 Adversary verifies this against
the tagged diffs; `vsdd-advance` refuses Gate 3 without this ledger.*

## What scaffolding is for here

The WI-1 behavioural tests (`test/integration/resolvers/apex.test.ts`) cannot
*run* without the Apex grammar loadable. Vendoring it (rung-3 build/infra) +
registering it in the loader makes `isLanguageAvailable('apex')` true, so the 45
behavioural tests transition **skip → red** (they run and fail — no routing, no
extractors → no Apex nodes). None of this greens a behavioural target.

## Scaffold edits

| Edit | Kind | Greens | Class |
|---|---|---|---|
| `gitnexus/vendor/tree-sitter-apex/` (ABI-14 regen of aheber/tree-sitter-sfapex; `src/parser.c`, `bindings/`, `prebuilds/linux-x64/`, `package.json`, `LICENSE`) | third-party asset, vendored via `cp` (not a Write-tool edit) | nothing behavioural | rung-3 build/infra |
| `.github/vendored-grammars.json` — `apex` entry + ABI-14 regen `hold` | manifest registration (`.json`, ungated) | `apex-vendored-grammar.test.ts` (manifest-hold) | **infra-presence test** — allowed |
| `src/core/tree-sitter/vendored-grammars.ts` — `tree-sitter-apex` in `VENDORED_GRAMMAR_PACKAGES` | loader registration (`.ts`, gated) | nothing | `// vsdd:scaffold` |
| `src/core/tree-sitter/parser-loader.ts` — `SOURCES.apex` row (keyed `'apex'`) | loader registration (`.ts`, gated) | nothing behavioural (flips `isLanguageAvailable` → the 45 run-and-fail) | `// vsdd:scaffold` |

## Infra-test maintenance (adding a vendored grammar updates its enumeration tests)

These are pre-existing infra tests that enumerate / guard the vendored set; adding
a grammar legitimately updates them. None is a behavioural target.

- `test/unit/grammar-update-monitor.test.ts` — registry enumeration `5 → 6` (+apex github/held); the dynamic consistency-guard (`manifest == physical vendor dirs`) now passes with apex on both sides.
- `test/unit/parser-loader-abi.test.ts` — added the `apex` `SMOKE_CASES` entry (ABI load-smoke: grammar loads + parses to `parser_output`).
- Publish-coverage guard (`assert-publish-grammar-coverage.test.ts`) — satisfied by shipping `prebuilds/linux-x64/` (not a stray `build/`, which would shadow prebuilds). *Note:* only `linux-x64` prebuild is present (this host); other-platform prebuilds + the postinstall build-registry wiring are a Step-3b/finishing task.

## Red-stays-red evidence (`vitest run`, post-scaffold)

- **Behavioural targets RED (none greened):**
  - `apex.test.ts` — 47/53 behavioural tests fail (the 6 passers are vacuous negative/safety invariants: the grammar-unavailable degradation no-op early-return, and the "no degenerate node" / "no dangling edge" / "owner-cascade drops the nested type" guard-invariants that hold trivially while there are zero Apex nodes — they strengthen in 3b).
  - `ingestion-utils.test.ts` — the 4 Apex **recognition** tests (`.cls`/`.trigger` → `apex`, provider routing) **stay red**: recognition is a behavioural REQ (REQ-001), its impl is the gated extension map, which scaffolding did **not** touch.
- **Infrastructure-presence tests GREEN (allowed):** `apex-vendored-grammar.test.ts` (2), `grammar-update-monitor.test.ts` (consistency guard + enumeration), `parser-loader-abi.test.ts` (ABI smoke), `assert-publish-grammar-coverage.test.ts` (publish guard).
- **Degradation invariants GREEN (no forceable red — host machinery + scaffold):** `apex-skip-grammar.test.ts` (runtime `GITNEXUS_SKIP_OPTIONAL_GRAMMARS` opt-out: apex reports unavailable when skipped, available when not — host opt-out machinery + the scaffold's `userSkippable` flag, not WI-1 behaviour).
- **No new regressions:** full `test/unit` = **23 failed = 19 pre-existing environment failures** (git/CLI/incremental/pdg/sibling — unrelated, this change touches none) **+ 4 recognition anchors**. The manifest-hold tests are green (infra-presence), the transient vendoring regressions fixed.

**Conclusion:** the scaffold made the behavioural suite executable-red and greened only infrastructure-presence tests. The discriminator held: **behaviour stays red until real implementation (Step 3b).**

## Step-3b closure — scaffold promoted to load-bearing implementation (2026-06-29)

The two `// vsdd:scaffold`-tagged registrations are now **load-bearing production code** and the tags
were removed (de-scaffolded):
- `src/core/tree-sitter/parser-loader.ts` — `SOURCES.apex` rekeyed from the literal `apex:` to
  `[SupportedLanguages.Apex]:` (the enum member now exists); scaffold rationale comment replaced.
- `src/core/tree-sitter/vendored-grammars.ts` — `tree-sitter-apex` in `VENDORED_GRAMMAR_PACKAGES`;
  scaffold comment replaced.
- Completed the deferred build-wiring: `scripts/build-tree-sitter-grammars.cjs` `GRAMMARS` gained the
  `apex` entry (`required:false`, honours `GITNEXUS_SKIP_OPTIONAL_GRAMMARS`).
- Worker fix (separate): `parse-worker.ts` keeps its OWN module-local vendored-grammar table; the
  scaffold registered Apex in `parser-loader` but not there, so the worker skipped all `.cls`/`.trigger`.
  Added the guarded require + `languageMap` entry (§2.2 vendored-grammar onboarding).

No `// vsdd:scaffold` tags remain in `src/`, `scripts/`, or `.github/`. The behavioural suite is GREEN
(65/65) on the real implementation.
