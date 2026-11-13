import { beforeAll, describe, expect, it, vi } from 'vitest';
import { LocalBackend } from '../../src/mcp/local/local-backend.js';
import { listRegisteredRepos } from '../../src/storage/repo-manager.js';
import { withTestLbugDB } from '../helpers/test-indexed-db.js';

vi.mock('../../src/storage/repo-manager.js', () => ({
  listRegisteredRepos: vi.fn().mockResolvedValue([]),
  cleanupOldKuzuFiles: vi.fn().mockResolvedValue({ found: false, needsReindex: false }),
  findSiblingClones: vi.fn().mockResolvedValue([]),
}));

const WIDGET_PATH = 'force-app/main/default/classes/Widget.cls';
const CLASS_UID = `Class:${WIDGET_PATH}:Widget`;
const ZERO_ARG_CTOR_UID = `Constructor:${WIDGET_PATH}:Widget.Widget#0`;
const ONE_ARG_CTOR_UID = `Constructor:${WIDGET_PATH}:Widget.Widget#1`;
const CALLER_UID = 'Method:force-app/main/default/classes/WidgetFactory.cls:WidgetFactory.make';
const COLLIDING_METHOD_UID =
  'Method:force-app/main/default/classes/WidgetHelpers.cls:WidgetHelpers.Widget';

const SEED = [
  `CREATE (widget:Class {id:'${CLASS_UID}', name:'Widget', filePath:'${WIDGET_PATH}', startLine:1, endLine:11, content:'public class Widget {}', description:''})`,
  `CREATE (zero:Constructor {id:'${ZERO_ARG_CTOR_UID}', name:'Widget', filePath:'${WIDGET_PATH}', startLine:3, endLine:5, content:'public Widget() {}', description:''})`,
  `CREATE (one:Constructor {id:'${ONE_ARG_CTOR_UID}', name:'Widget', filePath:'${WIDGET_PATH}', startLine:6, endLine:8, content:'public Widget(String name) {}', description:''})`,
  `CREATE (caller:Method {id:'${CALLER_UID}', name:'make', filePath:'force-app/main/default/classes/WidgetFactory.cls', startLine:3, endLine:5, content:'return new Widget(\\'y\\');', description:''})`,
  `CREATE (collision:Method {id:'${COLLIDING_METHOD_UID}', name:'Widget', filePath:'force-app/main/default/classes/WidgetHelpers.cls', startLine:3, endLine:5, content:'public static void Widget() {}', description:''})`,
  `MATCH (widget:Class {id:'${CLASS_UID}'}), (zero:Constructor {id:'${ZERO_ARG_CTOR_UID}'}) CREATE (widget)-[:CodeRelation {type:'HAS_METHOD', confidence:1.0, reason:'class-method', step:0}]->(zero)`,
  `MATCH (widget:Class {id:'${CLASS_UID}'}), (one:Constructor {id:'${ONE_ARG_CTOR_UID}'}) CREATE (widget)-[:CodeRelation {type:'HAS_METHOD', confidence:1.0, reason:'class-method', step:0}]->(one)`,
  `MATCH (caller:Method {id:'${CALLER_UID}'}), (one:Constructor {id:'${ONE_ARG_CTOR_UID}'}) CREATE (caller)-[:CodeRelation {type:'CALLS', confidence:1.0, reason:'new Widget(String)', step:0}]->(one)`,
];

withTestLbugDB(
  'apex-class-constructor-lookup',
  (handle) => {
    let backend: LocalBackend;

    beforeAll(() => {
      backend = (handle as typeof handle & { _backend: LocalBackend })._backend;
    });

    describe('Apex Class and same-named Constructor lookup (#19)', () => {
      it('bare-name context deliberately selects the Class and includes both constructors', async () => {
        const result = await backend.callTool('context', { name: 'Widget' });

        expect(result).toMatchObject({
          status: 'found',
          symbol: { uid: CLASS_UID, kind: 'Class' },
        });
        expect(
          result.outgoing.has_method.map((entry: { uid: string }) => entry.uid).sort(),
        ).toEqual([ONE_ARG_CTOR_UID, ZERO_ARG_CTOR_UID].sort());
      });

      it('bare-name impact selects the Class and reports the constructor caller at depth 1', async () => {
        const result = await backend.callTool('impact', {
          target: 'Widget',
          direction: 'upstream',
        });

        expect(result.target).toMatchObject({ id: CLASS_UID, type: 'Class' });
        expect(result.byDepth['1']).toEqual(
          expect.arrayContaining([expect.objectContaining({ id: CALLER_UID, name: 'make' })]),
        );
      });

      it('target_uid selects exactly the Apex Class', async () => {
        const result = await backend.callTool('impact', {
          target: 'Widget',
          target_uid: CLASS_UID,
          direction: 'upstream',
        });

        expect(result.target).toMatchObject({ id: CLASS_UID, type: 'Class' });
      });

      it('target_uid selects exactly the requested overloaded Apex Constructor', async () => {
        const result = await backend.callTool('impact', {
          target: 'Widget',
          target_uid: ONE_ARG_CTOR_UID,
          direction: 'upstream',
        });

        expect(result.target).toMatchObject({ id: ONE_ARG_CTOR_UID, type: 'Constructor' });
        expect(result.byDepth['1']).toEqual(
          expect.arrayContaining([expect.objectContaining({ id: CALLER_UID })]),
        );
      });

      it('context uid selects exactly the requested overloaded Apex Constructor', async () => {
        const result = await backend.callTool('context', { uid: ZERO_ARG_CTOR_UID });

        expect(result).toMatchObject({
          status: 'found',
          symbol: { uid: ZERO_ARG_CTOR_UID, kind: 'Constructor' },
        });
      });

      it('still selects the Class when another class has a method named Widget', async () => {
        const context = await backend.callTool('context', { name: 'Widget' });
        const impact = await backend.callTool('impact', {
          target: 'Widget',
          direction: 'upstream',
        });

        expect(context).toMatchObject({
          status: 'found',
          symbol: { uid: CLASS_UID, kind: 'Class' },
        });
        expect(impact.target).toMatchObject({ id: CLASS_UID, type: 'Class' });
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
          stats: { files: 3, nodes: 5, communities: 0, processes: 0 },
        },
      ]);
      const backend = new LocalBackend();
      await backend.init();
      (handle as typeof handle & { _backend: LocalBackend })._backend = backend;
    },
  },
);
