/**
 * Synthesize `@type-binding.self` captures for Apex instance methods —
 * one for `this` (always on non-static methods inside a type declaration)
 * and optionally one for `super` (only on class methods when the enclosing
 * class declares a `superclass`).
 *
 * Mirrors `languages/java/receiver-binding.ts`; the Apex grammar is
 * Java-derived so the node shapes match. Apex deltas: no `record_declaration`
 * (dropped), and modifier matching is case-insensitive (Apex keywords preserve
 * source case), so static detection routes through `apexHasModifier`.
 */

import type { Capture, CaptureMatch } from 'gitnexus-shared';
import { nodeToCapture, syntheticCapture, type SyntaxNode } from '../../utils/ast-helpers.js';
import { apexHasModifier } from './modifiers.js';

const TYPE_DECL_NODE_TYPES = new Set([
  'class_declaration',
  'interface_declaration',
  'enum_declaration',
  'trigger_declaration',
]);

const FUNCTION_NODE_TYPES = new Set(['method_declaration', 'constructor_declaration']);

/** Walk up to the enclosing type declaration. */
function findEnclosingTypeDeclaration(node: SyntaxNode): SyntaxNode | null {
  let cur: SyntaxNode | null = node.parent;
  while (cur !== null) {
    if (TYPE_DECL_NODE_TYPES.has(cur.type)) return cur;
    cur = cur.parent;
  }
  return null;
}

function typeName(typeNode: SyntaxNode): string | null {
  return typeNode.childForFieldName('name')?.text ?? null;
}

/** First superclass text. The Apex grammar uses a `superclass` field wrapping a
 *  `type_identifier` (Java-derived). */
function firstSuperclassText(typeNode: SyntaxNode): string | null {
  const superclass = typeNode.childForFieldName('superclass');
  if (superclass === null) return null;
  for (let i = 0; i < superclass.namedChildCount; i++) {
    const child = superclass.namedChild(i);
    if (child !== null && (child.type === 'type_identifier' || child.type === 'generic_type')) {
      return child.text;
    }
  }
  return null;
}

export function synthesizeApexReceiverBinding(fnNode: SyntaxNode): CaptureMatch[] {
  if (!FUNCTION_NODE_TYPES.has(fnNode.type)) return [];
  if (apexHasModifier(fnNode, 'static')) return [];

  const enclosingType = findEnclosingTypeDeclaration(fnNode);
  if (enclosingType === null) return [];

  const enclosingName = typeName(enclosingType);
  if (enclosingName === null) return [];

  // Anchor to the method body so the synthesized captures are inside
  // the function scope.
  const anchorNode = fnNode.childForFieldName('body');
  if (anchorNode === null) return [];

  const out: CaptureMatch[] = [];
  out.push(buildReceiverMatch(anchorNode, 'this', enclosingName));

  // `super` applies only to class methods with an explicit superclass.
  if (enclosingType.type === 'class_declaration') {
    const superText = firstSuperclassText(enclosingType);
    if (superText !== null) {
      out.push(buildReceiverMatch(anchorNode, 'super', superText));
    }
  }

  return out;
}

function buildReceiverMatch(anchorNode: SyntaxNode, name: string, typeText: string): CaptureMatch {
  const m: Record<string, Capture> = {
    '@type-binding.self': nodeToCapture('@type-binding.self', anchorNode),
    '@type-binding.name': syntheticCapture('@type-binding.name', anchorNode, name),
    '@type-binding.type': syntheticCapture('@type-binding.type', anchorNode, typeText),
  };
  return m;
}
