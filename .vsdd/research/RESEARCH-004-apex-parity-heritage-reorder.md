# RESEARCH-004 — Apex parity hardening, heritage reorder & external handling feasibility

*§A.6 Research artifact. Phase 2b host-API spike for **WI-4 (ITEM-004, parity hardening & external
handling)**. Resolves the three WI-4-defining host-API unknowns before SDD-004 commits the design: (A)
the committed **heritage/namespace-sibling pipeline reorder** that discharges the WI-3-carried
v1.10(iv)/v1.13 nested-parent limitations — is it mechanically feasible and does it actually fix the
mis-bind, without regressing peers (NFR-002)? (B) **external-reference handling** (REQ-013) — is
"external = benign unresolved, not a defect" already the host default, or does it need machinery? (C) the
**REQ-008 parameter-typed-argument narrowing** WI-2 deferred — does the argument-typing hook exist, and
what tells a user-defined parameter type from an external one?*

> **§A.6 calibration note.** §A.6 is written for *verification-tooling* (Prove-property) uncertainty. WI-4
> has no Prove-classified properties (parity + external handling guard no security/financial/data-integrity
> invariant — same calibration as WI-1/WI-2/WI-3). The uncertainty that objectively triggers a spike is a
> **host-API design** unknown, and WI-4 carries three. Per dogfood #13 an evidence-isolated Gate-2 adversary
> cannot validate a host-API design choice, and per dogfood #19 a host-API-heavy WI needs the §A.6 spike up
> front — the pipeline-reorder blast radius especially (a *generic, peer-affecting* pass reorder) must be
> settled empirically before SDD-004 pins it. Authored against the §A.6 field structure with *host resolution
> API* for *verifier*.

