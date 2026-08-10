import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { salesforceMetadataPhase } from '../../../src/core/ingestion/pipeline-phases/salesforce-metadata.js';
import type {
  PipelineContext,
  PhaseResult,
} from '../../../src/core/ingestion/pipeline-phases/types.js';
import { createKnowledgeGraph } from '../../../src/core/graph/graph.js';
import { generateId } from '../../../src/lib/utils.js';
import type { KnowledgeGraph } from '../../../src/core/graph/types.js';

function structureDeps(paths: string[]): ReadonlyMap<string, PhaseResult<unknown>> {
  return new Map([
    [
      'structure',
      {
        phaseName: 'structure',
        durationMs: 0,
        output: { scannedFiles: paths.map((p) => ({ path: p })) },
      },
    ],
  ]);
}

function ctxFor(repoPath: string, graph: KnowledgeGraph): PipelineContext {
  return {
    repoPath,
    graph,
    onProgress: () => {},
    pipelineStart: 0,
  } as PipelineContext;
}

/** Writes `files` into a throwaway repo and returns its path. */
function repoWith(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gn-sfmeta-phase-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return root;
}

const FIELD = 'objects/Contact/fields/VDM_Id__c.field-meta.xml';
const fieldXml = `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>VDM_Id__c</fullName>
</CustomField>`;

describe('salesforceMetadataPhase', () => {
  it('declares parse as a dependency, not just structure', () => {
    // Load-bearing: the flow->Apex edge resolves against Class nodes, which do
    // not exist until parse has run. The registry test asserts REGISTRATION
    // order, which cannot catch this — the runner orders by deps.
    expect(salesforceMetadataPhase.deps).toContain('parse');
    expect(salesforceMetadataPhase.deps).toContain('structure');
  });

  it('returns a fresh zero result when the repo has no Salesforce metadata', async () => {
    const graph = createKnowledgeGraph();
    const root = repoWith({ 'pom.xml': '<project><name>x</name></project>' });

    const first = await salesforceMetadataPhase.execute(
      ctxFor(root, graph),
      structureDeps(['pom.xml']),
    );
    const second = await salesforceMetadataPhase.execute(
      ctxFor(root, graph),
      structureDeps(['pom.xml']),
    );

    expect(first).toEqual({ objects: 0, fields: 0, validationRules: 0, flows: 0, edges: 0 });
    // A shared module-level constant handed out by reference lets one caller's
    // mutation corrupt every later run.
    expect(first).not.toBe(second);
  });

  it('reads only -meta.xml, leaving an unrelated xml corpus untouched', async () => {
    const graph = createKnowledgeGraph();
    const root = repoWith({
      [FIELD]: fieldXml,
      'build/pom.xml': '<project><fullName>NotSalesforce__c</fullName></project>',
    });
    graph.addNode({
      id: generateId('File', FIELD),
      label: 'File',
      properties: { name: 'VDM_Id__c.field-meta.xml', filePath: FIELD, startLine: 0, endLine: 0 },
    });

    const result = await salesforceMetadataPhase.execute(
      ctxFor(root, graph),
      structureDeps([FIELD, 'build/pom.xml']),
    );

    expect(result.fields).toBe(1);
    const names = [...graph.iterNodes()]
      .filter((n) => n.label === 'Record')
      .map((n) => n.properties.name);
    expect(names).toEqual(['Contact.VDM_Id__c']);
  });
});
