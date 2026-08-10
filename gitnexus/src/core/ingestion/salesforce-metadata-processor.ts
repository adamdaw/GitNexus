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

/** Stripped before any extraction — see `classify`. */
const XML_COMMENT_RE = /<!--[\s\S]*?-->/g;

/**
 * Blank a comment out in place rather than deleting it, so every character and
 * newline keeps its position. The FTS snippet is cut from the real file on
 * disk by line number (`csv-generator`), so collapsing lines here would point
 * each node at the wrong one.
 */
const stripComments = (content: string): string =>
  content.replace(XML_COMMENT_RE, (m) => m.replace(/[^\n]/g, ' '));

/**
 * Line that declares the entity, 0-based. `<fullName>` is the identity element
 * in every shape read here; an object file omits it, so the root element is
 * the fallback. Without this the exact-span snippet is `<?xml … ?>` for every
 * metadata node in the repo, which is noise in the index and scores every
 * metadata file twice on `xml` and `encoding`.
 */
function declaringLine(content: string): number {
  const lines = content.split('\n');
  const byFullName = lines.findIndex((l) => l.includes('<fullName>'));
  if (byFullName !== -1) return byFullName;
  const byRoot = lines.findIndex((l) => /^\s*<[A-Za-z]/.test(l) && !l.includes('<?xml'));
  return byRoot === -1 ? 0 : byRoot;
}

/** `<actionName>X</actionName>` … `<actionType>apex</actionType>` within one actionCalls block. */
const ACTION_CALL_RE = /<actionCalls>([\s\S]*?)<\/actionCalls>/g;
const ACTION_NAME_RE = /<actionName>([^<]+)<\/actionName>/;
const ACTION_TYPE_RE = /<actionType>([^<]+)<\/actionType>/;

const FORMULA_RE =
  /<(?:errorConditionFormula|errorDisplayField)>([\s\S]*?)<\/(?:errorConditionFormula|errorDisplayField)>/g;
/**
 * Custom field API names carry the `__c` suffix, which is what makes them
 * findable in a formula.
 *
 * The leading `(^|[^.\w])` excludes a token reached through a relationship
 * traversal: in `Account__r.Status__c` the field belongs to `Account`, not to
 * the object the rule lives on, and this processor has no relationship
 * metadata to resolve the target with. Qualifying it with the local object
 * would bind to a same-named local field — a wrong edge, which is worse than
 * none.
 *
 * `__r` itself is never matched: a relationship alias has no `-meta.xml` of
 * its own, so it could only ever resolve to nothing.
 */
const CUSTOM_NAME_RE = /(^|[^.\w])([A-Za-z][A-Za-z0-9_]*__c)\b/g;

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
  /** 0-based line that declares the entity — see `declaringLine`. */
  declLine: number;
}

/**
 * Path-qualified, matching `cobol-processor.ts` and the `Label:filePath:name`
 * convention the rest of the graph uses. A repo is not an org: an SFDX tree
 * vendors packages, so the same API name legitimately appears in several
 * package directories and a name-only id silently collapses them onto the
 * first file scanned — taking that file's `filePath` with it, which is what
 * incremental writeback keys on. The bare `<sf-kind>:` sentinel form is
 * reserved in the COBOL precedent for genuinely global externals; a field
 * defined in a package is not one.
 */
const nodeIdFor = (kind: EntityKind, name: string, filePath: string): string =>
  generateId('Record', `${filePath}:<sf-${kind}>:${name}`);

/**
 * Tombstone for a name claimed by two entities, following
 * `graph-bridge/node-lookup.ts`. A second write marks the key ambiguous rather
 * than letting scan order pick a winner, and an ambiguous lookup yields no
 * edge: emitting nothing beats minting a binding that points at the wrong
 * package's field.
 */
const AMBIGUOUS = '';

/** Record a name, marking it ambiguous if something already claimed it. */
const claim = (index: Map<string, string>, key: string, id: string): void => {
  index.set(key, index.has(key) ? AMBIGUOUS : id);
};

const resolved = (index: Map<string, string>, key: string): string | undefined => {
  const hit = index.get(key);
  return hit === undefined || hit === AMBIGUOUS ? undefined : hit;
};

/**
 * Classify by PATH, never by file content. Salesforce puts the owning object in
 * the directory (`objects/Contact/fields/VDM_Id__c.field-meta.xml`), which is
 * what makes a field DEFINITION unambiguous — the `<fullName>` inside is only
 * the bare field name and would collide across objects.
 */
