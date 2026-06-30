/**
 * `emitScopeCaptures` for Apex (SDD-002 §1/§3, WI-2).
 *
 * Drives the Apex scope query against the vendored tree-sitter-apex grammar and
 * groups raw matches into `CaptureMatch[]` for the central scope extractor.
 * Self-contained mirror of `languages/java/captures.ts` (Constitution §2.1 — no
 * Java internals imported; helpers are copied here). Apex deltas vs Java:
 *
 *   - NO import decomposition (Apex has no imports) — that branch is dropped.
 *   - `var` type-binding resolution is inert (Apex locals are always explicitly
 *     typed) but `resolveVarTypeBindings` is kept for its argument-type patching.
 *   - Inheritance synth covers `class_declaration` (`superclass`/`interfaces`)
 *     and `interface_declaration` (`extends_interfaces`); `record_declaration`
 *     is dropped (absent in Apex).
 *
 * Layers retained: free-vs-member call classification, read.member suppression,
 * `this`/`super` receiver-binding synthesis, arity metadata, reference arity /
 * parameter-types / arg-names, `@reference.inherits` synthesis, and
 * `this()`/`super()` explicit-constructor synthesis.
 *
 * Pure given the input source text. No I/O, no globals consulted.
 */

import type { Capture, CaptureMatch } from 'gitnexus-shared';
import {
  nodeIfType,
  nodeToCapture,
  syntheticCapture,
  type SyntaxNode,
} from '../../utils/ast-helpers.js';
import { computeApexArityMetadata, normalizeApexParamType } from './arity-metadata.js';
import { synthesizeApexReceiverBinding } from './receiver-binding.js';
import { getApexParser, getApexScopeQuery } from './query.js';
import { getTreeSitterBufferSize } from '../../constants.js';
import { parseSourceSafe } from '../../../tree-sitter/safe-parse.js';

/** Declaration anchors that carry function-like arity metadata. */
const FUNCTION_DECL_TAGS = ['@declaration.method', '@declaration.constructor'] as const;

/** tree-sitter-apex node types that the method extractor accepts. */
const FUNCTION_NODE_TYPES = ['method_declaration', 'constructor_declaration'] as const;

/** Suppress read.member emissions when the field_access is the write target of
 *  an assignment_expression (the write variant covers it). */
function shouldEmitReadMember(memberNode: SyntaxNode): boolean {
  const parent = memberNode.parent;
  if (parent === null) return true;

  switch (parent.type) {
    case 'assignment_expression':
      return parent.childForFieldName('left')?.id !== memberNode.id;
    default:
      return true;
  }
}

