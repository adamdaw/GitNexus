# Gate 5 pass record — Formal Hardening (ITEM-002 / WI-2)

*VSDD §A.7. Gate 5 is predominantly deterministic tooling (prover, fuzzer, mutation-tester) plus the
Constitution-designated manual exceptions (committed, Architect-signed). One subrecord per check; final
verdict PASS only when every subrecord passes. Demonstrated defects (crashes, non-equivalent mutants,
purity violations) are fixed-only. Verdict authority: Architect (Adam).*

- **Work item:** ITEM-002 (WI-2) — resolution mechanics.
- **Build under hardening:** SDD-002 (`.vsdd/SDD.md`, `# SDD-002`) under Constitution v1.1.1;
  implementation at commit `4767060e` (WI-2 Gate 4 cleared) + this session's Gate-5 addition
  (`test/integration/resolvers/apex-resolution-hardening.test.ts`).
- **Calibration (Constitution §6 / SDD-002 §7):** **no §A.3 Prove properties** (the resolution slice
  guards no security/financial/data-integrity/safety/concurrency invariant — every property is in the
  "test only" row; the absence is the legitimate §A.3 calibration fixed at Gate 2) → the formal-proof leg
  is **N/A**; Gate 5 reduces to **fuzz + mutation + purity audit**. WI-2 adds **no new parse path** — the
  SECT-001 untrusted-input boundary is owned by WI-1 (which fuzzed `parseSourceSafe` directly at its own
  Gate 5). WI-2's owned surface is the **resolution stage** (NFR-001 resolution-path slice): the
  `emitApexScopeCaptures` capture pipeline + the Ring-3 resolution hooks. The fuzz target is therefore the
  resolution capture surface, distinct from and non-redundant with WI-1's parse-boundary fuzz.
- **Verdict:** **PASS** — every subrecord passes; zero open defects.
- **Date:** 2026-06-30. **Architect sign-off:** Adam, 2026-06-30.

## Subrecord 1 — Proof execution (tool) — N/A

No Prove properties (§A.3 baseline empty, fixed at Gate 2 as a legitimate calibration; SDD-002 §7
verifies WI-2 by tests alone). Nothing to discharge. **PASS (N/A).**

## Subrecord 2 — Fuzz: adversarial resolution-path no-crash corpus (tool) — the gating obligation

`test/integration/resolvers/apex-resolution-hardening.test.ts` drives `emitApexScopeCaptures` in-process
(the vendored grammar loads synchronously) with **24 adversarial inputs** shaped to exercise the WI-2
resolution synth paths — truncated free/member calls, truncated field chains, `new` with no type,
truncated `this()`/`super()`, malformed/empty argument lists, malformed generic and parameter bindings,
truncated enhanced-`for`, deep member chains (2,000 segments), deep nested calls (2,000), a 20,000-element
argument list, `super` with no superclass, field access on a literal, a truncated trigger-body call, an
interface-extends-garbage form, a mixed valid+garbage unit, and empty / whitespace / delimiter-only inputs.

Every input returned a **defined `CaptureMatch[]` with no escaping throw**, well under the time ceiling.
This exercises the whole owned WI-2 capture surface — free/member classification, `this`/`super`
receiver-binding synthesis, arity metadata, argument-type inference, the var-type-binding resolution with
its `JSON.parse` paths, and inheritance / explicit-constructor synthesis — on error-recovery trees.
**24/24 PASS; 0 crashes.** (NFR-001 resolution-path slice: resolution completes, references left
unresolved, never a throw.)

## Subrecord 3 — Fuzz: bounded smoke-fuzz (tool)

Same boundary, **10,000 executions** (Constitution §6 floor) of mutated/random draws over a
resolution-significant atom alphabet (calls, member access, `new`, `this`/`super`, args, type bindings,
heritage clauses), driven by a deterministic mulberry32 PRNG (**seed `0x5f3ac002`** — sibling to WI-1's
`0x5f3ac001`; the seed is the reproducible corpus, no `Math.random` non-determinism). No escaping throw at
any draw; every draw returned a defined array. Saturation exit = the ≥10k floor. **PASS; 0 un-triaged
crashes.**

## Subrecord 4 — Mutation (manual exception, §A.8 / Principle 8)

The host ships **no mutation tooling** (no Stryker/config — confirmed in `package.json`), so the
Constitution's "mutation run (host tooling) over `languages/apex/**`" is discharged as a **targeted manual
mutation audit** with committed evidence, scoped to the **WI-2 resolution decision logic** (WI-1's parse
configs were audited at WI-1 Gate 5). Eight representative mutants were applied, the project rebuilt
(`node scripts/build.js`), the acceptance suites run (`apex-resolution.test.ts` + `apex-resolution-unit.test.ts`),
each confirmed **killed** (suite exit non-zero ≥1 failing test), then reverted (`git checkout`; suites
restored to green):

