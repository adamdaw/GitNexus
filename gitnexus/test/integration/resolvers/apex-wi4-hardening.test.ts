import { describe, it, expect } from 'vitest';
import type { CaptureMatch } from 'gitnexus-shared';
import { emitApexScopeCaptures } from '../../../src/core/ingestion/languages/apex/captures.js';
import { isLanguageAvailable } from '../../../src/core/tree-sitter/parser-loader.js';
import { SupportedLanguages } from '../../../src/config/supported-languages.js';

/**
 * Phase 6 / Gate 5 hardening for WI-4 (parity hardening & external handling) —
 * Constitution §6 fuzz budget, NFR-001 resolution-stage slice. Distinct from WI-1's
 * parse-boundary fuzz (`apex-hardening.test.ts`), WI-2's resolution-synth fuzz
 * (`apex-resolution-hardening.test.ts`), and WI-3's cross-file capture fuzz
 * (`apex-cross-file-hardening.test.ts`, which exercised nested ctors / enum constants /
 * `this.<field>` args / integer-boolean literal args). This corpus targets the
 * capture-surface additions WI-4 layered onto `emitApexScopeCaptures`:
 *   - the `@reference.qualified-name` emit for a **dotted heritage base**
 *     (`extends Outer.Inner`) — WS2,
 *   - the `@reference.qualified-name` emit for a **dotted explicit-constructor ref**
 *     (nested-parent `super(...)`) — WS2,
 *   - the **parameter-sourced argument-type slot** marker tagging in
 *     `resolveVarTypeBindings` (broadened to `@type-binding.parameter`) — WS3.
 * WI-3's corpus never exercises dotted *heritage* bases, dotted super ctor refs, or
 * parameter-typed argument slots, so this corpus is non-redundant.
 *
 * The WI-4 resolution-pass edits — the `run.ts` Apex-gated re-sequence, the `walkers.ts`
 * `resolveDottedHeritageBase` seam + folded receiver-var fallback, the
 * `namespace-siblings.ts` OUTER-first oracle, and the `param-arg-gate.ts` resolution-phase
 * hook — run in the scope-resolution pipeline, NOT inside `emitApexScopeCaptures`, so they
 * are covered by the Gate-5 mutation audit + the 3050-test green suite + the purity audit,
 * not this fuzz.
 *
 * `parseSourceSafe` (inside `emitApexScopeCaptures`) yields ERROR nodes on malformed input,
 * never an exception; "no crash" means a defined array, no unexpected throw, bounded
 * wall-clock.
 */

let apexAvailable = false;
try {
  apexAvailable = isLanguageAvailable(SupportedLanguages.Apex as unknown as SupportedLanguages);
} catch {
  apexAvailable = false;
}

const capture = (src: string): readonly CaptureMatch[] => emitApexScopeCaptures(src, 'Fuzz.cls');

describe.skipIf(!apexAvailable)('Apex WI-4 hardening — adversarial corpus (Gate 5, §A.4)', () => {
  const corpus: Record<string, string> = {
    // Dotted heritage base (WS2 — @reference.qualified-name emit path)
    'dotted extends truncated': 'public class C extends Outer.',
    'dotted extends no tail': 'public class C extends Outer. { }',
    'dotted extends leading dot': 'public class C extends .Inner { }',
    'dotted extends two segment': 'public class C extends Outer.Inner { }',
    'dotted extends three segment': 'public class C extends A.B.C { }',
    'dotted extends deep': `public class C extends ${'A.'.repeat(2000)}Z { }`,
    'dotted extends delimiters only': 'public class C extends ... { }',
    'dotted implements truncated': 'public class C implements Outer.',
    'dotted implements mixed': 'public class C extends A.B implements C.D, E.F { }',
    // Dotted explicit-constructor ref / super (WS2 — dotted super() emit path)
    'super truncated': 'public class C extends B { C() { super(',
    'super empty': 'public class C extends B { C() { super(); } }',
    'super nested arg': 'public class C extends Outer.Inner { C() { super(new Outer.Inner()); } }',
    'super dotted garbage': 'public class C extends B { C() { super.Outer.(); } }',
    'this-ctor chain truncated': 'public class C { C() { this(',
    // Parameter-sourced argument-type slots (WS3 — marker tagging path)
    'param arg simple': 'public class C { void m(Foo x) { g(x); } }',
    'param arg dotted type': 'public class C { void m(Outer.Inner x) { g(x); } }',
    'param arg no body': 'public class C { void m(Foo x) }',
    'param arg truncated type': 'public class C { void m(Outer.',
    'param arg many params': `public class C { void m(${'Foo a, '.repeat(500)}Bar z) { g(a); } }`,
    'param arg passed twice': 'public class C { void m(Foo x) { g(x, x); } }',
    'param arg shadowed': 'public class C { Foo x; void m(Bar x) { g(x); } }',
    // Degenerate / empty
    'extends nothing': 'public class C extends { }',
    'empty': '',
    'whitespace only': '   \n\t\r\n  ',
    'only heritage keywords': 'extends implements super this new ....',
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
});

describe.skipIf(!apexAvailable)('Apex WI-4 hardening — bounded smoke-fuzz (Gate 5, §A.4)', () => {
  // Deterministic PRNG (mulberry32) — the seed IS the reproducible corpus.
  const mulberry32 = (seed: number) => () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Atoms biased toward WI-4's capture-surface additions: dotted heritage bases,
  // dotted super/ctor refs, parameter-typed method headers, and their delimiters.
  const ATOMS = [
    'class C {', 'void m(', 'Foo x', 'Outer.Inner', 'extends Outer.Inner',
    'extends A.B.C', 'implements I.J', 'super(', 'this(', 'new Outer.Inner()',
    ') {', 'g(x)', 'x, ', 'Outer.', '.Inner', ', ', '(', ')', '.', ';', '{', '}', ' ', '\n',
  ];

  const EXECUTIONS = 10_000; // Constitution §6 floor

  it(`survives ${EXECUTIONS} mutated/random draws with no escaping throw`, () => {
    const rand = mulberry32(0x5f3a_c004); // sibling seed to WI-1 0x5f3ac001, WI-2 0x5f3ac002, WI-3 0x5f3ac003
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
        throw new Error(`fuzz draw ${i} threw unexpectedly on input ${JSON.stringify(src)}: ${String(err)}`);
      }
      expect(matches).toBeDefined();
    }
    expect(drawn).toBe(EXECUTIONS);
  }, 120_000);
});
