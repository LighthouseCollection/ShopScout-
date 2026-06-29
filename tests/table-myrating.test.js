const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const files = [
  'table/tableUtils.js',
  'table/myRating.js'
];

const ctx = {
  globalThis: null,
  console
};
ctx.globalThis = ctx;
vm.createContext(ctx);

for (const file of files) {
  const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  vm.runInContext(src, ctx, { filename: file });
}

const myRating = ctx.ShopScoutTable && ctx.ShopScoutTable.myRating;
assert.ok(myRating, 'my-rating table module is exposed');

const markup = myRating.render(3, 'p"1', 'https://example.test/a?x=<bad>', { role: true });
assert.ok(markup.includes('role="radiogroup"'), 'role option adds accessibility role');
assert.ok(markup.includes('data-current="3"'), 'current rating is embedded');
assert.ok(markup.includes('data-product-id="p&quot;1"'), 'product id is escaped');
assert.ok(markup.includes('https://example.test/a?x=&lt;bad&gt;'), 'product url is escaped');
assert.strictEqual((markup.match(/data-myrating="/g) || []).length, 5, 'five star targets are rendered');

const stars = [5, 4, 3, 2, 1].map(value => ({
  dataset: { myrating: String(value) },
  toggles: {},
  classList: {
    toggle(name, enabled) { this.owner.toggles[name] = enabled; }
  }
}));
stars.forEach(star => { star.classList.owner = star; });
const widget = {
  dataset: {},
  querySelectorAll(selector) {
    assert.strictEqual(selector, '[data-myrating]');
    return stars;
  }
};
myRating.applyWidgetValue(widget, 2);
assert.strictEqual(widget.dataset.current, '2', 'widget current value is updated');
assert.strictEqual(stars.find(star => star.dataset.myrating === '2').toggles['db-myrating-on'], true);
assert.strictEqual(stars.find(star => star.dataset.myrating === '3').toggles['db-myrating-off'], true);

let updateArgs = null;
const repo = {
  async getProduct(id) {
    assert.strictEqual(id, 'p1');
    return { id: 'p1', listId: 'list-a', _revision: 7, userRating: 1 };
  },
  async updateProduct(...args) {
    updateArgs = args;
    return { ok: true, product: { id: 'p1', listId: 'list-a', _revision: 8, userRating: 4 } };
  }
};

(async () => {
  const result = await myRating.writeRating({ repo, productId: 'p1', value: 4 });
  assert.strictEqual(result.ok, true, 'rating write returns repo result');
  assert.strictEqual(updateArgs[0], 'p1', 'rating write targets the product');
  assert.strictEqual(updateArgs[1].userRating, 4, 'rating write sends the new rating');
  assert.strictEqual(updateArgs[2].listId, 'list-a', 'rating write passes listId');
  assert.strictEqual(updateArgs[2].baseRevision, 7, 'rating write passes baseRevision');
  assert.strictEqual(updateArgs[2].source, 'myrating-edit', 'rating write declares source');

  const missing = await myRating.writeRating({
    repo: {
      async getProduct() { return null; },
      async updateProduct() { throw new Error('should not update a missing product'); }
    },
    productId: 'missing',
    value: 2
  });
  assert.strictEqual(missing.ok, false, 'missing product fails cleanly');
  assert.strictEqual(missing.reason, 'missing-product');

  console.log('table-myrating.test.js: all assertions passed');
})().catch(err => { console.error(err); process.exit(1); });