function classify(file: SalesforceMetadataFile): Entity | undefined {
  const p = file.path;
  // Commenting a clause out is how a formula or an action gets disabled during
  // maintenance, so commented content must not keep its blast radius.
  const content = stripComments(file.content);
  const common = { filePath: p, content, declLine: declaringLine(content) };

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

/**
 * Apex is case-insensitive, so the flow's `<actionName>` need not match class
 * casing.
 *
 * Restricted to `.cls`: a `Class` node can come from any language the walker
 * parsed, and a Salesforce repo routinely carries LWC and Node tooling beside
 * `force-app/`. Without the extension check a flow action named `Logger` binds
 * to a TypeScript `Logger`, minting a fabricated `CALLS` edge into `impact`.
 *
 * Ambiguous names are tombstoned rather than resolved first-wins. A repo can
 * hold two same-named classes — a vendored package and a local test double,
 * for instance — and picking by scan order can point every caller at the
 * double.
 */
function buildApexClassIndex(graph: KnowledgeGraph): Map<string, string> {
  const index = new Map<string, string>();
  for (const node of graph.iterNodes()) {
    if (node.label !== 'Class') continue;
    const { name, filePath } = node.properties;
    if (typeof name !== 'string') continue;
    if (typeof filePath !== 'string' || !filePath.endsWith('.cls')) continue;
    claim(index, name.toLowerCase(), node.id);
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
  /** Entities that produced a node, paired with it — the edge pass reads this. */
  const created: { entity: Entity; id: string }[] = [];
  for (const entity of entities) {
    const fileNodeId = generateId('File', entity.filePath);
    // structure-processor owns File nodes; without one there is nothing to anchor to.
    if (!graph.getNode(fileNodeId)) continue;

    const id = nodeIdFor(entity.kind, entity.name, entity.filePath);
    const node: GraphNode = {
      id,
      label: 'Record',
      properties: {
        name: entity.name,
        filePath: entity.filePath,
        startLine: entity.declLine,
        endLine: entity.declLine,
        description: `salesforce:${entity.kind}`,
      },
    };
    graph.addNode(node);
    created.push({ entity, id });
    claim(byName, `${entity.kind}:${entity.name.toLowerCase()}`, id);
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

  /**
   * Edge types are chosen for what `impact` actually TRAVERSES, not only for
   * what reads best. Its default relation set is CALLS / IMPORTS / EXTENDS /
   * IMPLEMENTS / USES / METHOD_OVERRIDES / OVERRIDES / METHOD_IMPLEMENTS
   * (`local-backend.ts`). `ACCESSES` is a legal type but sits OUTSIDE that
   * default, so edges emitted as ACCESSES are real, queryable in Cypher, and
   * invisible to `impact` — measured on the live index, not assumed. `USES`
   * carries the same meaning here and is traversed.
   *
   * `MEMBER_OF` is likewise avoided: it already means Community membership
   * (`(n)-[MEMBER_OF]->(c:Community)`), so reusing it for field-of-object would
   * overload a type with an unrelated established meaning.
   */
  const link = (
    sourceId: string | undefined,
    targetId: string | undefined,
    type: 'CONTAINS' | 'USES' | 'CALLS',
    reason: string,
    confidence: number,
  ): void => {
    if (!sourceId || !targetId || targetId === sourceId) return;
    const id = generateId(type, `${sourceId}->${targetId}`);
    if (graph.getNode(sourceId) === undefined || graph.getNode(targetId) === undefined) return;
    graph.addRelationship({ id, type, sourceId, targetId, confidence, reason });
    result.edges++;
  };

  const objectId = (name?: string): string | undefined =>
    name ? resolved(byName, `object:${name.toLowerCase()}`) : undefined;

  let apexIndex: Map<string, string> | undefined;

  // ── Edges ────────────────────────────────────────────────────────
  for (const { entity, id: sourceId } of created) {
    if (entity.kind === 'field') {
      // Object CONTAINS field, matching the direction Class CONTAINS Method
      // rather than pointing the member back at its container.
      link(objectId(entity.object), sourceId, 'CONTAINS', 'salesforce-field-of-object', 1.0);
      continue;
    }

    if (entity.kind === 'validationrule') {
      link(objectId(entity.object), sourceId, 'CONTAINS', 'salesforce-rule-guards-object', 1.0);
      // Formulas name fields bare (`VDM_Id__c`), so qualify with the object the
      // rule already lives under. A standard field (`FirstName`) has no
      // `-meta.xml`, hence no node, and simply finds nothing here.
      for (const name of customNamesIn(entity.content)) {
        link(
          sourceId,
          resolved(byName, `field:${`${entity.object}.${name}`.toLowerCase()}`),
          'USES',
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
          resolved(apexIndex, actionName.toLowerCase()),
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
    while ((name = CUSTOM_NAME_RE.exec(block[1])) !== null) names.add(name[2]);
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
