/**
 * Apex type-binding config (SDD-002 §3, WI-2 resolution).
 *
 * Apex's `local_variable_declaration` / `field_declaration` / `formal_parameter`
 * shapes are Java's (the grammar is Java-derived), so the extractors mirror
 * `type-extractors/jvm.ts`. Apex locals are ALWAYS explicitly typed (no `var`
 * inference), so `extractDeclaration` + `extractParameter` cover every binding —
 * no `extractInitializer` needed.
 *
 * Case-insensitivity (SDD-002 §2.2): Apex type names are case-insensitive, so the
 * bound type name is folded to lower case here. The class/interface/enum nodes are
 * registered under the same fold (the shared registration-table seam), so a binding
 * `ACCOUNT a` / `account a` both resolve the receiver `a` to the one `Account` type.
 * Variable names are case-preserving (no fixture varies a variable's case).
 */

import { type SyntaxNode } from '../../utils/ast-helpers.js';
import type { LanguageTypeConfig, TypeBindingExtractor, ParameterExtractor } from '../../type-extractors/types.js';
import { extractSimpleTypeName, extractVarName } from '../../type-extractors/shared.js';

/** Apex type names are case-insensitive — fold to the canonical lookup key. */
const foldType = (t: string): string => t.toLowerCase();

/** Apex: `Type x;` / `Type x = ...;` (one or more variable_declarator children). */
const extractApexDeclaration: TypeBindingExtractor = (
  node: SyntaxNode,
  env: Map<string, string>,
): void => {
  const typeNode = node.childForFieldName('type');
  if (!typeNode) return;
  const typeName = extractSimpleTypeName(typeNode);
  if (!typeName) return;
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (child?.type !== 'variable_declarator') continue;
    const nameNode = child.childForFieldName('name');
    if (nameNode) {
      const varName = extractVarName(nameNode);
      if (varName) env.set(varName, foldType(typeName));
    }
  }
};

/** Apex: `formal_parameter` → type name. */
const extractApexParameter: ParameterExtractor = (
  node: SyntaxNode,
  env: Map<string, string>,
): void => {
  const typeNode = node.childForFieldName('type');
  const nameNode = node.childForFieldName('name');
  if (!nameNode || !typeNode) return;
  const varName = extractVarName(nameNode);
  const typeName = extractSimpleTypeName(typeNode);
  if (varName && typeName) env.set(varName, foldType(typeName));
};

export const apexTypeConfig: LanguageTypeConfig = {
  declarationNodeTypes: new Set(['field_declaration', 'local_variable_declaration']),
  extractDeclaration: extractApexDeclaration,
  extractParameter: extractApexParameter,
};
