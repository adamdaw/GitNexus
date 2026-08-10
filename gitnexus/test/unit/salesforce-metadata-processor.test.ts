import { describe, it, expect } from 'vitest';
import { processSalesforceMetadata } from '../../src/core/ingestion/salesforce-metadata-processor.js';
import { createKnowledgeGraph } from '../../src/core/graph/graph.js';
import { parseRelationSchemaPairs } from '../../src/core/lbug/rel-pair-routing.js';
import { RELATION_SCHEMA } from '../../src/core/lbug/schema.js';
import { generateId } from '../../src/lib/utils.js';
import type { KnowledgeGraph } from '../../src/core/graph/types.js';

const OBJ = 'pkgs/vacatia/main/default/objects/Contact/Contact.object-meta.xml';
const FIELD = 'pkgs/vacatia/main/default/objects/Contact/fields/VDM_Id__c.field-meta.xml';
const RULE =
  'pkgs/vacatia/main/default/objects/Contact/validationRules/First_Name_is_Required.validationRule-meta.xml';
const FLOW = 'pkgs/vacatia/main/default/flows/Update_Case_Records.flow-meta.xml';

const objectXml = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Contact</label>
</CustomObject>`;

const fieldXml = `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>VDM_Id__c</fullName>
    <label>VDM Id</label>
    <type>Text</type>
</CustomField>`;

const ruleXml = `<?xml version="1.0" encoding="UTF-8" ?>
<ValidationRule xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>First_Name_is_Required</fullName>
    <active>true</active>
    <errorConditionFormula>ISBLANK(VDM_Id__c)</errorConditionFormula>
    <errorDisplayField>FirstName</errorDisplayField>
