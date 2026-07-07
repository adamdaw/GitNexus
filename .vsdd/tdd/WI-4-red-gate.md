# WI-4 (Parity hardening & external handling) — Red-Gate record

*VSDD Phase 3, Step 3a. Records the Red-Gate state of the WI-4 acceptance suite authored
against **SDD-004 §8**, BEFORE the WI-4 implementation (the pipeline reorder + nested-aware
heritage-base seam + parameter-arg narrowing gate + receiver-variable case-fold). The Gate-3
adversary (`vsdd-test-validator`) verifies this record against the tagged tests, with the
implementation WITHHELD.*

## Where the WI-4 tests live

- **BL-1…BL-8 discharge + BL-10 heritage arm — FLIPPED IN PLACE** in
  `test/integration/resolvers/apex-cross-file.test.ts`. SDD-004 §8 prescribes "the
  `apex-cross-file-collision` (and heritage) fixtures **flip** from documented-limitation pins to
  correct-resolution." The eight BL-1…BL-8 pins (ratified at WI-3 as "documented limitations,
  temporary until WI-4") are rewritten to assert the post-reorder correct resolution; the BL-10
  heritage-arm test is added to the collision block (reusing the existing `Phantom.cls` misfiled
  trigger + a new `PhantomSub.cls`). This is the committed WI-4 discharge, not a WI-3 regression —
  the pins were always going to flip here (test-740 flip note, pin-767 ratification).
- **REQ-008 param-arg / REQ-013 external / REQ-012 parity / receiver-var / NFR-001 cyclic
  heritage — NEW** `test/integration/resolvers/apex-parity.test.ts` (the §2.5 additive sibling
  SDD-004 §3 names), over four new fixture dirs: `apex-param-arg`, `apex-external`, `apex-parity`,
  `apex-heritage-cycle`.
- **One fixture edit:** `apex-cross-file/Outer.cls` — added `public Inner() {}` (an explicit ctor
  on the nested `Outer.Inner`) so NestSub's BL-7 `super()` binds an observable ctor node, mirroring
  Base's explicit ctor for BL-1. Additive; the 97 non-flipped `apex-cross-file.test.ts` tests
  (incl. the WI-3 `new Outer.Inner()` nested-access tests) stay green.

## Suite state at authoring (pre-impl host)

WI-1/2/3 are DONE and green, so the WI-4 tests **run** (they do not skip). No **test scaffolding**
(`// vsdd:scaffold`) is needed — grammar, provider, registration, and the WI-2/WI-3 resolution
mechanics all exist; WI-4 adds no new capability that must be registered before its behavioural
targets can execute. No scaffold ledger.

**Measured Red-Gate (pre-impl, HEAD after the flips):**

- `apex-cross-file.test.ts` — **10 red / 97 passed of 107**. The 10 reds are exactly the
  BL-1…BL-8 flips + the BL-10 heritage arm (enumerated below).
- `apex-parity.test.ts` — **6 red / 14 passed of 20**. The 6 reds are the genuinely-new WI-4
  behaviours; the 14 passing are already-green parity/external/bare-decl anchors (no-red
  justification below).
- **WI-4 red total: 16.**

**Pre-existing suite stays green (Step 3a changed ONLY test + fixture files — zero production
source — so nothing outside the two WI-4-owned files can change status):** `apex-resolution`,
`apex-hardening`, `apex-resolution-hardening`, `apex-cross-file-hardening`, `apex-resolution-unit`,
`apex-cross-file-unit`, and the `java` / `csharp` / `python` peers = **743/743 passed** (measured
2026-07-07). NFR-002's full cross-language measurement is Gate-4 (SDD-004 §5/§7); the zero-source-
change property makes the Step-3a peer-green trivially certain.

## The 16 genuinely-red WI-4 tests (each RED because the reorder/seam/gate/fold is unbuilt)

### apex-cross-file.test.ts — BL-1…BL-8 discharge flips + BL-10 (10 red)

1. **BL-1** — `CaseKid extends BASE implements IFACE` → EXTENDS to Base + IMPLEMENTS to Iface
   (case-varied, folded; the `implements` arm made explicit within BL-1, Architect-ruled
   2026-07-07). Red: pre-reorder heritage resolves before injection → case-varied base/interface
   miss the folded workspace key.
2. **BL-8** — `CaseKid.callUp2()`'s implicit-this `inherited()` → resolves to Base.inherited (the
   MRO includes Base once BL-1's EXTENDS exists; inc-15's gated MRO walk reaches it). Red as a
   BL-1 fallout.
3. **BL-3** — `NestSub extends Outer.Inner` → EXTENDS to the real nested Inner @ Outer.cls (the
   committed nested-aware base seam). Red: pre-reorder the dotted base misses both the (simple-name-
   keyed) workspace channel and, absent the seam, binds nothing/decoy.
4. **BL-7 (super.ping)** — `NestSub` `super.ping()` → the parent Outer.Inner.ping, no self-loop.
   Red as a BL-3 fallout.
5. **BL-7 (super ctor)** — `NestSub` `super()` → the parent nested Inner ctor @ Outer.cls. Red as a
   BL-3 fallout (relies on the added `Outer.Inner` explicit ctor for an observable edge).
6. **BL-5** — `TwinSub extends Twin` (same-case valid trigger/class twin) → EXTENDS to the class
   Twin @ Twin.cls, never the trigger. Red: pre-reorder the exact-case QNI sees two defs and
   refuses; post-reorder the folded key (trigger §3-excluded) yields the unique class.
