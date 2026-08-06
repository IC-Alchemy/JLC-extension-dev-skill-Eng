#!/usr/bin/env node
/**
 * Deprecated compatibility entry for the EasyEDA API linter.
 *
 * This forwards to scripts/eda-api.js lint so API validation is performed by
 * the TypeScript compiler against the target project's installed SDK types.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const cli = path.join(__dirname, 'eda-api.js');
const rawArgs = process.argv.slice(2);
const json = rawArgs.includes('--json');
const passthrough = rawArgs.filter(arg => arg !== '--json' && arg !== '--fix-hint');
if (passthrough.length === 0) {
  console.log('Usage: node scripts/lint-eda-api.js <file-or-dir> [...] [--json]');
  console.log('Forwarded usage: node scripts/eda-api.js lint --project <path> <src...>');
  process.exit(0);
}
const args = ['lint', '--project', process.cwd(), ...passthrough];
if (json) args.push('--format', 'json');

console.warn('[DEPRECATED] lint-eda-api.js now forwards to eda-api.js lint.');
console.warn('[DEPRECATED] Use: node scripts/eda-api.js lint --project <path> <src...>');

const result = spawnSync(process.execPath, [cli, ...args], { stdio: 'inherit' });
process.exit(result.status === null ? 4 : result.status);
