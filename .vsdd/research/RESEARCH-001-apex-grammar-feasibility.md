# RESEARCH-001 — Apex tree-sitter grammar feasibility

*§A.6 Research artifact. Phase 2b foundational-tooling spike. Resolves Assumption A-1
(the epic's single biggest unknown) before the Verification Architecture / SDD commits.*

> **§A.6 calibration note.** §A.6 is written for *verification-tooling* (Prove-property)
> uncertainty. Apex has no Prove-classified properties (a parser guards no security/financial/
> data-integrity invariant — see ADR-001 / SDD Gate-5 calibration). The uncertainty that
> objectively triggers a mandatory spike here is instead the **parsing tool**: first use of
> this grammar in the repo, an unproven ABI/runtime pairing, and no prior passing load on
> record. The handoff and the Phase-2 skill both direct this as "the §A.6 grammar feasibility
> spike", so it is authored against the §A.6 field structure with *grammar* substituted for
> *verifier*.

| Field | Value |
|---|---|
| **RESEARCH-001** | Apex grammar build + load feasibility against GitNexus's pinned tree-sitter runtime. |
| **Question** | Can `aheber/tree-sitter-sfapex`'s Apex grammar be vendored so it **builds a native binding on the project's Node runtime AND loads + parses real Apex under GitNexus's pinned `tree-sitter@0.21.1` (ABI-14 max)**? This is Assumption A-1 — the grammar carries the same native-binding/ABI risk class that has GitNexus's **Swift** blocked. |
| **Candidate tool(s)** | Grammar: `aheber/tree-sitter-sfapex` (MIT; Apex+SOQL+SOSL+SFLog; native + WASM bindings). Considered-and-rejected alternative: `jsuarez-chipiron/tree-sitter-apex` (list below). |
| **Representative property** | A native binding for the Apex grammar (1) compiles on Node 24, (2) is accepted by `Parser.prototype.setLanguage` on `tree-sitter@0.21.1` with no ABI rejection, and (3) parses a representative Apex class — `public with sharing` modifiers, `extends`/`implements`, `@AuraEnabled` annotation, auto-property (`{ get; set; }`), constructor with `super()`, static method, inline SOQL, nested `enum` — yielding **zero `ERROR`/`MISSING` nodes** and named member nodes the resolver can consume. |
| **Result** | **PASS, but ONLY after an ABI-14 regeneration.** The committed upstream `apex/src/parser.c` is `LANGUAGE_VERSION 15` (ABI-15); sfapex's `peerDependencies.tree-sitter` is `^0.22.4`. GitNexus pins `tree-sitter@0.21.1`, which accepts **ABI ≤14**. The upstream ABI-15 `parser.c` therefore cannot load as-is. Regenerating from the vendored `grammar.js` with `tree-sitter generate --abi 14` produces an ABI-14 `parser.c` that loads cleanly on 0.21.1 and parses the representative class with 0 errors. The grammar has **no external scanner** (only `alloc.h`/`array.h`/`parser.h`; no `scanner.c`) — strictly simpler to vendor than Swift (which has `scanner.c`). The binding's BLAKE2 `LANGUAGE_TYPE_TAG` is **byte-identical** to GitNexus's working vendored Swift binding. `node-addon-api` ranges are compatible (GitNexus `^8.0.0`, sfapex `^8.7.0`). |
| **Acceptance criterion** | The grammar loads on the project's pinned `tree-sitter@0.21.1` and parses representative Apex with 0 `ERROR`/`MISSING` nodes, with a vendoring path that fits GitNexus's existing vendored-grammar machinery (`requireVendoredGrammar` → `node-gyp-build` → prebuild/source-build). **Met.** |
| **Decision** | **Adopt `aheber/tree-sitter-sfapex`, vendored as an ABI-14 regeneration** (NOT the upstream ABI-15 `parser.c`) under `gitnexus/vendor/tree-sitter-apex/`, loaded via the existing `requireVendoredGrammar` path. Structural constraints this imposes are recorded below; they bind the SDD. |
| **Rejected alternatives (list)** | `jsuarez-chipiron/tree-sitter-apex`. |
| **Rejected alternatives (rationale)** | *Withheld from the Gate 2 Adversary (exploration narrative).* See `.vsdd/adr/ADR-001` body. |
| **Approval** | **APPROVED — Adam (Architect), 2026-06-28.** Adopt sfapex via ABI-14 regeneration + the auto-update regen `hold`. Conclusion cleared for consumption by the SDD. |
| **Consumed-by** | `.vsdd/SDD.md` Verification Architecture + grammar-vendoring section (WI-1), and its §A.7 Gate-2 pass record. |

## Structural constraints imposed on the SDD (binding)

1. **Vendor an ABI-14 regeneration, not the upstream parser.c.** The vendoring step is:
   copy `apex/grammar.js` + its `common/` dependencies + `tree-sitter.json`, run
   `tree-sitter generate --abi 14`, and vendor the regenerated `src/` (`parser.c`,
   `node-types.json`, `tree_sitter/`) + a Swift-shaped `bindings/node/` (`binding.cc`
   exposing only `tree_sitter_apex`, `index.js` attaching `nodeTypeInfo`) + `binding.gyp`
   + per-platform `prebuilds/`. This mirrors how `tree-sitter-c` is ABI-pinned at 0.21.4
   and `tree-sitter-kotlin` is pinned to an unreleased commit — Apex joins that set as an
   **ABI-pinned** grammar.

2. **Register Apex as a vendored grammar, not an npm dependency.** Add `'tree-sitter-apex'`
   to `VENDORED_GRAMMAR_PACKAGES` (`src/core/tree-sitter/vendored-grammars.ts`) and to the
   `GRAMMARS` registry in `scripts/build-tree-sitter-grammars.cjs` (`required: false`,
   honours `GITNEXUS_SKIP_OPTIONAL_GRAMMARS`). The worker loads it with a guarded
   `requireVendoredGrammar('tree-sitter-apex')` exactly like Swift/Dart/Kotlin/C, so a
   missing binding degrades to "Apex unavailable", never a crash.

3. **Maintenance hazard — the auto-update bot must regenerate, not copy.**
   `.github/vendored-grammars.json` + `update-vendored-grammars.mjs` (weekly auto-PR) and
   `check-tree-sitter-upgrade-readiness.py` read upstream and would pull the **ABI-15**
   `parser.c`, which silently breaks Apex loading on the pinned runtime. Apex's manifest
   entry MUST carry a `hold` documenting the mandatory `--abi 14` regeneration step (same
   pattern as the `c` ABI hold and `kotlin` commit hold). The consistency-guard test that
   asserts the manifest set equals the `vendor/tree-sitter-*` dirs must include Apex.

4. **Inline SOQL/SOSL parses without error and is out of resolution scope.** The grammar
   embeds SOQL/SOSL; the representative class's inline `[SELECT ...]` parsed clean. Per
   ADR-001 / deferred REQ-101, SOQL *semantic* resolution stays out of scope — the grammar
   parsing it without error is sufficient and does not pull schema/stdlib resolution in.

## Evidence (commands + output)

Isolated spike workspace: `/tmp/apex-spike/` (ephemeral; reproducible from the commands).

```
# 1. Clone + inspect — committed parser is ABI-15, no external scanner
$ git clone --depth 1 https://github.com/aheber/tree-sitter-sfapex.git
$ grep -m1 LANGUAGE_VERSION apex/src/parser.c   → #define LANGUAGE_VERSION 15
$ ls apex/src/tree_sitter/                       → alloc.h array.h parser.h   (no scanner.c)
$ grep -A3 peerDependencies package.json         → "tree-sitter": "^0.22.4"

# 2. Native binding compiles on Node 24 (full sfapex binding built during install)
$ node --version                                 → v24.17.0
$ npm install                                    → gyp info ok  (tree_sitter_sfapex_binding.node built)

# 3. Regenerate apex at ABI 14 from grammar.js
$ cd apex && npx tree-sitter generate --abi 14   → exit 0
$ grep -m1 LANGUAGE_VERSION src/parser.c         → #define LANGUAGE_VERSION 14

# 4. Build apex-only Swift-shaped binding + load against tree-sitter@0.21.1, parse sample
$ npm install   # tree-sitter@0.21.1 + node-addon-api@^8 + node-gyp-build@^4  → gyp info ok
$ node test.cjs
  tree-sitter runtime: 0.21.1
  root type: parser_output
  hasError flag: false
  ERROR/MISSING node count: 0
  --- top-level children ---
  class_declaration "public with sharing class AccountService"
  --- class body member types ---
  field_declaration, constructor_declaration, method_declaration, enum_declaration
  SPIKE PASS: ABI-14 apex grammar loaded on tree-sitter 0.21.1 and parsed clean.
```

The representative Apex source (`sample.cls`) and the load harness (`test.cjs`) are reproduced
in `.vsdd/sessions/2026-06-28.md` so the spike survives the ephemeral `/tmp` workspace.
