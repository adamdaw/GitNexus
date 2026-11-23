#!/usr/bin/env node
/**
 * GitNexus Cursor postToolUse Hook
 *
 * Receives a JSON event on stdin describing a finished tool call, derives a
 * search pattern (Grep query, Read file basename, or rg/grep arg from a Shell
 * command), runs `gitnexus augment <pattern>`, and emits the enriched context
 * back as `{ additional_context: "..." }` so the agent sees it alongside the
 * tool result.
 *
 * Replaces the legacy beforeShellExecution / augment-shell.sh pipeline:
 *   - Cross-platform (no bash, no jq — runs on Windows out of the box)
 *   - Covers Read and Grep, not just Shell rg/grep
 *
 * Cursor 2.4+ generic hooks: https://cursor.com/docs/agent/hooks
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { acquireHookSlot } = require('./hook-lock.cjs');
const { resolveHookRepo } = require('./registry-query.cjs');

function readInput() {
  try {
    const data = fs.readFileSync(0, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

function tokenizeShellWords(command) {
  const tokens = [];
  let current = '';
  let quote = null;
  let escaped = false;
  let hasToken = false;

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (escaped) {
      current += char;
      escaped = false;
      hasToken = true;
      continue;
    }

    if (quote === "'") {
      if (char === "'") quote = null;
      else current += char;
      hasToken = true;
      continue;
    }

    if (quote === '"') {
      if (char === '"') {
        quote = null;
      } else if (char === '\\') {
        const next = command[index + 1];
        if (next === '$' || next === '`' || next === '"' || next === '\\') {
          escaped = true;
        } else {
          current += '\\';
        }
      } else {
        current += char;
      }
      hasToken = true;
      continue;
    }

    if (char === '\\') {
      const next = command[index + 1];
      if (next === undefined || /\s/.test(next) || next === "'" || next === '"' || next === '\\') {
        escaped = true;
      } else {
        current += '\\' + next;
        index += 1;
      }
      hasToken = true;
    } else if (char === "'" || char === '"') {
      quote = char;
      hasToken = true;
    } else if (char === '\n' && tokens.length === 0 && !hasToken) {
      // A blank line before the first command ends nothing.
    } else if (/\s/.test(char) && char !== '\n') {
      if (hasToken) tokens.push(current);
      current = '';
      hasToken = false;
    } else if (char === ';' || char === '\n' || char === '|' || char === '&') {
      if (hasToken) tokens.push(current);
      current = '';
      hasToken = false;
      const next = command[index + 1];
      if ((char === '|' || char === '&') && next === char) {
        tokens.push(char + char);
        index += 1;
      } else {
        // A newline ends a command like `;`.
        tokens.push(char === '\n' ? ';' : char);
      }
    } else {
      current += char;
      hasToken = true;
    }
  }

  if (escaped) current += '\\';
  if (hasToken) tokens.push(current);
  return tokens;
}

function parseRgGrepPattern(cmd) {
  // In a POSIX shell, assignments before the command (`NO_COLOR=1 rg x`) belong
  // to it. Read them on the raw line, where a quoted `'A=1'` (a command name)
  // keeps its quotes. A `$NAME` value is read past; a command substitution
  // (`$(...)`, a backtick) or an array value is left in place and ends the
  // read. On Windows the shell may be PowerShell, which runs `NAME=value`
  // as a command, so they are not read past there.
  // Blank lines may precede the assignments. The command must follow the last
  // assignment on the same line.
  const leadingAssignments =
    /^[ \t\n]*(?:[A-Za-z_]\w*=(?:[^\s"'\\;&|<>$`()]|\$(?=[A-Za-z_])|\\.|"(?:[^"\\$`]|\$(?=[A-Za-z_])|\\.)*"|'[^']*')*[ \t]+)+(?=\S)/;
  const line = typeof cmd === 'string' ? cmd : '';
  const tokens = tokenizeShellWords(
    process.platform === 'win32' ? line : line.replace(leadingAssignments, ''),
  );
  let foundCmd = false;
  let skipNext = false;
  let skipNextAsPattern = false;
  let endOfOptions = false;
  let explicitPatternSeen = false;
  let patternFileSeen = false;
  const flagsWithValues = new Set([
    '-e',
    '-f',
    '--file',
    '-m',
    '--max-count',
    '-A',
    '-B',
    '-C',
    '-g',
    '--glob',
    '--iglob',
    '-t',
    '--type',
    '--include',
    '--exclude',
    '--encoding',
    '--path',
  ]);
  const rgValueFlags = new Set(['-r', '--replace']);
  const patternFlags = new Set(['-e', '--regexp']);
  const connectors = new Set(['&&', '||', ';', '|', '&']);
  const wrappers = new Set([
    'npx',
    'bunx',
    'pnpm',
    'yarn',
    'npm',
    'sudo',
    'env',
    'command',
    'time',
    'nice',
    'xargs',
    'dlx',
    'exec',
    'run',
    'git',
  ]);
  const wrapperFlagsWithValues = new Set([
    '--package',
    '-p',
    '--call',
    '--prefix',
    '--shell',
    '--filter',
    '--workspace',
    '--dir',
    '--cwd',
  ]);
  const basename = (token) =>
    token
      .split(/[\\/]/)
      .pop()
      ?.replace(/\.(exe|cmd|bat)$/i, '');

  let seenWrapper = false;
  let searchCommand = null;
  for (const token of tokens) {
    // The search ends at the first operator. The tokenizer drops quotes, so a
    // quoted '|' stops here too: that loses a query, it never adds a wrong one.
    if (connectors.has(token)) break;
    if (skipNext) {
      skipNext = false;
      if (skipNextAsPattern) {
        skipNextAsPattern = false;
        if (token.length >= 3) return token;
      }
      continue;
    }
    if (!foundCmd) {
      // After a wrapper such as `env` or `sudo`, `NAME=value` is an assignment
      // that wrapper reads, quoted or not. It is an ordinary argument to the
      // shell, which splits a `$NAME` value on blanks and computes a
      // substitution, so a value with `$`, a backtick or parentheses leaves no
      // reliable query.
      if (seenWrapper && /^[A-Za-z_][A-Za-z0-9_]*=/.test(token)) {
        if (/[$`()]/.test(token)) return null;
        continue;
      }
      const commandName = basename(token);
      if (wrappers.has(commandName)) {
        seenWrapper = true;
        continue;
      }
      if (seenWrapper && token.startsWith('-')) {
        const flagName = token.split('=', 1)[0];
        if (!token.includes('=') && wrapperFlagsWithValues.has(flagName)) skipNext = true;
        continue;
      }
      // Only a search that starts the line is read. One after `&&`, `;` or `|`
      // may read a file the command names, the output of the command before
      // it, or another directory after `cd`, and the line alone does not say
      // which.
      if (commandName !== 'rg' && commandName !== 'grep') return null;
      foundCmd = true;
      searchCommand = commandName;
      continue;
    }
    if (endOfOptions) {
      if (explicitPatternSeen || patternFileSeen) continue;
      return token.length >= 3 ? token : null;
    }
    if (token === '--') {
      endOfOptions = true;
      continue;
    }
    if (token.startsWith('-')) {
      if (token === '-f' || token === '--file') {
        skipNext = true;
        patternFileSeen = true;
        continue;
      }
      if (token.startsWith('--file=')) {
        patternFileSeen = true;
        continue;
      }
      if (token.startsWith('--regexp=')) {
        explicitPatternSeen = true;
        const value = token.slice('--regexp='.length);
        if (value.length >= 3) return value;
        continue;
      }
      const attachedPattern = token.match(/^-e(.+)$/);
      if (attachedPattern) {
        explicitPatternSeen = true;
        if (attachedPattern[1].length >= 3) return attachedPattern[1];
        continue;
      }
      if (
        flagsWithValues.has(token) ||
        patternFlags.has(token) ||
        (searchCommand === 'rg' && rgValueFlags.has(token))
      ) {
        skipNext = true;
        skipNextAsPattern = patternFlags.has(token);
        if (skipNextAsPattern) explicitPatternSeen = true;
      }
      continue;
    }
    if (explicitPatternSeen || patternFileSeen) continue;
    return token.length >= 3 ? token : null;
  }
  return null;
}

/**
 * Extract a search pattern from the tool input. Cursor 2.4 docs at
 * https://cursor.com/docs/agent/hooks list the tool *matchers* but do not
 * formally specify the per-tool tool_input field names, so we probe a
 * generous set of MCP-style aliases. As a last-resort fallback for Grep
 * (the highest-frequency search path) we also accept the longest plausible
 * string value in tool_input. Set GITNEXUS_DEBUG=1 to log the raw payload
 * to stderr if Cursor changes the contract and aliases stop matching.
 */
