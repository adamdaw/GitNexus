/**
 * Shared Apex annotation extraction (REQ-014).
 *
 * Apex annotations are uniform across member kinds: `modifiers > annotation`,
 * with the name available via the `name` field (RESEARCH-001 probe3). Names are
 * normalised to `@Name` with arguments stripped (`@AuraEnabled(cacheable=true)`
 * → `@AuraEnabled`). Used by both the method-config (method/constructor) and the
 * field-config (field/auto-property) so the four REQ-014 member kinds share one
 * walk.
 */

import type { SyntaxNode } from '../../utils/ast-helpers.js';

export function extractApexAnnotations(node: SyntaxNode): string[] {
  const annotations: string[] = [];
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (child?.type !== 'modifiers') continue;
    for (let j = 0; j < child.namedChildCount; j++) {
      const mod = child.namedChild(j);
      if (mod && (mod.type === 'annotation' || mod.type === 'marker_annotation')) {
        const nameNode = mod.childForFieldName('name') ?? mod.firstNamedChild;
        if (nameNode?.text) annotations.push('@' + nameNode.text);
      }
    }
  }
  return annotations;
}
