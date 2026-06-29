/**
 * Apex type-binding config (SDD-001 §1).
 *
 * WI-1 performs NO reference/type resolution (that is WI-2…4), so this is a
 * minimal viable config: it declares the local/field declaration node types but
 * supplies no-op binding extractors. WI-2 fleshes out type inference.
 */

import type { LanguageTypeConfig } from '../../type-extractors/types.js';

export const apexTypeConfig: LanguageTypeConfig = {
  declarationNodeTypes: new Set(['field_declaration', 'local_variable_declaration']),
  // ponytail: no-op until WI-2 builds Apex resolution — WI-1 emits nodes only.
  extractDeclaration: () => {},
  extractParameter: () => {},
};
