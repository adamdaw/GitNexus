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
import { populateApexNamespaceSiblings } from './namespace-siblings.js';

const apexScopeResolver: ScopeResolver = {
  language: SupportedLanguages.Apex,
  languageProvider: apexProvider,
  importEdgeReason: 'apex-scope: import',

  resolveImportTarget: () => null,

  // WI-3 (SDD-003 §3): cross-file type visibility via pure registration — inject
  // top-level user-defined types into the shared `workspaceFqnBindings` channel so
  // every WI-2 resolution mechanic reaches across files.
  populateNamespaceSiblings: populateApexNamespaceSiblings,

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
  // SDD-003 §3: a declaration-only interface-typed call (`Iface v; v.act()`)
  // targets ONLY the interface's own member — the concrete implementation is
  // unknown without a runtime type, so the generic implementer-fanout would
  // over-connect. Opt out of the secondary interface-dispatch edges.
  emitInterfaceDispatch: false,
};

export { apexScopeResolver };