| # | Site | Mutant | Killed by |
|---|---|---|---|
| 1 | `resolution.ts` `apexResolveReceiverMember` | ambiguity threshold `fields.length > 1` → `> 0` | every resolving field access becomes "ambiguous" → REQ-005/009 ACCESSES anchors |
| 2 | `resolution.ts` `interpretApexTypeBinding` | drop the bound-type `.toLowerCase()` fold | case-varied `ACCOUNT a` no longer folds → `a.NAME` unresolved (REQ-005) |
| 3 | `arity-metadata.ts` `normalizeApexParamType` | drop the param-type `.toLowerCase()` fold | unit param-type-fold anchors + overload (i-fold) |
| 4 | `captures.ts` `inferArgType` | integer literal `'Integer'` → `'String'` | overload (i) exact-type `f(Integer)` over `f(String)` |
| 5 | `captures.ts` free/member guard | flip `childForFieldName('object') !== null` → `=== null` | free/member call misclassification → CALLS anchors |
| 6 | `scope-resolver.ts` toggle | `conservativeOverloadResolution: true` → `false` | undisambiguable overload (iii) → REQ-015 obligation |
| 7 | `resolution.ts` `apexArityCompatibility` | disable the arity min check (`argCount < min` → `false`) | arity-disambiguated overload (ii) `g(Base)` over `g(Base,Integer)` |
| 8 | `captures.ts` `synthesizeApexInheritanceReferences` | drop class-extends synth (`node.childForFieldName('superclass')` → `null`) | nested-type EXTENDS (`Derived extends Base`, REQ-007) |

**0 surviving mutants; 0 equivalent-mutant justifications needed.** The audit spans every major WI-2
decision site — receiver-member ambiguity, the two case-folds (type-name + param-type), argument-type
inference, free/member classification, the conservative-overload toggle, arity disambiguation, and
inheritance synthesis — across all four owned modules (`resolution.ts`, `arity-metadata.ts`, `captures.ts`,
`scope-resolver.ts`). This is a manual exception (no automated mutation score); it is representative of the
branch logic, not exhaustive — a sharper automated run is available if the host later adopts mutation
tooling. **PASS (Architect-signed manual exception).**

## Subrecord 5 — Purity / safe-parse boundary audit (manual exception)

Static audit of the WI-2 resolution surface (`resolution.ts`, `captures.ts`, `arity-metadata.ts`,
`call-config.ts`, `type-config.ts`, `receiver-binding.ts`, `scope-resolver.ts`, `query.ts`, `index.ts`):

- **No** filesystem / network / process / console side effects.
- **No** non-determinism (`Math.random` / `Date.now` / `new Date`).
- **No** raw `parser.parse(` — the sole tree-sitter parse is `captures.ts:64` via `parseSourceSafe`
  (SECT-001 boundary intact; the two `.parse(` hits are `JSON.parse` of this module's own
  `JSON.stringify`-produced strings, not source parsing).
- Module-level mutable state is limited to the two **lazy-init memoization singletons** in `query.ts`
  (`_parser`, `_query`) — the host's standard per-language query pattern (mirrors `java`/`kotlin` query
  modules), idempotent and side-effect-free after first init; a deliberate, documented exception, not a
  purity violation. The resolution hooks and configs are otherwise pure functions over their inputs +
  stateless `const` config literals.

**PASS (Architect-signed conclusion).**

## Subrecord 6 — Manual-acceptance execution (§A.10) — N/A

WI-2 acceptance is fully **automated** (every SDD-002 §8 Gherkin scenario is `automated`); no
`environment-visible` / `person-confirmed` scenario, so no `planned` Gate-3 manual-acceptance record to
move to `executed`. **PASS (N/A).**

## Subrecord 7 — Security hardening analyzers (tool) — N/A

WI-2 introduces **no new trust boundary** (security-critical = false per the work-items ledger; it
operates on WI-1's safe-parsed output, not raw source) and **no new dependency** (§A.5 — no `package.json`
change). No Gate-5-owned analyzer / crypto suite applies (no crypto surface; no Wycheproof/whole-program
scan in scope). The SECT-001 boundary is owned and discharged by WI-1 Gate 5. **PASS (N/A).**

## Evidence

- Apex suites **166 passed** across 6 files (`apex-resolution` 29 + `apex-resolution-hardening` 25 +
  `apex-hardening` 18 + `apex` (WI-1) + `apex-resolution-unit` 7 + `apex-provider`). Java peer
  **186 passed** (no regression — NFR-002 holds). `tsc --noEmit` clean.
- New file: `gitnexus/test/integration/resolvers/apex-resolution-hardening.test.ts` (Subrecords 2–3).
- Mutation audit: 8/8 killed (manual apply → rebuild → run → revert; Subrecord 4).
- Purity audit: static grep over the 9 WI-2 modules (Subrecord 5).

## Cleared

Every subrecord PASS; no open crash, no surviving non-equivalent mutant, no purity violation, no
undischarged Prove (none in scope). **This completes WI-2's vertical (Gates 1–5).** On Architect sign-off:
commit, update the work-items ledger (ITEM-002 gates → [1, 1-decomp, 2, 3, 4, 5], status DONE), then
WI-3 (ITEM-003) opens — the cross-file binding enabler (REQ-010) + trigger-body resolution (REQ-011)
that complete the inherently-cross-file epic §9 forms WI-2 verified in-unit.
