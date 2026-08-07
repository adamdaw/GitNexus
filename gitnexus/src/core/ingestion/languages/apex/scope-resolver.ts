/**
 * Apex `ScopeResolver` registered in `SCOPE_RESOLVERS` and consumed by the
 * generic `runScopeResolution` orchestrator (RFC #909 Ring 3; SDD-002 §1/§3).
 *
 * Minimal adapter: Apex resolves via the scope-resolution registry, supplying
 * the nine required fields. Apex has NO imports (cross-file reach is WI-3), so
 * `resolveImportTarget` returns null and `mergeBindings` is a plain concat. Apex
 * has single class inheritance, so the MRO is the default linearization. Toggles:
 * `fieldFallbackOnMethodLookup:false` (Apex is statically typed — the heuristic
 * over-connects) and `propagatesReturnTypesAcrossImports:false` (no imports).
 */

import type { ParsedFile } from 'gitnexus-shared';
import { SupportedLanguages } from 'gitnexus-shared';
import { buildMro, defaultLinearize } from '../../scope-resolution/passes/mro.js';
import { populateClassOwnedMembers } from '../../scope-resolution/scope/walkers.js';
import type { ScopeResolver } from '../../scope-resolution/contract/scope-resolver.js';
import { apexProvider } from './index.js';
import { apexArityCompatibility, apexResolveReceiverMember } from './resolution.js';
import {
  populateApexNamespaceSiblings,
  resolveApexDottedHeritageBase,
} from './namespace-siblings.js';
import { gateApexParamArgTypes } from './param-arg-gate.js';

const apexScopeResolver: ScopeResolver = {
  language: SupportedLanguages.Apex,
  languageProvider: apexProvider,
  importEdgeReason: 'apex-scope: import',

  resolveImportTarget: () => null,

  // WI-3 (SDD-003 §3): cross-file type visibility via pure registration — inject
  // top-level user-defined types into the shared `workspaceFqnBindings` channel so
  // every WI-2 resolution mechanic reaches across files.
  populateNamespaceSiblings: populateApexNamespaceSiblings,

  // WI-4 (SDD-004 §1(1)): resolve heritage AFTER sibling registration so a
  // cross-file case-varied/nested `extends`/`implements` base reaches the
  // `workspaceFqnBindings` channel `populateNamespaceSiblings` fills (empty
  // until then). Discharges BL-1…BL-8. Peers keep today's order (flag unset).
  resolveHeritageAfterSiblings: true,

  // WI-4 (SDD-004 §1(2)): the dotted-heritage-base seam. Resolves `extends
  // Outer.Inner` OUTER-first through the folded workspace channel so a nested
  // parent binds the real nested type, never the same-tail top-level decoy
  // (BL-3/BL-4); refuses on an external/collided outer or absent/ambiguous tail.
  resolveDottedHeritageBase: resolveApexDottedHeritageBase,

  // WI-4 (SDD-004 §1(3)): gate parameter-typed-argument overload narrowing on a
  // decoy-safe user-defined oracle. Capture tags param-sourced arg-type slots;
  // this resolution-phase pass (after sibling registration, before reference
  // resolution) rewrites each to its canonical user-defined type or blanks it
  // (external/tie → arity-only), so an external param type never mis-narrows.
  populateRangeBindings: gateApexParamArgTypes,

  mergeBindings: (existing, incoming) => [...existing, ...incoming],

  arityCompatibility: (callsite, def) => apexArityCompatibility(def, callsite),

  // REQ-015: a case-only member collision (two members folding to one key) is
  // ambiguous → recorded unresolved, never first-matched.
  resolveReceiverMember: apexResolveReceiverMember,

  buildMro: (graph, parsedFiles, nodeLookup) =>
    buildMro(graph, parsedFiles, nodeLookup, defaultLinearize),

  populateOwners: (parsed: ParsedFile) => populateClassOwnedMembers(parsed),

  isSuperReceiver: (text) => text.trim() === 'super',

  fieldFallbackOnMethodLookup: false,
  propagatesReturnTypesAcrossImports: false,
  // REQ-015: an undisambiguable overloaded call is left UNRESOLVED, never
  // guessed (no exact-type match → no edge), rather than the host best-guess.
  conservativeOverloadResolution: true,
  // REQ-005/007: an unqualified `inherited()` inside a subclass resolves to the
  // cross-file parent's member via the class's MRO (Apex has ordinary single
  // inheritance; there is no C++-style dependent-base two-phase lookup to guard).
  resolveInheritedImplicitThisCall: true,
  // SDD-003 §3: a declaration-only interface-typed call (`Iface v; v.act()`)
  // targets ONLY the interface's own member — the concrete implementation is
  // unknown without a runtime type, so the generic implementer-fanout would
  // over-connect. Opt out of the secondary interface-dispatch edges.
  emitInterfaceDispatch: false,
  // Measured per the #2708 opt-in discipline: without this, the cross-file
  // `new Target().fLit(42)` receiver (REQ-008) drops to unresolved. Unlike Java,
  // Apex does not reach the shape through the #2564 object_creation_expression
  // capture rewrite, so the construction rule has to resolve `new` here.
  constructionSyntax: { keyword: 'new' },
};

export { apexScopeResolver };
