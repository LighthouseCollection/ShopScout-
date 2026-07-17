const assert = require('assert');
const fs = require('fs');
const path = require('path');

/* Task 7.5: detail-page rendering moved into comparison/productDetailView.js.
   Read both so the legacy content assertions still find their targets
   regardless of which file currently owns the snippet. */
const source =
  fs.readFileSync(path.join(__dirname, '..', 'comparison.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, '..', 'comparison', 'productDetailView.js'), 'utf8');

const headerDeclaration = source.indexOf('const productHeaderHtml');
const tabsDeclaration = source.indexOf('const overviewHtml');
const contentAssignment = source.indexOf('setTrustedHtml(content, `${productHeaderHtml}');

assert.ok(headerDeclaration >= 0, 'product detail has a separate product header block');
assert.ok(tabsDeclaration > headerDeclaration, 'tab pane content is declared after the product header block');
assert.ok(contentAssignment > tabsDeclaration, 'content assignment happens after header and tab panes are prepared');

const assignmentSlice = source.slice(contentAssignment, contentAssignment + 300);
assert.ok(
  assignmentSlice.includes('productHeaderHtml') && assignmentSlice.indexOf('productHeaderHtml') < assignmentSlice.indexOf('buildDetailTabsHtml'),
  'product header renders before the product detail tab menu'
);
assert.ok(source.includes("label: 'General'"), 'product detail first tab label remains General');
assert.ok(
  source.includes('function productSpecEntries(product)'),
  'product detail owns a ProductSpec-aware spec entry helper'
);
assert.ok(
  source.includes('renderSpecTable(productSpecEntries(p))'),
  'edit modal renders specs through ProductSpec access instead of rawSpecs only'
);
assert.ok(
  source.includes('function applyEditedSpecsToProduct(product, specs)'),
  'saving detail specs updates ProductSpec and normalized sidecars through a dedicated helper'
);
assert.ok(
  source.includes('p = applyEditedSpecsToProduct(p, collectSpecsFromEditor())'),
  'saveEdit uses the ProductSpec-aware edit buffer helper'
);

const detailFunction = source.slice(
  source.indexOf('async function openProductDetail'),
  source.indexOf('function closeProductDetail')
);
assert.ok(
  !detailFunction.includes("document.querySelector('.ribbon-shell').style.display = 'none'"),
  'opening a product keeps the dashboard ribbon visible'
);
assert.ok(
  !detailFunction.includes("document.getElementById('content').style.display = 'none'"),
  'opening a product stays in the main content region instead of hiding it like a separate page'
);
assert.ok(
  detailFunction.includes("document.getElementById('content').style.display = ''"),
  'product detail explicitly keeps the main content region visible'
);

console.log('product detail layout tests passed');
