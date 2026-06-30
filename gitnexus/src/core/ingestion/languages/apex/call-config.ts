/**
 * Apex call-extraction config (SDD-002 §3, WI-2).
 *
 * Apex has no `::` method references, so no `extractLanguageCallSite` override is
 * needed — the generic `createCallExtractor` path reads call sites from the
 * `@reference.call.*` / `@reference.read.*` query captures (see `query.ts`).
 * `typeAsReceiverHeuristic` lets a type-qualified call (`System.debug()`,
 * `Account.sObjectType`) treat the leading identifier as a type when no local
 * binding shadows it — the JVM behaviour.
 */

import { SupportedLanguages } from 'gitnexus-shared';
import type { CallExtractionConfig } from '../../call-types.js';

export const apexCallConfig: CallExtractionConfig = {
  language: SupportedLanguages.Apex,
  typeAsReceiverHeuristic: true,
};
