#!/usr/bin/env node
/**
 * Fail-closed version sync for the plugin manifest surfaces (#2445).
 *
 * `publish.yml` bumps only `gitnexus/package.json` when it cuts an RC, so
 * every RC tag through v1.6.10-rc.28 shipped manifests frozen at the last
 * stable version and failed its own unit suite (the cli-commands version
 * contract). This script pins every version-bearing plugin surface to the
 * package version:
 *
 *   - gitnexus-claude-plugin/.claude-plugin/plugin.json   (top-level version)
 *   - .claude-plugin/marketplace.json                     (plugins[gitnexus])
 *   - gitnexus-claude-plugin/.codex-plugin/plugin.json    (top-level version)
 *   - .agents/plugins/marketplace.json                    (plugins[gitnexus])
 *
 * Modes:
 *   node scripts/sync-plugin-manifests.mjs           rewrite stale surfaces
 *   node scripts/sync-plugin-manifests.mjs --check   verify only, exit 1 on drift
 *
 * Fail-closed: a missing file, unparseable JSON, an absent version field, or
 * anything other than exactly one `gitnexus` marketplace entry aborts with a
 * non-zero exit rather than letting a release ship a partial sync.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The ten plugin skill mcp.json carry no version to stamp. They launch the
// PATH-resolved `gitnexus` binary, because this build is not published to npm:
// any `npx -y gitnexus@<version>` launch arg resolves to the published package,
// which has no Apex support and returns nothing rather than erroring. A
// PATH-resolved command is inherently in step with whatever is linked, so there
// is nothing here for a release to drift out of sync with.
const MANIFEST_SURFACES = [
  { file: 'gitnexus-claude-plugin/.claude-plugin/plugin.json', kind: 'plugin' },
  { file: '.claude-plugin/marketplace.json', kind: 'marketplace' },
  { file: 'gitnexus-claude-plugin/.codex-plugin/plugin.json', kind: 'plugin' },
  { file: '.agents/plugins/marketplace.json', kind: 'marketplace' },
];

const PLUGIN_NAME = 'gitnexus';

function readJson(filePath) {
  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new Error(`Cannot read manifest surface ${filePath}: ${err.message}`);
  }
  try {
    return { raw, parsed: JSON.parse(raw) };
  } catch (err) {
    throw new Error(`Manifest surface ${filePath} is not valid JSON: ${err.message}`);
  }
}

function versionTarget(manifest, kind, filePath) {
  if (kind === 'plugin') {
    if (typeof manifest.version !== 'string' || manifest.version.length === 0) {
      throw new Error(`Manifest surface ${filePath} has no version field to sync`);
    }
    return manifest;
  }
  const entries = (Array.isArray(manifest.plugins) ? manifest.plugins : []).filter(
    (plugin) => plugin?.name === PLUGIN_NAME,
  );
  if (entries.length !== 1) {
    throw new Error(
      `Manifest surface ${filePath} must contain exactly one "${PLUGIN_NAME}" plugin entry, found ${entries.length}`,
    );
  }
  if (typeof entries[0].version !== 'string' || entries[0].version.length === 0) {
    throw new Error(`Manifest surface ${filePath} has no version field to sync`);
  }
  return entries[0];
}

/**
 * Resolve the current pinned version and the textual needle for one surface.
 * `plugin`/`marketplace` pin a JSON `"version"` field. Returns `{ from, needle }`
 * where `needle(v)` renders the exact substring to match/replace for version `v`.
 * Fail-closed on a missing/ambiguous target.
 */
function versionInfo(manifest, kind, filePath) {
  const target = versionTarget(manifest, kind, filePath);
  return { from: target.version, needle: (value) => `"version": "${value}"` };
}

/**
 * Sync (or with `check: true`, only inspect) every manifest surface under
 * `rootDir`. Returns `{ version, synced, stale }` where `stale` lists the
 * surfaces that did not match the package version when the run started.
 */
export function syncPluginManifests(rootDir, { check = false } = {}) {
  const pkgPath = path.join(rootDir, 'gitnexus', 'package.json');
  const version = readJson(pkgPath).parsed.version;
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error(`No version found in ${pkgPath}`);
  }

  const synced = [];
  const stale = [];
  for (const { file, kind } of MANIFEST_SURFACES) {
    const manifestPath = path.join(rootDir, file);
    const { raw, parsed } = readJson(manifestPath);
    const { from, needle } = versionInfo(parsed, kind, manifestPath);
    if (from === version) continue;

    stale.push({ file, from });
    if (check) continue;

    // Textual surgery instead of re-serializing: JSON.stringify would refold
    // arrays and fight prettier, turning a one-line version bump into
    // formatting churn inside the release commit. The needle is built from
    // the current pinned value, and anything other than exactly one
    // occurrence aborts rather than guessing.
    const currentNeedle = needle(from);
    const occurrences = raw.split(currentNeedle).length - 1;
    if (occurrences !== 1) {
      throw new Error(
        `Manifest surface ${manifestPath} has ${occurrences} occurrences of ${currentNeedle}; ` +
          'expected exactly one, refusing to sync',
      );
    }
    writeFileSync(manifestPath, raw.replace(currentNeedle, needle(version)));
    synced.push(file);
  }

  return { version, synced, stale };
}

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const check = process.argv.includes('--check');
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const result = syncPluginManifests(rootDir, { check });

  if (check && result.stale.length > 0) {
    for (const { file, from } of result.stale) {
      console.error(
        `::error::${file} is at ${from} but gitnexus/package.json is at ${result.version}. ` +
          'Run `node gitnexus/scripts/sync-plugin-manifests.mjs` and commit the result.',
      );
    }
    process.exit(1);
  }

  for (const file of result.synced) {
    console.log(`synced ${file} -> ${result.version}`);
  }
  console.log(
    result.stale.length === 0 && result.synced.length === 0
      ? `all plugin manifests already at ${result.version}`
      : `plugin manifests now at ${result.version}`,
  );
}
