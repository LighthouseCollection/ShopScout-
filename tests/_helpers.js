/* Test helpers — kept name-prefixed so they don't get picked up by the runner. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

/* Page + its scoped CSS + canonical theme — concatenated as one searchable blob.
   Pre-extraction, all CSS lived inline in the HTML; tests still want a single
   string to .includes() against. */
function pageAndStyles(htmlFile, cssFile) {
  return [read(htmlFile), read('theme.css'), read(cssFile)].join('\n');
}

module.exports = { read, pageAndStyles };
