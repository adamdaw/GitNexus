import { describe, it, expect } from 'vitest';
import type { CaptureMatch } from 'gitnexus-shared';
import { emitApexScopeCaptures } from '../../../src/core/ingestion/languages/apex/captures.js';
import { isLanguageAvailable } from '../../../src/core/tree-sitter/parser-loader.js';
import { SupportedLanguages } from '../../../src/config/supported-languages.js';

/**
 * Phase 6 / Gate 5 hardening for WI-3 (cross-file binding + resolution) — Constitution
 * §6 fuzz budget, NFR-001 resolution-stage slice. Distinct from WI-1's parse-boundary
 * fuzz (`apex-hardening.test.ts` → `parseSourceSafe`) and WI-2's resolution-synth fuzz
 * (`apex-resolution-hardening.test.ts`): this targets the capture-surface additions WI-3
 * layered onto `emitApexScopeCaptures` — the `scoped_type_identifier` captures (nested
 * ctors `new Outer.Inner()`, nested declared types `Outer.Inner i`, nested fields), the
 * `enum_constant` declaration capture, the integer/boolean literal argument-type
 * inference, and the `this.<field>` argument-reference resolution. WI-2's corpus never
 * exercises scoped types, enum constants, or `this.`-qualified args, so this corpus is
 * non-redundant. The cross-file resolution-pass edits (namespace-siblings injection and
 * the shared-pass walkers/free-call/receiver-bound/compound edits) run in the
 * scope-resolution pipeline, NOT inside `emitApexScopeCaptures`, so they are covered by
 * the Gate-5 mutation audit + the 2991-test green suite + the purity audit, not this fuzz.
 *
 * `parseSourceSafe` (inside `emitApexScopeCaptures`) yields ERROR nodes on malformed
 * input, never an exception; "no crash" means a defined array, no unexpected throw,
 * bounded wall-clock.
 */

let apexAvailable = false;
try {
  apexAvailable = isLanguageAvailable(SupportedLanguages.Apex as unknown as SupportedLanguages);
} catch {
  apexAvailable = false;
}

const capture = (src: string): readonly CaptureMatch[] => emitApexScopeCaptures(src, 'Fuzz.cls');

describe.skipIf(!apexAvailable)(
  'Apex cross-file hardening — adversarial corpus (Gate 5, §A.4)',
  () => {
    const corpus: Record<string, string> = {
      'truncated scoped ctor': 'public class C { void m() { Object o = new Outer.',
      'truncated scoped ctor open paren': 'public class C { void m() { new Outer.Inner(',
      'scoped ctor no tail': 'public class C { void m() { new Outer.() ; } }',
      'deeply scoped ctor': `public class C { void m() { new ${'A.'.repeat(2000)}Z(); } }`,
      'truncated scoped declared type': 'public class C { void m() { Outer.Inner ',
      'scoped declared type no var': 'public class C { void m() { Outer.Inner ; } }',
      'scoped field no init': 'public class C { Outer.Inner f; }',
      'truncated scoped field': 'public class C { Outer.',
      'enum empty body': 'public enum E { }',
      'enum trailing comma': 'public enum E { A, B, }',
      'enum only comma': 'public enum E { , }',
      'enum constant no name': 'public enum E { , A }',
      'this.field arg truncated': 'public class C { void m() { t.f(this.',
      'this arg no field': 'public class C { void m() { t.f(this.); } }',
      'this.field deep': `public class C { void m() { t.f(this.${'a.'.repeat(2000)}z); } }`,
      'int literal arg truncated': 'public class C { void m() { f(7',
      'boolean literal arg': 'public class C { void m() { f(true); } }',
      'mixed literal args garbage': 'public class C { void m() { f(7, true, , ); } }',
      'inherited implicit-this truncated': 'public class C extends B { void m() { inherited(',
      'super member truncated': 'public class C extends B { void m() { super.',
      'scoped type in extends': 'public class C extends Outer.Inner { }',
      'scoped type in implements garbage': 'public class C implements Outer. { }',
      'nested new in arg': 'public class C { void m() { f(new Outer.Inner()); } }',
      empty: '',
      'whitespace only': '   \n\t\r\n  ',
      'only scoped delimiters': '..Outer.Inner..new..',
    };

    for (const [name, src] of Object.entries(corpus)) {
      it(`captures without crashing: ${name}`, () => {
        const start = Date.now();
        let matches: readonly CaptureMatch[] | undefined;
        expect(() => {
          matches = capture(src);
        }).not.toThrow();
        expect(matches).toBeDefined();
        expect(Array.isArray(matches)).toBe(true);
        expect(Date.now() - start).toBeLessThan(10_000);
      });
    }
  },
);

describe.skipIf(!apexAvailable)(
  'Apex cross-file hardening — bounded smoke-fuzz (Gate 5, §A.4)',
  () => {
    // Deterministic PRNG (mulberry32) — the seed IS the reproducible corpus.
    const mulberry32 = (seed: number) => () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    // Atoms biased toward WI-3's capture-surface additions: scoped/nested types,
    // enum constants, this.field args, integer/boolean literal args, super/inherited.
    const ATOMS = [
      'class C {',
      'enum E {',
      'void m() {',
      '}',
      'Outer.Inner',
      'new Outer.Inner(',
      'Outer.',
      '.Inner',
      'i;',
      'f(',
      'this.w',
      '7',
      'true',
      'super.',
      'inherited(',
      'extends Outer.Inner',
      'A, B,',
      'RED',
      ', ',
      '(',
      ')',
      '.',
      ';',
      ' ',
      '\n',
    ];

    const EXECUTIONS = 10_000; // Constitution §6 floor

    it(`survives ${EXECUTIONS} mutated/random draws with no escaping throw`, () => {
      const rand = mulberry32(0x5f3a_c003); // sibling seed to WI-1's 0x5f3ac001, WI-2's 0x5f3ac002
      let drawn = 0;
      for (let i = 0; i < EXECUTIONS; i++) {
        const len = 1 + Math.floor(rand() * 30);
        let src = '';
        for (let j = 0; j < len; j++) src += ATOMS[Math.floor(rand() * ATOMS.length)];
        drawn++;
        let matches: readonly CaptureMatch[] | undefined;
        try {
          matches = capture(src);
        } catch (err) {
          throw new Error(
            `fuzz draw ${i} threw unexpectedly on input ${JSON.stringify(src)}: ${String(err)}`,
          );
        }
        expect(matches).toBeDefined();
      }
      expect(drawn).toBe(EXECUTIONS);
    }, 120_000);
  },
);
