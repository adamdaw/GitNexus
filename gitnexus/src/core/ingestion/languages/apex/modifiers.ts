/**
 * Apex-local modifier matching (SDD-001 §1, REQ-002/003 — case-insensitive keywords).
 *
 * Apex is a case-insensitive language: `webService`, `Public`, `GLOBAL` are all
 * valid spellings of the same keyword (Salesforce documents the SOAP keyword as
 * `webService`, capital S). The grammar preserves source case, so the host's
 * case-sensitive `hasModifier`/`findVisibility` (correct for Java/Kotlin, where
 * `Public` is not a keyword) would miss them. These wrappers case-fold the token
 * before comparison and live entirely under `languages/apex/` so the shared
 * helpers — and peer languages' case-sensitive semantics — are untouched.
 *
 * Both helpers scan every child token of the `modifiers` node and match on
 * case-folded text equality, so they work whether a keyword is an anonymous token
 * or a named `modifier` child; an `annotation` child never matches a bare keyword
 * (its text starts with `@`).
 */

import type { SyntaxNode } from '../../utils/ast-helpers.js';

/** Does the declaration carry `keyword` (passed lowercase) as an actual `modifier`
 *  token, compared case-insensitively? */
export function apexHasModifier(node: SyntaxNode, keyword: string): boolean {
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (child?.type !== 'modifiers') continue;
    for (let j = 0; j < child.childCount; j++) {
      const mod = child.child(j);
      if (mod && mod.text.trim().toLowerCase() === keyword) return true;
    }
  }
  return false;
}

/** First visibility keyword on the declaration, normalised to its canonical
 *  lowercase form, or `defaultVis`. `keywords` holds the canonical lowercase set. */
export function apexFindVisibility<V extends string>(
  node: SyntaxNode,
  keywords: ReadonlySet<V>,
  defaultVis: V,
): V {
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (child?.type !== 'modifiers') continue;
    for (let j = 0; j < child.childCount; j++) {
      const mod = child.child(j);
      const text = mod?.text.trim().toLowerCase() as V | undefined;
      if (text && (keywords as ReadonlySet<string>).has(text)) return text;
    }
  }
  return defaultVis;
}
