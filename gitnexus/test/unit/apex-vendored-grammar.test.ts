import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * WI-1 (SDD-001 §1, §8) — the Apex grammar is an ABI-14 regeneration of
 * aheber/tree-sitter-sfapex (upstream parser.c is ABI-15, which will not load on
 * the pinned tree-sitter@0.21.1). RESEARCH-001 §3 constraint #3 has two MUSTs:
 * the grammar is vendored AND carries a regeneration `hold` so the weekly
 * auto-update bot does not silently revert it to the unbuildable ABI-15. This
 * test pins the manifest contract. It is red until the manifest entry exists
 * (a Gate-3-gated edit), then green; see .vsdd/tdd/WI-1-red-gate.md.
 */
const manifestPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../.github/vendored-grammars.json',
);
const manifest: {
  grammars: Record<string, { name: string; upstream?: unknown; hold?: string }>;
} = JSON.parse(readFileSync(manifestPath, 'utf8'));

describe('Apex vendored-grammar manifest entry (WI-1)', () => {
  it('declares an apex grammar named tree-sitter-apex', () => {
    expect(manifest.grammars.apex).toBeDefined();
    expect(manifest.grammars.apex.name).toBe('tree-sitter-apex');
  });

  it('carries a regeneration hold so the auto-update bot cannot revert to ABI-15', () => {
    const hold = manifest.grammars.apex?.hold;
    expect(hold).toBeTruthy();
    expect(hold).toMatch(/abi|regen/i);
  });
});
