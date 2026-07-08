# RESEARCH-002 — Apex case-insensitive resolution feasibility

*§A.6 Research artifact. Phase 2b host-API spike for **WI-2 (ITEM-002, resolution mechanics)**. Resolves
the WI-2-defining unknown — how Apex achieves case-insensitive identifier/type-name resolution against a
host whose resolution is exact-string — before SDD-002 commits the design.*

> **§A.6 calibration note.** §A.6 is written for *verification-tooling* (Prove-property) uncertainty.
> WI-2 has no Prove-classified properties (resolution guards no security/financial/data-integrity
> invariant — same calibration as WI-1). The uncertainty that objectively triggers a spike here is a
> **host-API design** unknown: the WI-2-defining mechanic (case-insensitive resolution) has **no existing
> host seam**, and per dogfood finding #13 an evidence-isolated Gate-2 adversary cannot validate a
> host-API design choice — so the seam feasibility must be settled empirically *before* the SDD pins it,
> not reasoned in the spec and discovered wrong at Gate 3. Authored against the §A.6 field structure with
> *host resolution API* substituted for *verifier*.

| Field | Value |
|---|---|
| **RESEARCH-002** | How Apex achieves case-insensitive user-defined identifier/type-name resolution (REQ-005/007/008/009) in GitNexus's resolution stack. |
| **Question** | Apex is case-insensitive: `Account`, `ACCOUNT`, `account` denote the same symbol, and `acc.NAME` accesses the field declared `name`. The host's resolution is exact-string. **Can Apex case-insensitive resolution be done Apex-locally (option b — the provider folds names at its own emission points), or does it require a new generic §2.2 seam (option a — a provider identifier-normalizer threaded through the shared name-key boundaries)?** And is either feasible without naming Apex in shared code (Constitution §2.1)? |
| **Method** | Trace the *actual* name-key build + lookup surfaces in the host resolution stack. This is a **structural/seam** question — "where are the keys built, and is there a provider hook there?" — which is settled by reading the host code, the appropriate method (finding #13's structural-vs-behavioural split: a hook's existence is read-verifiable; resolution *semantics* are the Gate-3 reliance). Confirmed there is no pre-existing case-insensitivity provision to reuse. |

## Findings (each cited; structural facts)

1. **All user-defined name resolution routes through exact-string keys, at three surfaces:**
   - **Member index** — `MethodRegistry.register(ownerNodeId, methodName, def)` builds `key =
     `${ownerNodeId}\0${methodName}`` (`model/method-registry.ts:183`); `lookupAllByOwner` reads the same
     key. Field/type registries are parallel. `findOwnedMember`/`lookupOwnedMembersByOwner` consume these
     (`scope/walkers.ts:1036-1044`, `model/owned-members-lookup.ts:28-30`).
   - **Scope bindings** — `lookupBindingsAt(scopeId, name, scopes)` does `scopes.bindings.get(scopeId)?.get(name)`
     (`scope/walkers.ts:61`).
   - **Type bindings** — `scope.typeBindings.get(receiverName)` (`scope/walkers.ts:196`).
2. **The keys are built generically from extracted/captured names, with NO provider normalization hook at
   any of them.** `register()` is called from shared extraction with the def's case-preserving `methodName`
   (WI-1 kept member names/ids case-preserving). There is no per-language identifier-normalizer on the
   `ScopeResolver` contract or the registries.
3. **No existing case-insensitivity provision** anywhere in `core/ingestion/` or `gitnexus-shared/src/`
   (exhaustive grep: no `caseInsensitive`/`normalizeIdentifier`/`foldCase`/language flag).
4. **Node ids are generated separately** from these lookup keys (from the case-preserving `name` field /
   `generateId`), so **lookup-key and display-id are already decoupled** — a fold-the-key / preserve-the-id
   design is clean and consistent with WI-1's case-preserving-id decision.
5. **Precedent:** a per-language **type normalizer** already threads through overload narrowing
   (`scope-resolution/passes/overload-narrowing.ts` — "the output of the language's type normalizer"), so a
   per-language **identifier** normalizer is architecturally consistent, not novel in kind.

## Conclusion

- **Option (b) — Apex-local folding — is INFEASIBLE.** The decisive blocker is the member index: registry
  keys are built in *shared* code from extracted member names, with no Apex-reachable fold point. The
  Apex provider controls its call-site/binding emission, but it cannot fold the *register* side of the
  member index (populated generically) without editing shared code to name Apex (forbidden, §2.1). Folding
  only one side leaves case-varied member access (`acc.NAME` ↔ field `name`) unresolved.
- **Option (a) — a generic §2.2 identifier-normalizer seam — is REQUIRED and feasible.** A provider-supplied
  `normalizeIdentifier?: (s: string) => string` (identity default; `toLowerCase` for Apex), applied
  uniformly when **computing the name-key** at each boundary (registry register + lookup; scope binding
  insert + lookup; typeBinding insert + lookup; and the O(|defs|) compatibility-scan fallback in
  `lookupCore.collectOwnedMembers`). Node ids stay case-preserving (keys ≠ ids, per finding 4). This names
  no language, is identity-transparent for case-sensitive peers (measured no-regression), and is the same
  class of generic seam Constitution §2.2 v1.1.0 already sanctioned for WI-1.
- **Estimated seam surface:** ~4–6 shared name-key sites, each a one-line `normalizeIdentifier(key)` at
  matched insert/lookup pairs. Enumerated for the SDD; the symmetry (same fold on insert and lookup) is the
  correctness invariant.

## Residual Gate-3 reliances (finding #13 — do NOT pin these at Gate 2)

The **seam feasibility** is settled. The **resolution semantics once the seam exists** are host-API
behaviours to validate at Gate 3 (tests vs the real host), NOT to pin in SDD-002:
- that a folded lookup actually resolves the correct node end-to-end for each mechanic (call, type/ctor
  usage, `extends`/`implements`, overload selection, field/property chain) within a single declaration unit;
- that the host's MRO walk, receiver binding (`this`→enclosing type), and overload narrowing behave as the
  RESEARCH-002 host map describes when fed Apex input;
- that folding parameter-type tokens for overload disambiguation (REQ-008) composes with the existing
  per-language type normalizer without over-collapsing distinct types.

SDD-002 will mark these explicitly as Gate-3 design obligations, per finding #13.

## Impact if wrong

If option (a)'s symmetry is mis-implemented (fold on one side only, or a missed lookup surface), case-varied
references silently fail to resolve — caught by Gate-3 case-varied fixtures, fixed-only. No security/data
risk (resolution is conservative: a miss is an unresolved reference, never a mis-binding — REQ-015/006).

## Status

**Spike complete. Recommendation: SDD-002 pins option (a) — a generic §2.2 `normalizeIdentifier` seam — as
the case-insensitivity mechanism, with the enumerated name-key sites, and flags the resolution semantics as
Gate-3 reliances.** Architect approval of this conclusion gates SDD-002 authorship (Phase 2b → Step 2a).
