/**
 * Tree-sitter query for Apex scope captures (SDD-002 §1/§3, WI-2).
 *
 * Apex's grammar (vendored ABI-14 regeneration of aheber/tree-sitter-sfapex) is
 * Java-derived, so this query mirrors `languages/java/query.ts`'s
 * `JAVA_SCOPE_QUERY` node-for-node. The Apex-specific deltas (RESEARCH-001
 * reference-grammar addendum):
 *
 *   - Root node is `parser_output` (Java's is `program`).
 *   - NO imports / NO packages — every `import_declaration` pattern is removed.
 *   - Apex has no `record_declaration` / `annotation_type_declaration`
 *     (removed), and adds `trigger_declaration` as a class-like scope.
 *   - Apex locals are ALWAYS explicitly typed — no `var` inference — so every
 *     Java `var` type-binding pattern is dropped.
 *   - Apex has no `::` method references and no qualified `new pkg.Foo()` —
 *     those patterns are dropped (some reference grammar node types absent).
 *
 * Everything else is kept verbatim: scopes, declarations, type-bindings, and
 * the `@reference.call.{free,member,constructor}` / `@reference.read/write.member`
 * captures. Inheritance (`extends`/`implements`) and `this()`/`super()`
 * delegation are NOT in the query — they are synthesized in `captures.ts`.
 *
 * Exposes lazy `Parser` and `Query` singletons so callers don't pay tree-sitter
 * init cost per file. The grammar is vendored + optional, so it is loaded lazily
 * via `getLanguageGrammar` (never a top-level `import`) — a static import would
 * crash `analyze` on a platform without the Apex prebuild even for repos with no
 * Apex files (mirrors `languages/kotlin/query.ts`).
 */

import Parser from 'tree-sitter';
import { SupportedLanguages } from 'gitnexus-shared';
import { getLanguageGrammar } from '../../../tree-sitter/parser-loader.js';

