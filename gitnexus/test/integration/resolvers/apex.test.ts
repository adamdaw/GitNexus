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

  it('records a name and a non-degenerate line range from the definition node', () => {
    const classes = getNodesByLabelFull(result, 'Class');
    const shapes = classes.find((n) => n.name === 'Shapes');
    expect(shapes).toBeDefined();
    expect(shapes!.properties.language).toBe('apex');
    // Top-level Shapes opens the file: startLine 0, and the class spans many lines.
    expect(shapes!.properties.startLine).toBe(0);
    expect(shapes!.properties.endLine).toBeGreaterThan(shapes!.properties.startLine as number);
    // A second type at a different position proves ranges are not uniformly 0/0.
    const inner = classes.find((n) => n.name === 'InnerBox');
    expect(inner).toBeDefined();
    expect(inner!.properties.startLine).toBeGreaterThan(0);
    // Interface and Enum carry line ranges too (same definition-node mechanism).
    const iface = getNodesByLabelFull(result, 'Interface').find((n) => n.name === 'TopShape');
    expect(iface).toBeDefined();
    expect(iface!.properties.startLine).toBe(0);
    expect(iface!.properties.endLine).toBeGreaterThan(iface!.properties.startLine as number);
    const en = getNodesByLabelFull(result, 'Enum').find((n) => n.name === 'TopColor');
    expect(en).toBeDefined();
    expect(en!.properties.endLine).toBeGreaterThan(en!.properties.startLine as number);
  });

  it('emits deeply nested types with a fully-qualified id and no stack overflow (REQ-002 / §4)', () => {
    // Deep.cls: D1>D2>D3>D4>D5, innermost owns deepField/deepMethod.
    expect(getNodesByLabel(result, 'Class')).toContain('D5');
    const ownerIds = getRelationships(result, 'HAS_PROPERTY')
      .filter((e) => e.target === 'deepField')
      .map((e) => e.rel.sourceId);
    expect(ownerIds.some((id) => id.includes('D1.D2.D3.D4.D5'))).toBe(true);
  });

  it('qualifies nested interface and enum ids kind-agnostically, not just classes (REQ-002)', () => {
    // Drawable (nested interface) owns draw(); Palette (nested enum) owns RED.
    const drawOwner = getRelationships(result, 'HAS_METHOD').find((e) => e.target === 'draw')?.rel
      .sourceId;
    expect(drawOwner, 'nested interface owner id').toBeDefined();
    expect(drawOwner!).toContain('Shapes.Drawable');
    const redOwner = getRelationships(result, 'HAS_PROPERTY').find((e) => e.target === 'RED')?.rel
      .sourceId;
    expect(redOwner, 'nested enum owner id').toBeDefined();
    expect(redOwner!).toContain('Shapes.Palette');
  });

  it('does not collide a nested enum with a same-named top-level enum (REQ-002)', () => {
    // Shapes.Palette (nested) vs top-level Palette (Palette.cls) → two distinct Enum nodes.
    expect(getNodesByLabel(result, 'Enum').filter((n) => n === 'Palette').length).toBe(2);
    const hp = getRelationships(result, 'HAS_PROPERTY');
    const nestedOwner = hp.find((e) => e.target === 'RED')?.rel.sourceId; // nested Shapes.Palette
    const topOwner = hp.find((e) => e.target === 'TOPX')?.rel.sourceId; // top-level Palette
    expect(nestedOwner).toBeDefined();
    expect(topOwner).toBeDefined();
    expect(nestedOwner).not.toBe(topOwner);
    expect(topOwner!).not.toContain('Shapes.');
  });

  it('emits a DEFINES edge from the File node to a top-level type (REQ-002)', () => {
    const defines = getRelationships(result, 'DEFINES');
    const edge = defines.find((e) => e.target === 'Shapes' && e.sourceLabel === 'File');
    expect(edge).toBeDefined();
  });

  it('emits a File DEFINES edge for a nested type, like a top-level type (REQ-002, host default)', () => {
    // SDD-001 v1.2: a nested type takes a File→type DEFINES edge identical to a top-level type
    // and to the Java/Kotlin benchmark (owner-edge resolution does not run for class-like labels,
    // so they resolve no enclosing-type owner → File edge). Membership is ALSO recoverable from the
    // qualified id (Outer.Inner), built by the distinct buildQualifiedName name-path.
    const defines = getRelationships(result, 'DEFINES');
    for (const nested of ['InnerBox', 'Drawable', 'Palette']) {
      expect(
        defines.find((e) => e.target === nested && e.sourceLabel === 'File'),
        nested,
      ).toBeDefined();
    }
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

  it('does NOT carry an annotations property on an enum constant (Apex forbids it, REQ-003)', () => {
    const red = getNodesByLabelFull(result, 'Property').find((n) => n.name === 'RED');
    expect(red?.properties.annotations).toBeUndefined();
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
    expect(
      getNodesByLabelFull(result, 'Constructor').filter((c) => c.name === 'Overloads').length,
    ).toBe(2);
  });

  it('collapses an identical-signature duplicate to a single node (host default, REQ-003/§4)', () => {
    // Two identical `dup(Integer a)` methods — only possible in illegal-to-compile Apex. They collide
    // on id and collapse to one node (host last-write-wins/dedup), like every peer language. SDD-001
    // v1.2 reverted the WI-1-specific line+column disambiguator.
    expect(methodsNamed('dup').length).toBe(1);
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

  it('distinguishes overloads by the host collision-triggered parameter-type signature (REQ-003)', () => {
    // The two g overloads collide (same name + arity), so the host appends its raw parameter-type
    // text (formal_parameter.type source, exact case — NOT Apex-normalised per SDD-001 v1.2): the ids
    // carry `List<Account>` vs `List<Contact>`. Asserting the exact-case segment (not just count===2)
    // is what lets WI-2 recompute the id; a positional disambiguator would pass count but fail this,
    // and a lower-cased comparison would mask the v1.2 raw-text rule.
    const gOwnerIds = getRelationships(result, 'HAS_METHOD')
      .filter((e) => e.target === 'g')
      .map((e) => e.rel.targetId);
    expect(gOwnerIds.some((id) => id.includes('List<Account>'))).toBe(true);
    expect(gOwnerIds.some((id) => id.includes('List<Contact>'))).toBe(true);
  });

  it('adds no parameter-type signature to a non-overloaded method id (host collision-only, REQ-003)', () => {
    // qual(Schema.SObjectType a) is not overloaded, so the host appends no param-type segment
    // (typeTagForId is collision-triggered, like every peer). One Method node; the id carries the
    // arity but not the rendered type text. SDD-001 v1.2 reverted the always-on canonical signature.
    expect(methodsNamed('qual').length).toBe(1);
    const qualId = getRelationships(result, 'HAS_METHOD').find((e) => e.target === 'qual')?.rel
      .targetId;
    expect(qualId).toBeDefined();
    expect(qualId!.toLowerCase()).not.toContain('schema.sobjecttype');
  });

  it('keeps member ids and the name case-preserving; case-insensitivity is WI-2 resolution (REQ-003)', () => {
    // Apex is case-insensitive, but per SDD-001 v1.2 that is resolved by WI-2's resolver (the host
    // C# pattern), NOT by case-normalising WI-1 ids. Both the id and the name preserve declared casing.
    const node = getNodesByLabelFull(result, 'Method').find((n) => n.name === 'MixedName');
    expect(node).toBeDefined();
    const id = getRelationships(result, 'HAS_METHOD').find((e) => e.target === 'MixedName')?.rel
      .targetId;
    expect(id).toBeDefined();
    expect(id).toContain('MixedName'); // identity component preserves declared casing
  });

  it('collapses a same-line identical-signature duplicate to a single node (host default, REQ-003/§4)', () => {
    // `public Integer same, same;` — two declarators, same name → identical id → one node (host dedup).
    expect(getNodesByLabelFull(result, 'Property').filter((n) => n.name === 'same').length).toBe(1);
  });

  it('gives each multi-declarator member its own distinct line range (REQ-003)', () => {
    // `public Integer\n ml1,\n ml2;` — declarators on different source lines must
    // carry their own startLine (from the variable_declarator), not the shared range.
    const props = getNodesByLabelFull(result, 'Property');
    const ml1 = props.find((n) => n.name === 'ml1');
    const ml2 = props.find((n) => n.name === 'ml2');
    expect(ml1).toBeDefined();
    expect(ml2).toBeDefined();
    expect(ml1!.properties.startLine).not.toBe(ml2!.properties.startLine);
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
  it('top-level type with no modifier -> false', () => {
    // Visible.cls: `interface Visible` declared with no access modifier.
    expect(exportedOf('Interface', 'Visible')).toBe(false);
  });
  it('enum constant -> true (own visibility, even inside its enum)', () => {
    expect(exportedOf('Property', 'HAPPY')).toBe(true);
  });
  it('enum constant -> true even inside a PRIVATE enum (own visibility, not transitive)', () => {
    // Secret is a `private enum`; its constant HIDDEN is still own-visibility true —
    // owner visibility is not combined in WI-1 (that is WI-2/3's job).
    expect(exportedOf('Property', 'HIDDEN')).toBe(true);
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
        e.target === 'Foo' && e.sourceLabel === 'File' && e.targetFilePath.endsWith('.trigger'),
    );
    expect(triggerDefine).toBeDefined();
  });

  it('does not emit trigger events or the sObject as nodes or node properties (§4)', () => {
    // Foo.trigger: `trigger Foo on Account (before insert, after update)`.
    const trigger = getNodesByLabelFull(result, 'Class').find(
      (n) => n.name === 'Foo' && n.properties.apexConstruct === 'trigger',
    );
    expect(trigger).toBeDefined();
    // No event metadata carried on the trigger node.
    expect(trigger!.properties.events).toBeUndefined();
    expect(trigger!.properties.triggerEvents).toBeUndefined();
    // The sObject (Account) and event keywords are not emitted as graph nodes.
    for (const label of ['Class', 'Interface', 'Enum', 'Method', 'Constructor', 'Property']) {
      const names = getNodesByLabel(result, label);
      expect(names).not.toContain('Account');
      expect(names).not.toContain('insert');
      expect(names).not.toContain('update');
    }
  });
});

// ── REQ-014 — annotation metadata on each member kind ───────────────────────
describe.skipIf(!apexAvailable)('Apex annotation metadata (REQ-014)', () => {
  let result: PipelineResult;

  beforeAll(async () => {
    result = await runPipelineFromRepo(path.join(FIXTURES, 'apex-annotations'), () => {});
  }, 60000);

  const annotationsOf = (label: string, name: string): string[] =>
    (getNodesByLabelFull(result, label).find((n) => n.name === name)?.properties.annotations as
      | string[]
      | undefined) ?? [];

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

  it('captures multiple annotations on one member, including an unknown one verbatim (REQ-014/§4)', () => {
    const anns = annotationsOf('Property', 'multiAnno');
    expect(anns).toContain('@TestVisible');
    expect(anns).toContain('@AuraEnabled');
    // unknown annotation captured verbatim (no validation — framework semantics deferred)
    expect(anns).toContain('@SomeUnknownAnno');
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

  it('re-parents a member of a nameless owner to File scope, not dropped (host default, NFR-001)', () => {
    // BrokenName.cls: `public class { public void m() {} }` — owner name MISSING. The nameless owner
    // emits no node (no degenerate node), but its valid-named method m re-parents to File scope (a
    // File DEFINES edge), like every peer language. SDD-001 v1.2 reverted the WI-1-specific cascade-drop.
    expect(getNodesByLabel(result, 'Method')).toContain('m');
    const defines = getRelationships(result, 'DEFINES');
    expect(defines.find((e) => e.target === 'm' && e.sourceLabel === 'File')).toBeDefined();
  });

  it('emits a well-formed sibling declarator while dropping the bad one (declarator path)', () => {
    // BrokenField.cls: a malformed declarator next to `public Integer good;`.
    expect(getNodesByLabel(result, 'Property')).toContain('good');
  });

  it('leaves no dangling edges after cascade drops', () => {
    expect(findDanglingEdges(result)).toEqual([]);
  });

  it('re-parents nested types of a nameless owner to File scope, with no empty owner-segment id (NFR-001)', () => {
    // BrokenName.cls: a name-MISSING class containing method m AND a nested class InnerOfBroken (with
    // innerM). The nameless owner emits no node; its nested type and members re-parent (host default).
    // The retained NFR-001 guarantee: no id carries an empty owner segment (e.g. `.InnerOfBroken`).
    expect(getNodesByLabel(result, 'Class')).toContain('InnerOfBroken');
    expect(getNodesByLabel(result, 'Method')).toContain('innerM');
    const allIds: string[] = [];
    for (const t of ['DEFINES', 'HAS_METHOD', 'HAS_PROPERTY']) {
      for (const e of getRelationships(result, t)) {
        allIds.push(e.rel.sourceId, e.rel.targetId);
      }
    }
    // No emitted id carries an empty qualified segment (leading dot or `..`).
    expect(allIds.some((id) => /(^|:)\.|\.\./.test(id))).toBe(false);
  });

  it('handles empty and whitespace-only files without crashing or emitting nodes (§4 null/empty)', () => {
    // Empty.cls (0 bytes) and Whitespace.cls (whitespace only) sit beside the valid
    // and malformed files; the run still completes and the valid file is represented.
    expect(result).toBeDefined();
    expect(getNodesByLabel(result, 'Class')).toContain('Valid');
  });
});

// ── NFR-003 — per-file resource budget (over-buffer skip) ───────────────────
describe.skipIf(!apexAvailable)('Apex per-file resource budget (NFR-003)', () => {
  let tmpDir = '';
  let result: PipelineResult;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-oversized-'));
    // One valid small file (must survive) + one over the host buffer (must skip).
    fs.writeFileSync(
      path.join(tmpDir, 'Small.cls'),
      'public class Small { public void ok() {} }\n',
    );
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

// ── Provider per-file isolation (§4 concurrent) ─────────────────────────────
// The provider must hold no shared Apex mutable state: each file is parsed in
// isolation (host worker model), so every emitted node is attributed to its own
// source file — no cross-file bleed or misattribution. This is the observable
// behavioural consequence of statelessness (the code-level "no module mutable
// state" is additionally a Gate-4 review property). Each type below lives in its
// own fixture file; asserting filePath provenance catches shared-state bleed.
describe.skipIf(!apexAvailable)('Apex per-file isolation (§4 concurrent)', () => {
  let result: PipelineResult;
  beforeAll(async () => {
    result = await runPipelineFromRepo(path.join(FIXTURES, 'apex-types'), () => {});
  }, 60000);

  it('attributes each top-level type node to its own source file (no cross-file bleed)', () => {
    const expectations: Record<string, string> = {
      Shapes: 'Shapes.cls',
      TopShape: 'TopShape.cls',
      TopColor: 'TopColor.cls',
      D1: 'Deep.cls',
    };
    const types = [
      ...getNodesByLabelFull(result, 'Class'),
      ...getNodesByLabelFull(result, 'Interface'),
      ...getNodesByLabelFull(result, 'Enum'),
    ];
    for (const [name, file] of Object.entries(expectations)) {
      const node = types.find((n) => n.name === name);
      expect(node, name).toBeDefined();
      expect(node!.properties.filePath as string).toContain(file);
    }
  });

  it('emits each top-level type exactly once (no duplication from state bleed)', () => {
    const shapes = getNodesByLabelFull(result, 'Class').filter((n) => n.name === 'Shapes');
    expect(shapes.length).toBe(1);
    const topShape = getNodesByLabelFull(result, 'Interface').filter((n) => n.name === 'TopShape');
    expect(topShape.length).toBe(1);
  });
});

// ── Encoding robustness (§4 encoding) ───────────────────────────────────────
// Host buffer sizing handles byte-level encoding, but a UTF-8 BOM or CRLF can
// leak into extracted identifier text if name extraction is naive — an
// Apex-path concern. The class name must come through clean (no BOM char),
// proving the extraction path is encoding-robust.
describe.skipIf(!apexAvailable)('Apex encoding robustness (§4)', () => {
  let result: PipelineResult;
  beforeAll(async () => {
    result = await runPipelineFromRepo(path.join(FIXTURES, 'apex-encoding'), () => {});
  }, 60000);

  it('extracts a clean class name from a BOM-prefixed, CRLF file (no BOM in the name)', () => {
    const classes = getNodesByLabel(result, 'Class');
    expect(classes).toContain('BomClass');
    const BOM = String.fromCharCode(0xfeff);
    expect(classes.some((n) => n.includes(BOM))).toBe(false);
  });

  it('emits members from a CRLF file', () => {
    expect(getNodesByLabel(result, 'Method')).toContain('bomMethod');
  });
});

// Grammar-unavailable degradation (the §8 "recognised files skipped, run
// completes" clause) is exercised at the pipeline level in
// test/unit/apex-skip-grammar.test.ts, which forces the runtime opt-out via a
// fresh module load — a self-disabling skipIf guard here could not drive it once
// the grammar is present.
