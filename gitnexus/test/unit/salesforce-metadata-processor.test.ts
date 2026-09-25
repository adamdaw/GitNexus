import { describe, it, expect } from 'vitest';
import { processSalesforceMetadata } from '../../src/core/ingestion/salesforce-metadata-processor.js';
import { createKnowledgeGraph } from '../../src/core/graph/graph.js';
import { parseRelationSchemaPairs } from '../../src/core/lbug/rel-pair-routing.js';
import { RELATION_SCHEMA } from '../../src/core/lbug/schema.js';
import { generateId } from '../../src/lib/utils.js';
import type { KnowledgeGraph } from '../../src/core/graph/types.js';

const OBJ = 'pkgs/acme/main/default/objects/Contact/Contact.object-meta.xml';
const FIELD = 'pkgs/acme/main/default/objects/Contact/fields/External_Id__c.field-meta.xml';
const RULE =
  'pkgs/acme/main/default/objects/Contact/validationRules/Name_Required.validationRule-meta.xml';
const FLOW = 'pkgs/acme/main/default/flows/Example_Flow.flow-meta.xml';

const objectXml = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Contact</label>
</CustomObject>`;

const fieldXml = `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>External_Id__c</fullName>
    <label>External Id</label>
    <type>Text</type>
</CustomField>`;

const ruleXml = `<?xml version="1.0" encoding="UTF-8" ?>
<ValidationRule xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Name_Required</fullName>
    <active>true</active>
    <errorConditionFormula>ISBLANK(External_Id__c)</errorConditionFormula>
    <errorDisplayField>FirstName</errorDisplayField>
</ValidationRule>`;

const flowXml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <actionCalls>
        <name>Log_It</name>
        <actionName>AuditLogger</actionName>
        <actionType>apex</actionType>
    </actionCalls>
    <actionCalls>
        <name>Send_It</name>
        <actionName>emailSimple</actionName>
        <actionType>emailSimple</actionType>
    </actionCalls>
</Flow>`;

/** Every metadata file already has a File node by the time this phase runs. */
function withFiles(graph: KnowledgeGraph, paths: string[]): void {
  for (const p of paths) {
    graph.addNode({
      id: generateId('File', p),
      label: 'File',
      properties: { name: p.split('/').pop(), filePath: p, startLine: 0, endLine: 0 },
    });
  }
}

function addApexClass(graph: KnowledgeGraph, name: string, filePath: string): string {
  const id = generateId('Class', `${filePath}:${name}`);
  graph.addNode({
    id,
    label: 'Class',
    properties: { name, filePath, startLine: 0, endLine: 10, isExported: true },
  });
  return id;
}

function allFiles(): { path: string; content: string }[] {
  return [
    { path: OBJ, content: objectXml },
    { path: FIELD, content: fieldXml },
    { path: RULE, content: ruleXml },
    { path: FLOW, content: flowXml },
  ];
}

function edgesFrom(graph: KnowledgeGraph, sourceId: string) {
  return [...graph.iterRelationships()].filter((r) => r.sourceId === sourceId);
}

/** Node ids are path-qualified, so look entities up by their display name. */
function recordId(graph: KnowledgeGraph, name: string): string {
  const hit = [...graph.iterNodes()].find(
    (n) => n.label === 'Record' && n.properties.name === name,
  );
  if (!hit) throw new Error(`no Record node named ${name}`);
  return hit.id;
}

