# Gate 5 pass record — Formal Hardening (ITEM-004 / WI-4)

*VSDD §A.7. Gate 5 is predominantly deterministic tooling (prover, fuzzer, mutation-tester) plus the
Constitution-designated manual exceptions (committed, Architect-signed). One subrecord per check; final
verdict PASS only when every subrecord passes. Demonstrated defects (crashes, non-equivalent surviving
mutants, purity violations) are fixed-only; an equivalent mutant requires a justification. Verdict
authority: Architect (Adam).*

- **Work item:** ITEM-004 (WI-4) — parity hardening & external handling: the heritage-limitation pipeline
  re-sequence discharging BL-1…BL-8 + REQ-012/013 + the REQ-008 parameter-typed-argument completion +
  the receiver-variable case-fold.
- **Build under hardening:** SDD-004 (`.vsdd/SDD.md`, `# SDD-004`) + SRS v1.29 under Constitution v1.1.4;
  implementation at HEAD `9fb0aa7d` (WI-4 Gate-4 cleared, byte-stable) + this session's Gate-5 additions
  (`test/integration/resolvers/apex-wi4-hardening.test.ts`, and the `PCollField.cls` fixture + one M6
  mutation-kill assertion in `apex-parity.test.ts`). Impl surface (8 files): the 4 Apex-local
  (`languages/apex/` captures, namespace-siblings, scope-resolver, param-arg-gate) + the 4 shared/contract
  (`scope-resolution/pipeline/run.ts`, `scope/walkers.ts`, `contract/scope-resolver.ts`,
  `model/scope-resolution-indexes.ts`).
- **Calibration (Constitution §6 / SDD-004 §7):** **no §A.3 Prove properties** (the resolution slice guards
  no security/financial/data-integrity/safety/concurrency invariant — every property is test-only; the
  absence is the legitimate §A.3 calibration fixed at Gate 2) → the formal-proof leg is **N/A**; Gate 5
  reduces to **fuzz + mutation + purity audit**. WI-4 adds **no new parse path** — the SECT-001
  untrusted-input boundary is owned by WI-1. WI-4's owned capture-surface additions (the dotted-heritage
  `@reference.qualified-name` emit, the dotted `super()` ctor-ref emit, and the parameter-sourced
  argument-type marker tagging) layer onto `emitApexScopeCaptures`, so they are fuzzed there; the
  resolution-pass edits (the `run.ts` re-sequence, the `walkers.ts` seam + fold, the `namespace-siblings`
  oracle, the `param-arg-gate` hook) run in the scope-resolution pipeline, NOT inside
  `emitApexScopeCaptures`, so they are hardened by the mutation audit + the 3077-test green suite + the
  purity audit, not the capture fuzz. The three shared touches were cleared for §2.2 isolation at Gate 4;
  Gate 5 re-checks their decision logic is test-covered (mutation) and side-effect-free (purity).
- **Verdict:** **PASS** — every subrecord passes; zero open defects; the four surviving mutants are
  justified equivalents.
- **Date:** 2026-07-08. **Architect sign-off:** Adam, 2026-07-08.

## Subrecord 1 — Proof execution (tool) — N/A

No Prove properties (§A.3 baseline empty, fixed at Gate 2 as a legitimate calibration; SDD-004 §7 verifies
WI-4 by tests alone). Nothing to discharge. **PASS (N/A).**

## Subrecord 2 — Fuzz: adversarial WI-4-capture no-crash corpus (tool)

`test/integration/resolvers/apex-wi4-hardening.test.ts` drives `emitApexScopeCaptures` in-process with
**25 adversarial inputs** shaped to exercise WI-4's capture-surface additions, non-redundant with WI-3's
corpus (which covered nested ctors / enum constants / `this.<field>` args / literal args): truncated /
no-tail / leading-dot / 2-segment / 3-segment / 2,000-segment / delimiters-only **dotted heritage bases**
(`extends Outer.` … `extends A.B.C`, `implements Outer.`, mixed `extends A.B implements C.D`), truncated /
empty / nested-arg / garbage-dotted **`super()` and `this()` ctor refs**, and simple / dotted / no-body /
truncated / 500-param / passed-twice / shadowed **parameter-typed method headers**, plus degenerate
(`extends { }`, empty, whitespace, heritage-keywords-only) inputs. Every input returned a **defined
`CaptureMatch[]` with no escaping throw**, well under the 10s ceiling. **25/25 PASS; 0 crashes.**

## Subrecord 3 — Fuzz: bounded smoke-fuzz (tool)

