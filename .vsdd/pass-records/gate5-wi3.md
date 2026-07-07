# Gate 5 pass record — Formal Hardening (ITEM-003 / WI-3)

*VSDD §A.7. Gate 5 is predominantly deterministic tooling (prover, fuzzer, mutation-tester) plus the
Constitution-designated manual exceptions (committed, Architect-signed). One subrecord per check; final
verdict PASS only when every subrecord passes. Demonstrated defects (crashes, non-equivalent mutants,
purity violations) are fixed-only. Verdict authority: Architect (Adam).*

- **Work item:** ITEM-003 (WI-3) — cross-file binding (REQ-010) + trigger-body resolution (REQ-011) +
  the heritage/interface/nested/static/overload mechanics that complete the inherently-cross-file epic.
- **Build under hardening:** SDD-003 (`.vsdd/SDD.md`, `# SDD-003`, blob `3a63cdd0`) + SRS v1.28 (blob
  `2c5cf412`) under Constitution v1.1.3 (blob `12ceab6f`); implementation at commit `260093eb`
  (WI-3 Gate-4 cleared, byte-stable since increment 15) + this session's Gate-5 addition
  (`test/integration/resolvers/apex-cross-file-hardening.test.ts`). Impl surface (12 files) pinned at
  HEAD `260093eb` — the 5 Apex-local (`languages/apex/` namespace-siblings `17c6ce16`, query `a14aceb3`,
  captures `48519625`, resolution `4a848ec2`, scope-resolver) + the 7 shared-edit files (walkers
  `f9aa9aec`, run `e61bf7c0`, free-call-fallback `8032b77e`, compound-receiver `995eb945`,
  receiver-bound-calls `439154d1`, model/scope-resolution-indexes, contract/scope-resolver).
- **Calibration (Constitution §6 / SDD-003 §7):** **no §A.3 Prove properties** (the cross-file resolution
  slice guards no security/financial/data-integrity/safety/concurrency invariant — every property is
  "test only"; the absence is the legitimate §A.3 calibration fixed at Gate 2) → the formal-proof leg is
  **N/A**; Gate 5 reduces to **fuzz + mutation + purity audit**. WI-3 adds **no new parse path** — the
  SECT-001 untrusted-input boundary is owned by WI-1 (which fuzzed `parseSourceSafe` at its Gate 5).
  WI-3's owned capture surface is the `scoped_type_identifier` + `enum_constant` + literal-arg +
  `this.<field>` additions layered onto `emitApexScopeCaptures`; the cross-file resolution-pass edits
  (namespace-siblings injection + the seven shared-pass edits) run in the scope-resolution pipeline, NOT
  inside `emitApexScopeCaptures`, so they are hardened by the **mutation audit + the 3018-test green
  suite + the purity audit**, not the capture fuzz. The seven shared edits (increments 2, 3, 7, 8, 11,
  12, 15) were cleared for §2.1/§2.2 isolation at Gate 4; Gate 5 re-checks their decision logic is
  test-covered (mutation) and side-effect-free (purity), with inc-15's gated MRO walk — the one edit
  that changed shared control flow — receiving a dedicated mutant.
- **Verdict:** **PASS** — every subrecord passes; zero open defects.
- **Date:** 2026-07-07. **Architect sign-off:** Adam, 2026-07-07.

## Subrecord 1 — Proof execution (tool) — N/A

No Prove properties (§A.3 baseline empty, fixed at Gate 2 as a legitimate calibration; SDD-003 §7
verifies WI-3 by tests alone). Nothing to discharge. **PASS (N/A).**

## Subrecord 2 — Fuzz: adversarial cross-file-capture no-crash corpus (tool) — the gating obligation

`test/integration/resolvers/apex-cross-file-hardening.test.ts` drives `emitApexScopeCaptures` in-process
(the vendored grammar loads synchronously) with **26 adversarial inputs** shaped to exercise WI-3's
capture-surface additions — truncated/malformed scoped ctors (`new Outer.`, `new Outer.Inner(`,
`new Outer.()`), a 2,000-segment scoped ctor, truncated/no-var scoped declared types (`Outer.Inner`),
scoped fields, malformed enum bodies (empty / trailing-comma / leading-comma / no-name constant),
`this.<field>` arg forms (truncated, no-field, 2,000-deep), integer/boolean literal args (truncated,
malformed mixed), truncated implicit-this-inherited and `super.` member calls, `scoped_type_identifier`
in `extends`/`implements`, a nested `new` inside an argument list, and empty / whitespace /
scoped-delimiter-only inputs.

