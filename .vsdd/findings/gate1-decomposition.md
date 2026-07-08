# Findings — Gate 1 Decomposition Checkpoint

*VSDD §A.8. Class `fidelity` (epic-SRS → work-item derivation). All fixed-only — derivation fidelity
is never signed off. Reviewed across three fresh-context adversary rounds.*

| ID | Round | Category | Severity | Status | Summary |
|---|---|---|---|---|---|
| FIND-D01 | 1 | coverage/slice-fidelity | major | fixed | REQ-009 split across WI-2 (same-file) and WI-3 (cross-file), contradicting the "exactly once" coverage claim; WI-2 owned REQ-009 with no acceptance scenario while deploying before WI-3. |
| FIND-D02 | 1 | coverage (NFR classification) | minor | **rejected → re-fixed** | Argued NFR-001 should be WI-1-owned, not cross-cutting. Accepting it caused FIND-E01. See note. |
| FIND-D03 | 1 | slice-fidelity | minor | fixed | REQ-005/006 §9 scenario ("two classes") is naturally cross-file; WI-2 claimed it as same-file acceptance without stating the same-unit construct. |
| FIND-E01 | 2 | slice-fidelity/consistency | major | fixed | The FIND-D02 fix (NFR-001 → WI-1-only) contradicted epic §11 (NFR-001 is cross-cutting) and left the whole-run no-crash property unverifiable on the resolution path (error-recovery partial trees reach the resolver). |
| FIND-01 | clean re-run | slice-fidelity | minor | fixed | WHAT→HOW leak: light-SRS annotations/rationale named mechanisms (`parseSourceSafe`, `ParsedFile`/AST, tree-sitter error-recovery, `.cls`). Scrubbed to observable WHAT; mechanism detail relocated to the SDD. Found by the context-free re-run (the primed rounds missed it). |

## Resolutions

- **FIND-D01.** Removed the per-REQ same-file/cross-file split. WI-2 now owns the resolution
  *mechanics* REQ-005/006/015/007/008/009 in full; WI-3 owns REQ-010, the cross-file *binding
  enabler*, which **completes** (does not co-own) the WI-2 mechanics' inherently-cross-file §9
  scenarios. Coverage "exactly once" restored. This matches epic §11's actual intent ("the cross-file
  aspect of these mechanics is owned by WI-3" = the REQ-010 enabler, not per-mechanic co-ownership).
- **FIND-D03.** WI-2's own acceptance is verified on **single-compilation-unit** fixtures (inner/nested
  types); the inherently-cross-file epic §9 forms (REQ-005's two-class, REQ-009's cross-file chain) are
  completed end-to-end at WI-3 once REQ-010 lands. The acceptance boundary is now stated explicitly.
- **FIND-E01 (and the FIND-D02 reversal).** NFR-001 restored as a **cross-cutting** gate (epic §11),
  but sliced by path: WI-1 carries the parse-path slice (safe-parse + skip unparseable files);
  WI-2/3/4 each carry the resolution-path slice (resolution completes without crashing on partial /
  error-recovery trees and references into skipped files). This honours the epic AND closes the
  verifiability gap.

## Process note (dogfood — fix-induced drift, finding-legitimacy)

FIND-D02 was a **wrong finding**: it asserted NFR-001 "isn't genuinely cross-cutting" because
downstream items "inherit it with nothing to do" — directly contradicting epic §11, which fixes
NFR-001 as cross-cutting. The Builder accepted it and the resulting overcorrection (NFR-001 →
WI-1-only) produced the major FIND-E01 in the next round. Lesson: **"fidelity findings are fixed-only"
does not mean fix every finding unconditionally** — a finding that contradicts the source-of-truth
(here the parent epic) must be rejected against that source, not implemented. The re-review adversary,
explicitly tasked to check whether the fixes introduced new issues, caught the drift. Folds into VSDD
plugin dogfood finding #3 (fix-induced drift) + the adversary-prompt "did the fix introduce new
issues?" recommendation, and adds: the Builder must adjudicate a finding's legitimacy against the
admitted source-of-truth before treating it as fixed-only.