function pickLongestStringValue(obj) {
  let best = null;
  if (!obj || typeof obj !== 'object') return null;
  for (const v of Object.values(obj)) {
    if (typeof v === 'string' && v.length >= 3 && (!best || v.length > best.length)) {
      best = v;
    }
  }
  return best;
}

function extractPattern(toolName, toolInput) {
  const t = (toolName || '').toLowerCase();

  if (t === 'grep') {
    const aliases = [
      toolInput.query,
      toolInput.pattern,
      toolInput.regex,
      toolInput.q,
      toolInput.search,
      toolInput.searchQuery,
    ];
    for (const a of aliases) {
      if (typeof a === 'string' && a.length >= 3) return a;
    }
    // Last resort: scan tool_input for any reasonable-looking string value.
    return pickLongestStringValue(toolInput);
  }

  if (t === 'read') {
    const filePath =
      toolInput.target_file ||
      toolInput.file_path ||
      toolInput.filePath ||
      toolInput.path ||
      toolInput.file ||
      '';
    if (!filePath) return null;
    const base = path.basename(String(filePath), path.extname(String(filePath)));
    const cleaned = base.replace(/[^a-zA-Z0-9_]/g, '');
    return cleaned.length >= 3 ? cleaned : null;
  }

  if (t === 'shell') {
    const cmd = toolInput.command || '';
    if (!/\brg\b|\bgrep\b/.test(cmd)) return null;
    return parseRgGrepPattern(cmd);
  }

  return null;
}