</ValidationRule>`;

const flowXml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <actionCalls>
        <name>Log_It</name>
        <actionName>FlowLogEntry</actionName>
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
      'Contact.First_Name_is_Required',
      'Contact.VDM_Id__c',
      'Update_Case_Records',
    ]);
  });

  it('anchors each Record to its own File node', () => {
    const graph = createKnowledgeGraph();
    withFiles(graph, [OBJ, FIELD, RULE, FLOW]);
    processSalesforceMetadata(graph, allFiles());

    const contains = [...graph.iterRelationships()].filter(
      (r) => r.type === 'CONTAINS' && r.sourceId === generateId('File', FIELD),
    );
    expect(contains).toHaveLength(1);
    expect(graph.getNode(contains[0].targetId)?.properties.name).toBe('Contact.VDM_Id__c');
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
    expect(owned).toEqual(['Contact.VDM_Id__c']);
  });

  it('links a validation rule to the fields its formula names', () => {
    const graph = createKnowledgeGraph();
    withFiles(graph, [OBJ, FIELD, RULE]);
    processSalesforceMetadata(graph, [
      { path: OBJ, content: objectXml },
      { path: FIELD, content: fieldXml },
      { path: RULE, content: ruleXml },
    ]);

    const ruleId = recordId(graph, 'Contact.First_Name_is_Required');
    const byType = (t: string) =>
      edgesFrom(graph, ruleId)
        .filter((r) => r.type === t)
        .map((r) => graph.getNode(r.targetId)?.properties.name)
        .sort();

    // USES, not ACCESSES: impact()'s default traversal set excludes ACCESSES,
    // so an ACCESSES edge here is real in Cypher and invisible to impact().
    // The custom field its formula reads. FirstName is standard, has no
    // -meta.xml, and so has no node to point at — absent, not dangling.
    expect(byType('USES')).toEqual(['Contact.VDM_Id__c']);

    // and the object owns the rule, in the container->member direction
    const objId = recordId(graph, 'Contact');
    const owned = edgesFrom(graph, objId)
      .filter((r) => r.type === 'CONTAINS')
      .map((r) => graph.getNode(r.targetId)?.properties.name)
      .sort();
    expect(owned).toEqual(['Contact.First_Name_is_Required', 'Contact.VDM_Id__c']);
  });

  it('emits only edge types impact() traverses by default', () => {
    const graph = createKnowledgeGraph();
    withFiles(graph, [OBJ, FIELD, RULE, FLOW]);
    addApexClass(graph, 'FlowLogEntry', 'pkgs/x/classes/FlowLogEntry.cls');
    processSalesforceMetadata(graph, allFiles());

    // The blast-radius edges must be inside impact()'s default relation set or
    // they are invisible to it — the defect the first live reindex exposed.
    // CONTAINS is exempt: containment is structure, not blast radius.
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
    // Class casing deliberately differs from the flow's <actionName>FlowLogEntry:
    // identical strings on both sides would pass without any fold at all.
    const classId = addApexClass(graph, 'flowlogentry', 'pkgs/x/classes/flowlogentry.cls');

    processSalesforceMetadata(graph, [{ path: FLOW, content: flowXml }]);

    const flowId = recordId(graph, 'Update_Case_Records');
    const calls = edgesFrom(graph, flowId).filter((r) => r.type === 'CALLS');
    expect(calls).toHaveLength(1);
    expect(calls[0].targetId).toBe(classId);
  });

  it('ignores non-apex action types rather than inventing an edge', () => {
    const graph = createKnowledgeGraph();
    withFiles(graph, [FLOW]);
    addApexClass(graph, 'emailSimple', 'pkgs/x/classes/emailSimple.cls');

    processSalesforceMetadata(graph, [{ path: FLOW, content: flowXml }]);

    const flowId = recordId(graph, 'Update_Case_Records');
    expect(edgesFrom(graph, flowId).filter((r) => r.type === 'CALLS')).toEqual([]);
  });

  it('drops an apex action whose class is not in the graph instead of dangling', () => {
    const graph = createKnowledgeGraph();
    withFiles(graph, [FLOW]);

    processSalesforceMetadata(graph, [{ path: FLOW, content: flowXml }]);

    const flowId = recordId(graph, 'Update_Case_Records');
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
    addApexClass(graph, 'FlowLogEntry', 'pkgs/x/classes/FlowLogEntry.cls');
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
    const FIELD_B = 'pkgs/vendored/main/default/objects/Contact/fields/VDM_Id__c.field-meta.xml';
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

  it('refuses to bind a formula reference when two packages define the field', () => {
    const graph = createKnowledgeGraph();
    const FIELD_B = 'pkgs/vendored/main/default/objects/Contact/fields/VDM_Id__c.field-meta.xml';
    withFiles(graph, [OBJ, FIELD, FIELD_B, RULE]);

    processSalesforceMetadata(graph, [
      { path: OBJ, content: objectXml },
      { path: FIELD, content: fieldXml },
      { path: FIELD_B, content: fieldXml },
      { path: RULE, content: ruleXml },
    ]);

    // Ambiguous target: emitting no edge beats picking one arbitrarily and
    // minting a binding that points at the wrong package's field.
    const uses = [...graph.iterRelationships()].filter((r) => r.type === 'USES');
    expect(uses).toEqual([]);
  });

  it('refuses to bind a flow action when two classes share the name', () => {
    const graph = createKnowledgeGraph();
    withFiles(graph, [FLOW]);
    addApexClass(graph, 'FlowLogEntry', 'pkgs/a/classes/FlowLogEntry.cls');
    addApexClass(graph, 'FlowLogEntry', 'pkgs/b/classes/FlowLogEntry.cls');

    processSalesforceMetadata(graph, [{ path: FLOW, content: flowXml }]);

    const flowId = recordId(graph, 'Update_Case_Records');
    expect(edgesFrom(graph, flowId).filter((r) => r.type === 'CALLS')).toEqual([]);
  });

  it('never binds a flow action to a non-Apex class of the same name', () => {
    const graph = createKnowledgeGraph();
    withFiles(graph, [FLOW]);
    addApexClass(graph, 'FlowLogEntry', 'src/logging/FlowLogEntry.ts');

    processSalesforceMetadata(graph, [{ path: FLOW, content: flowXml }]);

    const flowId = recordId(graph, 'Update_Case_Records');
    expect(edgesFrom(graph, flowId).filter((r) => r.type === 'CALLS')).toEqual([]);
  });

  it('does not bind a cross-object formula reference to the local same-named field', () => {
    const graph = createKnowledgeGraph();
    const LOCAL_STATUS =
      'pkgs/vacatia/main/default/objects/Contact/fields/Status__c.field-meta.xml';
    const CROSS_RULE =
      'pkgs/vacatia/main/default/objects/Contact/validationRules/Cross.validationRule-meta.xml';
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
      'pkgs/vacatia/main/default/objects/Contact/validationRules/Commented.validationRule-meta.xml';
    const commentedRuleXml = `<?xml version="1.0" encoding="UTF-8" ?>
<ValidationRule xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Commented</fullName>
    <errorConditionFormula><!-- ISBLANK(VDM_Id__c) --> TRUE</errorConditionFormula>
</ValidationRule>`;
    const commentedFlowXml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <!-- <actionCalls>
        <actionName>FlowLogEntry</actionName>
        <actionType>apex</actionType>
    </actionCalls> -->
</Flow>`;
    withFiles(graph, [OBJ, FIELD, COMMENTED_RULE, FLOW]);
    addApexClass(graph, 'FlowLogEntry', 'pkgs/x/classes/FlowLogEntry.cls');

    processSalesforceMetadata(graph, [
      { path: OBJ, content: objectXml },
      { path: FIELD, content: fieldXml },
      { path: COMMENTED_RULE, content: commentedRuleXml },
      { path: FLOW, content: commentedFlowXml },
    ]);

    // Commenting a clause out is how a rule or action gets disabled during
    // maintenance; it must not keep its blast radius.
    const rels = [...graph.iterRelationships()];
    expect(rels.filter((r) => r.type === 'USES')).toEqual([]);
    expect(rels.filter((r) => r.type === 'CALLS')).toEqual([]);
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
    expect(node.properties.endLine).toBe(declLine);
  });

  it('keeps line numbers aligned with the real file when comments are stripped', () => {
    const graph = createKnowledgeGraph();
    const MULTILINE = 'pkgs/vacatia/main/default/objects/Contact/fields/X__c.field-meta.xml';
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
