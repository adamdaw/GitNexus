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
import type {
  DottedHeritageBaseResolution,
  ScopeResolutionIndexes,
} from '../../model/scope-resolution-indexes.js';

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
      // Predicate 2 (owning-scope discriminant): a top-level type is owned by a
      // Module-parented Class-kind scope (§3), keyed by its BARE folded name. A
      // NESTED type (§7(5)/(13) qualified-nested fallback) is owned by a
      // Class-parented Class-kind scope; its `qualifiedName` is already dotted
      // (`Outer.Inner`), so the SAME fold-of-qualifiedName keys it under a DOTTED
      // key (`outer.inner`) — never a bare key, so a bare `new Inner()` still
      // misses (REQ-015) and only a qualified `Outer.Inner` reference reaches it
      // via `findClassBindingInScope`'s folded workspace consult (before the
      // dotted-tail decoy fallback). Both are pure registration under one key rule.
      const nested = scope.parent !== moduleScopeId;
      for (const def of scope.ownedDefs) {
        if (!isApexTypeDef(def.type)) continue; // Predicate 1
        if (isTriggerFiled(def.filePath)) continue; // .trigger exclusion, before grouping
        const qn = def.qualifiedName;
        if (qn === undefined || qn === '') continue;
        // A top-level type's qualifiedName is its bare simple name; a nested
        // type's is the dotted `Outer.Inner` path (both verified via the parsed
        // owned-def shape). Folding both keeps top-level bare / nested dotted.
        if (nested && !qn.includes('.')) continue; // defensive: a nested def must be qualified
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
/**
 * Return the unique class-like workspace type for a folded key, or `undefined`
 * when the key is absent (external / inject-none-suppressed collision) or does
 * not hold exactly one type def. `computeApexNamespaceBindings` injects at most
 * one ref per folded key (inject-none on collision), so a populated bucket is a
 * single entry; the length guard is defensive.
 */
export function uniqueWorkspaceType(
  foldedKey: string,
  scopes: ScopeResolutionIndexes,
): SymbolDefinition | undefined {
  const bucket = scopes.workspaceFqnBindings.get(foldedKey);
  if (bucket === undefined || bucket.length !== 1) return undefined;
  const def = bucket[0]!.def;
  return isApexTypeDef(def.type) ? def : undefined;
}

/**
 * The Apex dotted-heritage-base seam (SDD-004 §1(2)) — registered as
 * `resolveDottedHeritageBase` and consulted at the top of
 * `resolveInheritanceBaseInScope` for `extends`/`implements Outer.Inner`.
 * Resolves OUTER-first through the folded `workspaceFqnBindings` channel that
 * `populateApexNamespaceSiblings` fills (nested types are injected under the
 * folded DOTTED key `outer.inner`), so no dotted base ever reaches the shared
 * dotted-tail fallback that binds a same-tail top-level decoy (BL-3/BL-4).
 *
 * Three states (§1(2)):
 *   - non-dotted base → `pass-through` (the simple-name discharge lives on the
 *     unchanged channel);
 *   - >2 segments (`ns.Outer.Inner`) — Apex nesting is one level deep, so this
 *     is a managed-package namespace-qualified external → `refuse`;
 *   - a two-segment `Outer.Inner`: `refuse` unless BOTH the OUTER folds to a
 *     unique workspace type (0 candidates = external / absent / case-collided
 *     inject-none) AND the folded full key binds a unique nested type
 *     (absent = typo/near-miss tail, ambiguous = inject-none) — else `resolved`.
 * Every dotted base returns `resolved` or `refuse` (never `pass-through`), so
 * the decoy-prone tail fallback is unreachable for a dotted base. Case-folding
 * (REQ-005) rides the same fold the injection used, so `HOUTER.HInner` resolves.
 */
export function resolveApexDottedHeritageBase(
  baseName: string,
  scopes: ScopeResolutionIndexes,
): DottedHeritageBaseResolution {
  const segments = baseName.split('.');
  if (segments.length < 2) return { kind: 'pass-through' };
  if (segments.length > 2) return { kind: 'refuse' };
  if (uniqueWorkspaceType(foldIdentifier(segments[0]!), scopes) === undefined) {
    return { kind: 'refuse' };
  }
  const nested = uniqueWorkspaceType(foldIdentifier(baseName), scopes);
  return nested === undefined ? { kind: 'refuse' } : { kind: 'resolved', def: nested };
}

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