export function emitApexScopeCaptures(
  sourceText: string,
  _filePath: string,
  cachedTree?: unknown,
): readonly CaptureMatch[] {
  let tree = cachedTree as ReturnType<ReturnType<typeof getApexParser>['parse']> | undefined;
  if (tree === undefined) {
    tree = parseSourceSafe(getApexParser(), sourceText, undefined, {
      bufferSize: getTreeSitterBufferSize(sourceText),
    });
  }

  const rawMatches = getApexScopeQuery().matches(tree.rootNode);
  const out: CaptureMatch[] = [];

  for (const m of rawMatches) {
    const grouped: Record<string, Capture> = {};
    const nodeMap: Record<string, SyntaxNode> = {};
    for (const c of m.captures) {
      const tag = '@' + c.name;
      grouped[tag] = nodeToCapture(tag, c.node);
      nodeMap[tag] = c.node;
    }
    if (Object.keys(grouped).length === 0) continue;

    // Skip free-call matches that are actually member calls (the query matches
    // ALL method_invocations as @reference.call.free without negation). If the
    // match also has @reference.receiver, the separate member match covers it.
    if (
      grouped['@reference.call.free'] !== undefined &&
      grouped['@reference.receiver'] !== undefined
    ) {
      continue;
    }

    // Filter read.member when it's the write target of an assignment.
    if (grouped['@reference.read.member'] !== undefined) {
      const memberNode = nodeIfType(nodeMap['@reference.read.member'], 'field_access');
      if (memberNode === null || !shouldEmitReadMember(memberNode)) {
        continue;
      }
    }

    // Synthesize `this` / `super` receiver type-bindings on every instance
    // method-like.
    if (grouped['@scope.function'] !== undefined) {
      out.push(grouped);
      const fnNode = findFunctionNode(nodeMap['@scope.function']);
      if (fnNode !== null) {
        for (const synth of synthesizeApexReceiverBinding(fnNode)) {
          out.push(synth);
        }
      }
      continue;
    }

    // Synthesize arity metadata on function-like declarations.
    const declTag = FUNCTION_DECL_TAGS.find((t) => grouped[t] !== undefined);
    if (declTag !== undefined) {
      const fnNode = findFunctionNode(nodeMap[declTag]);
      if (fnNode !== null) {
        const arity = computeApexArityMetadata(fnNode);
        if (arity.parameterCount !== undefined) {
          grouped['@declaration.parameter-count'] = syntheticCapture(
            '@declaration.parameter-count',
            fnNode,
            String(arity.parameterCount),
          );
        }
        if (arity.requiredParameterCount !== undefined) {
          grouped['@declaration.required-parameter-count'] = syntheticCapture(
            '@declaration.required-parameter-count',
            fnNode,
            String(arity.requiredParameterCount),
          );
        }
        if (arity.parameterTypes !== undefined) {
          grouped['@declaration.parameter-types'] = syntheticCapture(
            '@declaration.parameter-types',
            fnNode,
            JSON.stringify(arity.parameterTypes),
          );
        }
      }
    }

    // Synthesize `@reference.arity` on every callsite.
    const callTag = (
      ['@reference.call.free', '@reference.call.member', '@reference.call.constructor'] as const
    ).find((t) => grouped[t] !== undefined);
    if (callTag !== undefined && grouped['@reference.arity'] === undefined) {
      const callNode = nodeIfType(
        nodeMap[callTag],
        'method_invocation',
        'object_creation_expression',
      );
      if (callNode !== null) {
        const argList = callNode.childForFieldName('arguments');
        const args =
          argList === null
            ? []
            : argList.namedChildren.filter(
                (c) => c !== null && c.type !== 'block_comment' && c.type !== 'line_comment',
              );
        grouped['@reference.arity'] = syntheticCapture(
          '@reference.arity',
          callNode,
          String(args.length),
        );

        // Fold each inferred argument type (Apex case-insensitivity), symmetric
        // with the folded declared param types — so overload narrowing's exact
        // per-slot comparison matches case-varied user types.
        const argTypes = args.map((arg) => normalizeApexParamType(inferArgType(arg!)));
        grouped['@reference.parameter-types'] = syntheticCapture(
          '@reference.parameter-types',
          callNode,
          JSON.stringify(argTypes),
        );

        const argNames = args.map((a) => (a!.type === 'identifier' ? a!.text : ''));
        if (argNames.some((n) => n !== '')) {
          grouped['@reference.arg-names'] = syntheticCapture(
            '@reference.arg-names',
            callNode,
            JSON.stringify(argNames),
          );
        }
      }
    }

    out.push(grouped);
  }

  return [
    ...resolveVarTypeBindings(out),
    ...synthesizeApexInheritanceReferences(tree.rootNode),
    ...synthesizeApexExplicitConstructorReferences(tree.rootNode),
  ];
}

const TYPE_DECL_NODE_TYPES = new Set(['class_declaration', 'enum_declaration']);

/**
 * Synthesize `@reference.call.constructor` captures for explicit constructor
 * invocations — `super(...)` and `this(...)`. The Apex grammar models these as
 * `explicit_constructor_invocation` nodes (Java-derived), which the scope query
 * does not match, so the chained-constructor CALLS edges are synthesized here.
 *
 *   - `this(...)`  → the enclosing type's own simple name.
 *   - `super(...)` → the enclosing class's superclass simple-name tail. An
 *                    implicit super (no `superclass` field) is skipped.
 * Arity is attached so overloaded constructors disambiguate downstream.
 */
