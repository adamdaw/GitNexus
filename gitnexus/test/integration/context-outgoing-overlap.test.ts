/**
 * Integration test: context()'s outgoing-reference reads are started before
 * the incoming reads are awaited (overlap for LadybugDB 0.22.0 latency).
 *
 * The overlap must not change the response: the outgoing window stays the
 * uid-major `ORDER BY uid, relType LIMIT 30` page (#2787 F1) with ADVISED_BY
 * appended from its own window. And because the outgoing promise now exists
 * before the incoming reads are awaited, an incoming failure must not leave
 * that promise's rejection unhandled.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { LocalBackend } from '../../src/mcp/local/local-backend.js';
import { listRegisteredRepos } from '../../src/storage/repo-manager.js';
import { withTestLbugDB } from '../helpers/test-indexed-db.js';

vi.mock('../../src/storage/repo-manager.js', async (importActual) => ({
  ...(await importActual<typeof import('../../src/storage/repo-manager.js')>()),
  listRegisteredRepos: vi.fn().mockResolvedValue([]),
  cleanupOldKuzuFiles: vi.fn().mockResolvedValue({ found: false, needsReindex: false }),
  findSiblingClones: vi.fn().mockResolvedValue([]),
}));

// Pass-through by default. A test may install `failure` to make the outgoing
// and/or incoming context reads reject; they are told apart by the column they
// project (`target.id` for outgoing, `caller.id` for incoming).
type Failure = { incoming?: Error; outgoing?: Error; outgoingDelayMs?: number };
const db = vi.hoisted(() => ({
  failure: undefined as Failure | undefined,
  lastLbugPath: undefined as string | undefined,
  realExecuteParameterized: undefined as unknown as (...args: any[]) => Promise<any[]>,
}));

vi.mock('../../src/core/lbug/pool-adapter.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/lbug/pool-adapter.js')>();
  db.realExecuteParameterized = (actual as any).executeParameterized;
  return {
    ...actual,
    executeParameterized: (...args: any[]) => {
      db.lastLbugPath = args[0];
      const query = String(args[1]);
      const failure: Failure | undefined = db.failure;
      if (failure?.outgoing && query.includes('target.id AS uid')) {
        const err = failure.outgoing;
        return new Promise((_, reject) =>
          setTimeout(() => reject(err), failure.outgoingDelayMs ?? 0),
        );
      }
      if (failure?.incoming && query.includes('caller.id AS uid')) {
        return Promise.reject(failure.incoming);
      }
      return db.realExecuteParameterized(...args);
    },
  };
});

// ─── Fixture ─────────────────────────────────────────────────────────
// `hub` has 41 outgoing context edges to 36 targets t01..t36:
//   CALLS → t01..t36, plus ACCESSES → t07, t19, USES → t13, IMPORTS → t31,
//   MEMBER_OF → a Community (filtered out), ADVISED_BY → an advice method.
// uid-major, the 30-row window is t01..t27 with the ACCESSES/USES rows
// interleaved at t07/t13/t19 (ACCESSES < CALLS < USES breaks the uid tie), so
// IMPORTS → t31 falls outside it. A category-major key would instead return
// ACCESSES(2) + CALLS(28) and drop USES. `Community:hub` sorts before every
// `Function:` id, so a lost Community filter would show in the window too.
const HUB_ID = 'Function:src/hub.ts:hub';
const COMMUNITY_ID = 'Community:hub';
const ADVICE_ID = 'Method:src/aspect.ts:Aspect.around';
const INCOMING_IDS = ['Function:src/in1.ts:in1', 'Function:src/in2.ts:in2'];

const nn = (i: number): string => String(i).padStart(2, '0');
const target = (i: number) => ({
  uid: `Function:src/t${nn(i)}.ts:t${nn(i)}`,
  name: `t${nn(i)}`,
  filePath: `src/t${nn(i)}.ts`,
});
// `kind` is not asserted: `labels(target)[0]` does not resolve on LadybugDB
// (the limitation noted at context()'s class-like check), before and after the
// overlap change alike.
const ref = (r: { uid: string; name: string; filePath: string }) => expect.objectContaining(r);
const targetRef = (i: number) => ref(target(i));
const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, k) => from + k);

const fnNode = (id: string, name: string, filePath: string): string =>
  `CREATE (:Function {id: '${id}', name: '${name}', filePath: '${filePath}', startLine: 1, endLine: 3, isExported: true, content: '', description: ''})`;

const edge = (fromLabel: string, fromId: string, toLabel: string, toId: string, type: string) =>
  `MATCH (a:${fromLabel}), (b:${toLabel}) WHERE a.id = '${fromId}' AND b.id = '${toId}'
   CREATE (a)-[:CodeRelation {type: '${type}', confidence: 0.9, reason: 'direct', step: 0}]->(b)`;

const outEdge = (i: number, type: string) =>
  edge('Function', HUB_ID, 'Function', target(i).uid, type);

const SEED = [
  fnNode(HUB_ID, 'hub', 'src/hub.ts'),
  ...range(1, 36).map((i) => fnNode(target(i).uid, target(i).name, target(i).filePath)),
  ...INCOMING_IDS.map((id, k) => fnNode(id, `in${k + 1}`, `src/in${k + 1}.ts`)),
  `CREATE (:Community {id: '${COMMUNITY_ID}', label: 'Hub', heuristicLabel: 'Hub', keywords: ['hub'], description: 'h', enrichedBy: 'heuristic', cohesion: 0.5, symbolCount: 1})`,
  `CREATE (:Method {id: '${ADVICE_ID}', name: 'around', filePath: 'src/aspect.ts', startLine: 1, endLine: 5, isExported: false, content: '', description: ''})`,
  ...range(1, 36).map((i) => outEdge(i, 'CALLS')),
  outEdge(7, 'ACCESSES'),
  outEdge(19, 'ACCESSES'),
  outEdge(13, 'USES'),
  outEdge(31, 'IMPORTS'),
  edge('Function', HUB_ID, 'Community', COMMUNITY_ID, 'MEMBER_OF'),
  edge('Function', HUB_ID, 'Method', ADVICE_ID, 'ADVISED_BY'),
  ...INCOMING_IDS.map((id) => edge('Function', id, 'Function', HUB_ID, 'CALLS')),
];

// The uid-major window as (relType, uid), in query order.
const EXPECTED_WINDOW: Array<[string, string]> = range(1, 27).flatMap((i) => {
  const uid = target(i).uid;
  if (i === 7 || i === 19)
    return [
      ['ACCESSES', uid],
      ['CALLS', uid],
    ] as Array<[string, string]>;
  if (i === 13)
    return [
      ['CALLS', uid],
      ['USES', uid],
    ] as Array<[string, string]>;
  return [['CALLS', uid]] as Array<[string, string]>;
});

// The query context() ran for outgoing refs before the overlap change.
const PRE_OVERLAP_OUTGOING_QUERY = `
  MATCH (n {id: $symId})-[r:CodeRelation]->(target)
  WHERE r.type IN ['CALLS', 'IMPORTS', 'EXTENDS', 'IMPLEMENTS', 'MEMBER_OF', 'USES', 'DECLARES', 'HAS_METHOD', 'HAS_PROPERTY', 'METHOD_OVERRIDES', 'OVERRIDES', 'METHOD_IMPLEMENTS', 'ACCESSES']
    AND (r.type <> 'MEMBER_OF' OR labels(target) <> 'Community')
  RETURN r.type AS relType, target.id AS uid, target.name AS name, target.filePath AS filePath, labels(target)[0] AS kind
  ORDER BY uid, relType
  LIMIT 30
`;

withTestLbugDB(
  'context-outgoing-overlap',
  (handle) => {
    let backend: LocalBackend;

    beforeAll(() => {
      const ext = handle as typeof handle & { _backend?: LocalBackend };
      if (!ext._backend) {
        throw new Error('LocalBackend not initialized — afterSetup did not attach _backend');
      }
      backend = ext._backend;
    });

    afterEach(() => {
      db.failure = undefined;
    });

    describe('context() outgoing window with overlapped reads', () => {
      it('returns the uid-major 30-row outgoing window plus the separate ADVISED_BY window', async () => {
        const result = await backend.callTool('context', { uid: HUB_ID });

        expect(result).not.toHaveProperty('error');
        expect(result.status).toBe('found');
        expect(result.outgoing).toEqual({
          accesses: [targetRef(7), targetRef(19)],
          calls: range(1, 27).map(targetRef),
          uses: [targetRef(13)],
          advised_by: [ref({ uid: ADVICE_ID, name: 'around', filePath: 'src/aspect.ts' })],
        });
        expect(result.incoming.calls.map((r: { uid: string }) => r.uid)).toEqual(INCOMING_IDS);
      });

      it('matches the window the pre-overlap outgoing query returns on the same index', async () => {
        await backend.callTool('context', { uid: HUB_ID });
        if (!db.lastLbugPath) throw new Error('context() issued no executeParameterized call');

        const rows = await db.realExecuteParameterized(
          db.lastLbugPath,
          PRE_OVERLAP_OUTGOING_QUERY,
          {
            symId: HUB_ID,
          },
        );

        expect(rows.map((r: any) => [r.relType, r.uid])).toEqual(EXPECTED_WINDOW);
      });
    });

    describe('context() outgoing read failures', () => {
      it('does not leave the early outgoing read unhandled when an incoming read throws first', async () => {
        const unhandled: unknown[] = [];
        const onUnhandled = (reason: unknown) => unhandled.push(reason);
        process.on('unhandledRejection', onUnhandled);
        try {
          db.failure = {
            incoming: new Error('simulated: incoming read failed'),
            outgoing: new Error('simulated: outgoing read failed'),
            outgoingDelayMs: 20,
          };

          await expect(backend.callTool('context', { uid: HUB_ID })).rejects.toThrow(
            'simulated: incoming read failed',
          );
          // Let the outgoing read reject after context() has already given up.
          await new Promise((resolve) => setTimeout(resolve, 100));
        } finally {
          process.off('unhandledRejection', onUnhandled);
        }

        expect(unhandled, 'outgoing rejection escaped as an unhandled rejection').toEqual([]);
      });

      it('still surfaces an outgoing read failure when the incoming reads succeed', async () => {
        db.failure = { outgoing: new Error('simulated: outgoing read failed') };

        await expect(backend.callTool('context', { uid: HUB_ID })).rejects.toThrow(
          'simulated: outgoing read failed',
        );
      });
    });
  },
  {
    seed: SEED,
    poolAdapter: true,
    afterSetup: async (handle) => {
      vi.mocked(listRegisteredRepos).mockResolvedValue([
        {
          name: 'outgoing-overlap-repo',
          path: '/outgoing/repo',
          storagePath: handle.tmpHandle.dbPath,
          indexedAt: new Date().toISOString(),
          lastCommit: 'abc123',
          stats: { files: 40, nodes: 41, communities: 1, processes: 0 },
        },
      ]);
      const backend = new LocalBackend();
      await backend.init();
      (handle as any)._backend = backend;
    },
  },
);
