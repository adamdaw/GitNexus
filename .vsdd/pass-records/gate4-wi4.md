# Gate 4 — WI-4 (ITEM-004): Implementation vs Spec + Tests

- **Gate:** 4 (implementation vs spec + tests) — **two sequential passes**, distinct cold invocations.
- **Work item:** ITEM-004 (WI-4) — parity hardening & external handling; SDD-004.
- **Verdict:** **PASS_CLEAN** — both passes first-pass clean ("Forced to manufacture flaws.").
- **Architect direction:** Adam, 2026-07-08 (launch Pass 1; on clean, launch Pass 2).
- **Reviewed HEAD:** `bb935ec7` (`feature/apex-parser`), clean tree — all admitted artefacts pinned at this commit.

## Reviewer independence (§A.7)

Two **distinct** cold invocations, neither with any Pass-1/producer-session involvement:
- **Pass 1** — `vsdd-spec-reviewer`, agent `abfef53dd6a62c4ce`. Read-only; spec + tests + implementation.
- **Pass 2** — `vsdd-code-reviewer`, agent `aca14f5b4cdbcf416`. Read-only; implementation + Constitution.
  Dispatched only after Pass 1 closed PASS. No shared context between the two agents.

Both admitted the rationale-redacted §A.17 standing-dispositions note
(`gate2-wi4-standing-dispositions.md`); neither re-raised a settled ruling.

## Admitted bundle (manifest)

- Spec: `.vsdd/SDD.md` (# SDD-004 — §1 workstreams, §2 contracts, §5, §7 purity, §8 acceptance, §9),
  `.vsdd/SRS.md` (v1.29), `.vsdd/Constitution.md` (v1.1.4).
- Tests: `gitnexus/test/integration/resolvers/apex-cross-file.test.ts`,
  `gitnexus/test/integration/resolvers/apex-parity.test.ts`.
- Implementation (8 files, Step 3b): `pipeline/run.ts`, `scope/walkers.ts`,
  `contract/scope-resolver.ts`, `model/scope-resolution-indexes.ts`, apex
  `captures.ts` / `namespace-siblings.ts` / `scope-resolver.ts` / `param-arg-gate.ts`.
- Objective evidence: full resolver suite run (below); §A.17 standing-dispositions note.
- **Withheld** (never passed): deliberation record, ADRs, HANDOFF/session logs, research rationale,
  Pass-1↔Pass-2 narrative.

## Pass 1 — spec fidelity (derivation): PASS_CLEAN

`vsdd-spec-reviewer` verified every SDD-004 §2 behavioural clause and §8 acceptance item is faithfully
realised in the 8 files and genuinely exercised by the two admitted suites, with no code behaviour
contradicting a §2 clause, a cited SRS REQ/NFR, or a Constitution §1.2 class. Confirmations of note:
WS1 re-sequence strictly flag-gated (peer `else` arm feeds `finalized` in old order; Apex arm feeds
sibling-populated `indexes`), `methodDispatch` swapped by fresh re-spread never mutated;
`preEmitInheritanceEdges` fed the index set carrying the normalizer + injected workspace bindings;
WS2 seam three states (resolved/refuse/pass-through) + OUTER-uniqueness + >2-segment refuse, dotted
qualifier reaching the seam via `@reference.qualified-name`; WS3 oracle arms (a)/(b)/(c) decoy-safe,
tie/external → arity-only blank; WS4 folded fallback runs only post exact-miss, collision → undefined;
Constitution §1.2 — no valid-source false edge, BL-10 over-bind ratified §1.2-(b) invalid-source.
BL-1…BL-8 discharge + BL-10 heritage arm each pinned to a target-node test. Verdict: **PASS**.

## Pass 2 — code quality / security / process / dependencies: PASS_CLEAN

`vsdd-code-reviewer` found no defects. The three shared-code edits (`run.ts` re-sequence, `walkers.ts`
seam, `walkers.ts` folded fallback) are each strictly guarded on a provider-supplied field
(`resolveHeritageAfterSiblings`, `scopes.resolveDottedHeritageBase`, `scopes.normalizeIdentifier`) that
only Apex populates — every peer threads `undefined` and takes the byte-identical prior path (the
**§2.2 code-level review of the three shared touches**, discharged). `APEX_PARAM_ARG_MARKER`
(`' apex-param '`, space-delimited) cannot collide with a folded Apex type name; capture/marker index
access is guarded; no unbounded loop / ReDoS on untrusted input (parsing routes through
`parseSourceSafe` per SECT-001); no error silently swallowed to mask a defect; **no new or bumped
dependency** — every import resolves to the existing tree or `gitnexus-shared` (confirmed against
`package.json`). Verdict: **PASS**.

## Objective evidence (NFR-002 measurement)

Full resolver suite at `bb935ec7`: **`vitest run test/integration/resolvers` → 54 files passed (54),
3050 tests passed (3050)**, 174s. Zero peer regressions across all languages; the three shared touches
are byte-identical-for-peers (re-sequence) / behaviour-preserving no-ops (seam, fold). This 3050/3050
run is the NFR-002 objective evidence owed at Gate 4 (cobol skips are pre-existing native-binding gaps,
unrelated to this work item). NFR-002 discharged by measurement, not by construction alone.

## Findings

None. Both passes first-pass clean; no derivation-fidelity or code-quality/security/process/dependency
defect surfaced; no standing disposition re-raised.

## Next

**Gate 5** (fuzz / mutation / purity — deterministic tooling, same calibration as WI-1/2/3). Gate 4
cleared; do NOT `/vsdd-advance` state.json (dogfood #8) — `.vsdd/work-items.md` ITEM-004 is authoritative.
