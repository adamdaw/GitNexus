# WI-3 (ITEM-003) — Phase 3 Step 3b TDD compliance log (§A.12)

Per-increment record: failing test(s) → minimal implementation → pass, with changed
files and a one-line justification the diff is confined to satisfying the targeted tests.
Minimality is checked against this log at Gate 4.

Build note: integration tests run the compiled `dist/` worker; each `src/` edit requires
`node scripts/build.js` before re-running the integration suite.

---

## Increment 1 — Namespace-siblings registration (REQ-010/REQ-011 base; SDD-003 §3)

- **Targets (red→green):** the 10 unit anchors in `test/unit/apex-cross-file-unit.test.ts`
  (the §3 selection/fold/guard shape), and every cross-file/trigger form the *bare injection*
  is sufficient for — 24 integration anchors greened (two-class call, bare declared-type
  binding, cross-file chain, misfiled/non-exported top-level types, the trigger static/instance
  arms, etc.). Integration suite `apex-cross-file.test.ts`: **46 → 70 passing of 101**.
- **Changes:**
  - `src/core/ingestion/languages/apex/namespace-siblings.ts` (new) —
    `computeApexNamespaceBindings` (pure §3 selection + fold: Module-parented `Class`-kind
    scopes → every class-like `ownedDef` minus `.trigger`-filed, folded key, inject-none on
    >1 distinct nodeId) + `populateApexNamespaceSiblings` (the effectful `workspaceFqnBindings`
    writer shell; ReadonlyMap→Map cast localized, mirroring `csharp/namespace-siblings.ts:639/688`).
  - `src/core/ingestion/languages/apex/scope-resolver.ts` — register
    `populateNamespaceSiblings: populateApexNamespaceSiblings` on `apexScopeResolver`.
- **Justification:** pure registration of the existing `populateNamespaceSiblings` seam
  (Constitution §2.2), no shared-code edit, no new seam. Discriminant/trigger-exclusion/collision
  guard are Apex-local. Diff confined to satisfying the §3 unit anchors + the injection-sufficient
  cross-file forms.
- **NFR-002:** peers + prior Apex suites **312/312 green** (java.test, apex.test,
  apex-resolution.test, apex-resolution-hardening, apex-resolution-unit).

### Step-3b findings surfaced by Increment 1 (the designed Gate-3 reliance validations)

- **⚠ §7(2) local-over-global precedence — reliance validated FALSE → Phase-5 escalation.**
  The `local-over-global precedence` fixture (ShadowUser declares a nested `class Shadow`; a
  top-level `Shadow.cls` exists) is now RED: post-injection, `Shadow s = new Shadow()` in
  ShadowUser's method body binds the **injected global** Shadow (1 CALLS edge → Shadow.cls)
  instead of the local nested Shadow (0 edges → ShadowUser.cls). Apex requires the inner class
  to win. Per SDD-003 §7(2), the enclosing-scope shadow case was "genuinely unverified either
  way... a red fixture here is a mis-bind on valid source → **Phase-5 escalation to the
  Architect (no Apex-local knob exists over the shared rank order)**" — `lookupBindingsAt`
  consults the scope-independent `workspaceFqnBindings` at the method scope, before the walk
  reaches the declaring class scope. **AWAITING ARCHITECT DECISION** (a shared-code precedence
  edit under §2.2 review, an SRS-ratified bounded limitation, or other). No Apex-local
  remediation exists; not patched unilaterally.

- **The remaining 30 integration reds are the designed committed-fallback clusters** (§3/§7),
  built at Step 3b only where their fixtures are red (they now are): static type-name-receiver
  synthesis (§7(3) — Color.RED, Level.HIGH, and the case-varied CONSTS.FLOOR/COLOR.BLUE/
  ACCOUNTHANDLER.notify/LEVEL.LOW), nested-type member resolution (§7(5)/(13) — Outer.Inner +
  variants, Kit.Part), case-fold at the ctor/free-call lookup (§7(11) — new ENGINE/ACCOUNTHANDLER),
  cross-file inherited-member MRO (§7(10) — implicit-this inherited, h.tag), cross-file overloads
  (REQ-008 ∘ REQ-010), the interface declaration-only arm (§3), and the trigger-scope compositions
  (REQ-011 ∘ the above). Increments 2+ pending.
