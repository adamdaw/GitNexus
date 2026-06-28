# Gate 1 — Findings & Dispositions (SRS-001)

*VSDD §A.8. All Gate 1 findings are derivation-fidelity class → **fixed-only** (no sign-off).*

## Round 1 (adversary: fresh-context AI, distinct invocation; admitted bundle: Intent, Constitution, SRS, elicitation-facts) — VERDICT: FAIL, 8 findings

| FIND | Sev | Topic | Status | Fix |
|---|---|---|---|---|
| FIND-001 | major | Anonymous `.apex` recognised but body behaviour undefined (REQ-001/§2) | fixed | Deferred (Architect decision) → REQ-001 now `.cls`/`.trigger` only; REQ-105 minted; §2 + elicitation updated |
| FIND-002 | major | Unresolvable/ambiguous in-repo reference unspecified; REQ-006 contradicts Constitution P2 | fixed | REQ-006 reworded ("unambiguously"); REQ-015 added (conservative skip) + Gherkin |
| FIND-003 | minor | "container node" undefined | fixed | Defined in §2 |
| FIND-004 | minor | REQ-012 "equal in kind"/"MRO-aware" loose; Apex is single-inheritance | fixed | REQ-012 rewritten: "same node category … on an equivalent fixture"; MRO wording removed |
| FIND-005 | minor | REQ-008 overload coercion (assignable-not-identical) silent | fixed | REQ-008 binds coercion case to benchmark behaviour |
| FIND-006 | minor | Enum constants not in REQ-003 member set | fixed | enum constant added to REQ-003 + §2 |
| FIND-007 | minor | BR-2 "acceptance corpus" undefined | fixed | BR-2 points at §9 acceptance scenarios |
| FIND-008 | minor | NFR-001/002 pinned to single WIs in §11 | fixed | Marked cross-cutting on every WI |

All raising evidence: the Round-1 adversary report (fresh-context review of the admitted bundle).
Objective evidence per finding: the corresponding SRS commit diff.

## Round 2 (adversary: fresh cold invocation on the revised bundle) — VERDICT: FAIL, 6 findings

Mostly fix-induced drift from round 1 (consequential edits not fully propagated).

| FIND | Sev | Topic | Status | Fix |
|---|---|---|---|---|
| FIND-009 | major | REQ-015 absent from §11 decomposition | fixed | REQ-015 added to WI-2 |
| FIND-010 | major | REQ-005 unconditional, in tension with REQ-015 | fixed | REQ-005 qualified "unambiguously denotes" + cross-ref |
| FIND-011 | major | REQ-012 introduced undefined term "node category" | fixed | restated observably ("node of the same kind, edge of the same kind") |
| FIND-012 | minor | §10 stale "four" (five deferred REQs) | fixed | corrected to five + per-REQ characterisation |
| FIND-013 | minor | §11 "resolution may lag" — non-SHALL modal leak | fixed | reworded non-normative |
| FIND-014 | minor | NFR-001 double-assigned (WI-1 + cross-cutting); NFR-003 measurable only by reference | fixed | NFR-001 cross-cutting only; NFR-003 restated observably |

## Round 3 (adversary: fresh cold invocation) — VERDICT: FAIL, 6 findings ("SRS is strong"; subtler)

| FIND | Sev | Topic | Status | Fix |
|---|---|---|---|---|
| FIND-015 | major | NFR-003 round-2 fix introduced HOW-leak ("no separate ingestion path") + not perf-measurable | fixed | restated as observable threshold-parity property; architecture rule already lives in Constitution §2.2 |
| FIND-016 | major | REQ-008 "match benchmark behaviour" ambiguous (algorithm vs Apex rules) | fixed | governed by Apex's own overload rules; parity (REQ-012) scoped to node/edge kind; assignable-case Gherkin added |
| FIND-017 | minor | NFR-001 "unit" undefined | fixed | "unparseable file" |
| FIND-018 | minor | REQ-005/006 overlap & exhaustiveness | fixed | REQ-006 scoped to "a kind named in REQ-005" |
| FIND-019 | minor | REQ-002 omits nested interfaces/enums | fixed | broadened to "nested type (class, interface, enum)"; elicitation updated |
| FIND-020 | minor | §11 WI-2 "intra-file" label vs REQ-009 cross-type | fixed | WI-2 → "Resolution mechanics"; cross-file owned by WI-3 |

## Round 4 (adversary: fresh cold invocation) — VERDICT: PASS, 5 minor findings

No blockers, no majors. Reviewer affirmed intent fidelity, decomposition coverage, modal conformance,
Constitution consistency. Minors fixed anyway (Gate 1 is fixed-only).

| FIND | Sev | Topic | Status | Fix |
|---|---|---|---|---|
| FIND-021 | minor | NFR-003 has no acceptance scenario | fixed | added NFR-003 Gherkin (over-budget file skipped at same threshold) |
| FIND-022 | minor | REQ-008 delegates to uncited Apex ruleset | fixed | cite "Apex's own documented overload-resolution rules"; fixture pins expected |
| FIND-023 | minor | REQ-002 "node" vs §2/REQ-004 "container node" | fixed | REQ-002 → container node |
| FIND-024 | minor | REQ-006 redundant with REQ-005/015 | fixed | REQ-006 reduced to the distinct no-false-unresolved obligation (Intent's literal condition) |
| FIND-025 | minor | REQ-015 non-sequential numbering | fixed | §5 note: minted at Gate 1, slotted by theme |
