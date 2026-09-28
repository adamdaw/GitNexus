/**
 * Salesforce metadata over a real parse: the flow-to-Apex edge binds to the
 * `Class` node the Apex provider emits, not to a hand-built one. Guarded by
 * `apexAvailable` like the other Apex suites, since the grammar is optional.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import {
  FIXTURES,
  getRelationships,
  findDanglingEdges,
  runPipelineFromRepo,
  type PipelineResult,
} from './helpers.js';
import { isLanguageAvailable } from '../../../src/core/tree-sitter/parser-loader.js';
import { SupportedLanguages } from '../../../src/config/supported-languages.js';

const APEX = 'apex' as SupportedLanguages;

let apexAvailable = false;
try {
  apexAvailable = isLanguageAvailable(APEX);
} catch {
  apexAvailable = false;
}

describe.skipIf(!apexAvailable)('Salesforce flow to parsed Apex class', () => {
  let result: PipelineResult;

  beforeAll(async () => {
    result = await runPipelineFromRepo(path.join(FIXTURES, 'salesforce-flow-apex'), () => {});
  }, 60000);

  it('links the flow to the Apex class, not the same-named TypeScript class', () => {
    // The decoy must exist, or the `.cls` scoping is never exercised.
    const classes = [...result.graph.iterNodes()]
      .filter((n) => n.label === 'Class' && n.properties.name === 'AuditLogger')
      .map((n) => n.properties.filePath)
      .sort();
    expect(classes).toEqual([
      'force-app/main/default/classes/AuditLogger.cls',
      'tools/AuditLogger.ts',
    ]);

    const calls = getRelationships(result, 'CALLS').filter((e) => e.source === 'Example_Flow');
    expect(calls.map((e) => [e.targetLabel, e.target, e.targetFilePath, e.rel.reason])).toEqual([
      [
        'Class',
        'AuditLogger',
        'force-app/main/default/classes/AuditLogger.cls',
        'salesforce-flow-invokes-apex',
      ],
    ]);
  });

  it('leaves no dangling edge', () => {
    expect(findDanglingEdges(result)).toEqual([]);
  });
});
