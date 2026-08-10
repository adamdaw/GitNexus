import { describe, it, expect } from 'vitest';
import type { CaptureMatch } from 'gitnexus-shared';
import { emitApexScopeCaptures } from '../../../src/core/ingestion/languages/apex/captures.js';
import { isLanguageAvailable } from '../../../src/core/tree-sitter/parser-loader.js';
import { SupportedLanguages } from '../../../src/config/supported-languages.js';

/**
 * Phase 6 / Gate 5 hardening for WI-2 (resolution mechanics) — Constitution §6
 * fuzz budget, NFR-001 resolution-stage slice. Distinct from WI-1's parse-boundary
 * fuzz (`apex-hardening.test.ts`, which targets `parseSourceSafe`): this targets the
 * owned WI-2 resolution surface — `emitApexScopeCaptures`, which parses AND runs the
 * full capture pipeline (free/member call classification, `this`/`super` receiver-
 * binding synth, arity metadata, argument-type inference, var-type-binding resolution
 * with its JSON.parse paths, and inheritance / explicit-constructor synthesis). The
 * NFR-001 resolution slice requires this to complete without crashing on partial /
 * error-recovery trees, leaving references unresolved rather than throwing.
 *
 * Two checks, both in-process (the vendored grammar loads synchronously):
 *  1. Adversarial-input no-crash corpus (the gating obligation) — malformed inputs
 *     shaped to hit the resolution synth paths (truncated calls / chains / `new` /
 *     `this`/`super`, malformed arg lists, deep member chains). Every input must
 *     return a defined CaptureMatch[] with no escaping throw, in bounded time.
 *  2. A bounded smoke-fuzz (>=10,000-execution floor) of mutated/random input over a
 *     resolution-significant atom alphabet, seeded deterministically — no throw.
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
  'Apex resolution-path hardening — adversarial corpus (Gate 5, §A.4)',
  () => {
    const corpus: Record<string, string> = {
      'truncated free call': 'public class C { void m() { foo(',
      'truncated member call': 'public class C { void m() { a.b.c(',
      'truncated field chain': 'public class C { void m() { Account a; a.',
      'new with no type': 'public class C { void m() { Object o = new ; } }',
      'truncated new': 'public class C { void m() { new ',
      'truncated super in ctor': 'public class C extends B { C() { super(',
      'truncated this in ctor': 'public class C { C() { this(',
      'malformed empty args': 'public class C { void m() { f(,,,); } }',
      'malformed assignment no rhs': 'public class C { void m() { a.b = ; } }',
      'enhanced-for truncated': 'public class C { void m() { for (Account a : ',
      'malformed generic binding': 'public class C { List< x; }',
      'param with no type': 'public class C { void m( a) {} }',
      'deep member chain': `public class C { void m() { ${'a.'.repeat(2000)}b(); } }`,
      'deep nested calls': `public class C { void m() { ${'f('.repeat(2000)}${')'.repeat(2000)}; } }`,
      'huge arg list': `public class C { void m() { f(${'x, '.repeat(20_000)}y); } }`,
      'super with no superclass': 'public class C { C() { super(); } }',
      'this on enum': 'public enum E { A, B }',
      'trigger body truncated call': 'trigger T on Account (before insert) { handler.run(',
      'interface extends garbage': 'public interface I extends { }',
      'field access on literal': 'public class C { void m() { Integer x = 1; x.foo(); } }',
      'mixed valid and garbage': 'public class C { void ok() { good(); } void m() { a.b.c.d(',
      empty: '',
      'whitespace only': '   \n\t\r\n  ',
      'only delimiters': '{}().,;<>',
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
  'Apex resolution-path hardening — bounded smoke-fuzz (Gate 5, §A.4)',
  () => {
    // Deterministic PRNG (mulberry32) — the seed IS the reproducible corpus.
    const mulberry32 = (seed: number) => () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    // Atoms biased toward resolution-significant shapes (calls, member access, `new`,
    // `this`/`super`, args, type bindings) so draws land near the synth paths, not
    // just inert bytes.
    const ATOMS = [
      'class C {',
      'void m() {',
      '}',
      'foo(',
      'a.b(',
      'a.b.c',
      'new Account(',
      'this(',
      'super(',
      'x',
      ', y',
      'Account a =',
      'Integer i = 1;',
      "String s = 'x';",
      'extends B',
      'implements I',
      '(',
      ')',
      '.',
      ';',
      ',',
      '<Account>',
      'on Account',
      'trigger T',
      'interface I {',
      'enum E {',
      ' ',
      '\n',
    ];

    const EXECUTIONS = 10_000; // Constitution §6 floor

    it(`survives ${EXECUTIONS} mutated/random draws with no escaping throw`, () => {
      const rand = mulberry32(0x5f3a_c002); // sibling seed to WI-1's 0x5f3ac001
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
