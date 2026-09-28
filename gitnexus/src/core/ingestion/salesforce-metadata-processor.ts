/**
 * Salesforce Declarative Metadata Processor
 *
 * A Salesforce org defines objects, fields and validation rules as declarative
 * XML, not code. Those files were already scanned — every `-meta.xml` gets a
 * `File` node — but nothing looked inside them, so a field rename had no blast
 * radius at all.
 *
 * Fields and validation rules are named `Object.Field__c`, because a bare
 * `<fullName>` collides across objects. Symbol resolution is an exact match on
 * `name` (`local-backend.ts`), so `impact` answers on the qualified form;
 * the bare `Foo__c` a formula or an Apex expression would use does NOT resolve
 * to a field. Objects are named bare and resolve directly.
 *
 * Regex, not tree-sitter, and no XML parser: the elements read here do not
 * nest within their own kind, and `markdown-processor.ts` set the precedent
 * that a non-code file format does not need a grammar to earn graph edges.
 *
 * WHY `Record`. The relation schema must declare every pair emitted here
 * (`rel-pair-routing` aborts `analyze` outright on an undeclared one): `File`
 * and `Record` targets. `Record` and `CodeElement` both qualify, so the
 * schema does not decide it. `Record` is what `cobol-processor.ts` already uses
 * for entities that are real but not source code — DB tables, queues, IMS
 * segments — which is exactly what an object or a field is here.
 */

import { generateId } from '../../lib/utils.js';
import type { GraphNode, GraphRelationship } from 'gitnexus-shared';
import { KnowledgeGraph } from '../graph/types.js';

/** `objects/<Object>/fields/<Field>.field-meta.xml` and friends. */
const FIELD_PATH_RE = /(?:^|\/)objects\/([^/]+)\/fields\/([^/]+)\.field-meta\.xml$/;
const RULE_PATH_RE =
  /(?:^|\/)objects\/([^/]+)\/validationRules\/([^/]+)\.validationRule-meta\.xml$/;
const OBJECT_PATH_RE = /(?:^|\/)objects\/([^/]+)\/[^/]+\.object-meta\.xml$/;

/** True for exactly the paths `classify` can turn into an entity. */
export const isSalesforceEntityPath = (p: string): boolean =>
  [FIELD_PATH_RE, RULE_PATH_RE, OBJECT_PATH_RE].some((re) => re.test(p));

/** Stripped before any extraction — see `classify`. */
const XML_COMMENT_RE = /<!--[\s\S]*?-->/g;

/** The formula language's own comment, stripped from each formula block — see `customNamesIn`. */
const FORMULA_COMMENT_RE = /\/\*[\s\S]*?\*\//g;

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

/** A formula field's own expression, which reads other fields on the same object. */
const FIELD_FORMULA_RE = /<formula>([\s\S]*?)<\/formula>/g;

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
 * `__r` itself is never matched, which leaves a gap: `Account__r` is the
 * traversal name of a local lookup field (the one whose `<relationshipName>`
 * is `Account`), so the formula does depend on that field, but no edge to it
 * is emitted. Binding it needs the lookup's `<relationshipName>`, which is
 * not read yet.
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
  edges: number;
}

/**
 * Reasons on every edge resolved by NAME — all but the `File` anchor. Whether
 * a name resolves depends on every file that declares it (a second package
 * defining the same field changes the answer), so these edges are rebuilt
 * whole on incremental writeback rather than per changed file, like Spring's
 * `DECLARES` (see `incremental/subgraph-extract.ts`).
 */
export const SALESFORCE_RESOLVED_REASONS = [
  'salesforce-field-of-object',
  'salesforce-rule-guards-object',
  'salesforce-formula-references-field',
  'salesforce-rule-references-field',
] as const;

/** Edge types the resolved reasons are carried on. */
export const SALESFORCE_RESOLVED_TYPES = ['CONTAINS', 'USES'] as const;

type ResolvedReason = (typeof SALESFORCE_RESOLVED_REASONS)[number];

const RESOLVED_REASONS: ReadonlySet<string> = new Set(SALESFORCE_RESOLVED_REASONS);
const RESOLVED_TYPES: ReadonlySet<string> = new Set(SALESFORCE_RESOLVED_TYPES);

