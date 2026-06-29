import { describe, it, expect, beforeAll } from 'vitest';
import type Parser from 'tree-sitter';
import { createParserForLanguage } from '../../src/core/tree-sitter/parser-loader.js';
import { SupportedLanguages, getLanguageFromFilename } from 'gitnexus-shared';
import type { SyntaxNode } from '../../src/core/ingestion/utils/ast-helpers.js';

import { apexProvider } from '../../src/core/ingestion/languages/apex/index.js';
import { apexClassConfig } from '../../src/core/ingestion/languages/apex/class-config.js';
import { apexFieldConfig } from '../../src/core/ingestion/languages/apex/field-config.js';
import { apexMethodConfig } from '../../src/core/ingestion/languages/apex/method-config.js';
import { apexExportChecker } from '../../src/core/ingestion/languages/apex/export-checker.js';
import { extractApexAnnotations } from '../../src/core/ingestion/languages/apex/annotations.js';

/**
 * Main-thread unit anchors for the Apex provider config functions (SDD-001 §1,
 * REQ-002/003/004/014). The integration suite exercises these through the parse
 * *worker* (a worker_thread running compiled `dist/`), where v8 line-coverage
 * cannot see them; calling them directly here parses Apex in-process so the pure
 * extraction/visibility/annotation logic is both behaviourally asserted and
 * coverage-attributed to `languages/apex/**`.
 */

let parser: Parser;

const parse = (src: string): SyntaxNode => parser.parse(src).rootNode as unknown as SyntaxNode;

function findAll(node: SyntaxNode, type: string): SyntaxNode[] {
  const out: SyntaxNode[] = [];
  const visit = (n: SyntaxNode): void => {
    if (n.type === type) out.push(n);
    for (let i = 0; i < n.namedChildCount; i++) {
      const c = n.namedChild(i);
      if (c) visit(c);
    }
  };
  visit(node);
  return out;
}
const findFirst = (node: SyntaxNode, type: string): SyntaxNode => {
  const found = findAll(node, type)[0];
  if (!found) throw new Error(`no ${type} node in source`);
  return found;
};

beforeAll(async () => {
  parser = await createParserForLanguage(SupportedLanguages.Apex);
});

describe('apexClassConfig.extractType (REQ-002)', () => {
  it('labels class/interface/enum/trigger', () => {
    const cls = parse('public class C {}');
    const iface = parse('public interface I { void m(); }');
    const en = parse('public enum E { A, B }');
    const trig = parse('trigger T on Account (before insert) {}');
    expect(apexClassConfig.extractType!(findFirst(cls, 'class_declaration'))).toBe('Class');
    expect(apexClassConfig.extractType!(findFirst(iface, 'interface_declaration'))).toBe('Interface');
    expect(apexClassConfig.extractType!(findFirst(en, 'enum_declaration'))).toBe('Enum');
    expect(apexClassConfig.extractType!(findFirst(trig, 'trigger_declaration'))).toBe('Class');
  });
});

describe('apexClassConfig.extractProperties (REQ-004)', () => {
  it('marks a trigger with apexConstruct, leaves a class unmarked', () => {
    const trig = parse('trigger T on Account (before insert) {}');
    const cls = parse('public class C {}');
    expect(apexClassConfig.extractProperties!(findFirst(trig, 'trigger_declaration'))).toEqual({
      apexConstruct: 'trigger',
    });
    expect(apexClassConfig.extractProperties!(findFirst(cls, 'class_declaration'))).toBeUndefined();
  });
});

describe('apexExportChecker (REQ-002 visibility buckets)', () => {
  const exportableOf = (src: string, nodeType: string): boolean =>
    apexExportChecker(findFirst(parse(src), nodeType), 'x');

  it('treats global/public/webservice as exported', () => {
    expect(exportableOf('global class C {}', 'class_declaration')).toBe(true);
    expect(exportableOf('public class C {}', 'class_declaration')).toBe(true);
    expect(exportableOf('class C { webservice static void m() {} }', 'method_declaration')).toBe(true);
  });

  it('treats protected/private as not exported', () => {
    expect(exportableOf('class C { protected void m() {} }', 'method_declaration')).toBe(false);
    expect(exportableOf('class C { private Integer a; }', 'field_declaration')).toBe(false);
  });

  it('defaults a modifier-less class member to not exported', () => {
    expect(exportableOf('class C { void m() {} }', 'method_declaration')).toBe(false);
  });

  it('treats a modifier-less interface method as exported (implicitly public)', () => {
    expect(exportableOf('interface I { Decimal area(); }', 'method_declaration')).toBe(true);
  });

  it('treats an enum constant as exported regardless of enum visibility', () => {
    expect(exportableOf('private enum E { RED, GREEN }', 'enum_constant')).toBe(true);
  });

  it('defaults a trigger to not exported', () => {
    expect(exportableOf('trigger T on Account (before insert) {}', 'trigger_declaration')).toBe(false);
  });

  // Regression (Gate 4 Pass 2, finding 1): a modifier-less member must NOT be
  // classified as exported just because an annotation argument contains a
  // visibility keyword as a whole word. Whole-text matching mis-bucketed this.
  it('does not count a visibility keyword inside an annotation argument as a modifier', () => {
    const src = "class C { @RestResource(urlMapping='/public/v1') Integer secret; }";
    expect(exportableOf(src, 'field_declaration')).toBe(false);
  });
});

