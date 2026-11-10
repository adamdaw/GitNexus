import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SupportedLanguages } from 'gitnexus-shared';
import { renameCases } from '../helpers/rename-integration-cases.js';

const fixtureLanguages = [...new Set(renameCases.map((entry) => entry.language))].sort();

// Languages registered without a semantic rename provider. Measured, not granted:
// each must carry fixtures, every one of them must expect the provider's refusal
// (`unsupported_language`), and they run through the language's own file below —
// so adding a provider flips a fixture and forces the entry out of this map.
const NO_SEMANTIC_RENAME: Readonly<Record<string, string>> = {
  apex: 'Apex has no rename provider yet; its identifiers are case-insensitive, so a provider is real work, not a registration.',
};

describe('persisted semantic rename coverage', () => {
  it('has successful rename fixtures for every supported language', () => {
    expect(
      new Set(
        renameCases.filter((entry) => entry.status === 'success').map((entry) => entry.language),
      ),
    ).toEqual(
      new Set(
        Object.values(SupportedLanguages).filter((language) => !(language in NO_SEMANTIC_RENAME)),
      ),
    );
  });

  it.each(Object.keys(NO_SEMANTIC_RENAME))(
    '%s, exempt for having no rename provider, proves the refusal in every fixture',
    async (language) => {
      const fixtures = renameCases.filter((entry) => entry.language === language);
      expect(fixtures.length).toBeGreaterThan(0);
      for (const { directory } of fixtures) {
        const spec = JSON.parse(await fs.readFile(`${directory}/case.json`, 'utf8'));
        expect(spec.expect, directory).toMatchObject({
          status: 'error',
          code: 'unsupported_language',
        });
      }
    },
  );

  // Fixtures only run through a per-language file (it also shards CI), so a missing or
  // mis-targeted file would leave its fixtures silently unexecuted.
  it.each(fixtureLanguages)(
    'runs the persisted fixtures of %s from its own rename-provider file',
    async (language) => {
      const file = new URL(`./rename-provider-${language}.test.ts`, import.meta.url);
      const source = (await fs.readFile(fileURLToPath(file), 'utf8'))
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      expect(source).toMatch(
        new RegExp(`\\bdefineRenameFixtureTests\\(\\s*(['"\`])${language}\\1\\s*\\)`),
      );
    },
  );
});
