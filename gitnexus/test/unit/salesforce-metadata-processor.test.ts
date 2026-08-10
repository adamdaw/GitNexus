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

    const fieldId = generateId('Record', '<sf-field>:Contact.VDM_Id__c');
    const refs = edgesFrom(graph, fieldId).filter((r) => r.type === 'MEMBER_OF');
    expect(refs).toHaveLength(1);
    expect(graph.getNode(refs[0].targetId)?.properties.name).toBe('Contact');
  });

  it('links a validation rule to the fields its formula names', () => {
    const graph = createKnowledgeGraph();
    withFiles(graph, [OBJ, FIELD, RULE]);
    processSalesforceMetadata(graph, [
      { path: OBJ, content: objectXml },
      { path: FIELD, content: fieldXml },
      { path: RULE, content: ruleXml },
    ]);

    const ruleId = generateId('Record', '<sf-validationrule>:Contact.First_Name_is_Required');
    const byType = (t: string) =>
      edgesFrom(graph, ruleId)
        .filter((r) => r.type === t)
        .map((r) => graph.getNode(r.targetId)?.properties.name)
        .sort();

    // MEMBER_OF: the object the rule is defined on.
    expect(byType('MEMBER_OF')).toEqual(['Contact']);
    // ACCESSES: the custom field its formula reads. FirstName is standard, has
    // no -meta.xml, and so has no node to point at — it is absent, not dangling.
    expect(byType('ACCESSES')).toEqual(['Contact.VDM_Id__c']);
  });

  it('links a flow to the Apex class an apex action invokes, matching case-insensitively', () => {
    const graph = createKnowledgeGraph();
    withFiles(graph, [FLOW]);
    const classId = addApexClass(graph, 'FlowLogEntry', 'pkgs/x/classes/FlowLogEntry.cls');

    processSalesforceMetadata(graph, [{ path: FLOW, content: flowXml }]);

    const flowId = generateId('Record', '<sf-flow>:Update_Case_Records');
    const calls = edgesFrom(graph, flowId).filter((r) => r.type === 'CALLS');
    expect(calls).toHaveLength(1);
    expect(calls[0].targetId).toBe(classId);
  });

  it('ignores non-apex action types rather than inventing an edge', () => {
    const graph = createKnowledgeGraph();
    withFiles(graph, [FLOW]);
    addApexClass(graph, 'emailSimple', 'pkgs/x/classes/emailSimple.cls');

    processSalesforceMetadata(graph, [{ path: FLOW, content: flowXml }]);

    const flowId = generateId('Record', '<sf-flow>:Update_Case_Records');
    expect(edgesFrom(graph, flowId).filter((r) => r.type === 'CALLS')).toEqual([]);
  });

  it('drops an apex action whose class is not in the graph instead of dangling', () => {
    const graph = createKnowledgeGraph();
    withFiles(graph, [FLOW]);

    processSalesforceMetadata(graph, [{ path: FLOW, content: flowXml }]);

    const flowId = generateId('Record', '<sf-flow>:Update_Case_Records');
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
