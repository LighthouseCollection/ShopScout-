/* Discover and run every *.test.js file in tests/ and in the
   per-fork tests directories under grid-rebuild-claude/ and
   grid-rebuild-codex/ (when present). Each test file uses node's
   built-in assert and throws on failure. No framework. */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.dirname(__dirname);

/* Discoverable test directories.
   tests/                            — the project's main test suite
   grid-rebuild-claude/tests/        — Claude's Phase 2 fork
   grid-rebuild-codex/tests/         — Codex's Phase 2 fork (when added)
   Each test file's display label is relative-to-root so a failure
   tells you which fork produced it. */
const TEST_DIRS = [
  path.join(root, 'tests'),
  path.join(root, 'grid-rebuild-claude', 'tests'),
  path.join(root, 'grid-rebuild-codex', 'tests')
];

const tests = [];
for (const dir of TEST_DIRS) {
  if (!fs.existsSync(dir)) continue;
  const isTopLevel = dir === TEST_DIRS[0];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.test.js')) continue;
    /* Per-fork tests live in grid-rebuild-<fork>/tests/, not at the
       top level. Skip any cross-fork test that landed in tests/ by
       accident — each fork owns its own subdirectory and runs from
       there. */
    if (isTopLevel && /^grid-(claude|codex)-/.test(entry.name)) continue;
    tests.push({
      label: path.relative(root, path.join(dir, entry.name)).replace(/\\/g, '/'),
      file: path.join(dir, entry.name)
    });
  }
}
tests.sort((a, b) => a.label.localeCompare(b.label));

let failed = 0;
for (const t of tests) {
  process.stdout.write(`  ${t.label} ... `);
  const res = spawnSync(process.execPath, [t.file], { encoding: 'utf8' });
  if (res.status === 0) {
    console.log('ok');
  } else {
    failed++;
    console.log('FAIL');
    if (res.stdout) process.stdout.write(res.stdout);
    if (res.stderr) process.stderr.write(res.stderr);
  }
}

if (failed > 0) {
  console.error(`\n${failed} of ${tests.length} test files failed`);
  process.exit(1);
}
console.log(`\nall ${tests.length} test files passed`);
