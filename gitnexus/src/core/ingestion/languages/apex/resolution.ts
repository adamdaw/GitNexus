/**
 * Apex Ring-3 resolution hooks (SDD-002 §1/§3, WI-2).
 *
 * Self-contained mirrors of the Java hooks (`languages/java/interpret.ts`,
 * `simple-hooks.ts`, `merge-bindings.ts`, `arity.ts`) — no Java internals are
 * imported (Constitution §2.1). The one Apex-specific change is in
 * `interpretApexTypeBinding`: the bound TYPE name is folded to lower case before
 * storing, because Apex class/type names are case-insensitive (SDD-002 §2.2
 * "class/type names folded Apex-locally"). The class/interface/enum nodes
 * register under the same fold (the shared `normalizeIdentifier` seam), so a
 * binding `ACCOUNT a` / `account a` both resolve the receiver `a` to the one
 * `Account` type. Variable names stay case-preserving (no fixture varies a
 * variable's case — the receiver-variable fold is deferred per the §2.2 ceiling).
 */

import type {
  BindingRef,
  Callsite,
  CaptureMatch,
  ParsedTypeBinding,
  Scope,
  SymbolDefinition,
  TypeRef,
} from 'gitnexus-shared';
import type { SemanticModel } from '../../model/semantic-model.js';
import type { ScopeResolutionIndexes } from '../../model/scope-resolution-indexes.js';
import type { ReceiverMemberResolution } from '../../scope-resolution/contract/scope-resolver.js';

/**
 * REQ-015: case-only member collision. Two members differing only in case fold
 * to one registry key (the §2.2 seam), so a case-varied access (`b.Value` against
 * `value` and `VALUE`) finds MORE THAN ONE field under the folded key — genuinely
 * ambiguous. Return `ambiguous` so the receiver-bound pass records it unresolved
 * (no edge, no mis-binding) rather than first-matching. A single field (the common
 * case) returns `undefined` to let the default resolution proceed unchanged.
 */
export function apexResolveReceiverMember(
  ownerDef: SymbolDefinition,
  memberName: string,
  _callsite: Callsite,
  _scopes: ScopeResolutionIndexes,
  model: SemanticModel,
): ReceiverMemberResolution | undefined {
  const fields = model.fields.lookupAllByOwner(ownerDef.nodeId, memberName);
  if (fields.length > 1) {
    return { kind: 'ambiguous', candidateIds: fields.map((f) => f.nodeId) };
  }
  return undefined;
}

// ─── interpretTypeBinding ─────────────────────────────────────────────────

export function interpretApexTypeBinding(captures: CaptureMatch): ParsedTypeBinding | null {
  const nameCap = captures['@type-binding.name'];
  const typeCap = captures['@type-binding.type'];
  if (nameCap === undefined || typeCap === undefined) return null;

  // Strip generics to the base name (SDD-002 §3: member lookup keys on the base
  // type, as `type-config.ts` does), strip the qualifier, then fold to lower case
  // — Apex type-name case-insensitivity (the WI-2-defining change). The fold aligns
  // with the registration-table classLikeHook fold so the binding key matches the
  // registered class key.
  const rawType = stripQualifier(stripGeneric(typeCap.text.trim())).toLowerCase();

  let source: TypeRef['source'] = 'parameter-annotation';
  if (captures['@type-binding.self'] !== undefined) source = 'self';
  else if (captures['@type-binding.constructor'] !== undefined) source = 'constructor-inferred';
  else if (captures['@type-binding.annotation'] !== undefined) source = 'annotation';
  else if (captures['@type-binding.return'] !== undefined) source = 'return-annotation';

  return { boundName: nameCap.text, rawTypeName: rawType, source };
}

/**
 * Strip generic type parameters to the base type name (`List<Account>` → `List`),
 * keying member lookup on the base type — matching SDD-002 §3 and the
 * `type-config.ts` declared-type extractor. Apex's only generics are the stdlib
 * collections (`List`/`Set`/`Map`), which are external (unresolved), so base-name
 * keying is conservative-correct: a stdlib member access stays unresolved rather
 * than mis-binding to an element type.
 */
function stripGeneric(text: string): string {
  const m = text.match(/^((?:[A-Za-z_$][A-Za-z0-9_$]*\.)*[A-Za-z_$][A-Za-z0-9_$]*)<.+>$/s);
  return m !== null ? m[1].trim() : text;
}

/** `System.Account` → `Account`. */
function stripQualifier(text: string): string {
  const lastDot = text.lastIndexOf('.');
  if (lastDot === -1) return text;
  return text.slice(lastDot + 1);
}

// Apex provides no `bindingScopeFor` hook: it does not hoist method return-type
// bindings to Module scope (the Java mechanism, gated by `hoistTypeBindingsToModule`,
// which Apex does not set). WI-2 REQ-009 resolves field/property chains via the
// field-access fixpoint, not return-type chains — so the hoist would be inert.
// Method-return-chain resolution, if ever wanted, is a WI-4 parity item.

// ─── mergeBindings (provider shape) ────────────────────────────────────────

/** Apex has no imports — bindings are local-only, so the merge is a plain
 *  concat (no shadowing-tier precedence to apply). The provider passes
 *  `(scope, bindings)`; the scope-resolver does its own concat for `(existing,
 *  incoming)`. */
export const apexMergeBindings = (
  _scope: Scope,
  bindings: readonly BindingRef[],
): readonly BindingRef[] => [...bindings];

// ─── arityCompatibility ────────────────────────────────────────────────────

/** Apex arity check (mirror `javaArityCompatibility`). Apex user methods take no
 *  optional/default params and no user varargs (A-WI2-1), so this reduces to a
 *  strict equal-arity comparison; the varargs branch stays for fidelity. */
export function apexArityCompatibility(
  def: SymbolDefinition,
  callsite: Callsite,
): 'compatible' | 'unknown' | 'incompatible' {
  const max = def.parameterCount;
  const min = def.requiredParameterCount;
  if (max === undefined && min === undefined) return 'unknown';

  const argCount = callsite.arity;
  if (!Number.isFinite(argCount) || argCount < 0) return 'unknown';

  const hasVarArgs =
    def.parameterTypes !== undefined &&
    def.parameterTypes.some((t) => t === 'varargs' || t.includes('...'));

  if (min !== undefined && argCount < min) return 'incompatible';
  if (max !== undefined && argCount > max && !hasVarArgs) return 'incompatible';

  return 'compatible';
}

// ─── receiverBinding ───────────────────────────────────────────────────────

/** Look up `this` or `super` in the function scope's type bindings (mirror
 *  `javaReceiverBinding`). */
export function apexReceiverBinding(functionScope: Scope): TypeRef | null {
  if (functionScope.kind !== 'Function') return null;
  return functionScope.typeBindings.get('this') ?? functionScope.typeBindings.get('super') ?? null;
}