Every input returned a **defined `CaptureMatch[]` with no escaping throw**, well under the time ceiling.
This exercises WI-3's owned capture additions — the scoped-type ctor/declared-type/field captures, the
enum-constant capture, the integer/boolean `inferArgType` cases, and the `this.<field>` argument-reference
resolution — on error-recovery trees. **26/26 PASS; 0 crashes.** (NFR-001 resolution-path slice:
resolution completes, references left unresolved, never a throw.)

## Subrecord 3 — Fuzz: bounded smoke-fuzz (tool)

Same boundary, **10,000 executions** (Constitution §6 floor) of mutated/random draws over a WI-3-significant
atom alphabet (scoped/nested types, `new Outer.Inner(`, enum constants, `this.w`, integer/boolean literal
args, `super.`, `inherited(`, `extends Outer.Inner`), driven by a deterministic mulberry32 PRNG (**seed
`0x5f3ac003`** — sibling to WI-1's `0x5f3ac001` and WI-2's `0x5f3ac002`; the seed is the reproducible
corpus, no `Math.random` non-determinism). No escaping throw at any draw; every draw returned a defined
array. Saturation exit = the ≥10k floor. **PASS; 0 un-triaged crashes.**

## Subrecord 4 — Mutation (manual exception, §A.8 / Principle 8)

The host ships **no mutation tooling** (no Stryker/config — confirmed in `package.json`), so the
Constitution's "mutation run over the WI-3 surface" is discharged as a **targeted manual mutation audit**
with committed evidence, scoped to **every WI-3 decision site across all 12 changed files**. Each mutant
was applied to `src/`, the project rebuilt (`node scripts/build.js`), the WI-3 acceptance suite run
(`apex-cross-file.test.ts` + `apex-cross-file-unit.test.ts`, 116 anchors), confirmed **killed** (suite
exit non-zero ≥1 failing test), then reverted (`git checkout`; suite restored to 116/116):

