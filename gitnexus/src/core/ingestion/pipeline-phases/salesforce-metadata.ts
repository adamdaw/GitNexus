/**
 * Phase: salesforceMetadata
 *
 * Extracts Salesforce declarative metadata (objects, fields, validation rules)
 * from `-meta.xml` files.
 *
 * @deps    structure
 * @reads   scannedFiles (from structure phase)
 * @writes  graph (Record nodes + CONTAINS/USES edges)
 */

import type { PipelinePhase, PipelineContext, PhaseResult } from './types.js';
import { getPhaseOutput } from './types.js';
import {
  isSalesforceEntityPath,
  processSalesforceMetadata,
  type SalesforceMetadataResult,
} from '../salesforce-metadata-processor.js';
import { readFileContents } from '../filesystem-walker.js';
import type { StructureOutput } from './structure.js';
import { isDev } from '../utils/env.js';

import { logger } from '../../logger.js';

export type SalesforceMetadataOutput = SalesforceMetadataResult;

/**
 * A fresh object per call, matching `markdown.ts`. A shared module-level
 * constant handed out by reference lets one caller's mutation corrupt every
 * later run of the phase.
 */
const empty = (): SalesforceMetadataOutput => ({
  objects: 0,
  fields: 0,
  validationRules: 0,
  edges: 0,
});

/**
 * Narrowing to the entity paths before reading keeps a repo from paying to read
 * anything the processor would discard: an unrelated `.xml` corpus (Maven,
 * Android, MSBuild), and the Salesforce metadata this phase does not model
 * (profiles, permission sets, layouts).
 */
export const salesforceMetadataPhase: PipelinePhase<SalesforceMetadataOutput> = {
  name: 'salesforceMetadata',
  deps: ['structure'],

  async execute(
    ctx: PipelineContext,
    deps: ReadonlyMap<string, PhaseResult<unknown>>,
  ): Promise<SalesforceMetadataOutput> {
    const { scannedFiles } = getPhaseOutput<StructureOutput>(deps, 'structure');

    const metaScanned = scannedFiles.filter((f) => isSalesforceEntityPath(f.path));
    if (metaScanned.length === 0) return empty();

    const contents = await readFileContents(
      ctx.repoPath,
      metaScanned.map((f) => f.path),
    );
    const files = metaScanned
      .filter((f) => contents.has(f.path))
      .map((f) => ({ path: f.path, content: contents.get(f.path)! }));

    const result = processSalesforceMetadata(ctx.graph, files);

    if (isDev) {
      logger.info(
        `  Salesforce: ${result.objects} objects, ${result.fields} fields, ` +
          `${result.validationRules} validation rules, ` +
          `${result.edges} edges from ${files.length} files`,
      );
    }

    return result;
  },
};
