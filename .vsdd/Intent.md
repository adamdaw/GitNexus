# INTENT-001 — Apex parser for GitNexus

*Committed at intake, before deliberation (VSDD §A.15). Fixed input to Gate 1.*

- **Problem / opportunity:** GitNexus has no Apex (Salesforce) language support. Apex
  source surfaces as unknown symbols, so Salesforce codebases cannot be parsed, graphed,
  or queried the way GitNexus's other supported languages can.

- **Desired outcome:** GitNexus parses and graphs Apex as a first-class supported
  language — on par with its existing languages — so Apex classes resolve into the
  knowledge graph (classes, methods, references) like any other supported language.

- **Acceptance condition:** Apex classes no longer report unknown symbols — Apex
  source resolves into the graph rather than producing unresolved/skipped references.
  (Operationally, the scope-resolution reference→edge bridge reports no skipped
  references for in-scope Apex symbols; the precise scope of "in-scope" is settled in
  deliberation and recorded in the SRS.)

- **Requesting stakeholder / Architect:** Adam Daw.

- **Execution roles:** Builder — Claude (this session). Adversary — fresh-context agent
  per gate. Tracker — this repo's `.vsdd/` artifacts + the SRS traceability matrix.

- **Host project:** fork of `abhigyanpatwari/GitNexus` (`adamdaw/GitNexus`),
  PolyForm Noncommercial 1.0.0. Stack: TypeScript monorepo, tree-sitter, vitest.
