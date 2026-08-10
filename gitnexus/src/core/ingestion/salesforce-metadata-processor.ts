/**
 * Salesforce Declarative Metadata Processor
 *
 * Salesforce ships most of its behaviour as declarative XML, not code: objects,
 * fields, validation rules and flows. Those files were already scanned — every
 * `-meta.xml` gets a `File` node — but nothing looked inside them, so a field
 * rename had no blast radius and `impact` on `Foo__c` returned nothing.
 *
 * Regex, not tree-sitter, and no XML parser: the shapes read here are flat
 * single-line elements, and `markdown-processor.ts` set the precedent that a
 * non-code file format does not need a grammar to earn graph edges.
 *
 * WHY `Record` AND NOT `CodeElement`. Both are declared against `File` and
 * against themselves, but only `Record` is declared against `Class`
 * (`rel-pair-routing` rejects an undeclared pair by aborting `analyze`
 * outright, so this is a hard constraint, not a preference). A flow invoking
 * an Apex class is the edge this whole processor exists for. `Record` is also
 * what `cobol-processor.ts` already uses for entities that are real but not
 * source code — DB tables, queues, IMS segments — which is exactly what an
 * object or a field is here.
 */

import { generateId } from '../../lib/utils.js';
import type { GraphNode } from 'gitnexus-shared';
import { KnowledgeGraph } from '../graph/types.js';

/** `objects/<Object>/fields/<Field>.field-meta.xml` and friends. */
const FIELD_PATH_RE = /(?:^|\/)objects\/([^/]+)\/fields\/([^/]+)\.field-meta\.xml$/;
const RULE_PATH_RE =
  /(?:^|\/)objects\/([^/]+)\/validationRules\/([^/]+)\.validationRule-meta\.xml$/;
const OBJECT_PATH_RE = /(?:^|\/)objects\/([^/]+)\/[^/]+\.object-meta\.xml$/;
const FLOW_PATH_RE = /(?:^|\/)flows\/([^/]+)\.flow-meta\.xml$/;

/** `<actionName>X</actionName>` … `<actionType>apex</actionType>` within one actionCalls block. */
const ACTION_CALL_RE = /<actionCalls>([\s\S]*?)<\/actionCalls>/g;
const ACTION_NAME_RE = /<actionName>([^<]+)<\/actionName>/;
const ACTION_TYPE_RE = /<actionType>([^<]+)<\/actionType>/;

const FORMULA_RE =
  /<(?:errorConditionFormula|errorDisplayField)>([\s\S]*?)<\/(?:errorConditionFormula|errorDisplayField)>/g;
/** Custom API names always carry the `__c`/`__r` suffix, which is what makes them findable. */
const CUSTOM_NAME_RE = /\b([A-Za-z][A-Za-z0-9_]*__[cr])\b/g;

export interface SalesforceMetadataFile {
  path: string;
  content: string;
}

export interface SalesforceMetadataResult {
  objects: number;
  fields: number;
  validationRules: number;
  flows: number;
  edges: number;
}

type EntityKind = 'object' | 'field' | 'validationrule' | 'flow';

interface Entity {
  kind: EntityKind;
  /** Display name — `Contact`, `Contact.VDM_Id__c`, `Update_Case_Records`. */
  name: string;
  /** Owning object API name, where the path qualifies it. */
  object?: string;
  filePath: string;
  content: string;
}

const nodeIdFor = (kind: EntityKind, name: string): string =>
  generateId('Record', `<sf-${kind}>:${name}`);

/**
 * Classify by PATH, never by file content. Salesforce puts the owning object in
 * the directory (`objects/Contact/fields/VDM_Id__c.field-meta.xml`), which is
 * what makes a field DEFINITION unambiguous — the `<fullName>` inside is only
 * the bare field name and would collide across objects.
 */
function classify(file: SalesforceMetadataFile): Entity | undefined {
  const p = file.path;
  const common = { filePath: p, content: file.content };

  const field = FIELD_PATH_RE.exec(p);
  if (field) {
    return { kind: 'field', name: `${field[1]}.${field[2]}`, object: field[1], ...common };
  }
  const rule = RULE_PATH_RE.exec(p);
  if (rule) {
    return { kind: 'validationrule', name: `${rule[1]}.${rule[2]}`, object: rule[1], ...common };
  }
  const object = OBJECT_PATH_RE.exec(p);
  if (object) {
    return { kind: 'object', name: object[1], object: object[1], ...common };
  }
  const flow = FLOW_PATH_RE.exec(p);
  if (flow) {
    return { kind: 'flow', name: flow[1], ...common };
  }
  return undefined;
}

/** Apex is case-insensitive, so the flow's `<actionName>` need not match class casing. */
function buildApexClassIndex(graph: KnowledgeGraph): Map<string, string> {
  const index = new Map<string, string>();
  for (const node of graph.iterNodes()) {
    if (node.label !== 'Class') continue;
    const name = node.properties.name;
    if (typeof name !== 'string') continue;
    const key = name.toLowerCase();
    // ponytail: first definition wins. Two Apex classes can share a name across
    // packages; picking arbitrarily beats fanning out to both, and the org
    // forbids the collision anyway. Revisit if cross-package dupes show up.
    if (!index.has(key)) index.set(key, node.id);
  }
  return index;
}

