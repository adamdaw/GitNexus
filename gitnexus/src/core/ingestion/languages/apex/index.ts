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
import { createImportResolver } from '../../import-resolvers/resolver-factory.js';

import { APEX_QUERIES } from './queries.js';
import { apexClassConfig } from './class-config.js';
import { apexFieldConfig } from './field-config.js';
import { apexMethodConfig } from './method-config.js';
import { apexTypeConfig } from './type-config.js';
import { apexExportChecker } from './export-checker.js';
import { apexImportConfig } from './import-resolver.js';

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
});
