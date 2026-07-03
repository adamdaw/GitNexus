/**
 * Apex cross-file implicit type visibility (WI-3 / SDD-003 §3).
 *
 * Apex types are visible across files in a namespace with no `import` — so, like
 * C#'s global namespace, top-level user-defined types are injected into the shared
 * `workspaceFqnBindings` channel by folded simple name. `lookupBindingsAt` consults
 * that channel (finalized → augmented → namespace → workspace), so every WI-2
 * resolution mechanic reaches cross-file once the type name is registered here.
 *
 * This is PURE REGISTRATION — no new pipeline stage, no shared-code edit, no new
 * seam (Constitution §2). The selection/fold is a standalone pure helper
 * (`computeApexNamespaceBindings`); the hook is the effectful shell that performs
 * the sanctioned post-finalize append, exactly as `populateCsharpNamespaceSiblings`
 * does (`csharp/namespace-siblings.ts:639/688`).
 *
 * §3 algorithm:
 *   - universe = every class-like def (`Class`/`Interface`/`Enum`, Predicate 1) owned
 *     by a Module-parented `Class`-kind scope (Predicate 2, the OWNING-SCOPE
 *     discriminant — the Java package-siblings shape, `java/package-siblings.ts:95-105`,
 *     but taking EVERY class-like def, not Java's first), MINUS `.trigger`-filed defs
 *     (case-folded extension filter, applied BEFORE grouping so a trigger contributes
 *     no folded key to the collision count);
 *   - group by `normalizeIdentifier`-folded `qualifiedName` (Apex fold = lower-case);
 *   - inject `{ def, origin: 'namespace' }` iff the key has exactly ONE distinct
 *     `nodeId` (conservative inject-none on collision — the key is never created, so a
 *     colliding reference falls through to REQ-015-unresolved, never mis-bound).
 */

import type { BindingRef, ParsedFile, SymbolDefinition } from 'gitnexus-shared';
import type { ScopeResolutionIndexes } from '../../model/scope-resolution-indexes.js';

/** Predicate 1 — inject only the three Apex type-declaration kinds, never a
 *  member (Method/Property/Field/enum-constant); a member in `workspaceFqnBindings`
 *  could let `new foo()` mis-bind to a method (SDD-003 §3, [structural]). */
function isApexTypeDef(type: string): boolean {
  return type === 'Class' || type === 'Interface' || type === 'Enum';
}

/** The `.trigger` exclusion, compared case-folded — the host classifies extensions
 *  case-insensitively (`language-detection.ts:88`), and defs reach the hook with a
 *  case-preserved `filePath`, so a literal `endsWith('.trigger')` would mis-classify
 *  `T.TRIGGER`. A trigger is a referencing container, never a referenced type. */
function isTriggerFiled(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.trigger');
}

/** The Apex `normalizeIdentifier` fold (§2.2 seam; Apex = lower-case, matching
 *  `apexProvider.normalizeIdentifier`). Kept in sync with that provider field. */
function foldIdentifier(name: string): string {
  return name.toLowerCase();
}

/**
 * PURE selection + fold (SDD-003 §3 purity boundary). Returns the folded-key →
 * winning-def map: exactly one entry per key that has a single distinct `nodeId`
 * across the whole workspace; colliding keys (>1 distinct nodeId) are absent.
 */
export function computeApexNamespaceBindings(
  parsedFiles: readonly ParsedFile[],
): Map<string, SymbolDefinition> {
  // Group the def universe by folded key, deduping by nodeId within each key (a def
  // seen twice by nodeId is one def, not a collision — e.g. a re-emitted declaration).
  const byKey = new Map<string, Map<string, SymbolDefinition>>();

  for (const parsed of parsedFiles) {
    const moduleScopeId = parsed.scopes.find((s) => s.kind === 'Module')?.id;
    if (moduleScopeId === undefined) continue;
    for (const scope of parsed.scopes) {
      if (scope.kind !== 'Class') continue; // all Apex type-decl kinds → @scope.class
      if (scope.parent !== moduleScopeId) continue; // Predicate 2: top-level only
      for (const def of scope.ownedDefs) {
        if (!isApexTypeDef(def.type)) continue; // Predicate 1
        if (isTriggerFiled(def.filePath)) continue; // .trigger exclusion, before grouping
        const qn = def.qualifiedName;
        if (qn === undefined || qn === '') continue;
        const key = foldIdentifier(qn);
        let group = byKey.get(key);
        if (group === undefined) {
          group = new Map();
          byKey.set(key, group);
        }
        if (!group.has(def.nodeId)) group.set(def.nodeId, def);
      }
    }
  }

  const winners = new Map<string, SymbolDefinition>();
  for (const [key, group] of byKey) {
    if (group.size !== 1) continue; // inject-none on collision — key never created
    winners.set(key, group.values().next().value as SymbolDefinition);
  }
  return winners;
}

/**
 * The effectful hook (registered as `populateNamespaceSiblings` on the Apex scope
 * resolver). Appends each pure-selected top-level type into `workspaceFqnBindings`
 * under its folded simple name. The ReadonlyMap→Map cast is localized here, matching
 * the append-only contract of this channel (validateBindingsImmutability).
 *
 * `_ctx` is unused: selection is a read over `ParsedFile.scopes` alone — no file
 * content or tree-sitter re-parse is needed (the discriminant is the read-verifiable
 * owning-scope shape, not an AST fact).
 */
export function populateApexNamespaceSiblings(
  parsedFiles: readonly ParsedFile[],
  indexes: ScopeResolutionIndexes,
  _ctx: {
    readonly fileContents: ReadonlyMap<string, string>;
    readonly treeCache?: { get(filePath: string): unknown };
    readonly resolutionConfig?: unknown;
  },
): void {
  const workspace = indexes.workspaceFqnBindings as Map<string, BindingRef[]>;
  for (const [key, def] of computeApexNamespaceBindings(parsedFiles)) {
    let bucket = workspace.get(key);
    if (bucket === undefined) {
      bucket = [];
      workspace.set(key, bucket);
    }
    bucket.push({ def, origin: 'namespace' });
  }
}