Same boundary, **10,000 executions** (Constitution §6 floor) of mutated/random draws over a WI-4-significant
atom alphabet (dotted heritage bases, `super(`/`this(`/`new Outer.Inner()` ctor refs, parameter-typed
method headers, delimiters), driven by a deterministic mulberry32 PRNG (**seed `0x5f3ac004`** — sibling to
WI-1's `0x5f3ac001`, WI-2's `0x5f3ac002`, WI-3's `0x5f3ac003`; the seed IS the reproducible corpus, no
`Math.random` non-determinism). No escaping throw at any draw; every draw returned a defined array.
Saturation exit = the ≥10k floor. **PASS; 0 un-triaged crashes.**

## Subrecord 4 — Mutation (manual exception, §A.8 / Principle 8)

The host ships **no mutation tooling** (no Stryker/config — confirmed in `package.json`), so the
Constitution's "mutation run over the WI-4 surface" is discharged as a **targeted manual mutation audit**
with committed evidence, scoped to **every WI-4 decision site across all 8 changed files**. Each mutant was
applied to `src/`, the WI-4 acceptance suite run (`apex-cross-file.test.ts` + `apex-parity.test.ts`,
138+1 anchors — vitest executes the TS source directly, no build artifact), confirmed **killed** (≥1
failing test), then reverted (`git checkout`; suite restored to green). A validated differential harness
(a positive control — disabling the seam's `resolved` return, M3 — correctly showed a graph difference)
classified each survivor as equivalent by an **identical-graph** check on the site's own fixture:

| # | File · site | Mutant | Result |
|---|---|---|---|
| M1 | `run.ts` Apex re-sequence flag | `resolveHeritageAfterSiblings === true` → `=== false` | KILLED (11 failed) |
| M2 | `run.ts` §1(1) `indexes` pin | `runHeritageAndMro(indexes)` → `(finalized)` | KILLED (11) |
| M3 | `walkers.ts` seam `resolved` | `kind === 'resolved'` → `'resolved_MUT'` | KILLED (1) |
| M4 | `walkers.ts` seam `refuse` | `kind === 'refuse'` → `'refuse_MUT'` | KILLED (4) |
| M5 | `walkers.ts` receiver fold-hit | `foldedCount === 1` → `=== 99` | KILLED (1) |
| M6 | `walkers.ts` receiver fold-collision | `foldedCount > 1` → `> 99` | **KILLED (2)** — by the new `PCollField` fixture |
| M7 | `captures.ts` heritage qname emit | `'scoped_type_identifier'` → `…_MUT` | **SURVIVED → equivalent** |
| M8 | `captures.ts` param-arg marker tag | `MARKER + folded` → `folded` | **SURVIVED → equivalent** |
| M9 | `captures.ts` dotted-`super()` qname emit | `'scoped_type_identifier'` → `…_X` | **SURVIVED → equivalent** |
| M10 | `namespace-siblings.ts` >2-seg refuse | `segments.length > 2` → `> 99` | **SURVIVED → equivalent** |
| M11 | `namespace-siblings.ts` OUTER gate | OUTER `=== undefined` → `=== null` | KILLED (1) |
| M12 | `namespace-siblings.ts` unique-bucket | `bucket.length !== 1` → `!== 99` | KILLED (13) |
| M13 | `param-arg-gate.ts` dotted tail | `tail(declaredFolded)` → `declaredFolded` | KILLED (2) |
| M14 | `param-arg-gate.ts` enclosing shadow | enclosing `!== undefined` → `=== undefined` | KILLED (2) |
| M15 | `param-arg-gate.ts` external blank | `return ''` → `return declaredFolded` | KILLED (2) |

**11/15 killed; 4 surviving mutants, all justified equivalents** (Architect-dispositioned 2026-07-08 —
"kill M6, justify the other four"). Every *primary* decision site is killed: the flag + `indexes`
re-sequence pin (M1/M2), all three seam states + the receiver fold (M3/M4/M5/M6), the OUTER-uniqueness
gate + unique-bucket fold (M11/M12), and all three param-arg-gate output arms (M13/M14/M15). The M6 gap —
a receiver-variable fold collision that fell through to an enclosing same-folded field — was closed with a
new fixture (`PCollField.cls`: method-local `rc`/`RC` collide under 'rc', enclosing field `rC`:Widget)
that pins the §4 refuse: a "keep scanning outer scopes on collision" mutant now binds `PCollField →
Widget.foo` and is killed.

### Equivalent-mutant justifications (empirical identical-graph + mechanism)

- **M7 (heritage qname emit) & M9 (dotted-`super()` qname emit):** the nested-aware `resolveDottedHeritageBase`
  seam is the load-bearing decoy-safe mechanism — M3 (disable `resolved`) and M4 (disable `refuse`) are both
  killed. The `@reference.qualified-name` emit is redundant belt-over-suspenders: `resolveInheritanceBaseInScope`
  consults the seam via `rawQualifiedName ?? baseName`, and the resolution reaches the correct dotted form
  regardless, so removing the extra capture changes no edge (identical graph on `apex-heritage-refuse` /
  `apex-cross-file`; harness validated by the M3 positive control showing DIFFERS). **Equivalent.**
- **M8 (param-arg marker tag):** the gate's observable *output* is fully pinned by M13/M14/M15 (all killed —
  the dotted-tail, enclosing-shadow, and external-blank arms). The marker's mere presence is not
  independently observable: bare folded parameter types coincide with the gated result for the fixture —
  a user-defined top-level type narrows either way, an external type matches no user overload either way,
  and a dotted type normalises identically in the overload comparator (identical graph on `apex-param-arg`).
  **Equivalent.**