function synthesizeApexExplicitConstructorReferences(root: SyntaxNode): CaptureMatch[] {
  const out: CaptureMatch[] = [];
  const stack: SyntaxNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.type === 'explicit_constructor_invocation') {
      emitApexExplicitConstructorRef(out, node);
    }
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (child !== null) stack.push(child);
    }
  }
  return out;
}

function emitApexExplicitConstructorRef(out: CaptureMatch[], node: SyntaxNode): void {
  const ctor = node.childForFieldName('constructor');
  if (ctor === null) return;

  const enclosingType = findEnclosingTypeDeclaration(node);
  if (enclosingType === null) return;

  let targetNameNode: SyntaxNode | null = null;
  if (ctor.type === 'this') {
    targetNameNode = enclosingType.childForFieldName('name');
  } else if (ctor.type === 'super') {
    const superclass = enclosingType.childForFieldName('superclass');
    if (superclass === null) return;
    for (const base of superclass.namedChildren) {
      if (base === null) continue;
      const nameNode = apexBaseLookupNameNode(base);
      if (nameNode !== null) {
        targetNameNode = nameNode;
        break;
      }
    }
  }
  if (targetNameNode === null) return;

  const argList = node.childForFieldName('arguments');
  const args =
    argList === null
      ? []
      : argList.namedChildren.filter(
          (c) => c !== null && c.type !== 'block_comment' && c.type !== 'line_comment',
        );

  out.push({
    '@reference.call.constructor': nodeToCapture('@reference.call.constructor', node),
    '@reference.name': nodeToCapture('@reference.name', targetNameNode),
    '@reference.arity': syntheticCapture('@reference.arity', node, String(args.length)),
  });
}

function findEnclosingTypeDeclaration(node: SyntaxNode): SyntaxNode | null {
  let cur: SyntaxNode | null = node.parent;
  while (cur !== null) {
    if (TYPE_DECL_NODE_TYPES.has(cur.type)) return cur;
    cur = cur.parent;
  }
  return null;
}

/**
 * Synthesize `@reference.inherits` captures from Apex class heritage so the
 * registry-primary scope-resolution path emits EXTENDS / IMPLEMENTS edges
 * (mirrors `synthesizeJavaInheritanceReferences`). Covers `class_declaration`
 * (`superclass` extends + `interfaces` implements) AND `interface_declaration`
 * (`extends_interfaces` → interface-to-interface). Base names reduce to the bare
 * simple identifier; the EXTENDS-vs-IMPLEMENTS split is decided downstream from
 * the resolved target's symbol kind.
 */
function synthesizeApexInheritanceReferences(root: SyntaxNode): CaptureMatch[] {
  const out: CaptureMatch[] = [];
  const stack: SyntaxNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.type === 'class_declaration') {
      const superclass = node.childForFieldName('superclass');
      if (superclass !== null) {
        for (const base of superclass.namedChildren) emitApexInheritanceBase(out, base);
      }
      const interfaces = node.childForFieldName('interfaces');
      if (interfaces !== null) {
        for (const typeList of interfaces.namedChildren) {
          if (typeList === null || typeList.type !== 'type_list') continue;
          for (const base of typeList.namedChildren) emitApexInheritanceBase(out, base);
        }
      }
    } else if (node.type === 'interface_declaration') {
      for (let i = 0; i < node.namedChildCount; i++) {
        const extendsInterfaces = node.namedChild(i);
        if (extendsInterfaces === null || extendsInterfaces.type !== 'extends_interfaces') continue;
        for (const typeList of extendsInterfaces.namedChildren) {
          if (typeList === null || typeList.type !== 'type_list') continue;
          for (const base of typeList.namedChildren) emitApexInheritanceBase(out, base);
        }
      }
    }
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (child !== null) stack.push(child);
    }
  }
  return out;
}

function emitApexInheritanceBase(out: CaptureMatch[], base: SyntaxNode | null): void {
  if (base === null) return;
  const nameNode = apexBaseLookupNameNode(base);
  if (nameNode === null) return;
  out.push({
    '@reference.inherits': nodeToCapture('@reference.inherits', base),
    '@reference.name': nodeToCapture('@reference.name', nameNode),
  });
}

