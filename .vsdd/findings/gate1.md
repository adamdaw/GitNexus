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