- **M10 (>2-segment refuse):** a >2-segment base's `segments[0]` is never a unique workspace type — Apex
  injects only 2-level `outer.inner` keys — so the OUTER-uniqueness gate (M11, killed) refuses any
  >2-segment base regardless; the `> 2` guard is a redundant fast-path (identical graph on
  `apex-heritage-refuse`). **Equivalent.**

This is a manual exception (no automated mutation score); it is representative of the branch logic, not
exhaustive — a sharper automated run is available if the host later adopts mutation tooling. **PASS
(Architect-signed manual exception).**

## Subrecord 5 — Purity / safe-parse boundary audit (manual exception)

Static audit of the 8 WI-4-touched modules:

- **No** non-determinism (`Math.random` / `Date.now` / `new Date`) anywhere in the 8 files.
- **No** filesystem / network / `console.*` / new `process.*` side effect in any WI-4-edited region. The
  only `process.env` reads in `run.ts` (`PROF_SCOPE_RESOLUTION`, `GITNEXUS_DISK_SCOPE_INDEX`) are
  **pre-existing host code outside the WI-4 diff**; WI-4's `run.ts` additions are the pure re-sequence
  closures (`runHeritageAndMro` / `buildIndexes` / `runWorkspaceAndSiblings`) and pure field-threading onto
  the per-run indexes (`normalizeIdentifier`, `resolveDottedHeritageBase`).
- **No** raw `parser.parse(` source-parse — the only `.parse(` hits are `captures.ts:456–457`, the WI-2-era
  `JSON.parse` round-trip of this module's own `@reference.parameter-types` / `@reference.arg-names` capture
  text (already audited at WI-2/WI-3 Gate 5), not source parsing.
- The Apex-local modules and the shared-pass edits are pure functions over their inputs (the seam oracle,
  the OUTER-first nested lookup, the folded receiver scan, the param-arg gate); no new module-level mutable
  state. The workspace writes (`populateApexNamespaceSiblings`) are the sanctioned append-only channel (I8),
  Apex-gated.

**PASS (Architect-signed conclusion).**

## Subrecord 6 — Manual-acceptance execution (§A.10) — N/A

WI-4 acceptance is fully **automated** (every SDD-004 §8 Gherkin scenario is `automated`); no
`environment-visible` / `person-confirmed` scenario, so no `planned` Gate-3 manual-acceptance record to move
to `executed`. **PASS (N/A).**

## Subrecord 7 — Security hardening analyzers (tool) — N/A

WI-4 introduces **no new trust boundary** (it operates on WI-1's safe-parsed output, not raw source) and
**no new dependency** (§A.5 — no `package.json` change; Gate-4 Pass-2 confirmed zero new deps / vendored
assets). No Gate-5-owned analyzer / crypto suite applies. The SECT-001 boundary is owned and discharged by
WI-1 Gate 5. **PASS (N/A).**

## Evidence

- WI-4 acceptance suite green (`apex-cross-file.test.ts` + `apex-parity.test.ts`, now 139 anchors incl. the
  M6 mutation-kill assertion).
- New hardening file **26/26** (`apex-wi4-hardening.test.ts`: 25 corpus + 1 smoke-fuzz; Subrecords 2–3).
- **Full cross-language resolver suite `test/integration/resolvers/` = 55 files, 3077/3077 pass** (3050
  Gate-4 baseline + 26 new hardening + 1 M6-kill) — NFR-002 peer parity holds with the WI-4 impl + the three
  shared touches in place; cobol skipped (native binding unbuilt in-env, causally independent).
- Mutation audit: **11/15 killed, 4 justified equivalents** (manual apply → run → revert; Subrecord 4).
- Purity audit: static scan over the 8 WI-4 modules (Subrecord 5).

## Cleared

Every subrecord PASS; no open crash, no surviving non-equivalent mutant, no purity violation, no
undischarged Prove (none in scope). **This completes WI-4's vertical (Gates 1–5).** On Architect sign-off:
commit, update the work-items ledger (ITEM-004 gates → [1, 2, 3, 4, 5], status DONE).