| Field | Value |
|---|---|
| **RESEARCH-004** | How to discharge the WI-3-carried nested-parent heritage limitations by reordering the heritage pre-pass relative to the WI-3 cross-file registration (REQ-012 parity + the committed reorder); how the host treats external/stdlib references (REQ-013); and how an overloaded call narrows on a method-parameter argument whose type may be user-defined or external (REQ-008 completion). |
| **Question** | (A) The heritage pre-pass `preEmitInheritanceEdges` resolves superclass/interface names **before** the WI-3 `populateNamespaceSiblings` registration populates `workspaceFqnBindings` — so `class Sub extends TOuter.TInner` cannot see the cross-file nested type and mis-binds a same-tail top-level decoy (SRS v1.10(iv)/pin 767), poisoning the MRO so `s.decoy2()` rides into the decoy (v1.13). **Can the heritage block be reordered after the registration; does that resolve the mis-bind; and is the reorder safe for the five peers that register `populateNamespaceSiblings`?** (B) Is an unresolved external reference already benign (no edge, no defect), or does REQ-013 need an "external" classification? (C) Does the argument-type inference resolve a method-parameter's declared type when the parameter is used as an overload argument, and what distinguishes a user-defined parameter type from an external one (so narrowing is safe)? All without naming Apex in shared logic (Constitution §2.1). |
| **Method** | Trace the actual scope-resolution pipeline stage order, the heritage base-resolution call path, and the argument-typing path in the host stack (structural/seam questions — settled by reading host code, per dogfood #13's structural-vs-behavioural split). Verified against primary source (`gitnexus/src/core/ingestion/`), not a secondary summary; the load-bearing reorder facts (pipeline order, the heritage base-resolution channel, mechanical feasibility) were read first-hand at authoring, not carried from a prior artifact. |

## Findings — A: the heritage/namespace-sibling reorder (each cited; read-verified)

1. **The current Phase-2 order runs heritage resolution BEFORE the cross-file registration.** Read-verified
   in `scope-resolution/pipeline/run.ts` (the crux, confirmed first-hand at authoring):
   ```
   preEmitInheritanceEdges          run.ts:573   → resolves base names, emits EXTENDS/IMPLEMENTS
   emitDetectedInterfaceImplementations  :593
   buildMro                              :601     → reads those edges → MRO → methodDispatch (:616)
   … indexes {…, methodDispatch, normalizeIdentifier}  :614-621
   buildWorkspaceResolutionIndex         :632
   populateNamespaceSiblings             :640     → populates workspaceFqnBindings  ← WI-3 registration
   propagateImportedReturnTypes          :663
   resolveReferenceSites                 :687
   ```
   So heritage (`:573`) and the MRO built from it (`:601`) both run **before** `populateNamespaceSiblings`
   (`:640`). This is the structural root cause of the v1.10(iv)/v1.13 limitations (SRS §5.1 register;
   RESEARCH-003 Addendum 9 first flagged the ordering and named the reorder a WI-4 item).

2. **The heritage pass resolves a base name through the same lookup the reorder would newly feed.**
   `preEmitInheritanceEdges` resolves each `inherits` site's base via
   `resolveInheritanceBaseInScope(site.inScope, site.name, scopes, site.rawQualifiedName, callerClass)`
   (`run.ts:172`). That function (`scope/walkers.ts:338-366`): (a) for a dotted base, first tries
   `resolveQualifiedInheritanceBase` against the exact-case `QualifiedNameIndex` (`walkers.ts:353-361,
   379-`); (b) falls to `findClassBindingInScope` (`walkers.ts:301-331`) → `walkScopeChain` → `lookupBindingsAt`,
   which **consults `workspaceFqnBindings` as its scope-independent channel** (`walkers.ts:88` →
   `workspaceBindingsFor`, `:65-73`, **raw key then `normalizeIdentifier`-folded key**); (c) then the
   **QNI dotted-tail single-match fallback** (`walkers.ts:320-329`) — a dotted base retries its simple tail
   in the exact-case `QualifiedNameIndex`, single-match-wins; (d) then the Apex-inert
   `resolveAmbiguousInheritanceBaseViaImports` (`walkers.ts:364` — keys on `ImportEdge[]`, which Apex never
   emits). So the heritage pass **already flows through the `workspaceFqnBindings` channel** — it is simply
   empty of Apex keys when the pass runs today.

3. **The reorder is mechanically feasible and bounded to a ~70-line region.** The movable unit is the
   heritage block `{preEmitInheritanceEdges :573, emitDetectedInterfaceImplementations :593, buildMro :601}`;
   `buildMro` must stay after heritage emit (it reads the EXTENDS/IMPLEMENTS edges — `passes/mro.ts:49`).
   The coupling: `indexes` (`run.ts:614`) bundles `methodDispatch` built *from* the MRO (`:616`), and
   `populateNamespaceSiblings` consumes `indexes` (`:641`). So a reorder re-sequences to: build `indexes`
   with the **empty** `methodDispatch` `finalizeScopeModel` produces by design (`:608` comment) →
   `populateNamespaceSiblings` (workspace channel now populated) → heritage block (base resolution now sees
   the workspace keys) → build MRO → swap in the populated `methodDispatch`. All within the `:554-621`
   region; no cross-file signature change.

4. **The reorder DISCHARGES the simple-name heritage forms but is NECESSARY-BUT-NOT-SUFFICIENT for the
   dotted nested-parent form.** Read-traced consequence per base shape:
   - **Simple-name base (`extends Base`, case-varied `extends BASE`):** after the reorder,
     `findClassBindingInScope('BASE')` → `lookupBindingsAt` → `workspaceBindingsFor` tries `BASE` (raw miss)
     then the folded `base` (**hit** — the injected top-level type). So case-varied simple heritage resolves.
     This discharges the SRS v1.8(i) case-varied-heritage limitation and its v1.11(a) downstream (the super
     self-loop, inherited-member) — forms that fail today only because the channel is empty at pass time.
   - **Dotted nested-parent base (`extends TOuter.TInner`):** `workspaceFqnBindings` is keyed by folded
     **simple** name (`touter`), so `lookupBindingsAt('TOuter.TInner')` misses (raw and folded both dotted),
     and the **QNI dotted-tail fallback (walkers.ts:320-329) still binds the same-tail top-level decoy** —
     the exact v1.10(iv) mis-bind, unchanged by the reorder. Fixing the dotted form additionally requires
     **nested-aware base resolution**: resolve the OUTER segment (`TOuter`) via the workspace channel, then
     find the nested tail (`TInner`) among `TOuter`'s owned nested defs, **before** the dotted-tail fallback
     — the same OUTER-first nested lookup WI-3 inc 11 built Apex-local for the ctor/declared-type paths
     (`languages/apex/`), now owed on the heritage base-resolution path.
   - **Consequence for v1.13 (poisoned MRO):** eliminating the dotted mis-bind removes the false EXTENDS
     edge, so `buildMro` no longer carries the decoy into the MRO and `s.decoy2()` no longer resolves into
     the decoy's member. The MRO consequence is fallout of fixing the EXTENDS edge — no separate MRO edit.

5. **Peer blast radius (NFR-002) — five peers register `populateNamespaceSiblings`.** `csharp`, `go`,
   `java`, `php`, `swift` register the hook (RESEARCH-003 finding 4). Moving heritage resolution to *after*
   the registration means those languages' heritage bases would newly see their own namespace/workspace
   bindings during heritage resolution — which could resolve a heritage base that currently misses (a **new**
   EXTENDS/IMPLEMENTS edge) = a potential NFR-002 regression. The reorder is generic (names no language), so
   this is measured, not assumed: whether any peer's heritage resolution *changes* under the reorder is a
   **Gate-4 NFR-002 measurement obligation** (peer resolver suites, full cross-language surface). Intuition
   (not a pin): more reachable bindings can only *add* resolvable heritage, rarely un-resolve an existing
   edge, so a peer change is unlikely but must be measured. **Committed fallback if a peer regresses**
   (Architect-ruled 2026-07-07, "generic + gated fallback"): a per-language gate (an Apex-only flag on the
   provider/`ScopeResolutionIndexes`, mirroring WI-3 inc 15's `resolveInheritedImplicitThisCall`) that
   confines the after-registration heritage timing to Apex, leaving peers on the current order. The SHALL has
   a named satisfaction path either way (finding #29).

## Findings — B: external-reference handling (REQ-013)

6. **"External = benign unresolved" is already the host default — no "external" classification exists.**
   An unresolved reference is simply **skipped, no edge emitted**: `resolve-references.ts:127-129`
   (`resolutions.length === 0 → unresolved++, continue`) and `emit-references.ts:100-104` (missing target →
   skip). `ResolutionOutcome` (`scope-resolution/resolution-outcome.ts:12-34`) has only `'resolved'` and
   `'suppressed'` (ambiguity) kinds — **no `'external'`/`'unresolved-benign'` kind**. So a reference to a
   stdlib/sObject/managed-package type produces no edge and no defect *by construction* — REQ-013's "external,
   not a defect" is the existing behaviour. Peers additionally *pre-filter* known builtins via the
   `isBuiltInName` provider hook (`language-provider.ts:379, 423-424`, fed by a `builtInNames` set) to avoid
   even attempting resolution; C# has a dedicated external-namespace gate (`csharp-namespace-gate.ts:22-47`,
   a `CSHARP_EXTERNAL_ROOTS` set). *[Finding 6 read-quality: cited from the Phase-2 spike sweep; the
   no-edge-on-miss behaviour is the acceptance-observable REQ-013 pins at Gate 3, so it is a [Gate-3 reliance],
   not a Gate-2 structural pin.]*

## Findings — C: parameter-typed-argument narrowing (REQ-008 completion)

7. **The argument-typing hook exists; a parameter argument is left untyped only because its type is not
   resolved, not because the path is absent.** Overload narrowing runs through
   `narrowOverloadCandidates(overloads, argCount, argTypes, …)` (`scope-resolution/passes/overload-narrowing.ts`),
   which filters by exact type slot and **treats an empty-string arg type as "unknown → any match"** (skip).
   Apex infers arg types in `languages/apex/captures.ts`: `inferArgType` returns a type for literals and `''`
   for a bare identifier (a parameter reference lands here); `resolveVarTypeBindings` then post-resolves an
   `''` arg from the local `varTypes` map (`captures.ts:415-450`), which is built from `@type-binding`
   captures **including method parameters**. So a parameter used as an overload argument already gets its
   declared type *if* that type was captured — the gap WI-2 deferred is not a missing path but the **safety
   gate**: narrowing on a parameter whose type is **external** (not user-defined) would mis-resolve, so WI-2
   left all parameter args untyped (arity-only, conservative). *[Finding 7 read-quality: as finding 6 —
   spike-swept; the exact behaviour is a Gate-3 reliance.]*

8. **The user-defined-vs-external oracle already exists — `workspaceFqnBindings` membership.** Whether a type
   name is user-defined (in-workspace) is answered by a `workspaceFqnBindings`/class-binding lookup
   (`workspaceBindingsFor`, `walkers.ts:65-73`; `findClassBindingInScope`, `:301`) — the same registry WI-3's
   REQ-010 populates. REQ-013's external-type detection is therefore **reuse, not new machinery**: a parameter
   type present in `workspaceFqnBindings` is user-defined (narrow); absent → treat as external (leave
   untyped, arity-only). This is the gate that lets the REQ-008 parameter-arg completion narrow safely.

## Conclusion

- **A. The reorder is the committed generic change, discharging the simple-name heritage limitations
  outright and the dotted nested-parent limitation *in combination with* a nested-aware heritage base
  resolution.** SDD-004 pins: (i) the **generic reorder** of the heritage block to after
  `populateNamespaceSiblings` (`run.ts` `:554-621` re-sequence, names no language — Constitution §2.2), with
  the Gate-4 **NFR-002 measurement obligation** and the Architect-ruled **committed per-language-gated
  fallback** if a peer regresses; (ii) a **committed nested-aware heritage base seam** (the inc-11 OUTER-first
  nested lookup, extended to the heritage path). **[Reconciled 2026-07-07 — see Addendum 2: this seam is a
  committed deliverable, NOT iff-red.** Finding 4's read-trace (folded-**simple**-name workspace keying + the
  `walkers.ts:320-329` dotted-tail fallback, both source-confirmed) establishes *structurally* that the
  reorder alone cannot resolve the dotted nested-parent form — so the seam's necessity is certain, and it is a
  shared edit (additive `emitHeritageEdges` registration cannot remove the shared pre-pass's decoy edge). The
  original "engaged if the fixture stays red" wording below is superseded.]** — never a silent de-scope
  (Constitution §7 / finding #29).
  The v1.10(iv)/v1.13 fixtures (`apex-cross-file-collision` TailSub/TailMro/TInner) flip from
  documented-limitation pins to correct-resolution assertions; the v1.8(i)/v1.11(a) case-varied-heritage
  fixtures likewise flip (reorder-discharged), a scope the SDD must state so the SRS §5.1 register is updated.
- **B. REQ-013 is satisfied by the host default (external = no edge = benign) plus, at most, an Apex
  `builtInNames`/external-root reuse** if a parity fixture shows a *false-positive* external attempt; no new
  outcome kind. SDD-004 pins REQ-013 acceptance as: a stdlib/sObject reference emits no edge and no unresolved
  *defect*, verified by a parity fixture — a [Gate-3 reliance] on the host no-edge-on-miss behaviour.
- **C. The REQ-008 parameter-arg completion is: gate `resolveVarTypeBindings`' parameter-type narrowing on
  the finding-8 workspace-membership oracle** — narrow when the parameter's declared type is in
  `workspaceFqnBindings` (user-defined), leave untyped (arity-only, conservative — never mis-bound) when
  absent (external). Apex-local (`languages/apex/captures.ts`); no shared edit. Completes the WI-2-deferred
  sub-case (SDD-002 §2 / work-items REQ-008 note) without re-owning the REQ-008 mechanic.
- **REQ-012 (Java/Kotlin parity) & NFR-004** are demonstrated by a parity fixture suite comparable to peers
  (`apex.test.ts`), measuring the full resolution surface (same-file + cross-file) — no new resolution
  algorithm, the parity *evidence*.
- **Receiver-*variable*-name case-fold** (the WI-2→WI-3→WI-4 re-deferred case-insensitivity completeness
  item): fold a receiver variable's name at its lookup, Apex-local against REQ-005/REQ-008 case-insensitivity;
  no epic §9 scenario varies a variable's case, so it is parity hardening, not a SHALL gap.

## Residual Gate-3 reliances (finding #13 — do NOT pin these at Gate 2)

The **pipeline structure** (findings 1-3), the **feasibility of the reorder** (finding 3), and the
**existence of the workspace-membership oracle** (finding 8) are settled (structural, read-verified). The
**resolution behaviour once the reorder/gate/oracle runs** is a host-API obligation validated at Gate 3
(tests vs the real host), NOT a Gate-2 pin:
- that the reorder actually resolves each *simple-name* cross-file heritage form (case-varied `extends BASE`;
  cross-file top-level `extends`/`implements`/`super`) and leaves peers' heritage edges byte-identical
  (the NFR-002 slice — measured at Gate 4);
- that the dotted nested-parent form resolves after the reorder + the nested-aware base resolution (and does
  NOT mis-bind the decoy), and that the poisoned-MRO member (`s.decoy2()`) correspondingly no longer resolves
  into the decoy — the committed nested-aware base seam (finding 4; **structurally required, not iff-red** —
  Addendum 2), a generic per-language hook consulted at the top of `resolveInheritanceBaseInScope`;
- that a parameter argument whose type is user-defined narrows the overload, and one whose type is external
  leaves it arity-only (never mis-bound) — the finding-7/8 completion;
- that an external (stdlib/sObject/managed-package) reference emits no edge and no unresolved defect
  (finding 6), across the parity fixtures.

## Impact if wrong

If the reorder regresses a peer's heritage edges, the Architect-ruled per-language gate confines the change to
Apex (finding 5) — the fallback is pre-committed, not improvised. If the reorder alone leaves the dotted
nested-parent fixture red, the committed nested-aware base resolution discharges it (finding 4) — a named
Apex-local mechanism, not a silent de-scope. If REQ-013 external handling shows a false-positive, the
`builtInNames` reuse closes it (finding 6). No security/data risk: resolution stays conservative — a miss is
an unresolved reference, never a mis-binding (REQ-015/006); the reorder can only *add* correct edges or, if it
mis-fired, be caught by the NFR-002 peer suites and the v1.10(iv)/v1.13 fixtures.

## Status

**Spike complete. (A) The reorder is feasible and bounded (`run.ts:554-621`); it discharges the simple-name
heritage limitations and — with a committed Apex-local nested-aware base resolution — the dotted
nested-parent limitation; the generic reorder carries a Gate-4 NFR-002 measurement obligation with the
Architect-ruled per-language-gated fallback (2026-07-07). (B) REQ-013 is the host default (external = benign
no-edge). (C) The REQ-008 parameter-arg completion gates on the existing `findClassBindingInScope`
user-defined-vs-external
oracle.** Recommendation: SDD-004 pins the reorder (generic, §2.2, gated-fallback), the nested-aware heritage
base resolution (committed Apex-local fallback), the parameter-arg narrowing gate, REQ-013 external-benign
acceptance, and the REQ-012/NFR-004 parity fixtures. Architect approval of this conclusion + the SDD-004
purity boundary (Step 2b) gates Gate 2.

## Addendum 1 (2026-07-07) — moved-block scope: peer optional-hook registrations (grounds the seven-pass move)

The main findings analyzed the movable unit as the heritage-resolution core `{preEmitInheritanceEdges :573,
emitDetectedInterfaceImplementations :593, buildMro :601}`. SDD-004's re-sequence moves the whole contiguous
`run.ts:573-602` block (adding `emitHeritageEdges? :579`, `emitImplicitImportEdges? :584`, the
`postHeritageNodeLookup` rebuild `:591-592`, and `buildExtendsOnlyMro? :602`) to preserve internal order. This
addendum read-verifies the peer impact of relocating those three optional hooks past
`buildWorkspaceResolutionIndex` (`:632`) and `populateNamespaceSiblings` (`:640`), so the seven-pass move is
spike-grounded (dogfood #19), not assumed.

**Read-verified optional-hook registrations (which languages register each):**
- `emitImplicitImportEdges` — **swift only** (`languages/swift/scope-resolver.ts:119`,
  `emitSwiftImplicitImportEdges`; emits same-target File→File IMPORTS edges).
- `emitHeritageEdges` — **ruby, rust, dart** (`languages/{ruby,rust,dart}/scope-resolver.ts`).
- `buildExtendsOnlyMro` — **php** (`languages/php/scope-resolver.ts`).
- **Apex registers NONE of the three** (`languages/apex/scope-resolver.ts` — verified absent). So the **Apex
  discharge itself needs only the three SHARED passes** (`preEmitInheritanceEdges`,
  `emitDetectedInterfaceImplementations`, `buildMro`) to move; the optional hooks move only because the block
  is contiguous shared code.

**Position-independence of the moved optional hooks (why the move is inert for most peers):** each optional
hook takes **position-independent inputs** — `emitHeritageEdges(graph, parsedFiles, nodeLookup, finalized)`,
`emitImplicitImportEdges(graph, parsedFiles, nodeLookup, resolutionConfig)`, `buildExtendsOnlyMro(graph,
parsedFiles, nodeLookup)` — none is passed `indexes`, so **the R4-F1 `indexes`-not-`finalized` argument swap
applies ONLY to the two Apex-relied-on shared passes** (`preEmitInheritanceEdges`,
`emitDetectedInterfaceImplementations`); the optional hooks keep their existing args and thus see **no input
change** from the move. `buildExtendsOnlyMro` (php) and `buildMro` read the EXTENDS edges the block emits and
move with it (relative order preserved) → unchanged. `emitHeritageEdges` (ruby/rust/dart) emits into the graph
from position-independent inputs, and no pass between its old and new position consumes its output before it
runs (`populateNamespaceSiblings` iterates defs, not heritage edges) → unchanged.

**The one genuine peer surface — swift.** Swift registers **both** `emitImplicitImportEdges` and
`populateNamespaceSiblings`; today `emitImplicitImportEdges` (`:584`) runs **before**
`populateNamespaceSiblings` (`:640`), and the move relocates it **after**. Whether swift's namespace-sibling
population, `buildWorkspaceResolutionIndex`, or the `:653-:663` passes depend on the implicit-IMPORTS edges'
pre-registration emission is **the single peer surface the generic move touches** — measured at Gate 4 (swift's
resolver suite). Because `runScopeResolution` runs **once per language over extension-partitioned files**
(RESEARCH-003 Addendum 12), the gate is per-run: set on the Apex run, unset on the swift/ruby/etc runs → the
gated form has **zero** peer surface, making the whole optional-hook peer analysis above moot for the built
artifact. **Architect ruling (2026-07-07): the Apex-gated form IS the built artifact** (not a
measured-fallback) — five peers register an optional hook in the moved region, so a generic all-language
re-sequence would touch them, whereas the gated form is byte-identical for every peer by construction and
fits Constitution §2.2's "configured by the isolated provider" arm (no §2.2 amendment). The generic
all-language re-sequence is left as a possible *later* upstream contribution, not gated on WI-4. (This
supersedes this addendum's original "generic-vs-gated settled by the Gate-4 measurement" wording.)

## Addendum 2 (2026-07-07) — the nested-aware heritage base seam is structurally required (reconciles the Conclusion's "iff-red" wording)

The main Conclusion A(ii) and the Residual reliances originally framed the nested-aware heritage base
resolution as "engaged **if/iff** the dotted-nested-parent fixture stays red after the reorder" — a
contingency. Finding 4's read-trace, re-confirmed against source, establishes it is **structurally certain**,
not contingent:

- `workspaceFqnBindings` is keyed by the **folded SIMPLE name** (`walkers.ts:65-73`,
  `namespace-siblings.ts` §3 fold), so `lookupBindingsAt('Outer.Inner')` (a dotted base) **cannot** hit the
  workspace channel — the key is simple, the query dotted.
- After the reorder, a dotted base therefore still falls to `findClassBindingInScope`'s **QNI dotted-tail
  single-match fallback** (`walkers.ts:320-329`), which binds the same-tail top-level decoy (BL-4) — exactly
  the pre-reorder mis-bind. The reorder populates the channel but the channel is unreachable by a dotted key.
- So the reorder alone is **provably (by source structure) insufficient** for BL-3/BL-4; the seam is required,
  not "engaged if red." And it **must be a shared edit** (a generic per-language hook consulted at the top of
  `resolveInheritanceBaseInScope`, gating the shared pre-pass's dotted-tail fallback) — a purely-additive
  `emitHeritageEdges` registration runs *after* `preEmitInheritanceEdges` has already bound the decoy and
  cannot *remove* that false edge.

**Reconciliation:** SDD-004 §1(2) pins the seam as a **committed deliverable (the epic's second shared edit),
NOT iff-red** — this addendum is the source basis; the Conclusion/Residual "iff-red" wording is superseded.
The seam carries the finding-#29 committed satisfaction path (Architect escalation → SRS §5.1 amendment +
INTENT-001 revisit / Gate-1 re-entry) only for the case its §2.2 seam review cannot be made clean — that is
the residual contingency, not the seam's existence.

**Hook contract (three return states, per SDD-004 §1(2)/§3):** (i) resolved (OUTER binds a workspace type,
nested tail a unique owned def) → return the binding; (ii) applicable-but-refuse (OUTER bound, tail
absent/ambiguous) → refuse, emit no edge; (iii) not-applicable (non-dotted / OUTER unbound) → pass through.
States (i) and (ii) both suppress `resolveQualifiedInheritanceBase` (`:353-361`) and the
`findClassBindingInScope` call (`:363`), so no path binds the decoy once the OUTER is a workspace type.

## Addendum 3 (2026-07-07) — full read-verified `run.ts:554-693` pipeline (grounds the F2 pin + the `ln`-landing)

Read-verified against `src/core/ingestion/scope-resolution/pipeline/run.ts` (2026-07-07). Each pass, its
call args, and what it consumes re: `indexes.methodDispatch` (the `MethodDispatchIndex` / "`ln`"), heritage
graph edges, and `indexes.scopeTree`:

| Line | Pass | Args | Reads `methodDispatch`? | Heritage edges |
|---|---|---|---|---|
| `:573` | `preEmitInheritanceEdges` | `(graph, finalized, nodeLookup)` | no (runs before `buildMro`; today takes empty-`ln` `finalized`) | emits |
| `:579` | `emitHeritageEdges?` | `(graph, parsedFiles, nodeLookup, finalized)` | no | emits |
| `:584` | `emitImplicitImportEdges?` | `(graph, parsedFiles, nodeLookup, resolutionConfig)` | no | no |
| `:591` | `postHeritageNodeLookup` rebuild | — | no | reads graph |
| `:593` | `emitDetectedInterfaceImplementations` | `(graph, parsedFiles, postHeritageNodeLookup, provider, finalized, readonlyModel)` | no (takes `finalized`, empty `ln`) | emits IMPLEMENTS |
| `:601` | `buildMro` | `(graph, parsedFiles, postHeritageNodeLookup)` | **produces** the MRO that populates `ln` | reads |
| `:614` | `const indexes = {...finalized, methodDispatch: buildPopulatedMethodDispatch(...), normalizeIdentifier}` | — | **populates `ln` here** | — |
| `:632` | `buildWorkspaceResolutionIndex` | `(parsedFiles, indexes.scopeTree)` | **no — takes only `indexes.scopeTree`** | no |
| `:640` | `populateNamespaceSiblings?` | `(parsedFiles, indexes, {...})` | **no — Apex impl reads only `indexes.workspaceFqnBindings`** (`namespace-siblings.ts:127`) | no (iterates defs, Add. 1) |
| `:653` | `mirrorNamespaceTypeBindings?` | `(parsedFiles, indexes, workspaceIndex, resolutionConfig)` | consumes `indexes` | no |
| `:663` | `propagateImportedReturnTypes?` | `(parsedFiles, indexes, workspaceIndex)` | consumes `indexes` | no |
| `:666` | `populateRangeBindings?` | `(parsedFiles, indexes, {...})` | consumes `indexes` | no |
| `:680` | `validateBindingsImmutability` | `(indexes, onWarn)` | consumes `indexes` | no |
| `:687` | `resolveReferenceSites` | `({scopes: indexes, ...})` | consumes `indexes` | no |

**Consequences (grounding the SDD F2 pin + the `ln`-landing claim):**
1. **F2 `methodDispatch`-independence of the empty-`ln`-window passes is a read-verified fact, not a
   heritage-edge inference:** `buildWorkspaceResolutionIndex` takes only `indexes.scopeTree` (`:632`) and
   Apex's `populateNamespaceSiblings` reads only `indexes.workspaceFqnBindings` (`namespace-siblings.ts:127`)
   — neither reads `methodDispatch`. Running them before the moved `buildMro` (empty `ln`) is safe by
   signature/body, independently of Addendum 1's heritage-edge point.
2. **The `:653-:687` tail all consume `indexes`:** post-reorder the tail is threaded the re-spread
   `{...indexes, methodDispatch: populatedFromMovedBuildMro}`, so `mirror`/`propagate`/`populateRange`/
   `validate`/`resolve` each receive the **same** populated `ln` they receive un-gated (where `buildMro` at
   `:601` populates `ln` at `:614` before the same tail). The empty-`ln` window is closed strictly between the
   `indexes` build and the moved `buildMro`, which completes before `:653` in both orders.
3. `preEmitInheritanceEdges` (`:573`) and `emitDetectedInterfaceImplementations` (`:593`) today take
   `finalized` (empty `ln`), so they **already** run without a populated `methodDispatch` — threading them the
   pre-heritage empty-`ln` `indexes` (which additionally carries `normalizeIdentifier` + the injected
   `workspaceFqnBindings`) changes only those two fields, never a `methodDispatch` dependency.
4. **`preEmitInheritanceEdges` (`:573`) is the authoritative grammar-level heritage emitter for EXTENDS *and*
   declared IMPLEMENTS** — it resolves every declared base via `resolveInheritanceBaseInScope` and discriminates
   the edge kind by the resolved target's type (`run.ts:189`: `Interface`/`Trait` → IMPLEMENTS, else EXTENDS).
   So threading it `indexes` gives the folded workspace channel to a declared `implements IFace` exactly as to
   `extends`. **`emitDetectedInterfaceImplementations` (`:593`) is the Go-style *inferred*-implements pass** —
   Apex registers no `detectInterfaceImplementations` hook, so it early-returns 0 (`run.ts:216`) and is inert
   for Apex; it moves with the block but needs no `indexes` for Apex correctness.

## Addendum 4 (2026-07-07) — REQ-008 oracle correction (supersedes Conclusion C / Status (C))

Conclusion C says "gate on the finding-8 **workspace-membership** oracle — narrow when the parameter's declared
type is **in `workspaceFqnBindings`**"; Status (C) then labels that mechanism "the existing
`findClassBindingInScope` user-defined-vs-external oracle." **Those two phrasings are not equivalent, and the
`findClassBindingInScope` label is wrong for a nested/dotted parameter type** — a decoy-safety hole the SDD
correctly closed:

- The **membership check** (finding 8 — is the *folded simple name* a key in `workspaceFqnBindings`) is
  decoy-safe: the §3 inject-none guard keys ≤1 per folded name, so a collision resolves to nothing → external.
- `findClassBindingInScope` (`walkers.ts:301-331`) does **more** than a membership check — it does
  `walkScopeChain` + full-path-QNI single-match + the **decoy-prone simple-tail single-match** (`:320-329`).
  On a nested/dotted parameter type it would bind a **same-tail top-level decoy** → the overload narrows on the
  **wrong** type (a mis-resolution, defeating "never mis-bound").

**Corrected oracle (as SDD-004 §1(3)/§3 pins it):** (a) a **simple** top-level type-name → `workspaceFqnBindings`
folded **membership** (finding 8, decoy-safe); (b) a **dotted/nested** type-name → the Apex-local inc-11
OUTER-first nested lookup (finding 4, decoy-safe); (c) a **simple-name nested type referenced from within its
enclosing class** → an enclosing-scope owned-def lookup (scope-local; its resolution is a **[Gate-3 reliance]**,
not a read-verified pin). **Explicitly NOT `findClassBindingInScope`** (its `:320-329` tail is decoy-prone for
nested types). This supersedes Status (C)'s `findClassBindingInScope` phrasing; Conclusion C's underlying
*membership* mechanism stands (it is arm (a)).

## Addendum 5 (2026-07-07) — seam state-(ii)/(iii) boundary correction (tightens Addendum 2's hook contract)

Addendum 2's hook contract listed "(iii) not-applicable (non-dotted / **OUTER unbound**) → pass through" and
scoped its decoy-safety lemma to "once the OUTER **is a workspace type**". That boundary is **too loose** and is
**corrected** here (the SDD-004 §1(2)/§3/§4 contract is the authoritative version):

- **The pass-through arm (iii) is for NON-DOTTED bases only.** For a **dotted** base, an unbound / external /
  managed-package-namespace / **>2-segment** OUTER must **refuse (state ii — no edge)**, NOT pass through —
  because passing a *dotted* base to the shared `resolveQualifiedInheritanceBase`/`findClassBindingInScope`
  path reaches the `walkers.ts:320-329` dotted-tail single-match, which can bind a **same-tail top-level decoy**
  (`extends Ext.Inner` with an external `Ext` and a top-level `Inner` → decoy mis-bind — a REQ-015 / §1.2
  over-bind). So the decoy-safety guarantee holds for **every** dotted base (resolve or refuse), not only
  workspace-bound OUTERs. **Only a non-dotted (simple) base falls through to the unchanged path** (where BL-1's
  case-fold discharge lives).
- **OUTER "ambiguity" is not a 2+-candidate state.** SDD-003 §3's inject-none guard keys **≤1 per folded
  name**, so a folded-workspace OUTER query returns **0 or 1**, never 2+; a case-collision on the OUTER folded
  name is **inject-none-suppressed → 0 candidates**, i.e. the *absent-OUTER refuse* arm. The seam therefore has
  no "2+ candidates" branch; the collision case is subsumed by the absent/refuse arm.

Apex user-defined nested types are at most **two segments** (one nesting level), so a >2-segment dotted base is
namespace-qualified (external) → refuse. Net: **every dotted base is resolved (i) or refused (ii); pass-through
(iii) is non-dotted only** — no dotted base can reach the decoy-prone fallback.
