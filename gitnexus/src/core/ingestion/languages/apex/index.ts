/**
 * Apex language provider (SDD-001, WI-1: parse & graph population).
 *
 * Salesforce Apex support. The grammar is a vendored ABI-14 regeneration of
 * aheber/tree-sitter-sfapex (Java-derived), so the extractor configs mirror the
 * JVM shapes. WI-1 covers recognition, node/containment emission, and member
 * metadata only — no reference resolution (WI-2…4), hence no call extractor or
 * Ring-3 binding hooks here.
 *
 * Constitution §2.1: every Apex-specific behaviour is consolidated under this
 * directory; no shared ingestion module is edited to name Apex.
 */

import { SupportedLanguages } from 'gitnexus-shared';
import { defineLanguage } from '../../language-provider.js';
import { createClassExtractor } from '../../class-extractors/generic.js';
import { createFieldExtractor } from '../../field-extractors/generic.js';
import { createMethodExtractor } from '../../method-extractors/generic.js';
import { createCallExtractor } from '../../call-extractors/generic.js';
import { createImportResolver } from '../../import-resolvers/resolver-factory.js';

import { APEX_QUERIES } from './queries.js';
import { apexClassConfig } from './class-config.js';
import { apexFieldConfig } from './field-config.js';
import { apexMethodConfig } from './method-config.js';
import { apexTypeConfig } from './type-config.js';
import { apexCallConfig } from './call-config.js';
import { apexExportChecker } from './export-checker.js';
import { apexImportConfig } from './import-resolver.js';
import { emitApexScopeCaptures } from './captures.js';
import {
  interpretApexTypeBinding,
  apexBindingScopeFor,
  apexMergeBindings,
  apexReceiverBinding,
  apexArityCompatibility,
} from './resolution.js';

export const apexProvider = defineLanguage({
  id: SupportedLanguages.Apex,
  extensions: ['.cls', '.trigger'],
  treeSitterQueries: APEX_QUERIES,
  typeConfig: apexTypeConfig,
  exportChecker: apexExportChecker,
  importResolver: createImportResolver(apexImportConfig),
  fieldExtractor: createFieldExtractor(apexFieldConfig),
  methodExtractor: createMethodExtractor(apexMethodConfig),
  classExtractor: createClassExtractor(apexClassConfig),
  callExtractor: createCallExtractor(apexCallConfig),
  // WI-2 §2.2 seam: Apex identifiers and type names are case-insensitive, so the
  // shared name-key boundaries fold member/binding names to lower case before
  // keying (symmetric on register + lookup). Identity for case-sensitive peers.
  normalizeIdentifier: (s: string): string => s.toLowerCase(),

  // ── RFC #909 Ring 3: scope-based resolution hooks (WI-2). Apex has no
  // imports, so interpretImport / importOwningScope / resolveImportTarget are
  // omitted on the provider (cross-file reach is WI-3). ──
  emitScopeCaptures: emitApexScopeCaptures,
  interpretTypeBinding: interpretApexTypeBinding,
  bindingScopeFor: apexBindingScopeFor,
  mergeBindings: apexMergeBindings,
  receiverBinding: apexReceiverBinding,
  arityCompatibility: apexArityCompatibility,
});
