import { describe, it, expect } from 'vitest';
import { communitiesPhase } from '../../../src/core/ingestion/pipeline-phases/communities.js';
import type {
  PipelineContext,
  PhaseResult,
} from '../../../src/core/ingestion/pipeline-phases/types.js';
import { createKnowledgeGraph } from '../../../src/core/graph/graph.js';
import type { GraphNode } from '../../../src/core/graph/types.js';

function node(id: string, label: GraphNode['label']): GraphNode {
  return {
    id,
    label,
    properties: { name: id, filePath: `/src/${id}.ts`, startLine: 1, endLine: 10 },
  };
}

const deps: ReadonlyMap<string, PhaseResult<unknown>> = new Map([
  ['structure', { phaseName: 'structure', durationMs: 0, output: { totalFiles: 1 } }],
]);

describe('communitiesPhase', () => {
  it('writes MEMBER_OF only into Community nodes it writes, keeping every membership', async () => {
    const graph = createKnowledgeGraph();
    for (const id of ['a', 'b', 'lone']) graph.addNode(node(id, 'Function'));
    graph.addNode(node('main', 'File'));
    graph.addRelationship({
      id: 'ab',
      sourceId: 'a',
      targetId: 'b',
      type: 'CALLS',
      confidence: 1,
      reason: '',
    });
    // A module-level call is sourced from the File node, which is not a
    // community symbol, so `lone` is partitioned alone into a singleton.
    graph.addRelationship({
      id: 'main-lone',
      sourceId: 'main',
      targetId: 'lone',
      type: 'CALLS',
      confidence: 1,
      reason: '',
    });

    const { communityResult } = await communitiesPhase.execute(
      { repoPath: '/', graph, onProgress: () => {}, pipelineStart: 0 } as PipelineContext,
      deps,
    );

    const memberOf = [...graph.iterRelationships()].filter((r) => r.type === 'MEMBER_OF');
    expect(memberOf.filter((r) => graph.getNode(r.targetId)?.label !== 'Community')).toEqual([]);
    expect(memberOf.map((r) => r.sourceId).sort()).toEqual(['a', 'b']);
    // Skill generation groups singleton memberships by folder when no
    // community forms, so the detection result keeps them.
    expect(communityResult.memberships.map((m) => m.nodeId).sort()).toEqual(['a', 'b', 'lone']);
  });
});
