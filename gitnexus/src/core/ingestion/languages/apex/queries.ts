/**
 * Apex tree-sitter capture queries (SDD-001 §3).
 *
 * Apex's grammar (vendored ABI-14 regeneration of aheber/tree-sitter-sfapex)
 * is Java-derived, so the node shapes mirror tree-sitter-java: typed
 * declarations with a `name` field, `field_declaration` carrying one or more
 * `variable_declarator` children, `formal_parameter` with a `type` field, and
 * `modifiers > annotation`. The capture-name suffix maps to a NodeLabel via the
 * host `getLabelFromCaptures` convention (`@definition.class` → Class, etc.).
 *
 * Two Apex-specific shapes:
 *  - `trigger_declaration` shares the `@definition.class` capture with classes
 *    (REQ-004 discriminant); the provider stamps `apexConstruct='trigger'` by
 *    node type, never by the capture.
 *  - a field's `@definition.property` capture sits on each **variable_declarator**
 *    (not the shared `field_declaration`) so every declarator of a multi-declarator
 *    field gets its OWN start/end line range (REQ-003), and `enum_constant`
 *    is captured as a member `Property` via its uniform `name` field.
 */
export const APEX_QUERIES = `
; Types — class, interface, enum, and (REQ-004) trigger sharing @definition.class
(class_declaration name: (identifier) @name) @definition.class
(interface_declaration name: (identifier) @name) @definition.interface
(enum_declaration name: (identifier) @name) @definition.enum
(trigger_declaration name: (identifier) @name) @definition.class

; Methods & constructors
(method_declaration name: (identifier) @name) @definition.method
(constructor_declaration name: (identifier) @name) @definition.constructor

; Fields & auto-properties — one match per declarator so each member carries
; its own line range; @definition.property sits on the variable_declarator.
(field_declaration
  (variable_declarator
    name: (identifier) @name) @definition.property)

; Enum constants — members of their Enum (uniform name field)
(enum_constant name: (identifier) @name) @definition.property
`;