/** Type × reason, matching exactly what `deleteSalesforceResolvedEdges` removes. */
export const isSalesforceResolvedRelationship = (
  relationship: Pick<GraphRelationship, 'type' | 'reason'>,
): boolean => RESOLVED_TYPES.has(relationship.type) && RESOLVED_REASONS.has(relationship.reason);

type EntityKind = 'object' | 'field' | 'validationrule';

interface Entity {
  kind: EntityKind;
  /** Display name — `Contact`, `Contact.External_Id__c`. */
  name: string;
  /** Owning object API name, where the path qualifies it. */
  object?: string;
  filePath: string;
  content: string;
  /** 0-based line that declares the entity — see `declaringLine`. */
  declLine: number;
  /**
   * 0-based last line of the file. A metadata file declares exactly one
   * entity, and `detect_changes` maps diff hunks to symbols by line overlap,
   * so the span runs to the end of the file: an edit anywhere in the body
   * (a formula, say) touches the entity.
   */
  lastLine: number;
  /**
   * Directory holding the metadata-type folders (`objects/`) —
   * `pkgs/acme/main/default` for `pkgs/acme/main/default/objects/…`. Two
   * entities with the same one belong to the same package source tree.
   */
  sourceDir: string;
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

/** Every entity claiming a Salesforce name, with the source tree it lives in. */
type ScopedIndex = Map<string, { id: string; sourceDir: string }[]>;

const claimScoped = (index: ScopedIndex, key: string, id: string, sourceDir: string): void => {
  const hits = index.get(key);
  if (hits) hits.push({ id, sourceDir });
  else index.set(key, [{ id, sourceDir }]);
};

/**
 * A unique name resolves directly. A name several packages define resolves to
 * the one in the referrer's own source tree — the path answers it, so this is
 * not a guess — and otherwise yields no edge: emitting nothing beats minting a
 * binding that points at the wrong package.
 */
const resolvedFrom = (index: ScopedIndex, key: string, sourceDir: string): string | undefined => {
  const hits = index.get(key);
  if (!hits) return undefined;
  if (hits.length === 1) return hits[0].id;
  const local = hits.filter((h) => h.sourceDir === sourceDir);
  return local.length === 1 ? local[0].id : undefined;
};

/**
 * Classify by PATH, never by file content. Salesforce puts the owning object in
 * the directory (`objects/Contact/fields/External_Id__c.field-meta.xml`), which is
 * what makes a field DEFINITION unambiguous — the `<fullName>` inside is only
 * the bare field name and would collide across objects.
 */
function classify(file: SalesforceMetadataFile): Entity | undefined {
  const p = file.path;
  // A commented-out clause is not live, so it must not keep a blast radius.
  const content = stripComments(file.content);
  // Each path regex anchors on the metadata-type folder, so the match starts
  // where the source tree ends.
  const common = (m: RegExpExecArray) => ({
    filePath: p,
    content,
    declLine: declaringLine(content),
    lastLine: content.split('\n').length - 1,
    sourceDir: p.slice(0, m.index),
  });

  const field = FIELD_PATH_RE.exec(p);
  if (field) {
    return { kind: 'field', name: `${field[1]}.${field[2]}`, object: field[1], ...common(field) };
  }
  const rule = RULE_PATH_RE.exec(p);
  if (rule) {
    return {
      kind: 'validationrule',
      name: `${rule[1]}.${rule[2]}`,
      object: rule[1],
      ...common(rule),
    };
  }
  const object = OBJECT_PATH_RE.exec(p);
  if (object) {
    return { kind: 'object', name: object[1], object: object[1], ...common(object) };
  }
  return undefined;
}

export const processSalesforceMetadata = (
  graph: KnowledgeGraph,
  files: SalesforceMetadataFile[],
): SalesforceMetadataResult => {
  const result: SalesforceMetadataResult = {
    objects: 0,
    fields: 0,
    validationRules: 0,
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
  } as const;

  // ── Nodes ────────────────────────────────────────────────────────
  // Every node lands before any edge, so a reference can resolve to an entity
  // declared in a file processed later.
  const byName: ScopedIndex = new Map();
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
        endLine: entity.lastLine,
        description: `salesforce:${entity.kind}`,
      },
    };
    graph.addNode(node);
    created.push({ entity, id });
    claimScoped(byName, `${entity.kind}:${entity.name.toLowerCase()}`, id, entity.sourceDir);
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
   * invisible to `impact`. `USES` carries the same meaning here and is
   * traversed.
   *
   * `MEMBER_OF` is likewise avoided: it already means Community membership
   * (`(n)-[MEMBER_OF]->(c:Community)`), so reusing it for field-of-object would
   * overload a type with an unrelated established meaning.
   */
  // The id is derived from (type, source, target), and `addRelationship` keeps
  // the first edge written for an id, so re-linking a pair adds nothing; count
  // each id once.
  const linked = new Set<string>();
  const link = (
    sourceId: string | undefined,
    targetId: string | undefined,
    type: (typeof SALESFORCE_RESOLVED_TYPES)[number],
    reason: ResolvedReason,
    confidence: number,
  ): void => {
    if (!sourceId || !targetId || targetId === sourceId) return;
    const id = generateId(type, `${sourceId}->${targetId}`);
    if (graph.getNode(sourceId) === undefined || graph.getNode(targetId) === undefined) return;
    graph.addRelationship({ id, type, sourceId, targetId, confidence, reason });
    if (!linked.has(id)) {
      linked.add(id);
      result.edges++;
    }
  };

  /** `from` is the referrer's source tree, which settles a name several packages define. */
  const objectId = (name: string | undefined, from: string): string | undefined =>
    name ? resolvedFrom(byName, `object:${name.toLowerCase()}`, from) : undefined;

  /** Bare field name qualified by the object it is being read on. */
  const fieldId = (object: string | undefined, field: string, from: string): string | undefined =>
    object ? resolvedFrom(byName, `field:${`${object}.${field}`.toLowerCase()}`, from) : undefined;

  // ── Edges ────────────────────────────────────────────────────────
  for (const { entity, id: sourceId } of created) {
    if (entity.kind === 'field') {
      // Object CONTAINS field, in the container->member direction CONTAINS
      // takes elsewhere in the graph, rather than pointing the member back at
      // its container.
      link(
        objectId(entity.object, entity.sourceDir),
        sourceId,
        'CONTAINS',
        'salesforce-field-of-object',
        1.0,
      );
      // A formula field reads other fields on its own object, which is what
      // gives a rename its field-to-field blast radius.
      for (const name of customNamesIn(entity.content, FIELD_FORMULA_RE)) {
        link(
          sourceId,
          fieldId(entity.object, name, entity.sourceDir),
          'USES',
          'salesforce-formula-references-field',
          0.9,
        );
      }
      continue;
    }

    if (entity.kind === 'validationrule') {
      link(
        objectId(entity.object, entity.sourceDir),
        sourceId,
        'CONTAINS',
        'salesforce-rule-guards-object',
        1.0,
      );
      // Formulas name fields bare (`External_Id__c`), so qualify with the object the
      // rule already lives under. Only custom (`__c`) names are read, so a
      // standard field (`FirstName`) binds nothing here.
      for (const name of customNamesIn(entity.content, FORMULA_RE)) {
        link(
          sourceId,
          fieldId(entity.object, name, entity.sourceDir),
          'USES',
          'salesforce-rule-references-field',
          0.9,
        );
      }
    }
  }

  return result;
};

/**
 * Distinct custom field API names appearing inside the elements `blockRe`
 * matches. A formula's own block comments are dropped first: a clause inside
 * one is no more live than one inside an XML comment.
 */
function customNamesIn(content: string, blockRe: RegExp): string[] {
  const names = new Set<string>();
  blockRe.lastIndex = 0;
  let block: RegExpExecArray | null;
  while ((block = blockRe.exec(content)) !== null) {
    const text = block[1].replace(FORMULA_COMMENT_RE, ' ');
    CUSTOM_NAME_RE.lastIndex = 0;
    let name: RegExpExecArray | null;
    while ((name = CUSTOM_NAME_RE.exec(text)) !== null) names.add(name[2]);
  }
  return [...names];
}
