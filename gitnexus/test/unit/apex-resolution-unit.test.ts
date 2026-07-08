/**
 * Apex (Salesforce) — WI-2: resolution mechanics, main-thread UNIT anchors.
 *
 * SDD-002 §7 provisions main-thread unit anchors for the new pure resolution
 * functions so they are COVERAGE-ATTRIBUTABLE (dogfood #16): the provider configs
 * run inside the parse worker_thread, invisible to main-thread v8 coverage, so the
 * integration suite alone cannot attribute coverage on `languages/apex/**`. These
 * anchors call the pure functions directly on the main thread.
 *
 * Authored BEFORE implementation (VSDD Phase 3, TDD). They are RED until Step 3b:
 *   - `apexProvider.normalizeIdentifier` does not exist yet -> undefined.
 *   - `languages/apex/arity-metadata.ts` (the Apex param-type case-fold, mirroring
 *     cpp's `normalizeCppParamType`, SDD-002 §3) does not exist yet -> import fails.
 * Step 3b adds both and these go green.
 */
import { describe, it, expect } from 'vitest';
import { apexProvider } from '../../src/core/ingestion/languages/apex/index.js';

// `languages/apex/arity-metadata.ts` (the Apex param-type case-fold, mirroring cpp's
// `normalizeCppParamType`, SDD-002 §3) is created in Step 3b. Imported dynamically so THIS file still
// collects pre-impl and each anchor below fails individually (the import rejects) instead of the whole
// file failing to load — clean per-test Red-Gate evidence.
const loadNormalizeApexParamType = async (): Promise<(raw: string) => string> => {
  const mod = await import('../../src/core/ingestion/languages/apex/arity-metadata.js');
  return (mod as { normalizeApexParamType: (raw: string) => string }).normalizeApexParamType;
};

// ── normalizeIdentifier §2.2 seam — Apex supplies toLowerCase (REQ-005/008) ──
describe('Apex normalizeIdentifier seam (SDD-002 §2.2)', () => {
  const norm = (s: string): string | undefined =>
    (apexProvider as { normalizeIdentifier?: (s: string) => string }).normalizeIdentifier?.(s);

  it('the Apex provider supplies a normalizeIdentifier seam (not the identity default)', () => {
    expect((apexProvider as { normalizeIdentifier?: unknown }).normalizeIdentifier).toBeDefined();
  });

  it('case-folds an identifier (Apex case-insensitivity)', () => {
    expect(norm('Account')).toBe('account');
    expect(norm('ACCOUNT')).toBe('account');
  });

  it('is symmetric: case-variants of one identifier normalize to the same key', () => {
    // The correctness invariant of the seam — insert and lookup must agree on the key. Asserted against
    // a concrete folded value (not just norm(a)===norm(b), which would pass trivially while both undefined).
    expect(norm('MyType')).toBe('mytype');
    expect(norm('MYTYPE')).toBe('mytype');
  });

  it('is idempotent / identity-preserving on an already-folded identifier', () => {
    expect(norm('account')).toBe('account');
  });
});

// ── Apex-local param-type case-fold — for REQ-008 overload comparison ─────────
describe('Apex param-type case-fold (SDD-002 §3, mirrors cpp normalizeCppParamType)', () => {
  it('folds case so case-varied param types compare equal', async () => {
    const fold = await loadNormalizeApexParamType();
    expect(fold('Account')).toBe(fold('account'));
    expect(fold('ACCOUNT')).toBe(fold('Account'));
  });

  it('folds case inside a generic param type while preserving its structure', async () => {
    // Generics are preserved structurally (member lookup keys on the folded text); only case folds.
    const fold = await loadNormalizeApexParamType();
    expect(fold('List<Account>')).toBe(fold('list<account>'));
  });

  it('distinguishes genuinely different param types (no over-collapse)', async () => {
    const fold = await loadNormalizeApexParamType();
    expect(fold('Account')).not.toBe(fold('Contact'));
  });
});