export const processSalesforceMetadata = (
  graph: KnowledgeGraph,
  files: SalesforceMetadataFile[],
): SalesforceMetadataResult => {
  const result: SalesforceMetadataResult = {
    objects: 0,
    fields: 0,
    validationRules: 0,
    flows: 0,
    edges: 0,
  };

  const entities: Entity[] = [];
  for (const file of files) {
    if (!file.path.endsWith('.xml')) continue;
    const entity = classify(file);
    if (entity) entities.push(entity);
  }
  if (entities.length === 0) return result;

  const countKey = {
    object: 'objects',
    field: 'fields',
    validationrule: 'validationRules',
    flow: 'flows',
  } as const;

  // ── Nodes ────────────────────────────────────────────────────────
  // Every node lands before any edge, so a reference can resolve to an entity
  // declared in a file processed later.
  const byName = new Map<string, string>();
  for (const entity of entities) {
    const fileNodeId = generateId('File', entity.filePath);
    // structure-processor owns File nodes; without one there is nothing to anchor to.
    if (!graph.getNode(fileNodeId)) continue;

    const id = nodeIdFor(entity.kind, entity.name);
    const node: GraphNode = {
      id,
      label: 'Record',
      properties: {
        name: entity.name,
        filePath: entity.filePath,
        startLine: 0,
        endLine: 0,
        description: `salesforce:${entity.kind}`,
      },
    };
    graph.addNode(node);
    byName.set(`${entity.kind}:${entity.name.toLowerCase()}`, id);
    result[countKey[entity.kind]]++;

    graph.addRelationship({
      id: generateId('CONTAINS', `${fileNodeId}->${id}`),
      type: 'CONTAINS',
      sourceId: fileNodeId,
      targetId: id,
      confidence: 1.0,
      reason: 'salesforce-metadata',
    });
    result.edges++;
  }

  const link = (
    sourceId: string,
    targetId: string | undefined,
    type: 'MEMBER_OF' | 'ACCESSES' | 'CALLS',
    reason: string,
    confidence: number,
  ): void => {
    if (!targetId || targetId === sourceId) return;
    const id = generateId(type, `${sourceId}->${targetId}`);
    if (graph.getNode(sourceId) === undefined || graph.getNode(targetId) === undefined) return;
    graph.addRelationship({ id, type, sourceId, targetId, confidence, reason });
    result.edges++;
  };

  const objectId = (name?: string): string | undefined =>
    name ? byName.get(`object:${name.toLowerCase()}`) : undefined;

  let apexIndex: Map<string, string> | undefined;

  // ── Edges ────────────────────────────────────────────────────────
  for (const entity of entities) {
    const sourceId = byName.get(`${entity.kind}:${entity.name.toLowerCase()}`);
    if (!sourceId) continue;

    if (entity.kind === 'field') {
      link(sourceId, objectId(entity.object), 'MEMBER_OF', 'salesforce-field-of-object', 1.0);
      continue;
    }

    if (entity.kind === 'validationrule') {
      link(sourceId, objectId(entity.object), 'MEMBER_OF', 'salesforce-rule-guards-object', 1.0);
      // Formulas name fields bare (`VDM_Id__c`), so qualify with the object the
      // rule already lives under. A standard field (`FirstName`) has no
      // `-meta.xml`, hence no node, and simply finds nothing here.
      for (const name of customNamesIn(entity.content)) {
        link(
          sourceId,
          byName.get(`field:${`${entity.object}.${name}`.toLowerCase()}`),
          'ACCESSES',
          'salesforce-rule-references-field',
          0.9,
        );
      }
      continue;
    }

    if (entity.kind === 'flow') {
      apexIndex ??= buildApexClassIndex(graph);
      for (const actionName of apexActionNames(entity.content)) {
        link(
          sourceId,
          apexIndex.get(actionName.toLowerCase()),
          'CALLS',
          'salesforce-flow-invokes-apex',
          0.9,
        );
      }
    }
  }

  return result;
};

/** Distinct `__c`/`__r` API names appearing anywhere in a rule's formulas. */
function customNamesIn(content: string): string[] {
  const names = new Set<string>();
  FORMULA_RE.lastIndex = 0;
  let block: RegExpExecArray | null;
  while ((block = FORMULA_RE.exec(content)) !== null) {
    CUSTOM_NAME_RE.lastIndex = 0;
    let name: RegExpExecArray | null;
    while ((name = CUSTOM_NAME_RE.exec(block[1])) !== null) names.add(name[1]);
  }
  return [...names];
}

/**
 * `<actionName>` values from `actionCalls` blocks whose `<actionType>` is
 * `apex`. Matching per block matters: a flow mixes apex actions with
 * `emailSimple` and record actions, and a file-wide scan for `<actionName>`
 * would attribute every one of them to Apex.
 */
function apexActionNames(content: string): string[] {
  const names = new Set<string>();
  ACTION_CALL_RE.lastIndex = 0;
  let block: RegExpExecArray | null;
  while ((block = ACTION_CALL_RE.exec(content)) !== null) {
    const body = block[1];
    if (ACTION_TYPE_RE.exec(body)?.[1] !== 'apex') continue;
    const name = ACTION_NAME_RE.exec(body)?.[1];
    if (name) names.add(name);
  }
  return [...names];
}
