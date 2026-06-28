/**
 * Apex (Salesforce) — WI-1: parse & graph population.
 *
 * Gate-3 acceptance suite for SDD-001 (.vsdd/SDD.md §8). Tests are authored
 * BEFORE implementation (VSDD Phase 3, TDD). Apex is an optional vendored
 * grammar (an ABI-14 regeneration of aheber/tree-sitter-sfapex, pinned to
 * tree-sitter@0.21.1). These integration assertions are guarded by
 * `apexAvailable`: until the grammar is vendored (a Gate-3-gated step, since the
 * hook blocks parser.c / the SupportedLanguages enum / the provider) they SKIP,
 * and become red->green during Step 3b. The forceably-red Gate-3 evidence lives
 * in the unit suites (filename classification + manifest hold) and is recorded,
 * with the no-red justification for this suite, in .vsdd/tdd/WI-1-red-gate.md.
 *
 * `SupportedLanguages.Apex` does not exist pre-implementation, so the enum is
 * referenced by its string value ('apex') to keep the pre-existing suite clean.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';
import {
  FIXTURES,
  getRelationships,
  getNodesByLabel,
  getNodesByLabelFull,
  findDanglingEdges,
  runPipelineFromRepo,
  type PipelineResult,
} from './helpers.js';
import { isLanguageAvailable } from '../../../src/core/tree-sitter/parser-loader.js';
import { SupportedLanguages } from '../../../src/config/supported-languages.js';
import { TREE_SITTER_MAX_BUFFER } from '../../../src/core/ingestion/constants.js';

// Apex enum member does not exist until implementation; reference by value.
const APEX = 'apex' as SupportedLanguages;

let apexAvailable = false;
try {
  apexAvailable = isLanguageAvailable(APEX);
} catch {
  apexAvailable = false;
}

// ── REQ-002 — type container nodes (class/interface/enum + nested) ──────────
describe.skipIf(!apexAvailable)('Apex type container nodes (REQ-002)', () => {
  let result: PipelineResult;

  beforeAll(async () => {
    result = await runPipelineFromRepo(path.join(FIXTURES, 'apex-types'), () => {});
  }, 60000);

  it('emits a Class node for a top-level class', () => {
    expect(getNodesByLabel(result, 'Class')).toContain('Shapes');
  });

  it('emits an Interface node for a top-level interface', () => {
    expect(getNodesByLabel(result, 'Interface')).toContain('TopShape');
  });

  it('emits an Enum node for a top-level enum', () => {
    expect(getNodesByLabel(result, 'Enum')).toContain('TopColor');
  });

  it('emits nested class/interface/enum nodes (by simple name)', () => {
    expect(getNodesByLabel(result, 'Class')).toContain('InnerBox');
    expect(getNodesByLabel(result, 'Interface')).toContain('Drawable');
    expect(getNodesByLabel(result, 'Enum')).toContain('Palette');
  });

  it('qualifies a nested type id by its enclosing owner (Shapes.InnerBox)', () => {
    // The nested class InnerBox owns a method volume(); the owning node id of
    // that HAS_METHOD edge must carry the qualified segment Shapes.InnerBox.
    const hasMethod = getRelationships(result, 'HAS_METHOD');
    const volumeEdge = hasMethod.find((e) => e.target === 'volume');
    expect(volumeEdge).toBeDefined();
    expect(volumeEdge!.rel.sourceId).toContain('Shapes.InnerBox');
  });

  it('records a name and a line range on a type node', () => {
    const shapes = getNodesByLabelFull(result, 'Class').find((n) => n.name === 'Shapes');
    expect(shapes).toBeDefined();
    expect(shapes!.properties.language).toBe('apex');
    expect(typeof shapes!.properties.startLine).toBe('number');
    expect(typeof shapes!.properties.endLine).toBe('number');
  });

  it('emits a DEFINES edge from the File node to a top-level type (REQ-002)', () => {
    const defines = getRelationships(result, 'DEFINES');
    const edge = defines.find((e) => e.target === 'Shapes' && e.sourceLabel === 'File');
    expect(edge).toBeDefined();
  });
});

// ── REQ-003 — member nodes (method/constructor/field/property/enum-const) ───
describe.skipIf(!apexAvailable)('Apex member nodes (REQ-003)', () => {
  let result: PipelineResult;

  beforeAll(async () => {
    result = await runPipelineFromRepo(path.join(FIXTURES, 'apex-types'), () => {});
  }, 60000);

  it('emits a Method node for a method', () => {
    expect(getNodesByLabel(result, 'Method')).toContain('area');
  });

  it('emits a Constructor node for a constructor', () => {
    expect(getNodesByLabel(result, 'Constructor')).toContain('Shapes');
  });

  it('emits a Property node for a field and for an auto-property', () => {
    const props = getNodesByLabel(result, 'Property');
    expect(props).toContain('width'); // field
    expect(props).toContain('label'); // auto-property { get; set; }
  });

  it('emits a Property node for each enum constant', () => {
    const props = getNodesByLabel(result, 'Property');
    expect(props).toContain('RED');
    expect(props).toContain('GREEN');
    expect(props).toContain('BLUE');
  });

  it('connects method and constructor to the type via HAS_METHOD', () => {
    const hasMethod = getRelationships(result, 'HAS_METHOD');
    expect(hasMethod.find((e) => e.source === 'Shapes' && e.target === 'area')).toBeDefined();
    expect(hasMethod.find((e) => e.source === 'Shapes' && e.target === 'Shapes')).toBeDefined();
  });

  it('connects field, property and enum constant to the type via HAS_PROPERTY', () => {
    const hasProp = getRelationships(result, 'HAS_PROPERTY');
    expect(hasProp.find((e) => e.source === 'Shapes' && e.target === 'width')).toBeDefined();
    expect(hasProp.find((e) => e.source === 'Shapes' && e.target === 'label')).toBeDefined();
    expect(hasProp.find((e) => e.source === 'Palette' && e.target === 'RED')).toBeDefined();
  });

  it('every member node has exactly one declaring-type owner edge (no dangling)', () => {
    expect(findDanglingEdges(result, ['HAS_METHOD', 'HAS_PROPERTY'])).toEqual([]);
  });
});

// ── REQ-003 — type-only overloads & identical-signature duplicates ──────────
describe.skipIf(!apexAvailable)('Apex overloads and duplicates (REQ-003)', () => {
  let result: PipelineResult;

  beforeAll(async () => {
    result = await runPipelineFromRepo(path.join(FIXTURES, 'apex-overloads'), () => {});
  }, 60000);

  const methodsNamed = (name: string) =>
    getNodesByLabelFull(result, 'Method').filter((m) => m.name === name);

  it('emits two distinct Method nodes for a simple type-only overload f(Integer)/f(String)', () => {
    expect(methodsNamed('f').length).toBe(2);
  });

  it('emits two distinct Method nodes for a generic overload g(List<Account>)/g(List<Contact>)', () => {
    expect(methodsNamed('g').length).toBe(2);
  });

  it('emits two distinct Method nodes for an array overload h(Account)/h(Account[])', () => {
    expect(methodsNamed('h').length).toBe(2);
  });

  it('emits two distinct Constructor nodes for a constructor overload', () => {
    expect(getNodesByLabelFull(result, 'Constructor').filter((c) => c.name === 'Overloads').length).toBe(
      2,
    );
  });

  it('retains both members of an identical-signature duplicate (start line+column disambiguator)', () => {
    expect(methodsNamed('dup').length).toBe(2);
  });

  it('emits one Property node per declarator of a multi-declarator field (REQ-003)', () => {
    const props = getNodesByLabel(result, 'Property');
    expect(props).toContain('p');
    expect(props).toContain('q');
    expect(props).toContain('r');
  });

  it('propagates a shared annotation to every multi-declarator member (REQ-014)', () => {
    const props = getNodesByLabelFull(result, 'Property');
    for (const name of ['p', 'q', 'r']) {
      const node = props.find((n) => n.name === name);
      expect(node, name).toBeDefined();
      expect(node!.properties.annotations).toContain('@TestVisible');
    }
  });
});

// ── REQ-002 — isExported per declaration context ────────────────────────────
describe.skipIf(!apexAvailable)('Apex isExported by context (REQ-002)', () => {
  let result: PipelineResult;

  beforeAll(async () => {
    result = await runPipelineFromRepo(path.join(FIXTURES, 'apex-exports'), () => {});
  }, 60000);

  const exportedOf = (label: string, name: string): boolean | undefined =>
    getNodesByLabelFull(result, label).find((n) => n.name === name)?.properties.isExported as
      | boolean
      | undefined;

  it('global member -> true', () => {
    expect(exportedOf('Property', 'gField')).toBe(true);
  });
  it('public member -> true', () => {
    expect(exportedOf('Property', 'pubField')).toBe(true);
  });
  it('webservice member -> true', () => {
    expect(exportedOf('Method', 'wsMethod')).toBe(true);
  });
  it('protected member -> false', () => {
    expect(exportedOf('Property', 'protField')).toBe(false);
  });
  it('private member -> false', () => {
    expect(exportedOf('Property', 'privField')).toBe(false);
  });
  it('class member with no modifier -> false', () => {
    expect(exportedOf('Property', 'defField')).toBe(false);
  });
  it('nested type with no modifier -> false', () => {
    expect(exportedOf('Class', 'NoModNested')).toBe(false);
  });
  it('top-level type (global class) -> true; nested explicit-public type -> true', () => {
    expect(exportedOf('Class', 'Visibility')).toBe(true);
    expect(exportedOf('Class', 'Nested')).toBe(true);
  });
  it('interface method with no modifier -> true', () => {
    expect(exportedOf('Method', 'show')).toBe(true);
  });
  it('enum constant -> true (own visibility, even inside its enum)', () => {
    expect(exportedOf('Property', 'HAPPY')).toBe(true);
  });
});

// ── REQ-004 — trigger container node ────────────────────────────────────────
describe.skipIf(!apexAvailable)('Apex trigger container node (REQ-004)', () => {
  let result: PipelineResult;

  beforeAll(async () => {
    result = await runPipelineFromRepo(path.join(FIXTURES, 'apex-trigger'), () => {});
  }, 60000);

  it('emits a trigger as a Class node carrying apexConstruct=trigger and isExported=false', () => {
    const trigger = getNodesByLabelFull(result, 'Class').find(
      (n) => n.name === 'Foo' && n.properties.apexConstruct === 'trigger',
    );
    expect(trigger).toBeDefined();
    expect(trigger!.properties.isExported).toBe(false);
  });

  it('keeps a trigger and a same-named class as two distinct nodes', () => {
    const foos = getNodesByLabelFull(result, 'Class').filter((n) => n.name === 'Foo');
    expect(foos.length).toBe(2);
    // exactly one of them is the trigger
    expect(foos.filter((n) => n.properties.apexConstruct === 'trigger').length).toBe(1);
  });

  it('the same-named class node does NOT carry apexConstruct', () => {
    const cls = getNodesByLabelFull(result, 'Class').find(
      (n) => n.name === 'Foo' && n.properties.apexConstruct === undefined,
    );
    expect(cls).toBeDefined();
  });

  it('emits a DEFINES edge from the File node to the trigger (REQ-002/004)', () => {
    const defines = getRelationships(result, 'DEFINES');
    const triggerDefine = defines.find(
      (e) =>
        e.target === 'Foo' &&
        e.sourceLabel === 'File' &&
        e.targetFilePath.endsWith('.trigger'),
    );
    expect(triggerDefine).toBeDefined();
  });
});

// ── REQ-014 — annotation metadata on each member kind ───────────────────────
describe.skipIf(!apexAvailable)('Apex annotation metadata (REQ-014)', () => {
  let result: PipelineResult;

  beforeAll(async () => {
    result = await runPipelineFromRepo(path.join(FIXTURES, 'apex-annotations'), () => {});
  }, 60000);

  const annotationsOf = (label: string, name: string): string[] =>
    (getNodesByLabelFull(result, label).find((n) => n.name === name)?.properties
      .annotations as string[] | undefined) ?? [];

  it('captures a field annotation, normalised to @Name', () => {
    expect(annotationsOf('Property', 'secret')).toContain('@TestVisible');
  });

  it('captures an auto-property annotation', () => {
    expect(annotationsOf('Property', 'name')).toContain('@AuraEnabled');
  });

  it('captures a method annotation and strips its arguments', () => {
    const fetch = annotationsOf('Method', 'fetch');
    expect(fetch).toContain('@AuraEnabled');
    // arguments stripped: cacheable=true must not appear
    expect(fetch.some((a) => a.includes('cacheable'))).toBe(false);
  });

  it('captures a constructor annotation (REQ-014 — constructor path)', () => {
    expect(annotationsOf('Constructor', 'Annotated')).toContain('@TestVisible');
  });
});

// ── NFR-001 (parse-path) — malformed input never crashes; conservative skip ─
describe.skipIf(!apexAvailable)('Apex malformed-input crash-safety (NFR-001/SEC-001)', () => {
  let result: PipelineResult;

  beforeAll(async () => {
    result = await runPipelineFromRepo(path.join(FIXTURES, 'apex-malformed'), () => {});
  }, 60000);

  it('completes the run and represents the valid file (name-field path)', () => {
    expect(result).toBeDefined();
    expect(getNodesByLabel(result, 'Class')).toContain('Valid');
    expect(getNodesByLabel(result, 'Method')).toContain('ok');
  });

  it('emits no degenerate (empty-named) node on any label', () => {
    for (const label of ['Class', 'Interface', 'Enum', 'Method', 'Constructor', 'Property']) {
      expect(getNodesByLabel(result, label).filter((n) => n === '' || n == null)).toEqual([]);
    }
  });

  it('drops a member whose enclosing owner has no recoverable name (cascade, no orphan)', () => {
    // BrokenName.cls: `public class { public void m() {} }` — owner name MISSING.
    // The valid-named method m must NOT survive as an orphan node.
    expect(getNodesByLabel(result, 'Method')).not.toContain('m');
  });

  it('emits a well-formed sibling declarator while dropping the bad one (declarator path)', () => {
    // BrokenField.cls: a malformed declarator next to `public Integer good;`.
    expect(getNodesByLabel(result, 'Property')).toContain('good');
  });

  it('leaves no dangling edges after cascade drops', () => {
    expect(findDanglingEdges(result)).toEqual([]);
  });
});

// ── NFR-003 — per-file resource budget (over-buffer skip) ───────────────────
describe.skipIf(!apexAvailable)('Apex per-file resource budget (NFR-003)', () => {
  let tmpDir = '';
  let result: PipelineResult;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-oversized-'));
    // One valid small file (must survive) + one over the host buffer (must skip).
    fs.writeFileSync(path.join(tmpDir, 'Small.cls'), 'public class Small { public void ok() {} }\n');
    const filler = '// padding to exceed TREE_SITTER_MAX_BUFFER\n'.repeat(
      Math.ceil(TREE_SITTER_MAX_BUFFER / 40) + 1000,
    );
    fs.writeFileSync(
      path.join(tmpDir, 'Huge.cls'),
      `public class Huge {\n${filler}\n public void big() {} }\n`,
    );
    result = await runPipelineFromRepo(tmpDir, () => {});
  }, 120000);

  afterAll(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('skips the over-budget file at the host threshold but continues the run', () => {
    expect(getNodesByLabel(result, 'Class')).toContain('Small');
    expect(getNodesByLabel(result, 'Class')).not.toContain('Huge');
  });
});

// ── Graceful degradation when the optional grammar is unavailable ───────────
// NOTE: no forceable red state — recognised .cls/.trigger files degrade to a
// skip whether or not Apex is implemented; this guards the optional-grammar
// path against regression. See .vsdd/tdd/WI-1-red-gate.md.
describe('Apex grammar-unavailable degradation (NFR-001 — no crash)', () => {
  it('completes the run with no Apex nodes when the grammar is absent', async () => {
    if (apexAvailable) {
      // When the grammar IS present we cannot exercise the absent path here;
      // the optional-grammar skip is covered by host-level skip-flag e2e tests.
      return;
    }
    const result = await runPipelineFromRepo(path.join(FIXTURES, 'apex-types'), () => {});
    expect(result).toBeDefined();
    // "No Apex nodes" means no Apex *code* nodes — the generic file walker still
    // creates a File node per .cls regardless of language support, so exclude
    // container labels and look only for parsed code constructs.
    const CODE_LABELS = new Set(['Class', 'Interface', 'Enum', 'Method', 'Constructor', 'Property']);
    const apexCodeNodes: string[] = [];
    result.graph.forEachNode((n) => {
      if (CODE_LABELS.has(n.label) && (n.properties.filePath as string | undefined)?.endsWith('.cls')) {
        apexCodeNodes.push(n.properties.name);
      }
    });
    expect(apexCodeNodes).toEqual([]);
  }, 60000);
});
