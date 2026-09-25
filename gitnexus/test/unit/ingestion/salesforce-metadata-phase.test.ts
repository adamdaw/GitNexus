import { afterEach, describe, it, expect, vi } from 'vitest';
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
import { readFileContents } from '../../../src/core/ingestion/filesystem-walker.js';

// Pass-through spy: the phase's path narrowing is only observable in
// which files get read, since the processor ignores other paths either way.
vi.mock('../../../src/core/ingestion/filesystem-walker.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../src/core/ingestion/filesystem-walker.js')>();
  return { ...actual, readFileContents: vi.fn(actual.readFileContents) };
});

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

const tempRoots: string[] = [];
afterEach(() => {
  for (const root of tempRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

/** Writes `files` into a throwaway repo and returns its path. */
function repoWith(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gn-sfmeta-phase-'));
  tempRoots.push(root);
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return root;
}

const FIELD = 'objects/Contact/fields/External_Id__c.field-meta.xml';
const PROFILE = 'profiles/Admin.profile-meta.xml';
const OBJECT = 'objects/Contact/Contact.object-meta.xml';
const RULE = 'objects/Contact/validationRules/Name_Required.validationRule-meta.xml';
const fieldXml = `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>External_Id__c</fullName>
</CustomField>`;

describe('salesforceMetadataPhase', () => {
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

    expect(first).toEqual({ objects: 0, fields: 0, validationRules: 0, edges: 0 });
    // A shared module-level constant handed out by reference lets one caller's
    // mutation corrupt every later run.
    expect(first).not.toBe(second);
  });

  it('reads only entity metadata, leaving other xml and other metadata untouched', async () => {
    const graph = createKnowledgeGraph();
    // One file per entity path pattern, so each pattern is pinned.
    const entities: Record<string, string> = {
      [FIELD]: fieldXml,
      [OBJECT]: '<CustomObject/>',
      [RULE]: '<ValidationRule/>',
    };
    const root = repoWith({
      ...entities,
      'build/pom.xml': '<project><fullName>NotSalesforce__c</fullName></project>',
      [PROFILE]: '<Profile><custom>false</custom></Profile>',
    });
    for (const p of Object.keys(entities)) {
      graph.addNode({
        id: generateId('File', p),
        label: 'File',
        properties: { name: p.split('/').pop(), filePath: p, startLine: 0, endLine: 0 },
      });
    }

    vi.mocked(readFileContents).mockClear();
    const result = await salesforceMetadataPhase.execute(
      ctxFor(root, graph),
      structureDeps([...Object.keys(entities), 'build/pom.xml', PROFILE]),
    );

    const read = vi.mocked(readFileContents).mock.calls.flatMap(([, paths]) => paths);
    expect(read).toEqual(Object.keys(entities));
    expect(result).toMatchObject({ objects: 1, fields: 1, validationRules: 1 });
    const names = [...graph.iterNodes()]
      .filter((n) => n.label === 'Record')
      .map((n) => n.properties.name)
      .sort();
    expect(names).toEqual(['Contact', 'Contact.External_Id__c', 'Contact.Name_Required']);
  });
});
