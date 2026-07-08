/**
 * Apex field/property extraction config (SDD-001 §1, REQ-003).
 *
 * Apex fields and auto-properties both parse as `field_declaration` (no distinct
 * `property_declaration` node — RESEARCH-001 addendum), so a single config covers
 * both. `extractNames` enumerates every `variable_declarator` so a multi-declarator
 * field (`Integer a, b, c;`) enriches each resulting Property node.
 *
 * This config drives *metadata enrichment* (type/visibility/static/readonly). The
 * Property NODES themselves (and their own line ranges) are emitted by the query
 * captures in the worker; `isExported` comes from the Apex exportChecker, not here.
 */

import { SupportedLanguages } from 'gitnexus-shared';
import type { FieldExtractionConfig } from '../../field-extractors/generic.js';
import { typeFromField } from '../../field-extractors/configs/helpers.js';
import type { FieldVisibility } from '../../field-types.js';
import type { SyntaxNode } from '../../utils/ast-helpers.js';
import { extractApexAnnotations } from './annotations.js';
import { apexFindVisibility, apexHasModifier } from './modifiers.js';

const APEX_VIS = new Set<FieldVisibility>(['public', 'private', 'protected']);

function declaratorNames(node: SyntaxNode): string[] {
  const names: string[] = [];
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (child?.type === 'variable_declarator') {
      const name = child.childForFieldName('name');
      if (name?.text) names.push(name.text);
    }
  }
  return names;
}

export const apexFieldConfig: FieldExtractionConfig = {
  language: SupportedLanguages.Apex,
  typeDeclarationNodes: [
    'class_declaration',
    'interface_declaration',
    'enum_declaration',
    'trigger_declaration',
  ],
  fieldNodeTypes: ['field_declaration'],
  bodyNodeTypes: ['class_body', 'interface_body', 'enum_body', 'trigger_body'],
  // Apex class members default to private.
  defaultVisibility: 'private',

  // Required hook, but the factory prefers `extractNames`, so this only serves a
  // single-name caller; the first declarator name is that name.
  extractName(node) {
    return declaratorNames(node)[0];
  },

  extractNames: declaratorNames,

  extractType(node) {
    // The grammar guarantees a `field_declaration` has a `type` field.
    return typeFromField(node, 'type');
  },

  extractVisibility(node) {
    return apexFindVisibility(node, APEX_VIS, 'private');
  },

  isStatic(node) {
    return apexHasModifier(node, 'static');
  },

  isReadonly(node) {
    return apexHasModifier(node, 'final');
  },

  // REQ-014: a field_declaration's shared modifiers carry to every declarator,
  // so each multi-declarator member inherits the same annotations.
  extractAnnotations: extractApexAnnotations,
};
