'use strict';

const { spawnSync } = require('node:child_process');

const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
if (nodeMajor < 22) {
  console.error('Node.js 22+ required. Current:', process.version);
  process.exit(1);
}

if (process.platform !== 'darwin') {
  process.exit(0);
}

const r = spawnSync('xcodebuild', ['-license', 'check'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

if (r.error && r.error.code === 'ENOENT') {
  process.exit(0);
}

const out = `${r.stderr || ''}${r.stdout || ''}`;
const licenseBlocked =
  r.status === 69 || /agree to the Xcode license/i.test(out);

if (licenseBlocked) {
  console.error(`
Native dependency "swisseph-v2" (via vedic-astrology) must compile with Apple developer tools.
The Xcode / SDK license is not accepted yet, so node-gyp cannot run.

Fix (one-time):
  sudo xcodebuild -license

Then retry:
  npm install
`);
  process.exit(1);
}

process.exit(0);
