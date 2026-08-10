/**
 * Phase: salesforceMetadata
 *
 * Extracts Salesforce declarative metadata (objects, fields, validation rules,
 * flows) from `-meta.xml` files and links flows to the Apex they invoke.
 *
 * @deps    structure, parse
 * @reads   scannedFiles (from structure phase)
 * @writes  graph (Record nodes + CONTAINS/USES/CALLS edges)
 *
 * Depends on `parse` — not just `structure` — because the flow→Apex edge
 * resolves against `Class` nodes, which only exist once the Apex files have
 * been parsed. Ordered after `parse` in `buildPhaseList` for the same reason.
 */

import type { PipelinePhase, PipelineContext, PhaseResult } from './types.js';
import { getPhaseOutput } from './types.js';
import {
  processSalesforceMetadata,
  type SalesforceMetadataResult,
} from '../salesforce-metadata-processor.js';
import { readFileContents } from '../filesystem-walker.js';
import type { StructureOutput } from './structure.js';
import { isDev } from '../utils/env.js';

import { logger } from '../../logger.js';

export type SalesforceMetadataOutput = SalesforceMetadataResult;

const EMPTY: SalesforceMetadataOutput = {
  objects: 0,
  fields: 0,
  validationRules: 0,
  flows: 0,
  edges: 0,
};

/**
 * `-meta.xml` is the suffix every Salesforce source-format metadata file
 * carries. Narrowing here rather than in the processor keeps a repo with a
 * large unrelated `.xml` corpus (Maven, Android, MSBuild) from paying to read
 * any of it.
 */
const isSalesforceMetadata = (p: string): boolean => p.endsWith('-meta.xml');

export const salesforceMetadataPhase: PipelinePhase<SalesforceMetadataOutput> = {
  name: 'salesforceMetadata',
  deps: ['structure', 'parse'],

  async execute(
    ctx: PipelineContext,
    deps: ReadonlyMap<string, PhaseResult<unknown>>,
  ): Promise<SalesforceMetadataOutput> {
    const { scannedFiles } = getPhaseOutput<StructureOutput>(deps, 'structure');

    const metaScanned = scannedFiles.filter((f) => isSalesforceMetadata(f.path));
    if (metaScanned.length === 0) return EMPTY;

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
          `${result.validationRules} validation rules, ${result.flows} flows, ` +
          `${result.edges} edges from ${files.length} files`,
      );
    }

    return result;
  },
};
