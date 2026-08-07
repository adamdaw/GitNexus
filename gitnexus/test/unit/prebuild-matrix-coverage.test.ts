import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { VENDORED_GRAMMAR_PACKAGES } from '../../src/core/tree-sitter/vendored-grammars.js';

/**
 * Every vendored grammar MUST be covered by the cross-build workflow.
 *
 * `build-tree-sitter-prebuilds.yml` is what produces
 * `vendor/<grammar>/prebuilds/<platform-arch>/` for all six targets. A grammar
 * absent from its `REGISTRY` still installs — it just source-builds on every
 * platform the committed prebuilds miss, which needs a C/C++ toolchain the
 * "no operational risk" pipeline exists to make unnecessary.
 *
 * That is not hypothetical: tree-sitter-apex was vendored with a linux-x64
 * prebuild only and never added to the registry, so every macOS and Windows
 * install source-built it — and the resulting `vendor/*\/build/` output then
 * tripped the publish guard (`assert-publish-grammar-coverage`). Nothing failed
 * loudly, because a missing prebuild degrades to a compile rather than an error.
 *
 * The two lists are maintained in different files by different concerns
 * (a runtime loader vs a CI recipe), so nothing but this test keeps them equal.
 */

const WORKFLOW = fileURLToPath(
  new URL('../../../.github/workflows/build-tree-sitter-prebuilds.yml', import.meta.url),
);

/** Grammar package names in the workflow's `REGISTRY` literal. */
function registryPackages(): Set<string> {
  const yaml = readFileSync(WORKFLOW, 'utf8');
  const start = yaml.indexOf('const REGISTRY = {');
  expect(start, 'REGISTRY literal is present in the workflow').toBeGreaterThan(-1);
  const end = yaml.indexOf('};', start);
  expect(end, 'REGISTRY literal is terminated').toBeGreaterThan(start);

  const body = yaml.slice(start, end);
  return new Set([...body.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1]));
}

describe('tree-sitter prebuild matrix coverage', () => {
  it('cross-builds every vendored grammar', () => {
    expect([...registryPackages()].sort()).toEqual([...VENDORED_GRAMMAR_PACKAGES].sort());
  });

  it('gives every registry grammar a smoke-test snippet', () => {
    const yaml = readFileSync(WORKFLOW, 'utf8');
    const start = yaml.indexOf('const snippets = {');
    expect(start, 'snippets literal is present in the workflow').toBeGreaterThan(-1);
    const body = yaml.slice(start, yaml.indexOf('};', start));
    const withSnippet = new Set([...body.matchAll(/^\s{14}(\w+):/gm)].map((m) => m[1]));

    // The registry is keyed by shortname; the snippet map must use the same keys,
    // because the build job indexes it as `snippets[process.env.GRAMMAR]`. A
    // missing key yields `undefined`, and parsing undefined is not a failure the
    // smoke step reports as one.
    const yamlRegistry = yaml.slice(
      yaml.indexOf('const REGISTRY = {'),
      yaml.indexOf('};', yaml.indexOf('const REGISTRY = {')),
    );
    const shortnames = new Set([...yamlRegistry.matchAll(/^\s{12}(\w+):\s*\{/gm)].map((m) => m[1]));

    expect([...shortnames].sort()).toEqual([...withSnippet].sort());
  });
});
