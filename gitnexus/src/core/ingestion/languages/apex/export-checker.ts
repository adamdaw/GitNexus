/**
 * Apex export (visibility) checker (SDD-001 §2, REQ-002 export semantics).
 *
 * Apex has no module-export concept; declared visibility is the analogue, and the
 * no-modifier default is context-dependent. The rule is total — every node falls
 * in exactly one bucket:
 *  - explicit `global`/`public`/`webservice` → exported; `protected`/`private` → not.
 *  - modifier-less implicitly-public contexts (interface members, enum constants) → exported.
 *  - modifier-less default-private contexts (class member, top-level/nested type, trigger) → not.
 *
 * `isExported` is the node's OWN visibility, not transitive referenceability — an
 * enum constant is exported even inside a `private` enum (owner-combination is WI-2/3).
 */

import type { ExportChecker } from '../../export-detection.js';
import type { SyntaxNode } from '../../utils/ast-helpers.js';

const DECLARATION_TYPES = new Set([
  'class_declaration',
  'interface_declaration',
  'enum_declaration',
  'trigger_declaration',
  'method_declaration',
  'constructor_declaration',
  'field_declaration',
  'enum_constant',
]);

const TYPE_DECLARATION_TYPES = new Set([
  'class_declaration',
  'interface_declaration',
  'enum_declaration',
  'trigger_declaration',
]);

/** Walk up to the nearest declaration node that carries (or contextualises) visibility. */
function nearestDeclaration(node: SyntaxNode): SyntaxNode | null {
  for (let cur: SyntaxNode | null = node; cur !== null; cur = cur.parent) {
    if (DECLARATION_TYPES.has(cur.type)) return cur;
  }
  return null;
}

/** The modifiers text directly on a declaration (a field's modifiers live on the
 *  field_declaration; a variable_declarator inherits them via its parent). */
function modifiersText(decl: SyntaxNode): string {
  for (let i = 0; i < decl.namedChildCount; i++) {
    const child = decl.namedChild(i);
    if (child?.type === 'modifiers') return child.text ?? '';
  }
  return '';
}

/** Is this declaration a member of an interface (implicitly public, no modifiers)? */
function isInterfaceMember(decl: SyntaxNode): boolean {
  for (let cur = decl.parent; cur !== null; cur = cur.parent) {
    if (cur.type === 'interface_declaration') return true;
    if (TYPE_DECLARATION_TYPES.has(cur.type)) return false;
  }
  return false;
}

export const apexExportChecker: ExportChecker = (node, _name) => {
  const decl = nearestDeclaration(node);
  if (!decl) return false;

  // Enum constants are modifier-less and implicitly public — own visibility is
  // always exported, independent of the enclosing enum's visibility.
  if (decl.type === 'enum_constant') return true;

  const modifiers = modifiersText(decl);
  if (/\b(global|public|webservice)\b/.test(modifiers)) return true;
  if (/\b(protected|private)\b/.test(modifiers)) return false;

  // No explicit modifier: interface members are implicitly public; everything
  // else (class member, top-level/nested type, trigger) defaults to private.
  if (decl.type === 'method_declaration' && isInterfaceMember(decl)) return true;
  return false;
};
