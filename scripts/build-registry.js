#!/usr/bin/env node
/**
 * Deprecated compatibility entry.
 *
 * API registry generation is now backed by the target project's installed
 * @jlceda/pro-api-types declaration file and cached under node_modules/.cache.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const cli = path.join(__dirname, 'eda-api.js');
const args = ['doctor', '--project', process.cwd(), ...process.argv.slice(2)];

console.warn('[DEPRECATED] build-registry.js no longer writes scripts/api-registry.json.');
console.warn('[DEPRECATED] Use: node scripts/eda-api.js doctor|search|inspect --project <path>');

const result = spawnSync(process.execPath, [cli, ...args], { stdio: 'inherit' });
process.exit(result.status === null ? 4 : result.status);