/** Resolve an Apex base-type node to its bare simple-name identifier node. */
function apexBaseLookupNameNode(node: SyntaxNode): SyntaxNode | null {
  switch (node.type) {
    case 'type_identifier':
      return node;
    case 'scoped_type_identifier':
      return node.lastNamedChild;
    case 'generic_type': {
      const first = node.firstNamedChild;
      return first === null ? null : apexBaseLookupNameNode(first);
    }
    default:
      return null;
  }
}

function resolveVarTypeBindings(matches: CaptureMatch[]): CaptureMatch[] {
  const returnTypes = new Map<string, string>();
  const varTypes = new Map<string, string>();
  const ambiguousReturns = new Set<string>();
  const ambiguousVars = new Set<string>();

  for (const m of matches) {
    if (
      m['@type-binding.return'] !== undefined &&
      m['@type-binding.type'] !== undefined &&
      m['@type-binding.name'] !== undefined
    ) {
      const name = m['@type-binding.name'].text;
      const type = m['@type-binding.type'].text;
      const existing = returnTypes.get(name);
      if (existing !== undefined && existing !== type) {
        ambiguousReturns.add(name);
        returnTypes.delete(name);
      } else if (!ambiguousReturns.has(name)) {
        returnTypes.set(name, type);
      }
    }
    if (
      m['@type-binding.annotation'] !== undefined &&
      m['@type-binding.type'] !== undefined &&
      m['@type-binding.name'] !== undefined
    ) {
      const name = m['@type-binding.name'].text;
      const t = m['@type-binding.type'].text;
      const existing = varTypes.get(name);
      if (existing !== undefined && existing !== t) {
        ambiguousVars.add(name);
        varTypes.delete(name);
      } else if (!ambiguousVars.has(name)) {
        varTypes.set(name, t);
      }
    }
  }

  const resolved: CaptureMatch[] = [];
  for (const m of matches) {
    if (m['@reference.arg-names'] !== undefined && m['@reference.parameter-types'] !== undefined) {
      try {
        const types: string[] = JSON.parse(m['@reference.parameter-types'].text);
        const names: string[] = JSON.parse(m['@reference.arg-names'].text);
        let patched = false;
        for (let i = 0; i < types.length; i++) {
          if (types[i] === '' && names[i] !== undefined && names[i] !== '') {
            const rt = varTypes.get(names[i]!);
            if (rt !== undefined) {
              // Fold the resolved var type (Apex case-insensitivity) to match the
              // folded declared param types in overload narrowing.
              types[i] = normalizeApexParamType(rt);
              patched = true;
            }
          }
        }
        if (patched) {
          const patchedMatch: Record<string, Capture> = { ...m };
          patchedMatch['@reference.parameter-types'] = {
            ...m['@reference.parameter-types']!,
            text: JSON.stringify(types),
          };
          delete patchedMatch['@reference.arg-names'];
          resolved.push(patchedMatch);
          continue;
        }
      } catch {
        // pass through
      }
    }
    resolved.push(m);
  }
  return resolved;
}

/** Infer an Apex argument's static type from literal patterns. */
function inferArgType(argNode: SyntaxNode): string {
  switch (argNode.type) {
    case 'decimal_integer_literal':
    case 'hex_integer_literal':
    case 'octal_integer_literal':
    case 'binary_integer_literal':
      return 'int';
    case 'decimal_floating_point_literal':
    case 'hex_floating_point_literal':
      return 'double';
    case 'string_literal':
      return 'String';
    case 'character_literal':
      return 'char';
    case 'true':
    case 'false':
      return 'boolean';
    case 'null_literal':
      return 'null';
    case 'object_creation_expression': {
      const typeNode = argNode.childForFieldName('type');
      return typeNode?.text ?? '';
    }
    default:
      return '';
  }
}

/** Resolve an Apex function-like node from a query-captured node. */
function findFunctionNode(node: SyntaxNode | undefined): SyntaxNode | null {
  return nodeIfType(node, ...FUNCTION_NODE_TYPES);
}
