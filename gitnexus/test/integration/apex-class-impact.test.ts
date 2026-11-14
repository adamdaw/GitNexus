/**
 * Integration Tests: Class impact rolls up callers of the class's methods (#18)
 *
 * Apex utility classes are reached through their static methods
 * (`IdUtil.make(...)`), so the CALLS edges land on the Method nodes, never on
 * the Class. The graph shape below mirrors what `analyze` emits for the
 * issue's two-class SFDX repro:
 *
 *   File -DEFINES-> Class -HAS_METHOD-> Method <-CALLS- caller Method
 *
 * Before the fix, impact(upstream) on the Class seeded only its Constructors,
 * owning File and typed Properties, so it reported impactedCount 0 / UNKNOWN
 * while impact on the method itself found the caller.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { LocalBackend } from '../../src/mcp/local/local-backend.js';
import { listRegisteredRepos } from '../../src/storage/repo-manager.js';
import { withTestLbugDB } from '../helpers/test-indexed-db.js';

vi.mock('../../src/storage/repo-manager.js', () => ({
  listRegisteredRepos: vi.fn().mockResolvedValue([]),
  cleanupOldKuzuFiles: vi.fn().mockResolvedValue({ found: false, needsReindex: false }),
  findSiblingClones: vi.fn().mockResolvedValue([]),
}));

const DIR = 'force-app/main/default/classes';

function apexClass(cls: string): string[] {
  return [
    `CREATE (:File {id:'file:${cls}', name:'${cls}.cls', filePath:'${DIR}/${cls}.cls', content:''})`,
    `CREATE (:Class {id:'class:${cls}', name:'${cls}', filePath:'${DIR}/${cls}.cls', startLine:1, endLine:20, isExported:true, content:'', description:''})`,
    `MATCH (f:File {id:'file:${cls}'}), (c:Class {id:'class:${cls}'}) CREATE (f)-[:CodeRelation {type:'DEFINES', confidence:1.0, reason:'', step:0}]->(c)`,
  ];
}

function apexMethod(cls: string, method: string): string[] {
  return [
    `CREATE (:Method {id:'method:${cls}.${method}', name:'${method}', filePath:'${DIR}/${cls}.cls', startLine:2, endLine:4, isExported:true, content:'', description:''})`,
    `MATCH (c:Class {id:'class:${cls}'}), (m:Method {id:'method:${cls}.${method}'}) CREATE (c)-[:CodeRelation {type:'HAS_METHOD', confidence:1.0, reason:'', step:0}]->(m)`,
  ];
}

function calls(from: string, to: string): string {
  return `MATCH (a:Method {id:'method:${from}'}), (b:Method {id:'method:${to}'}) CREATE (a)-[:CodeRelation {type:'CALLS', confidence:0.9, reason:'direct', step:0}]->(b)`;
}

const SEED = [
  // ── The issue's repro: Caller.run -> IdUtil.make ─────────────────────
  ...apexClass('IdUtil'),
  ...apexMethod('IdUtil', 'make'),
  ...apexClass('Caller'),
  ...apexMethod('Caller', 'run'),
  calls('Caller.run', 'IdUtil.make'),

  // ── A static method called from two files ────────────────────────────
  ...apexClass('StrUtil'),
  ...apexMethod('StrUtil', 'pad'),
  ...apexClass('OrderSvc'),
  ...apexMethod('OrderSvc', 'submit'),
  ...apexClass('InvoiceSvc'),
  ...apexMethod('InvoiceSvc', 'issue'),
  calls('OrderSvc.submit', 'StrUtil.pad'),
  calls('InvoiceSvc.issue', 'StrUtil.pad'),

  // ── One caller of two methods, plus a call between the class's own
  //    methods (Fmt.money -> Fmt.round) ────────────────────────────────
  ...apexClass('Fmt'),
  ...apexMethod('Fmt', 'money'),
  ...apexMethod('Fmt', 'round'),
  calls('Fmt.money', 'Fmt.round'),
  ...apexClass('Report'),
  ...apexMethod('Report', 'render'),
  calls('Report.render', 'Fmt.money'),
  calls('Report.render', 'Fmt.round'),
];

const namesAt = (result: any, depth: number): string[] =>
  (result.byDepth?.[depth] ?? []).map((d: any) => d.name);

withTestLbugDB(
  'apex-class-impact',
  (handle) => {
    let backend: LocalBackend;
    beforeAll(() => {
      backend = (handle as any)._backend;
    });

    const impactOf = (target: string) =>
      backend.callTool('impact', { target, direction: 'upstream', includeTests: true });

    describe('impact(upstream) on a Class counts callers of its methods (#18)', () => {
      it('repro: IdUtil reports Caller.run at depth 1 with a resolved risk', async () => {
        const result = await impactOf('IdUtil');

        expect(result).not.toHaveProperty('error');
        expect(result.impactedCount).toBe(1);
        expect(namesAt(result, 1)).toEqual(['run']);
        expect(result.risk).toBe('LOW');
      });

      it('matches impact on the method itself', async () => {
        const onClass = await impactOf('IdUtil');
        const onMethod = await impactOf('make');

        expect(onClass.impactedCount).toBe(onMethod.impactedCount);
        expect(namesAt(onClass, 1)).toEqual(namesAt(onMethod, 1));
      });

      it('counts a static method called from two files once per caller', async () => {
        const result = await impactOf('StrUtil');

        expect(result.impactedCount).toBe(2);
        expect(namesAt(result, 1).sort()).toEqual(['issue', 'submit']);
      });

      it('counts a caller of two of the class methods once', async () => {
        const result = await impactOf('Fmt');

        expect(namesAt(result, 1)).toEqual(['render']);
        expect(result.impactedCount).toBe(1);
      });

      it("does not count the class's own methods calling each other", async () => {
        const result = await impactOf('Fmt');

        const allNames = Object.values(result.byDepth as Record<string, any[]>)
          .flat()
          .map((d: any) => d.name);
        expect(allNames).not.toContain('money');
        expect(allNames).not.toContain('round');
      });
    });
  },
  {
    seed: SEED,
    poolAdapter: true,
    afterSetup: async (handle) => {
      vi.mocked(listRegisteredRepos).mockResolvedValue([
        {
          name: 'test-repo',
          path: '/test/repo',
          storagePath: handle.tmpHandle.dbPath,
          indexedAt: new Date().toISOString(),
          lastCommit: 'abc123',
          stats: { files: 8, nodes: 20, communities: 0, processes: 0 },
        },
      ]);
      const backend = new LocalBackend();
      await backend.init();
      (handle as any)._backend = backend;
    },
  },
);