const APEX_SCOPE_QUERY = `
;; Scopes
(parser_output) @scope.module

(class_declaration) @scope.class
(interface_declaration) @scope.class
(enum_declaration) @scope.class
(trigger_declaration) @scope.class

(method_declaration) @scope.function
(constructor_declaration) @scope.function

;; Declarations — types
(class_declaration
  name: (identifier) @declaration.name) @declaration.class

(interface_declaration
  name: (identifier) @declaration.name) @declaration.interface

(enum_declaration
  name: (identifier) @declaration.name) @declaration.enum

(trigger_declaration
  name: (identifier) @declaration.name) @declaration.class

;; Declarations — methods / constructors
(method_declaration
  name: (identifier) @declaration.name) @declaration.method

(constructor_declaration
  name: (identifier) @declaration.name) @declaration.constructor

;; Declarations — fields
(field_declaration
  declarator: (variable_declarator
    name: (identifier) @declaration.name)) @declaration.variable

;; Declarations — local variables
(local_variable_declaration
  declarator: (variable_declarator
    name: (identifier) @declaration.name)) @declaration.variable

;; Declarations — enum constants (SDD-003 §3 static-receiver enum-constant
;; synthesis). Registers each constant as a Property of the enclosing enum
;; scope so \`Color.RED\` resolves via the static-type-name-receiver member
;; lookup (findOwnedMember). Apex-local divergence from java/query.ts, which
;; omits enum constants from scope resolution — an Apex committed fallback.
(enum_constant
  name: (identifier) @declaration.name) @declaration.variable

;; Type bindings — parameter annotations: void f(Account a)
(formal_parameter
  type: (type_identifier) @type-binding.type
  name: (identifier) @type-binding.name) @type-binding.parameter

(formal_parameter
  type: (generic_type) @type-binding.type
  name: (identifier) @type-binding.name) @type-binding.parameter

(formal_parameter
  type: (scoped_type_identifier) @type-binding.type
  name: (identifier) @type-binding.name) @type-binding.parameter

;; Type bindings — local variable annotations: Account a = new Account();
(local_variable_declaration
  type: (type_identifier) @type-binding.type
  declarator: (variable_declarator
    name: (identifier) @type-binding.name)) @type-binding.annotation

(local_variable_declaration
  type: (generic_type) @type-binding.type
  declarator: (variable_declarator
    name: (identifier) @type-binding.name)) @type-binding.annotation

;; Type bindings — field declarations: private Account acct;
(field_declaration
  type: (type_identifier) @type-binding.type
  declarator: (variable_declarator
    name: (identifier) @type-binding.name)) @type-binding.annotation

(field_declaration
  type: (generic_type) @type-binding.type
  declarator: (variable_declarator
    name: (identifier) @type-binding.name)) @type-binding.annotation

;; Type bindings — method return type: public Account getAccount() { }
(method_declaration
  type: (type_identifier) @type-binding.type
  name: (identifier) @type-binding.name) @type-binding.return

(method_declaration
  type: (generic_type) @type-binding.type
  name: (identifier) @type-binding.name) @type-binding.return

;; Type bindings — enhanced for: for (Account a : list)
(enhanced_for_statement
  type: (type_identifier) @type-binding.type
  name: (identifier) @type-binding.name) @type-binding.annotation

(enhanced_for_statement
  type: (generic_type) @type-binding.type
  name: (identifier) @type-binding.name) @type-binding.annotation

;; NOTE (SDD-002 clarification 2026-06-30): a plain declared type (\`Account a;\`)
;; is NOT captured as a standalone @reference.type. No benchmark language emits a
;; USES edge for a bare declaration; the declared type IS captured above as a
;; @type-binding (driving receiver typing), which is how REQ-005 "type usage"
;; resolution is exercised. A standalone USES edge would exceed parity.

;; References — all method calls: foo() and obj.method()
;; tree-sitter's query engine drops negation-based \`!object\` patterns when a
;; positive \`object:\` pattern exists for the same node type, so we match all
;; calls here and classify free vs member in captures.ts based on the presence
;; of @reference.receiver.
(method_invocation
  object: (_) @reference.receiver
  name: (identifier) @reference.name) @reference.call.member

(method_invocation
  name: (identifier) @reference.name) @reference.call.free

;; References — constructor calls: new Account(...)
(object_creation_expression
  type: (type_identifier) @reference.name) @reference.call.constructor

(object_creation_expression
  type: (generic_type
    (type_identifier) @reference.name)) @reference.call.constructor

;; Qualified nested constructor: new Outer.Inner() (SDD-003 §7(5)/(13)). The type
;; is a \`scoped_type_identifier\` (not a plain \`type_identifier\`); capture the WHOLE
;; scoped node as @reference.name so \`site.name\` is the dotted \`Outer.Inner\`, which
;; \`findClassBindingInScope\` folds (\`outer.inner\`) and resolves against the nested
;; type injected into \`workspaceFqnBindings\` (namespace-siblings), before the
;; dotted-tail decoy fallback. The emitted edge target is the resolved def's simple
;; name (\`Inner\`). Apex-local: java/query.ts assumes no qualified \`new pkg.Foo()\`.
(object_creation_expression
  type: (scoped_type_identifier) @reference.name) @reference.call.constructor

;; References — field/property writes: obj.name = 'x'
(assignment_expression
  left: (field_access
    object: (_) @reference.receiver
    field: (identifier) @reference.name)) @reference.write.member

;; References — field/property reads: obj.name
(field_access
  object: (_) @reference.receiver
  field: (identifier) @reference.name) @reference.read.member
`;

let _parser: Parser | null = null;
let _query: Parser.Query | null = null;

export function getApexParser(): Parser {
  if (_parser === null) {
    _parser = new Parser();
    _parser.setLanguage(
      getLanguageGrammar(SupportedLanguages.Apex) as Parameters<Parser['setLanguage']>[0],
    );
  }
  return _parser;
}

export function getApexScopeQuery(): Parser.Query {
  if (_query === null) {
    _query = new Parser.Query(
      getLanguageGrammar(SupportedLanguages.Apex) as Parameters<Parser['setLanguage']>[0],
      APEX_SCOPE_QUERY,
    );
  }
  return _query;
}
