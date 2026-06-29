/**
 * Apex import resolver config (SDD-001 §3).
 *
 * Apex has no import statements — symbols are referenced by (case-insensitive)
 * name within the org namespace. So the resolver carries no strategies (an
 * identity/no-op resolver); cross-file binding is WI-3's REQ-010 concern.
 */

import { SupportedLanguages } from 'gitnexus-shared';
import type { ImportResolutionConfig } from '../../import-resolvers/types.js';

export const apexImportConfig: ImportResolutionConfig = {
  language: SupportedLanguages.Apex,
  strategies: [],
};