describe('Apex case-insensitive modifiers (Gate 4 Pass 2, finding — REQ-002/003)', () => {
  const exportableOf = (src: string, nodeType: string): boolean =>
    apexExportChecker(findFirst(parse(src), nodeType), 'x');

  it('recognises mixed-case visibility keywords as exported (Apex is case-insensitive)', () => {
    // `webService` (capital S) is Salesforce's documented canonical casing.
    expect(exportableOf('class C { webService static void m() {} }', 'method_declaration')).toBe(true);
    expect(exportableOf('class C { Public Integer a; }', 'field_declaration')).toBe(true);
    expect(exportableOf('GLOBAL class C {}', 'class_declaration')).toBe(true);
  });

  it('reads mixed-case static/final/visibility on field and method configs', () => {
    const fld = findFirst(parse('class C { Private Static Final Integer X = 0; }'), 'field_declaration');
    expect(apexFieldConfig.extractVisibility!(fld)).toBe('private');
    expect(apexFieldConfig.isStatic!(fld)).toBe(true);
    expect(apexFieldConfig.isReadonly!(fld)).toBe(true);

    const m = findFirst(parse('class C { PUBLIC STATIC void go() {} }'), 'method_declaration');
    expect(apexMethodConfig.extractVisibility!(m)).toBe('public');
    expect(apexMethodConfig.isStatic!(m)).toBe(true);
  });
});

describe('apexFieldConfig (REQ-003/014)', () => {
  it('enumerates every declarator of a multi-declarator field', () => {
    const fld = findFirst(parse('class C { Integer a, b, c; }'), 'field_declaration');
    expect(apexFieldConfig.extractNames!(fld)).toEqual(['a', 'b', 'c']);
  });

  it('reads visibility, static, and final/readonly modifiers', () => {
    const fld = findFirst(parse('class C { private static final Integer COUNT = 0; }'), 'field_declaration');
    expect(apexFieldConfig.extractVisibility!(fld)).toBe('private');
    expect(apexFieldConfig.isStatic!(fld)).toBe(true);
    expect(apexFieldConfig.isReadonly!(fld)).toBe(true);
  });

  it('normalises field annotations to @Name with args stripped', () => {
    const fld = findFirst(parse('class C { @AuraEnabled(cacheable=true) String n; }'), 'field_declaration');
    expect(apexFieldConfig.extractAnnotations!(fld)).toEqual(['@AuraEnabled']);
  });

  it('extracts the single-declarator name and its type', () => {
    const fld = findFirst(parse('class C { Map<Id, Account> byId; }'), 'field_declaration');
    expect(apexFieldConfig.extractName!(fld)).toBe('byId');
    // The type label is the simple name (host strips generic arguments).
    expect(apexFieldConfig.extractType!(fld)).toBe('Map');
  });
});

describe('apexProvider (SDD-001 §1 — registration shape)', () => {
  it('exposes the Apex id, extensions, and the WI-scoped (no-op) type/import config', () => {
    expect(apexProvider.id).toBe(SupportedLanguages.Apex);
    expect(apexProvider.extensions).toEqual(['.cls', '.trigger']);
    // WI-1 is parse/graph only — resolution (WI-2…4) is not wired yet.
    expect(apexProvider.exportChecker).toBe(apexExportChecker);
    expect(apexProvider.treeSitterQueries.length).toBeGreaterThan(0);
  });

  it('maps .cls/.trigger to Apex without disturbing an incumbent extension (REQ-001 §8 spot-check)', () => {
    expect(getLanguageFromFilename('Acct.cls')).toBe(SupportedLanguages.Apex);
    expect(getLanguageFromFilename('Acct.trigger')).toBe(SupportedLanguages.Apex);
    // A non-Apex extension still resolves to its incumbent language.
    expect(getLanguageFromFilename('Foo.java')).toBe(SupportedLanguages.Java);
  });
});

describe('apexMethodConfig (REQ-003/014)', () => {
  it('extracts parameter rawType for overload disambiguation', () => {
    const m = findFirst(parse('class C { void m(List<Account> accts, Integer n) {} }'), 'method_declaration');
    const params = apexMethodConfig.extractParameters!(m);
    expect(params.map((p) => p.name)).toEqual(['accts', 'n']);
    expect(params[0].rawType).toBe('List<Account>');
  });

  it('covers constructors through the same path', () => {
    const ctor = findFirst(parse('class C { public C(Integer x) {} }'), 'constructor_declaration');
    expect(apexMethodConfig.extractName!(ctor)).toBe('C');
    expect(apexMethodConfig.extractVisibility!(ctor)).toBe('public');
  });

  it('treats a body-less interface method as abstract', () => {
    const iface = parse('interface I { Decimal area(); }');
    const m = findFirst(iface, 'method_declaration');
    const owner = findFirst(iface, 'interface_declaration');
    expect(apexMethodConfig.isAbstract!(m, owner)).toBe(true);
  });
});

describe('extractApexAnnotations (REQ-014)', () => {
  it('strips arguments and handles multiple annotations', () => {
    const m = findFirst(
      parse('class C { @AuraEnabled(cacheable=true) @TestVisible void m() {} }'),
      'method_declaration',
    );
    expect(extractApexAnnotations(m)).toEqual(['@AuraEnabled', '@TestVisible']);
  });

  it('returns no annotations for an unannotated member', () => {
    const m = findFirst(parse('class C { void m() {} }'), 'method_declaration');
    expect(extractApexAnnotations(m)).toEqual([]);
  });
});