function resolveCliPath() {
  try {
    return require.resolve('gitnexus/dist/cli/index.js');
  } catch {
    return '';
  }
}

// This fork is not published to npm. Never fetch the upstream package when
// the CLI cannot be resolved; let spawnSync report a missing PATH binary.
function runGitNexusCli(cliPath, args, cwd, timeout) {
  return spawnSync(cliPath ? process.execPath : 'gitnexus', cliPath ? [cliPath, ...args] : args, {
    encoding: 'utf-8',
    timeout,
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
}

function main() {
  try {
    const input = readInput();
    if (process.env.GITNEXUS_DEBUG) {
      // Echo the payload so users can capture Cursor's actual contract when
      // diagnosing why augmentation isn't firing. Stderr only — stdout is
      // reserved for the JSON response Cursor consumes.
      try {
        process.stderr.write(
          `GitNexus Cursor hook stdin: ${JSON.stringify(input).slice(0, 500)}\n`,
        );
      } catch {
        /* never let debug logging break the hook */
      }
    }
    const cwd = input.cwd || process.cwd();
    if (!path.isAbsolute(cwd)) return;

    const toolName = input.tool_name || '';
    const toolInput = input.tool_input || {};
    const pattern = extractPattern(toolName, toolInput);
    if (!pattern || pattern.length < 3) return;

    // Registry row first (persisted external storagePath wins). Local owned
    // `.gitnexus` is only the fallback when no matching registry row exists.
    const repo = resolveHookRepo(cwd);
    if (!repo) return;
    const storagePath = repo.storagePath;

    const release = acquireHookSlot(storagePath);
    if (!release) {
      // Normal skip path: all per-repo hook slots are held by concurrent
      // sessions. Stays silent by default; surfaced only under the cursor
      // hook's own GITNEXUS_DEBUG (truthy) convention. NOTE: unlike the
      // claude/plugin/antigravity adapters this integration does not install
      // hook-db-lock-probe.cjs, so its augment child is not guard-wrapped
      // on the local-CLI path — tracked on the #2163 follow-up list
      // ("cursor probe").
      if (process.env.GITNEXUS_DEBUG) {
        process.stderr.write('[GitNexus] augment skipped: hook slots saturated\n');
      }
      return;
    }

    const cliPath = resolveCliPath();
    let result = '';
    try {
      const child = runGitNexusCli(cliPath, ['augment', '--', pattern], cwd, 7000);
      if (!child.error && child.status === 0) {
        result = child.stderr || '';
      }
    } catch {
      /* graceful failure */
    } finally {
      release();
    }

    if (result && result.trim()) {
      console.log(JSON.stringify({ additional_context: result.trim() }));
    }
  } catch (err) {
    if (process.env.GITNEXUS_DEBUG) {
      console.error('GitNexus Cursor hook error:', (err.message || '').slice(0, 200));
    }
  }
}

if (require.main === module) main();

module.exports = { parseRgGrepPattern, tokenizeShellWords };
