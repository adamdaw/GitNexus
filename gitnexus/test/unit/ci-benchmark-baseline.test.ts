import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { load } from 'js-yaml';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

type Job = {
  name: string;
  needs: string;
  steps: { with?: { ref?: string; script?: string } }[];
  strategy?: { matrix: Record<string, string[]> };
};
const { jobs } = load(
  readFileSync(path.resolve(__dirname, '../../../.github/workflows/ci-tests.yml'), 'utf8'),
) as { jobs: Record<string, Job> };
const paired = [
  'file-result-reuse-benchmark',
  'analyze-resume-benchmark',
  'lexical-lookup-benchmark',
  'mcp-query-benchmark',
  'embedding-chunking-benchmark',
];
const passed = paired.flatMap((id) => {
  const job = jobs[id];
  const matrix = Object.entries(job.strategy?.matrix ?? {});
  const names = matrix.length
    ? matrix[0][1].map((value) => job.name.replace('${{ matrix.' + matrix[0][0] + ' }}', value))
    : [job.name];
  return names.map((name) => ({ name: 'ci / tests / ' + name, conclusion: 'success' }));
});
const repo = { owner: 'org', repo: 'repo' };
const { benchmarkBaseline } = createRequire(import.meta.url)(
  '../../../.github/scripts/benchmark-baseline.cjs',
) as {
  benchmarkBaseline(options: {
    github: unknown;
    repo: typeof repo;
    cwd: string;
    allowFirstParentFallback?: boolean;
  }): Promise<string>;
};

it.each(paired)('%s checks out the selected release baseline', (id) => {
  expect(jobs[id].needs).toBe('benchmark-baseline');
  expect(jobs[id].steps.map((s) => s.with?.ref)).toContain(
    '${{ needs.benchmark-baseline.outputs.sha }}',
  );
});

let cwd: string;
const git = (...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const mark = () => {
  const sha = git('rev-parse', 'HEAD');
  git('tag', 'rc/' + sha);
  return sha;
};

beforeEach(() => {
  for (const name of Object.keys(process.env).filter((key) => key.startsWith('GIT_'))) {
    vi.stubEnv(name, undefined);
  }
  cwd = mkdtempSync(path.join(tmpdir(), 'benchmark-baseline-'));
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 'CI');
  git('config', 'user.email', 'ci@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'tag.gpgsign', 'false');
  git('commit', '-qm', 'last good', '--allow-empty');
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(cwd, { recursive: true, force: true });
});

it.each(['push', 'workflow_dispatch'])('uses the last measured %s ancestor', async (event) => {
  const good = mark();
  git('checkout', '-qb', 'topic');
  git('commit', '-qm', 'side branch', '--allow-empty');
  mark();
  git('checkout', '-q', 'main');
  git('commit', '-qm', 'no-op Publish', '--allow-empty');
  const skipped = mark();
  git('commit', '-qm', 'benchmark failure', '--allow-empty');
  git('merge', '--no-ff', '-qm', 'stable candidate', 'topic');
  mark(); // A repeat release of the candidate must still compare to its ancestor.
  const actions = {
    listWorkflowRuns: vi.fn(async ({ head_sha }: { head_sha: string }) => [
      { id: head_sha, event },
    ]),
    listJobsForWorkflowRun: vi.fn(async ({ run_id }: { run_id: string }) =>
      run_id === good ? passed : [{ name: 'RC guard', conclusion: 'success' }],
    ),
  };
  const github = {
    rest: { actions },
    paginate: <P, T>(fn: (params: P) => Promise<T>, params: P) => fn(params),
  };
  vi.stubEnv('PATH', path.join(cwd, 'no-executables'));
  expect(await benchmarkBaseline({ github, repo, cwd })).toBe(good);
  expect(actions.listWorkflowRuns.mock.calls).toEqual(
    [skipped, good].map((head_sha) => [
      {
        ...repo,
        workflow_id: 'publish.yml',
        branch: 'main',
        head_sha,
        status: 'success',
        per_page: 100,
      },
    ]),
  );
  // A skipped matrix leg cannot establish a baseline even if the workflow as a whole succeeded.
  actions.listJobsForWorkflowRun.mockResolvedValue([
    ...passed.slice(1),
    { ...passed[0], conclusion: 'skipped' },
  ]);
  await expect(benchmarkBaseline({ github, repo, cwd })).rejects.toThrow('No ancestor');
});

const unmeasured = () => {
  const actions = {
    listWorkflowRuns: vi.fn(async ({ head_sha }: { head_sha: string }) => [
      { id: head_sha, event: 'push' },
    ]),
    listJobsForWorkflowRun: vi.fn(async () => [{ name: 'RC guard', conclusion: 'success' }]),
  };
  return {
    rest: { actions },
    paginate: <P, T>(fn: (params: P) => Promise<T>, params: P) => fn(params),
  };
};

it('falls back to the first parent only when opted in and no ancestor qualifies', async () => {
  mark(); // An rc marker without a measured Publish run does not qualify.
  git('commit', '-qm', 'parent', '--allow-empty');
  const parent = git('rev-parse', 'HEAD');
  git('commit', '-qm', 'pushed tip', '--allow-empty');
  const github = unmeasured();
  const notice = vi.spyOn(console, 'log').mockImplementation(() => {});
  expect(await benchmarkBaseline({ github, repo, cwd, allowFirstParentFallback: true })).toBe(
    parent,
  );
  expect(notice).toHaveBeenCalledWith(expect.stringMatching(new RegExp('^::notice::.*' + parent)));
  notice.mockRestore();
  await expect(benchmarkBaseline({ github, repo, cwd })).rejects.toThrow(
    'No ancestor has a successful main Publish run with every paired benchmark.',
  );
});

it('prefers a measured rc ancestor over the first-parent fallback', async () => {
  const good = mark();
  git('commit', '-qm', 'parent', '--allow-empty');
  git('commit', '-qm', 'pushed tip', '--allow-empty');
  const github = unmeasured();
  github.rest.actions.listJobsForWorkflowRun.mockImplementation(async () => passed);
  expect(await benchmarkBaseline({ github, repo, cwd, allowFirstParentFallback: true })).toBe(good);
});

it('fails clearly when the fallback has no first parent', async () => {
  await expect(
    benchmarkBaseline({ github: unmeasured(), repo, cwd, allowFirstParentFallback: true }),
  ).rejects.toThrow('HEAD^1');
});

it('opts into the first-parent fallback only on the adamdaw/GitNexus fork', () => {
  const script = jobs['benchmark-baseline'].steps.find((s) => s.with?.script)?.with?.script;
  expect(script).toContain(
    "allowFirstParentFallback: context.repo.owner + '/' + context.repo.repo === 'adamdaw/GitNexus'",
  );
  expect(script?.match(/allowFirstParentFallback/g)).toHaveLength(1);
});
