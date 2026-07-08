# Standing dispositions (admitted objective evidence — §A.17, rationale redacted)

These are settled Architect dispositions. They are admitted so the review does not re-open a
question already decided. Rationale is redacted; only the disposition and its standing criterion appear.

- **§2.2 fit of the provider-flag-gated heritage/namespace pipeline re-sequence** (a provider-configured
  `resolveHeritageAfterSiblings` flag that gates a control-flow re-sequence of existing shared passes, taken
  only on the run of the configuring provider): **DISPOSITIONED by the Architect — the existing Constitution
  §2.2 "configured by the isolated provider" arm admits this provider-configured control-flow point (the same
  category as an existing provider flag that gates shared control flow); NO §2.2 amendment is required.** This
  is a settled Constitution-interpretation ruling. Do **not** re-raise "does the gated re-sequence need a §2.2
  amendment / is it a self-clearance" as a Gate-2 finding. (A *materially different* §2.2 concern — e.g. the
  shared code naming a language, or a peer-observable behaviour change — remains in scope.)

- **§2.2 fit of the nested-aware heritage-base seam** (a generic per-language hook consulted at the top of
  shared `resolveInheritanceBaseInScope`; the isolated provider supplies the impl; a behaviour-preserving
  no-op for a peer that registers no hook): **DISPOSITIONED by the Architect — it fits §2.2(b) as a standard
  per-language provider hook (the same category as the host's existing `emitHeritageEdges` /
  `populateNamespaceSiblings` hooks), naming no language; NO §2.2 amendment is required.** Its §2.2(c) NFR-002
  leg is Gate-4-**measured** (the hook-consultation point is added to shared code peers execute), and the
  research-recorded escalation fallback covers the case its seam-conformance review cannot be made clean. Do
  **not** re-raise "is the seam a §2.2 self-clearance / does it need an amendment" as a Gate-2 finding. (A
  *materially different* concern — the shared code naming a language, or a measured peer regression — remains
  in scope.)

- **Case-varied cross-file `implements` — is it an uncatalogued §5.1 shortfall?** **DISPOSITIONED by the
  Architect (2026-07-07): NO — it is the `implements` arm of BL-1's already-catalogued heritage-family
  case-insensitivity limitation.** REQ-007 covers "inheritance AND interface-implementation lookup", so the
  §5.1 heritage-family limitation class (BL-1…BL-8) encompasses both the `extends` and `implements` arms; the
  register rows' `extends` examples are illustrative of the class, not exhaustive. SRS §1's "sole area of
  non-full-SHALL is the heritage-family" claim therefore holds, and NO new §5.1 row / Gate-1 reopen is
  required; the WI-4 Gate-3 discharge amendment makes BL-1's `implements` arm explicit. Do **not** re-raise
  "the case-varied `implements` is uncatalogued / §1's sole-area claim is falsified" as a Gate-2 finding.

- **WI-4's authority for the REQ-008 parameter-typed-argument narrowing completion** (SRS §11.4 lists WI-4 as
  REQ-012/REQ-013/NFR-004/ITEM-004 only, not REQ-008): **DISPOSITIONED by the Architect (2026-07-07): the
  authoritative decomposition cut is `work-items.md` ITEM-004**, whose Adam-approved scope includes the REQ-008
  parameter-arg completion (a WI-2→WI-4 sub-case SDD-002 §2 deferred). SRS §11 is **explicitly provisional**
  (SRS line 967: "the formal cut and its Gate-1 decomposition checkpoint follow"), so it does not bound WI-4's
  scope; NO SRS §11.4 amendment / Gate-1 reopen is owed. Do **not** re-raise "WI-4's REQ-008 scope is
  underived / over-scoped vs §11.4" as a Gate-2 finding — the authority is the (withheld-from-review but
  Architect-approved) ITEM-004 cut.
