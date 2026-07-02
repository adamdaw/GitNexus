# WI-3 Step 3a — Builder findings at test authoring (2026-07-02)

*Status: DISPOSITIONED — Architect (Adam) selected **(a) parity-accept + document** and
**F1 → ledger the already-greens**, 2026-07-02. SDD-003 amended same day (§1 two-channel
model; §2/§3/§4/§7(4)/§8); `gate2-wi3.md` superseded → cold Gate-2 re-review pending
(`gate2-wi3-r2.md`); affected tests re-authored; red-gate ledger records the no-red
justifications.* The WI-3 suite is authored and was run
once against the pre-impl host (32 red / 22 pass of 54); two findings against SDD-003's
design model emerged from the pass/fail split and were verified by direct probe
(scratchpad `probe-wi3.mjs`, edges dumped from the real pipeline). Per dogfood #15 a
Phase-3 Builder finding loops back to its owning gate (Gate 2, SDD-only) in-loop.*

## F1 — the host already resolves several REQ-010 forms WITHOUT the hook (model gap)

`workspace-index.ts` precomputes `simpleName → FIRST module-local callable def`
(the workspace-wide fallback of `findExportedDefByName`; see its header), and the
heritage pass resolves parent/interface names workspace-wide. Both are exact-case,
first-match, language-hook-independent. Verified pre-impl (no `populateNamespaceSiblings`
registered):

- `new Engine()` (App.cls) → `Class:Engine.cls:Engine` — cross-file ctor CALLS ✓
- `Derived extends Base` / `implements Iface` / `SubIface extends Iface` — cross-file
  EXTENDS/IMPLEMENTS ✓ (incl. the IMPLEMENTS edge-label selection, §7(6) reliance TRUE)
- `super()` → `Constructor:Base.cls:Base.Base#0`; `super.greet()` → `Method:Base.cls:Base.greet#0` ✓
- `Consts.MAX_SIZE` → `Property:Consts.cls:Consts.MAX_SIZE` (static type-name receiver) ✓
- Trigger body: `AccountHandler.handle()` → CALLS from `T`; `new AccountHandler()` → CALLS
  from `T`; `AccountHandler.MAX_SIZE` → ACCESSES from `T` ✓ — REQ-011's static arm and the
  edge-from-trigger [structural obligation] hold with NO WI-3 code (§7(3) reliance TRUE for
  the static-call/static-field arms; the host attributes the edge source to the trigger
  container natively)

Still genuinely RED (the hook + folded key ARE needed): every instance-receiver member
resolution (`e.start()`, `held.label`, `h.leaf.value`, `c.inherited()`, `a.save()`,
`s.ok()`, `s.fine()`, cyclic `x.b.a.b`), every case-varied form (`new ENGINE()`,
`e.STOP()`), enum-constant access (`Color.RED`, `Level.HIGH` — unlike static Property
access), all cross-file overload narrowing (incl. static `Target.sf(7)`), nested
`Outer.Inner`, trigger instance-receiver (`h.process()`, `h.name`), and both unit-anchor
groups (module absent).

Impact: SDD-003 §1's premise "the gap is purely the absence of a cross-file visibility
hook" is inaccurate — the gap is confined to the *binding/typed-receiver channel*
(+ case-folding, enum constants, overloads, nested types). Several §8 acceptance tests
cannot be authored red; they are already-green acceptance (reliance-found-true-early,
the mirror image of dogfood #20's reliance-found-false).

## F2 — the §3 inject-none guard does NOT foreclose mis-binding (safety-claim gap)

SDD-003 §2/§3/§7(4) claim the collision guard makes no-mis-bind "guaranteed Apex-locally
by construction" (a >1 Apex bucket can never reach the host lookup). That holds only for
the `workspaceFqnBindings`/`lookupBindingsAt` channel. The exact-case first-match fallback
channel (F1) bypasses it, verified pre-impl:

- `new Dupe()` (DupCaller.cls) → bound to `Class:DupOne.cls:Dupe` **with `DUPE` present in
  DupTwo.cls**. Under Apex case-insensitivity the reference matches both equally →
  ambiguous → REQ-015 says no edge + record; the host binds the exact-case match
  (first-match on ties). §4's "duplicate global simple name → unresolved, never mis-bound"
  is contradicted for the ctor/heritage/static-receiver forms. (The MEMBER path stays
  guarded: `Dupe d` gets no binding under inject-none, so `d.hit()` stays unresolved —
  the exposure is confined to the fallback channel's forms.)
- `new Rogue()` → bound to the class misfiled in `Rogue.trigger`. §4's "misfiled in a
  .trigger file → excluded, left unresolved" is likewise contradicted (the extension
  discriminant governs only the injection channel).

WI-3 cannot close this without a shared-code edit (against §3 "pure registration") or a
new §2.2 seam (its own review) — the channel predates WI-3 and serves all peers.

## Design fork (Architect decision required)

- **(a) Parity-accept + document (recommended).** The fallback channel's exact-case
  first-match behaviour is what every peer language gets (Constitution §1 parity — same
  ground as the Gate-2 collision-tiebreaker revert). Amend SDD-003: §1 model the channel;
  §3/§7(4) scope the foreclosure claim to the bindings channel; §4 re-state the duplicate
  and .trigger-misfile outcomes as the host's (bind exact-case-first / bind the misfiled
  class) with a §A.13-style documented limitation for the case-variant-duplicate mis-bind;
  §8 reframe the two negatives. Re-author the affected tests to pin actual host behaviour.
  Cost: SDD-003 amendment ⇒ Gate-2 pass record superseded ⇒ cold Gate-2 re-review of the
  amended SDD before Gate 3 (dogfood #15 cascade).
- **(b) Enforce REQ-015 on the fallback channel** — requires a shared edit or new generic
  seam (both need their own §2.2/§7 sanction); Apex-specific suppression of a host-parity
  channel is invention-beyond-parity of exactly the kind Gate 2 already reverted once.
- **(c) Do nothing / narrow fixtures** — not viable: same-case duplicates still first-match
  bind, and silently weakening the fixture hides a real REQ-015 gap.

## Affected authored tests (pending the fork)

- Already-green acceptance (need no-red justification entries, not edits): cross-file ctor,
  EXTENDS/IMPLEMENTS ×3, super() + super.method(), `Consts.MAX_SIZE`, trigger static call /
  ctor / static field (+ their REQ-006/dangling guards).
- Contradicted negatives (need re-authoring under (a)): "injects NOTHING for a colliding
  folded key" (ctor half), "excludes a class misfiled in a .trigger file".
- Unaffected: all genuinely-red positives listed in F1, all unit anchors.
