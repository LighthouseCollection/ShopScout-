/* Discover and run every *.test.js file in tests/.
   Each test file uses node's built-in `assert` and throws on failure.
   No framework. */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const dir = __dirname;
const files = fs.readdirSync(dir)
  .filter(f => f.endsWith('.test.js'))
  .sort();

let failed = 0;
for (const f of files) {
  process.stdout.write(`  ${f} ... `);
  const res = spawnSync(process.execPath, [path.join(dir, f)], { encoding: 'utf8' });
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
  console.error(`\n${failed} of ${files.length} test files failed`);
  process.exit(1);
}
console.log(`\nall ${files.length} test files passed`);