7. **BL-6** — `TailMro` `t.decoy2()` → NO false member edge (the poisoned MRO is cleared once
   BL-4's EXTENDS binds the real nested type). Red as a BL-4 fallout.
8. **BL-4** — `TailSub extends TOuter.TInner` (nested-parent + same-tail top-level decoy) → EXTENDS
   to the real nested TInner @ TOuter.cls, never the decoy TInner.cls (the v1.10(iv) target; the
   seam gates the shared dotted-tail fallback). Red until reorder + seam.
9. **BL-2** — `TwistSub extends Twist` (case-variant trigger/class twin) → EXTENDS to the class
   TWIST @ TWIST.cls, never the trigger. Red like BL-5.
10. **BL-10 heritage arm** — `PhantomSub extends PHANTOM` (case-varied, `.cls`-misfiled trigger) →
    EXTENDS binds the injected misfiled trigger post-reorder (the ratified §1.2-(b) over-bind,
    dispositioned by the committed SRS BL-10 amendment); the trigger has no members, so no false
    inherited-member MRO edge; the non-heritage `new PHANTOM()` bind stays live. Red: pre-reorder
    heritage resolves before injection → `extends PHANTOM` misses.

### apex-parity.test.ts — new WI-4 behaviours (6 red)

11. **REQ-008 param-arg, user-defined top-level** — `b.f(p:Widget)` narrows to f(Widget) via the
    §1(3)(a) workspace-membership oracle. Red: WI-2 leaves parameter args untyped.
12. **REQ-008 param-arg, dotted nested** — `b.g(p:NOuter.NInner)` narrows to g(NOuter.NInner) via
    the §1(3)(b) inc-11 OUTER-first lookup, never the same-tail decoy. Red until the gate.
13. **REQ-008 param-arg, simple-name nested in enclosing scope** — `NOuter.callInnerFromEnclosing
    (p:NInner)` narrows via the §1(3)(c) enclosing-scope owned-def lookup. Red until the gate.
14. **REQ-006 anchor for the param-arg narrowing** — exactly the three user-defined narrowing
    sites resolve (0 pre-impl → 3 post-impl). Red until the gate.
15. **Receiver-variable case-fold** — `Widget a; A.foo()` folds `A`→variable `a` → Widget.foo
    (§1(4) Apex case-insensitivity hardening; no governing SHALL/parity/NFR-004). Red: WI-2/WI-3
    fold type/member names but not a receiver variable's name.
16. **NFR-001 case-varied cross-file heritage cycle** — `CycloneA extends CYCLONEB` /
    `CycloneB extends CYCLONEA` both resolve (RED until the reorder resolves case-varied cross-file
    bases) AND the run terminates (buildMro's cap bounds the newly-formable cycle; the 120s test
    timeout enforces no-hang).

## Already-green anchors (no-red justification — VSDD Principle 3, rung ruled out: "behaviourally
consequential / enables a target test")

These WI-4 fixtures assert behaviour **already delivered** by WI-1/2/3 (not by any WI-4 code), so
they pass pre-impl. They are legitimate acceptance content — the NFR-004 aggregate requires the
`apex-resolution` suite to exercise every §9 scenario, and REQ-012's parity leg re-asserts the
peer-equivalent resolution shapes as parity evidence. Ruled out rung (1) "behaviourally
consequential → test it" would demand a new red, but these behaviours are already correct; they
serve as **regression anchors + parity evidence**, so they are retained green with this note.

- **`apex-parity.test.ts` REQ-012 parity shapes** (cross-file call `e.start()`, ctor `new
  PEngine()`, field `held.label`, `PDerived extends PBase`, exact-case `PApp implements PIface`,
  bare-declared-type-no-standalone-edge) — all resolve via WI-3's REQ-010 enabler / WI-2 mechanics.
  Re-asserted as the REQ-012 parity leg of NFR-004. The genuinely-new receiver-var fold in the same
  fixture is red (#15).
- **`apex-parity.test.ts` REQ-013 external** (no edge + no defect for System.debug / new Account() /
  a.Name / ExtNs.Svc.ping; run completes; no dangling) — the host default on any unresolved
  reference (SDD-004 §2, RESEARCH-004 finding 6); no WI-4 code creates it. Conservative-negative
  anchors, run-completion is the value.
- **`apex-param-arg` external-typed parameter arg** (`b.f(s:String)` → no binding edge) — WI-2
  already leaves parameter args untyped → arity-only → the two arity-1 overloads survive →
  ambiguous → edge-absence. WI-4 preserves this conservative arm; the user-defined narrowing cases
  (#11–14) are the reds.
- **dangling-edge sweeps** across all four fixtures — structural NFR-001 guards; green throughout.

## Note — REQ-008 ambiguous-duplicate param type (edge catalog)

SDD-004 §4 lists "Parameter arg, duplicate-named (ambiguous) user-defined type → oracle refuses on
tie → external → arity-only." Its observable outcome is **identical** to the external-typed arm
(#external anchor above): conservative arity-only skip, no mis-bind. It is covered by the same
conservative-skip assertion; a dedicated duplicate-typed fixture is deferred as redundant with the
external arm (flagged here so the Gate-3 adversary sees the deliberate coverage decision, not a gap).