describe('processSalesforceMetadata', () => {
  it('creates a Record node per declarative entity, keyed by object where the path qualifies it', () => {
    const graph = createKnowledgeGraph();
    withFiles(graph, [OBJ, FIELD, RULE, FLOW]);

    const result = processSalesforceMetadata(graph, allFiles());

    expect(result).toMatchObject({ objects: 1, fields: 1, validationRules: 1, flows: 1 });

    const ids = [...graph.iterNodes()]
      .filter((n) => n.label === 'Record')
      .map((n) => n.properties.name)
      .sort();
    expect(ids).toEqual([
      'Contact',
      'Contact.External_Id__c',
      'Contact.Name_Required',
      'Example_Flow',
    ]);
  });

  it('skips an entity whose File node is absent rather than dangling its anchor', () => {
    const graph = createKnowledgeGraph();
    withFiles(graph, [OBJ]);

    const result = processSalesforceMetadata(graph, [
      { path: OBJ, content: objectXml },
      { path: FIELD, content: fieldXml },
    ]);

    expect(result).toMatchObject({ objects: 1, fields: 0 });
    for (const r of graph.iterRelationships()) {
      expect(graph.getNode(r.sourceId), `dangling source ${r.sourceId}`).toBeDefined();
      expect(graph.getNode(r.targetId), `dangling target ${r.targetId}`).toBeDefined();
    }
  });

  it('anchors each Record to its own File node', () => {
    const graph = createKnowledgeGraph();
    withFiles(graph, [OBJ, FIELD, RULE, FLOW]);
    processSalesforceMetadata(graph, allFiles());

    const contains = [...graph.iterRelationships()].filter(
      (r) => r.type === 'CONTAINS' && r.sourceId === generateId('File', FIELD),
    );
    expect(contains).toHaveLength(1);
    expect(graph.getNode(contains[0].targetId)?.properties.name).toBe('Contact.External_Id__c');
  });

  it('links a custom field to the object that owns it', () => {
    const graph = createKnowledgeGraph();
    withFiles(graph, [OBJ, FIELD]);
    processSalesforceMetadata(graph, [
      { path: OBJ, content: objectXml },
      { path: FIELD, content: fieldXml },
    ]);

    const objId = recordId(graph, 'Contact');
    const owned = edgesFrom(graph, objId)
      .filter((r) => r.type === 'CONTAINS')
      .map((r) => graph.getNode(r.targetId)?.properties.name);
    expect(owned).toEqual(['Contact.External_Id__c']);
  });

  it('links a validation rule to the fields its formula names', () => {
    const graph = createKnowledgeGraph();
    withFiles(graph, [OBJ, FIELD, RULE]);
    processSalesforceMetadata(graph, [
      { path: OBJ, content: objectXml },
      { path: FIELD, content: fieldXml },
      { path: RULE, content: ruleXml },
    ]);

    const ruleId = recordId(graph, 'Contact.Name_Required');
    const byType = (t: string) =>
      edgesFrom(graph, ruleId)
        .filter((r) => r.type === t)
        .map((r) => graph.getNode(r.targetId)?.properties.name)
        .sort();

    // USES, not ACCESSES: impact()'s default traversal set excludes ACCESSES,
    // so an ACCESSES edge here is real in Cypher and invisible to impact().
    // The custom field its formula reads. FirstName is a standard field, and
    // only custom (`__c`) names are read from formulas — absent, not dangling.
    expect(byType('USES')).toEqual(['Contact.External_Id__c']);

    // and the object owns the rule, in the container->member direction
    const objId = recordId(graph, 'Contact');
    const owned = edgesFrom(graph, objId)
      .filter((r) => r.type === 'CONTAINS')
      .map((r) => graph.getNode(r.targetId)?.properties.name)
      .sort();
    expect(owned).toEqual(['Contact.External_Id__c', 'Contact.Name_Required']);
  });

  it('emits only edge types impact() traverses by default', () => {
    const graph = createKnowledgeGraph();
    withFiles(graph, [OBJ, FIELD, RULE, FLOW]);
    addApexClass(graph, 'AuditLogger', 'pkgs/x/classes/AuditLogger.cls');
    processSalesforceMetadata(graph, allFiles());

    // The blast-radius edges must be inside impact()'s default relation set or
    // they are invisible to it. CONTAINS is exempt: containment is structure,
    // not blast radius.
    const IMPACT_DEFAULT = new Set([
      'CALLS',
      'IMPORTS',
      'EXTENDS',
      'IMPLEMENTS',
      'USES',
      'METHOD_OVERRIDES',
      'OVERRIDES',
      'METHOD_IMPLEMENTS',
    ]);
    const emitted = new Set([...graph.iterRelationships()].map((r) => r.type));
    for (const t of emitted) {
      if (t === 'CONTAINS') continue;
      expect(IMPACT_DEFAULT.has(t), `${t} is outside impact()'s default traversal`).toBe(true);
    }
  });

  it('links a flow to the Apex class an apex action invokes, matching case-insensitively', () => {
    const graph = createKnowledgeGraph();
    withFiles(graph, [FLOW]);
    // Class casing deliberately differs from the flow's <actionName>AuditLogger:
    // identical strings on both sides would pass without any fold at all.
    const classId = addApexClass(graph, 'auditlogger', 'pkgs/x/classes/auditlogger.cls');

    processSalesforceMetadata(graph, [{ path: FLOW, content: flowXml }]);

    const flowId = recordId(graph, 'Example_Flow');
    const calls = edgesFrom(graph, flowId).filter((r) => r.type === 'CALLS');
    expect(calls).toHaveLength(1);
    expect(calls[0].targetId).toBe(classId);
  });

  it('ignores non-apex action types rather than inventing an edge', () => {
    const graph = createKnowledgeGraph();
    withFiles(graph, [FLOW]);
    addApexClass(graph, 'emailSimple', 'pkgs/x/classes/emailSimple.cls');

    processSalesforceMetadata(graph, [{ path: FLOW, content: flowXml }]);

    const flowId = recordId(graph, 'Example_Flow');
    expect(edgesFrom(graph, flowId).filter((r) => r.type === 'CALLS')).toEqual([]);
  });

  it('drops an apex action whose class is not in the graph instead of dangling', () => {
    const graph = createKnowledgeGraph();
    withFiles(graph, [FLOW]);

    processSalesforceMetadata(graph, [{ path: FLOW, content: flowXml }]);

    const flowId = recordId(graph, 'Example_Flow');
    expect(edgesFrom(graph, flowId)).toEqual([]);
    // and every edge that IS emitted must resolve to a real node
    for (const r of graph.iterRelationships()) {
      expect(graph.getNode(r.sourceId), `dangling source ${r.sourceId}`).toBeDefined();
      expect(graph.getNode(r.targetId), `dangling target ${r.targetId}`).toBeDefined();
    }
  });

  it('emits only node-label pairs the relation schema declares', () => {
    const graph = createKnowledgeGraph();
    withFiles(graph, [OBJ, FIELD, RULE, FLOW]);
    addApexClass(graph, 'AuditLogger', 'pkgs/x/classes/AuditLogger.cls');
    processSalesforceMetadata(graph, allFiles());

    const declared = parseRelationSchemaPairs(RELATION_SCHEMA);
    const emitted = new Set<string>();
    for (const r of graph.iterRelationships()) {
      emitted.add(`${graph.getNode(r.sourceId)!.label}|${graph.getNode(r.targetId)!.label}`);
    }
    expect(emitted.size).toBeGreaterThan(0);
    for (const pair of emitted) {
      expect(declared.has(pair), `undeclared pair ${pair}`).toBe(true);
    }
  });

  it('gives same-named entities in different packages their own nodes', () => {
    const graph = createKnowledgeGraph();
    const FIELD_B =
      'pkgs/vendored/main/default/objects/Contact/fields/External_Id__c.field-meta.xml';
    withFiles(graph, [FIELD, FIELD_B]);

    const result = processSalesforceMetadata(graph, [
      { path: FIELD, content: fieldXml },
      { path: FIELD_B, content: fieldXml },
    ]);

    const records = [...graph.iterNodes()].filter((n) => n.label === 'Record');
    expect(records).toHaveLength(2);
    expect(records.map((n) => n.properties.filePath).sort()).toEqual([FIELD_B, FIELD].sort());
    // the counter reports nodes created, not files seen
    expect(result.fields).toBe(records.length);
  });

  it('binds to the definition in its own package when another package defines the same name', () => {
    const graph = createKnowledgeGraph();
    const OBJ_B = 'pkgs/vendored/main/default/objects/Contact/Contact.object-meta.xml';
    const FIELD_B =
      'pkgs/vendored/main/default/objects/Contact/fields/External_Id__c.field-meta.xml';
    // The other package's definitions come first, so a first-match lookup
    // would bind to them.
    withFiles(graph, [OBJ_B, OBJ, FIELD_B, FIELD, RULE]);

    processSalesforceMetadata(graph, [
      { path: OBJ_B, content: objectXml },
      { path: OBJ, content: objectXml },
      { path: FIELD_B, content: fieldXml },
      { path: FIELD, content: fieldXml },
      { path: RULE, content: ruleXml },
    ]);

    const pathOf = (id: string) => graph.getNode(id)?.properties.filePath;
    const edges = [...graph.iterRelationships()];
    const uses = edges.filter((r) => r.type === 'USES');
    expect(uses.map((r) => [pathOf(r.sourceId), pathOf(r.targetId)])).toEqual([[RULE, FIELD]]);

    // Each package's object owns its own field, not the other package's.
    const owns = edges
      .filter((r) => r.reason === 'salesforce-field-of-object')
      .map((r) => [pathOf(r.sourceId), pathOf(r.targetId)])
      .sort();
    expect(owns).toEqual(
      [
        [OBJ, FIELD],
        [OBJ_B, FIELD_B],
      ].sort(),
    );
  });

  it("binds a flow's DML and subflow to its own package when another package defines the same names", () => {
    const graph = createKnowledgeGraph();
    const OBJ_B = 'pkgs/vendored/main/default/objects/Contact/Contact.object-meta.xml';
    const FIELD_B =
      'pkgs/vendored/main/default/objects/Contact/fields/External_Id__c.field-meta.xml';
    const CHILD = 'pkgs/acme/main/default/flows/Child_Flow.flow-meta.xml';
    const CHILD_B = 'pkgs/vendored/main/default/flows/Child_Flow.flow-meta.xml';
    const callerXml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <recordLookups>
        <name>Get_Contact</name>
        <filters>
            <field>External_Id__c</field>
        </filters>
        <object>Contact</object>
    </recordLookups>
    <subflows>
        <name>Run_Child</name>
        <flowName>Child_Flow</flowName>
    </subflows>
</Flow>`;
    // The other package's definitions come first, so a first-match lookup
    // would bind to them.
    withFiles(graph, [OBJ_B, OBJ, FIELD_B, FIELD, CHILD_B, CHILD, FLOW]);
    processSalesforceMetadata(graph, [
      { path: OBJ_B, content: objectXml },
      { path: OBJ, content: objectXml },
      { path: FIELD_B, content: fieldXml },
      { path: FIELD, content: fieldXml },
      { path: CHILD_B, content: '<Flow/>' },
      { path: CHILD, content: '<Flow/>' },
      { path: FLOW, content: callerXml },
    ]);

    const targets = [...graph.iterRelationships()]
      .filter((r) => r.sourceId === recordId(graph, 'Example_Flow') && r.type !== 'CONTAINS')
      .map((r) => `${r.type}:${graph.getNode(r.targetId)?.properties.filePath}`)
      .sort();
    expect(targets).toEqual([`CALLS:${CHILD}`, `USES:${OBJ}`, `USES:${FIELD}`]);
  });

  it('binds a name defined once, even in another package', () => {
    const graph = createKnowledgeGraph();
    const OTHER_FLOW = 'pkgs/other/main/default/flows/Example_Flow.flow-meta.xml';
    const dmlXml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <recordLookups>
        <name>Get_Contact</name>
        <object>Contact</object>
    </recordLookups>
</Flow>`;
    withFiles(graph, [OBJ, OTHER_FLOW]);
    processSalesforceMetadata(graph, [
      { path: OBJ, content: objectXml },
      { path: OTHER_FLOW, content: dmlXml },
    ]);

    const uses = edgesFrom(graph, recordId(graph, 'Example_Flow'))
      .filter((r) => r.type === 'USES')
      .map((r) => graph.getNode(r.targetId)?.properties.filePath);
    expect(uses).toEqual([OBJ]);
  });

  it('binds a rule to a field defined once, even in another package', () => {
    const graph = createKnowledgeGraph();
    const RULE_C =
      'pkgs/other/main/default/objects/Contact/validationRules/Name_Required.validationRule-meta.xml';
    withFiles(graph, [FIELD, RULE_C]);
    processSalesforceMetadata(graph, [
      { path: FIELD, content: fieldXml },
      { path: RULE_C, content: ruleXml },
    ]);

    // A name only one package defines is not ambiguous, whichever tree refers to it.
    const uses = [...graph.iterRelationships()]
      .filter((r) => r.type === 'USES')
      .map((r) => graph.getNode(r.targetId)?.properties.filePath);
    expect(uses).toEqual([FIELD]);
  });

  it('refuses to bind when two other packages define the name and neither is its own', () => {
    const graph = createKnowledgeGraph();
    const FIELD_B =
      'pkgs/vendored/main/default/objects/Contact/fields/External_Id__c.field-meta.xml';
    const RULE_C =
      'pkgs/other/main/default/objects/Contact/validationRules/Name_Required.validationRule-meta.xml';
    withFiles(graph, [FIELD, FIELD_B, RULE_C]);

    processSalesforceMetadata(graph, [
      { path: FIELD, content: fieldXml },
      { path: FIELD_B, content: fieldXml },
      { path: RULE_C, content: ruleXml },
    ]);

    // Ambiguous target: emitting no edge beats picking one arbitrarily and
    // minting a binding that points at the wrong package's field.
    const uses = [...graph.iterRelationships()].filter((r) => r.type === 'USES');
    expect(uses).toEqual([]);
  });

  it('refuses to bind a flow action when two classes share the name', () => {
    const graph = createKnowledgeGraph();
    withFiles(graph, [FLOW]);
    addApexClass(graph, 'AuditLogger', 'pkgs/a/classes/AuditLogger.cls');
    addApexClass(graph, 'AuditLogger', 'pkgs/b/classes/AuditLogger.cls');

    processSalesforceMetadata(graph, [{ path: FLOW, content: flowXml }]);

    const flowId = recordId(graph, 'Example_Flow');
    expect(edgesFrom(graph, flowId).filter((r) => r.type === 'CALLS')).toEqual([]);
  });

  it('binds a flow action only to a top-level class, not an inner class of the same name', () => {
    const graph = createKnowledgeGraph();
    withFiles(graph, [FLOW]);
    // The parser emits an inner class as a Class node on its outer class's
    // file. A flow can only name a top-level class, which Apex names for its file.
    addApexClass(graph, 'AuditLogger', 'pkgs/x/classes/Utils.cls');
    const topLevel = addApexClass(graph, 'AuditLogger', 'pkgs/y/classes/AuditLogger.CLS');

    processSalesforceMetadata(graph, [{ path: FLOW, content: flowXml }]);

    const calls = edgesFrom(graph, recordId(graph, 'Example_Flow')).filter(
      (r) => r.type === 'CALLS',
    );
    expect(calls.map((r) => r.targetId)).toEqual([topLevel]);
  });

  it('never binds a flow action to a non-Apex class of the same name', () => {
    const graph = createKnowledgeGraph();
    withFiles(graph, [FLOW]);
    addApexClass(graph, 'AuditLogger', 'src/logging/AuditLogger.ts');

    processSalesforceMetadata(graph, [{ path: FLOW, content: flowXml }]);

    const flowId = recordId(graph, 'Example_Flow');
    expect(edgesFrom(graph, flowId).filter((r) => r.type === 'CALLS')).toEqual([]);
  });

  it('does not bind a cross-object formula reference to the local same-named field', () => {
    const graph = createKnowledgeGraph();
    const LOCAL_STATUS = 'pkgs/acme/main/default/objects/Contact/fields/Status__c.field-meta.xml';
    const CROSS_RULE =
      'pkgs/acme/main/default/objects/Contact/validationRules/Cross.validationRule-meta.xml';
    const crossRuleXml = `<?xml version="1.0" encoding="UTF-8" ?>
<ValidationRule xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Cross</fullName>
    <errorConditionFormula>ISPICKVAL(Account__r.Status__c, "x")</errorConditionFormula>
</ValidationRule>`;
    withFiles(graph, [OBJ, LOCAL_STATUS, CROSS_RULE]);

    processSalesforceMetadata(graph, [
      { path: OBJ, content: objectXml },
      { path: LOCAL_STATUS, content: fieldXml },
      { path: CROSS_RULE, content: crossRuleXml },
    ]);

    // Account__r.Status__c is Account's field, not Contact's. Qualifying the
    // bare token with the rule's own object would point at the wrong record.
    const uses = [...graph.iterRelationships()].filter((r) => r.type === 'USES');
    expect(uses).toEqual([]);
  });

  it('ignores references and actions that are commented out', () => {
    const graph = createKnowledgeGraph();
    const COMMENTED_RULE =
      'pkgs/acme/main/default/objects/Contact/validationRules/Commented.validationRule-meta.xml';
    const commentedRuleXml = `<?xml version="1.0" encoding="UTF-8" ?>
<ValidationRule xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Commented</fullName>
    <errorConditionFormula><!-- ISBLANK(External_Id__c) --> TRUE</errorConditionFormula>
</ValidationRule>`;
    const commentedFlowXml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <!-- <actionCalls>
        <actionName>AuditLogger</actionName>
        <actionType>apex</actionType>
    </actionCalls> -->
</Flow>`;
    withFiles(graph, [OBJ, FIELD, COMMENTED_RULE, FLOW]);
    addApexClass(graph, 'AuditLogger', 'pkgs/x/classes/AuditLogger.cls');

    processSalesforceMetadata(graph, [
      { path: OBJ, content: objectXml },
      { path: FIELD, content: fieldXml },
      { path: COMMENTED_RULE, content: commentedRuleXml },
      { path: FLOW, content: commentedFlowXml },
    ]);

    // A commented-out clause or action is not live; it must not keep a blast radius.
    const rels = [...graph.iterRelationships()];
    expect(rels.filter((r) => r.type === 'USES')).toEqual([]);
    expect(rels.filter((r) => r.type === 'CALLS')).toEqual([]);
  });

  it('ignores field references inside formula comments', () => {
    const graph = createKnowledgeGraph();
    const OLD = 'pkgs/acme/main/default/objects/Contact/fields/Old_Field__c.field-meta.xml';
    const ruleWithFormulaComment = `<?xml version="1.0" encoding="UTF-8" ?>
<ValidationRule xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Name_Required</fullName>
    <errorConditionFormula>/* ISBLANK(Old_Field__c) || */ ISBLANK(External_Id__c)</errorConditionFormula>
</ValidationRule>`;
    withFiles(graph, [FIELD, OLD, RULE]);

    processSalesforceMetadata(graph, [
      { path: FIELD, content: fieldXml },
      { path: OLD, content: fieldXml },
      { path: RULE, content: ruleWithFormulaComment },
    ]);

    // `/* */` is the formula language's own comment; a clause inside it is not live.
    const uses = edgesFrom(graph, recordId(graph, 'Contact.Name_Required'))
      .filter((r) => r.type === 'USES')
      .map((r) => graph.getNode(r.targetId)?.properties.name);
    expect(uses).toEqual(['Contact.External_Id__c']);
  });

  it('links a validation rule to the custom field its error is displayed on', () => {
    const graph = createKnowledgeGraph();
    const displayedRule = `<?xml version="1.0" encoding="UTF-8" ?>
<ValidationRule xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Name_Required</fullName>
    <errorConditionFormula>TRUE</errorConditionFormula>
    <errorDisplayField>External_Id__c</errorDisplayField>
</ValidationRule>`;
    withFiles(graph, [FIELD, RULE]);

    processSalesforceMetadata(graph, [
      { path: FIELD, content: fieldXml },
      { path: RULE, content: displayedRule },
    ]);

    // The element holds the bare name alone, so it matches only at the start.
    const uses = edgesFrom(graph, recordId(graph, 'Contact.Name_Required'))
      .filter((r) => r.type === 'USES')
      .map((r) => graph.getNode(r.targetId)?.properties.name);
    expect(uses).toEqual(['Contact.External_Id__c']);
  });

  it('points each Record at its declaring line, not at the XML prolog', () => {
    const graph = createKnowledgeGraph();
    withFiles(graph, [FIELD]);
    processSalesforceMetadata(graph, [{ path: FIELD, content: fieldXml }]);

    // The FTS snippet is the exact source span (`csv-generator`), so 0,0 would
    // index `<?xml version="1.0" ...?>` for every metadata node in the repo.
    const node = [...graph.iterNodes()].find((n) => n.label === 'Record')!;
    const declLine = fieldXml.split('\n').findIndex((l) => l.includes('<fullName>'));
    expect(node.properties.startLine).toBe(declLine);
  });

  it('spans each Record to the end of its file, so an edit anywhere in the body touches it', () => {
    const graph = createKnowledgeGraph();
    withFiles(graph, [OBJ, FIELD, FLOW]);
    processSalesforceMetadata(graph, [
      { path: OBJ, content: objectXml },
      { path: FIELD, content: fieldXml },
      { path: FLOW, content: flowXml },
    ]);

    // `detect_changes` maps diff hunks to symbols by line overlap, and each
    // metadata file declares exactly one entity. Objects and flows carry no
    // `<fullName>`, so they start at their root element.
    const span = (path: string) => {
      const n = [...graph.iterNodes()].find(
        (x) => x.label === 'Record' && x.properties.filePath === path,
      )!;
      return [n.properties.startLine, n.properties.endLine];
    };
    const lastLine = (xml: string) => xml.split('\n').length - 1;
    const rootLine = (xml: string, tag: string) =>
      xml.split('\n').findIndex((l) => l.startsWith(tag));
    expect(span(OBJ)).toEqual([rootLine(objectXml, '<CustomObject'), lastLine(objectXml)]);
    expect(span(FLOW)).toEqual([rootLine(flowXml, '<Flow'), lastLine(flowXml)]);
    expect(span(FIELD)[1]).toBe(lastLine(fieldXml));
  });

  it('keeps line numbers aligned with the real file when comments are stripped', () => {
    const graph = createKnowledgeGraph();
    const MULTILINE = 'pkgs/acme/main/default/objects/Contact/fields/X__c.field-meta.xml';
    const withComment = `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <!-- a comment
         spanning
         three lines -->
    <fullName>X__c</fullName>
</CustomField>`;
    withFiles(graph, [MULTILINE]);
    processSalesforceMetadata(graph, [{ path: MULTILINE, content: withComment }]);

    // FTS reads the real file off disk, so a stripped comment must not shift
    // the line the node points at.
    const node = [...graph.iterNodes()].find((n) => n.label === 'Record')!;
    expect(withComment.split('\n')[node.properties.startLine as number]).toContain('<fullName>');
  });

  it('links a flow to the subflow it invokes', () => {
    const graph = createKnowledgeGraph();
    const TARGET = 'pkgs/acme/main/default/flows/Child_Flow.flow-meta.xml';
    const callerXml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <subflows>
        <name>Create_Child_Record</name>
        <flowName>Child_Flow</flowName>
    </subflows>
</Flow>`;
    withFiles(graph, [FLOW, TARGET]);
    processSalesforceMetadata(graph, [
      { path: FLOW, content: callerXml },
      { path: TARGET, content: '<Flow/>' },
    ]);

    const calls = edgesFrom(graph, recordId(graph, 'Example_Flow')).filter(
      (r) => r.type === 'CALLS',
    );
    expect(calls.map((r) => graph.getNode(r.targetId)?.properties.name)).toEqual(['Child_Flow']);
  });

  it('links a flow to an Apex plugin class', () => {
    const graph = createKnowledgeGraph();
    const pluginXml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <apexPluginCalls>
        <name>Legacy</name>
        <apexClass>AuditLogger</apexClass>
    </apexPluginCalls>
</Flow>`;
    withFiles(graph, [FLOW]);
    const classId = addApexClass(graph, 'AuditLogger', 'pkgs/x/classes/AuditLogger.cls');
    processSalesforceMetadata(graph, [{ path: FLOW, content: pluginXml }]);

    const calls = edgesFrom(graph, recordId(graph, 'Example_Flow')).filter(
      (r) => r.type === 'CALLS',
    );
    expect(calls.map((r) => r.targetId)).toEqual([classId]);
  });

  it('links a flow to the object and fields its record operations touch', () => {
    const graph = createKnowledgeGraph();
    const STATUS = 'pkgs/acme/main/default/objects/Contact/fields/Status__c.field-meta.xml';
    const dmlXml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <recordLookups>
        <name>Get_Contact</name>
        <filters>
            <field>Status__c</field>
        </filters>
        <object>Contact</object>
    </recordLookups>
</Flow>`;
    withFiles(graph, [OBJ, STATUS, FLOW]);
    processSalesforceMetadata(graph, [
      { path: OBJ, content: objectXml },
      { path: STATUS, content: fieldXml },
      { path: FLOW, content: dmlXml },
    ]);

    // The block declares its own <object>, so unlike a validation-rule formula
    // the bare field name here is qualified by real metadata, not a guess.
    const uses = edgesFrom(graph, recordId(graph, 'Example_Flow'))
      .filter((r) => r.type === 'USES')
      .map((r) => graph.getNode(r.targetId)?.properties.name)
      .sort();
    expect(uses).toEqual(['Contact', 'Contact.Status__c']);
  });

  it.each(['recordCreates', 'recordUpdates', 'recordDeletes'])(
    'links a flow to the object and fields a %s block touches',
    (element) => {
      const graph = createKnowledgeGraph();
      const STATUS = 'pkgs/acme/main/default/objects/Contact/fields/Status__c.field-meta.xml';
      const dmlXml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <${element}>
        <name>Touch_Contact</name>
        <inputAssignments>
            <field>Status__c</field>
        </inputAssignments>
        <object>Contact</object>
    </${element}>
</Flow>`;
      withFiles(graph, [OBJ, STATUS, FLOW]);
      processSalesforceMetadata(graph, [
        { path: OBJ, content: objectXml },
        { path: STATUS, content: fieldXml },
        { path: FLOW, content: dmlXml },
      ]);

      const uses = edgesFrom(graph, recordId(graph, 'Example_Flow'))
        .filter((r) => r.type === 'USES')
        .map((r) => graph.getNode(r.targetId)?.properties.name)
        .sort();
      expect(uses).toEqual(['Contact', 'Contact.Status__c']);
    },
  );

  it("qualifies a DML block's fields by that block's own object, not another block's", () => {
    const graph = createKnowledgeGraph();
    const STATUS = 'pkgs/acme/main/default/objects/Contact/fields/Status__c.field-meta.xml';
    const mixedXml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <recordLookups>
        <name>Get_Contact</name>
        <object>Contact</object>
    </recordLookups>
    <recordUpdates>
        <name>Update_It</name>
        <inputReference>someVar</inputReference>
        <inputAssignments>
            <field>Status__c</field>
        </inputAssignments>
    </recordUpdates>
</Flow>`;
    withFiles(graph, [OBJ, STATUS, FLOW]);
    processSalesforceMetadata(graph, [
      { path: OBJ, content: objectXml },
      { path: STATUS, content: fieldXml },
      { path: FLOW, content: mixedXml },
    ]);

    const uses = edgesFrom(graph, recordId(graph, 'Example_Flow'))
      .filter((r) => r.type === 'USES')
      .map((r) => graph.getNode(r.targetId)?.properties.name);
    expect(uses).toEqual(['Contact']);
  });

  it('resolves flow references to objects, fields and subflows regardless of case', () => {
    const graph = createKnowledgeGraph();
    const STATUS = 'pkgs/acme/main/default/objects/Contact/fields/Status__c.field-meta.xml';
    const CHILD = 'pkgs/acme/main/default/flows/Child_Flow.flow-meta.xml';
    const upperXml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <recordLookups>
        <name>Get_Contact</name>
        <filters>
            <field>STATUS__C</field>
        </filters>
        <object>CONTACT</object>
    </recordLookups>
    <subflows>
        <name>Run_Child</name>
        <flowName>CHILD_FLOW</flowName>
    </subflows>
</Flow>`;
    withFiles(graph, [OBJ, STATUS, FLOW, CHILD]);
    processSalesforceMetadata(graph, [
      { path: OBJ, content: objectXml },
      { path: STATUS, content: fieldXml },
      { path: FLOW, content: upperXml },
      { path: CHILD, content: '<Flow/>' },
    ]);

    const targets = edgesFrom(graph, recordId(graph, 'Example_Flow'))
      .filter((r) => r.type === 'USES' || r.type === 'CALLS')
      .map((r) => `${r.type}:${graph.getNode(r.targetId)?.properties.name}`)
      .sort();
    expect(targets).toEqual(['CALLS:Child_Flow', 'USES:Contact', 'USES:Contact.Status__c']);
  });

  it('does not link a flow that invokes itself as a subflow', () => {
    const graph = createKnowledgeGraph();
    const selfXml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <subflows>
        <name>Recurse</name>
        <flowName>Example_Flow</flowName>
    </subflows>
</Flow>`;
    withFiles(graph, [FLOW]);
    const result = processSalesforceMetadata(graph, [{ path: FLOW, content: selfXml }]);

    expect([...graph.iterRelationships()].filter((r) => r.type === 'CALLS')).toEqual([]);
    expect(result.edges).toBe(graph.relationshipCount);
  });

  it('counts an edge once when several operations link the same pair', () => {
    const graph = createKnowledgeGraph();
    const STATUS = 'pkgs/acme/main/default/objects/Contact/fields/Status__c.field-meta.xml';
    const lookup = (name: string) => `
    <recordLookups>
        <name>${name}</name>
        <filters>
            <field>Status__c</field>
        </filters>
        <object>Contact</object>
    </recordLookups>`;
    const dmlXml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">${lookup('Get_One')}${lookup('Get_Two')}
</Flow>`;
    withFiles(graph, [OBJ, STATUS, FLOW]);
    const result = processSalesforceMetadata(graph, [
      { path: OBJ, content: objectXml },
      { path: STATUS, content: fieldXml },
      { path: FLOW, content: dmlXml },
    ]);

    // Edge ids are derived from (type, source, target), so the second lookup
    // re-links pairs the graph already holds; the reported count must not count it.
    expect(result.edges).toBe(graph.relationshipCount);
  });

  it('does not bind record-operation fields when the block declares no object', () => {
    const graph = createKnowledgeGraph();
    const STATUS = 'pkgs/acme/main/default/objects/Contact/fields/Status__c.field-meta.xml';
    const noObjectXml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <recordUpdates>
        <name>Update_It</name>
        <inputReference>someVar</inputReference>
        <inputAssignments>
            <field>Status__c</field>
        </inputAssignments>
    </recordUpdates>
</Flow>`;
    withFiles(graph, [OBJ, STATUS, FLOW]);
    processSalesforceMetadata(graph, [
      { path: OBJ, content: objectXml },
      { path: STATUS, content: fieldXml },
      { path: FLOW, content: noObjectXml },
    ]);

    expect([...graph.iterRelationships()].filter((r) => r.type === 'USES')).toEqual([]);
  });

  it('links a formula field to the fields its formula reads', () => {
    const graph = createKnowledgeGraph();
    const FORMULA = 'pkgs/acme/main/default/objects/Contact/fields/Age__c.field-meta.xml';
    const formulaXml = `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Age__c</fullName>
    <formula>TODAY() &gt; External_Id__c</formula>
</CustomField>`;
    withFiles(graph, [OBJ, FIELD, FORMULA]);
    processSalesforceMetadata(graph, [
      { path: OBJ, content: objectXml },
      { path: FIELD, content: fieldXml },
      { path: FORMULA, content: formulaXml },
    ]);

    const uses = edgesFrom(graph, recordId(graph, 'Contact.Age__c'))
      .filter((r) => r.type === 'USES')
      .map((r) => graph.getNode(r.targetId)?.properties.name);
    expect(uses).toEqual(['Contact.External_Id__c']);
  });

  it('counts an edge once when a formula names the same field in two casings', () => {
    const graph = createKnowledgeGraph();
    const casedRule = `<?xml version="1.0" encoding="UTF-8" ?>
<ValidationRule xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Name_Required</fullName>
    <errorConditionFormula>ISBLANK(External_Id__c) || ISBLANK(external_id__c)</errorConditionFormula>
</ValidationRule>`;
    withFiles(graph, [FIELD, RULE]);
    const result = processSalesforceMetadata(graph, [
      { path: FIELD, content: fieldXml },
      { path: RULE, content: casedRule },
    ]);

    // Both casings resolve to one field, so the second link re-writes an edge
    // the graph already holds; the reported count must not count it.
    expect(result.edges).toBe(graph.relationshipCount);
  });

  it('does not link a formula field to itself', () => {
    const graph = createKnowledgeGraph();
    const SELF = 'pkgs/acme/main/default/objects/Contact/fields/Score__c.field-meta.xml';
    const selfXml = `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Score__c</fullName>
    <formula>Score__c + 1</formula>
</CustomField>`;
    withFiles(graph, [SELF]);
    const result = processSalesforceMetadata(graph, [{ path: SELF, content: selfXml }]);

    expect([...graph.iterRelationships()].filter((r) => r.type === 'USES')).toEqual([]);
    expect(result.edges).toBe(graph.relationshipCount);
  });

  it('ignores files that are not Salesforce metadata', () => {
    const graph = createKnowledgeGraph();
    withFiles(graph, ['src/index.ts', 'pom.xml']);

    const result = processSalesforceMetadata(graph, [
      { path: 'src/index.ts', content: 'export const a = 1;' },
      { path: 'pom.xml', content: '<project><name>x</name></project>' },
    ]);

    expect(result).toMatchObject({ objects: 0, fields: 0, validationRules: 0, flows: 0 });
    expect([...graph.iterNodes()].filter((n) => n.label === 'Record')).toEqual([]);
  });
});