| # | File · site | Mutant | Killed (n failed) |
|---|---|---|---|
| M1 | `namespace-siblings.ts` inject-none guard | `group.size !== 1` → `!== 999` (never skip) | 8 — BL-12 same-case no-record + collision cases |
| M2 | `namespace-siblings.ts` `.trigger` exclusion | `.endsWith('.trigger')` → `.endsWith('.notrig')` | 2 — trigger/class twin injects as a type |
| M3 | `namespace-siblings.ts` fold | `name.toLowerCase()` → `name` | 8 — every case-varied cross-file reference |
| M4 | `query.ts` enum-constant capture | remove the `(enum_constant …)` clause | 5 — enum-constant ACCESS (Color.RED, …) |
| M5 | `query.ts` scoped declared-type capture | `@type-binding.type` → `@type-binding.IGNORED` | 6 — nested-type receiver (`i.ping()`) |
| M6 | `captures.ts` `inferArgType` | `case 'int'` → `case 'int_MUT'` | 7 — integer-literal-arg overload narrowing |
| M7 | `captures.ts` arg-ref | `nm.startsWith('this.')` → `'this_MUT.'` | 2 — `this.<field>` overload (`fField`) |
| M8 | `resolution.ts` keep-qualifier fold | append `.split('.').pop()` (re-strip qualifier) | 6 — nested-type receiver binding |
| M9 | `walkers.ts` workspace fold-on-miss | short-circuit to `return undefined` | 16 — every case-varied workspace consult |
| M10 | `walkers.ts` workspace-defer | `lookupBindingsAt(…, false)` → `true` (consult early) | 1 — local-over-global shadow (inc 2) |
| M11 | `free-call-fallback.ts` MRO walk (inc 15) | `[classDefId, ...mroFor(…)]` → `[classDefId]` | 1 — implicit-this inherited member (#185) |
| M12 | `free-call-fallback.ts` conservative ctor (inc 7) | `conservativeOverloadResolution === true` → `=== false` | 1 — undisambiguable ctor (REQ-015) |
| M13 | `compound-receiver.ts` new-Type head (inc 8) | `/^new\s+(.+)$/` → `/^nomatch\s+…/` | 1 — `new Target().fLit(42)` receiver |
| M14 | `receiver-bound-calls.ts` interface gate (inc 12) | `emitInterfaceDispatch !== false` → `=== false` | 1 — declaration-only interface arm |
| M15 | `receiver-bound-calls.ts` Case-3b FQN fallback (inc 11) | `ownerDef === undefined && …` → `false && …` | 6 — nested-type-via-FQN receiver |

**15/15 killed; 0 surviving mutants; 0 equivalent-mutant justifications needed.** The audit spans every WI-3
decision site — the namespace-siblings selection/fold/guard/exclusion, both new query captures, both
argument-type-inference additions, the keep-qualifier fold, and each of the seven shared-pass edits
(workspace fold-on-miss + local-over-global defer, the gated MRO walk, conservative-ctor narrowing, the
new-Type receiver, the interface-dispatch gate, the Case-3b FQN fallback). The three plumbing-only files
(`model/scope-resolution-indexes.ts`, `pipeline/run.ts`, `contract/scope-resolver.ts`) carry no
independent decision logic — they thread `normalizeIdentifier`, `resolveInheritedImplicitThisCall`, and
`emitInterfaceDispatch` into the sites above, so they are covered transitively (M9 kills the normalizer
thread, M11 the MRO-flag thread, M14 the interface-toggle contract). This is a manual exception (no
automated mutation score); it is representative of the branch logic, not exhaustive — a sharper automated
run is available if the host later adopts mutation tooling. **PASS (Architect-signed manual exception).**

## Subrecord 5 — Purity / safe-parse boundary audit (manual exception)

Static audit of the 12 WI-3-touched modules (5 Apex-local + 7 shared):

- **No** filesystem / network / process side effects and **no** `console.*` in any WI-3-edited region.
- **No** non-determinism (`Math.random` / `Date.now` / `new Date`) anywhere in the 12 files.
- **No** raw `parser.parse(` source-parse — the only `.parse(` hits are `captures.ts:419–420`
  `JSON.parse` of this module's own `@reference.parameter-types` / `@reference.arg-names` capture text
  (WI-2-era, already audited at WI-2 Gate 5; JSON round-trip of `JSON.stringify`-produced strings, not
  source parsing). The two comment mentions of `parser.parse(...)` (`run.ts:281`, `scope-resolver.ts:239`)
  are documentation, not calls.
- `run.ts` reads `process.env` at lines 443 / 710 (a profiling flag and a disk-index feature) — these are
  **pre-existing host code outside WI-3's diff**; WI-3's only additions to `run.ts` are two pure field
  assignments (`normalizeIdentifier` and `resolveInheritedImplicitThisCall === true`) threaded onto the
  per-run indexes/options (confirmed against `git diff f8139239..HEAD`). The Apex-local modules and the
  shared-pass edits are pure functions over their inputs; no new module-level mutable state (the
  `query.ts` lazy-init singletons audited at WI-2 Gate 5 are unchanged by WI-3).

**PASS (Architect-signed conclusion).**

## Subrecord 6 — Manual-acceptance execution (§A.10) — N/A

WI-3 acceptance is fully **automated** (every SDD-003 §8 Gherkin scenario is `automated`); no
`environment-visible` / `person-confirmed` scenario, so no `planned` Gate-3 manual-acceptance record to
move to `executed`. **PASS (N/A).**

## Subrecord 7 — Security hardening analyzers (tool) — N/A

WI-3 introduces **no new trust boundary** (security-critical = false per the work-items ledger; it
operates on WI-1's safe-parsed output, not raw source) and **no new dependency** (§A.5 — no `package.json`
change; Gate-4 Pass-2 confirmed zero new deps / vendored assets). No Gate-5-owned analyzer / crypto suite
applies. The SECT-001 boundary is owned and discharged by WI-1 Gate 5. **PASS (N/A).**

## Evidence

- WI-3 acceptance suite **116/116** (`apex-cross-file.test.ts` 106 + `apex-cross-file-unit.test.ts` 10).
- New hardening file **27/27** (`apex-cross-file-hardening.test.ts`: 26 corpus + 1 smoke-fuzz;
  Subrecords 2–3).
- **Full cross-language resolver suite `test/integration/resolvers/` = 53 files, 3018/3018 pass** (2991
  prior + the 27 new hardening tests) — NFR-002 peer parity holds with the WI-3 impl + the seven shared
  edits in place; cobol skipped (native binding unbuilt in-env, causally independent of a resolution-pass
  edit).
- Mutation audit: **15/15 killed** (manual apply → rebuild → run → revert; Subrecord 4).
- Purity audit: static scan over the 12 WI-3 modules (Subrecord 5).

## Cleared

Every subrecord PASS; no open crash, no surviving non-equivalent mutant, no purity violation, no
undischarged Prove (none in scope). **This completes WI-3's vertical (Gates 1–5).** On Architect sign-off:
commit, update the work-items ledger (ITEM-003 gates → [1, 1-decomp?, 2, 3, 4, 5], status DONE), then
WI-4 (ITEM-004) opens — the heritage-limitation pipeline reorder that discharges BL-1…BL-8 +
REQ-012/013 + the REQ-008 completion, resolving the v1.10(iv)/v1.13 documented limitations by construction.
