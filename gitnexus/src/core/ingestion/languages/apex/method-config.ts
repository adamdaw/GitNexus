/**
 * Apex method/constructor extraction config (SDD-001 §1, REQ-003/REQ-014).
 *
 * Covers BOTH `method_declaration` and `constructor_declaration` so constructor
 * annotations (REQ-014) and constructor overloads (REQ-003) flow through the same
 * path as methods. Parameter `rawType` is the `formal_parameter.type` node's source
 * text — the host's `typeTagForId` builds the overload-disambiguating id segment
 * from it (`~List<Account>` etc.), giving type-only overloads distinct ids.
 */

import { SupportedLanguages } from 'gitnexus-shared';
import type {
  MethodExtractionConfig,
  ParameterInfo,
  MethodVisibility,
} from '../../method-types.js';
import { extractSimpleTypeName } from '../../type-extractors/shared.js';
import type { SyntaxNode } from '../../utils/ast-helpers.js';
import { extractApexAnnotations } from './annotations.js';
import { apexFindVisibility, apexHasModifier } from './modifiers.js';

const APEX_VIS = new Set<MethodVisibility>(['public', 'private', 'protected']);
const INTERFACE_OWNER_TYPES = new Set(['interface_declaration']);

function extractApexParameters(node: SyntaxNode): ParameterInfo[] {
  const params: ParameterInfo[] = [];
  const paramList = node.childForFieldName('parameters');
  if (!paramList) return params;
  for (let i = 0; i < paramList.namedChildCount; i++) {
    const param = paramList.namedChild(i);
    if (param?.type !== 'formal_parameter') continue;
    const nameNode = param.childForFieldName('name');
    const typeNode = param.childForFieldName('type');
    if (!nameNode) continue;
    params.push({
      name: nameNode.text,
      type: typeNode ? (extractSimpleTypeName(typeNode) ?? typeNode.text?.trim()) : null,
      rawType: typeNode?.text?.trim() ?? null,
      isOptional: false,
      isVariadic: false,
    });
  }
  return params;
}

export const apexMethodConfig: MethodExtractionConfig = {
  language: SupportedLanguages.Apex,
  typeDeclarationNodes: [
    'class_declaration',
    'interface_declaration',
    'enum_declaration',
    'trigger_declaration',
  ],
  methodNodeTypes: ['method_declaration', 'constructor_declaration'],
  bodyNodeTypes: ['class_body', 'interface_body', 'enum_body', 'trigger_body'],

  extractName(node) {
    return node.childForFieldName('name')?.text;
  },

  extractReturnType(node) {
    return node.childForFieldName('type')?.text?.trim();
  },

  extractParameters: extractApexParameters,

  extractVisibility(node) {
    return apexFindVisibility(node, APEX_VIS, 'private');
  },

  isStatic(node) {
    return apexHasModifier(node, 'static');
  },

  isAbstract(node, ownerNode) {
    if (apexHasModifier(node, 'abstract')) return true;
    // Interface methods are implicitly abstract (no body).
    if (INTERFACE_OWNER_TYPES.has(ownerNode.type)) {
      return !node.childForFieldName('body');
    }
    return false;
  },

  isFinal(node) {
    return apexHasModifier(node, 'final');
  },

  extractAnnotations: extractApexAnnotations,
};
