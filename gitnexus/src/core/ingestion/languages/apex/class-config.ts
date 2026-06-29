/**
 * Apex class/type extraction config (SDD-001 §1, REQ-002).
 *
 * Mirrors the JVM config but enables `qualifiedNodeId` so nested types resolve
 * to qualified ids (`Outer.Inner`) — REQ-002 models nested-type membership by
 * id-qualification, not a containment edge. `trigger_declaration` is treated as
 * a class-like container (label Class; the trigger discriminant lives in the
 * provider's node-property hook, not here).
 */

import { SupportedLanguages } from 'gitnexus-shared';
import type { ClassExtractionConfig } from '../../class-types.js';

const APEX_TYPE_NODES = [
  'class_declaration',
  'interface_declaration',
  'enum_declaration',
  'trigger_declaration',
];

export const apexClassConfig: ClassExtractionConfig = {
  language: SupportedLanguages.Apex,
  typeDeclarationNodes: APEX_TYPE_NODES,
  // Apex has no package/namespace declaration — file path qualifies top-level ids.
  ancestorScopeNodeTypes: APEX_TYPE_NODES,
  // REQ-002: nested types are keyed Outer.Inner via the host qualified-id path.
  qualifiedNodeId: true,
  extractType(node) {
    if (node.type === 'interface_declaration') return 'Interface';
    if (node.type === 'enum_declaration') return 'Enum';
    // class_declaration and trigger_declaration are both Class containers.
    return 'Class';
  },
  // REQ-004: a trigger is captured under the shared @definition.class label;
  // distinguish it by node type with a marker property (Constitution §2.1 —
  // no shared NodeLabel for an Apex concept).
  extractProperties(node) {
    return node.type === 'trigger_declaration' ? { apexConstruct: 'trigger' } : undefined;
  },
};
