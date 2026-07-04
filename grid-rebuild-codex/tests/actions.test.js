const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.join(__dirname, '..', '..');

function makeElement(id) {
  return {
    id,
    hidden: false,
    textContent: '',
    value: '',
    dataset: {},
    classList: { toggle() {} },
    setAttribute() {},
    addEventListener() {},
    replaceChildren() {}
  };
}

function createContext(confirmResult) {
  const elements = new Map([
    ['productGrid', makeElement('productGrid')],
    ['ssGridHost', makeElement('ssGridHost')],
    ['ssGridStatus', makeElement('ssGridStatus')],
    ['productSearchInput', makeElement('productSearchInput')],
    ['productSearchScope', Object.assign(makeElement('productSearchScope'), { value: 'current' })]
  ]);
  let capturedOptions = null;
  let deleteCalls = 0;
  const confirmCalls = [];
  const ctx = {
    console,
    globalThis: null,
    document: {
      getElementById(id) { return elements.get(id) || null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      addEventListener() {},
      createElement(tag) {
        return Object.assign(makeElement(tag), {
          tagName: String(tag).toUpperCase(),
          ownerDocument: this
        });
      }
    },
    SSProductRepo: {
      async listLists() { return [{ id: 'list-1', name: 'Cameras' }]; },
      async getActiveListId() { return 'list-1'; },
      async listProducts() {
        return [{
          id: 'p1',
          title: 'Pocket camera',
          url: 'https://example.test/p1',
          _revision: 1
        }];
      }
    },
    ShopScoutGridCodexProjections: {
      buildProductsRowsProjection(products) {
        return {
          columns: [
            { id: 'title', field: 'title', name: 'Name', type: 'text' },
            { id: 'actions', field: '_actions', name: '', type: 'actions' }
          ],
          rows: products.map(product => ({
            id: product.id,
            title: product.title,
            url: product.url,
            _shopScout: {
              productId: product.id,
              url: product.url,
              revision: product._revision
            }
          }))
        };
      }
    },
    ShopScoutSlickGridAdapter: {
      create(_host, projection, options) {
        capturedOptions = options;
        return {
          update() {},
          destroy() {},
          projection
        };
      }
    },
    ShopScoutUI: {
      async confirm(message, options) {
        confirmCalls.push({ message, options });
        return confirmResult;
      }
    },
    async deleteProductById(item) {
      deleteCalls += 1;
      ctx.lastDeletedItem = item;
    }
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(
    fs.readFileSync(path.join(rootDir, 'grid-rebuild-codex', 'shopscoutGrid.js'), 'utf8'),
    ctx,
    { filename: 'grid-rebuild-codex/shopscoutGrid.js' }
  );
  return {
    ctx,
    getOptions: () => capturedOptions,
    getDeleteCalls: () => deleteCalls,
    getConfirmCalls: () => confirmCalls
  };
}

async function renderAndDelete(confirmResult) {
  const harness = createContext(confirmResult);
  await harness.ctx.ShopScoutGrid.render();
  const actionOptions = harness.getOptions();
  assert.equal(typeof actionOptions.onAction, 'function', 'grid exposes row action callback');
  await actionOptions.onAction('delete', {
    id: 'p1',
    title: 'Pocket camera',
    url: 'https://example.test/p1',
    _shopScout: {
      productId: 'p1',
      url: 'https://example.test/p1'
    }
  });
  return harness;
}

(async () => {
  const canceled = await renderAndDelete(false);
  assert.equal(canceled.getDeleteCalls(), 0,
    'canceling the row delete confirmation prevents product deletion');
  assert.equal(canceled.getConfirmCalls().length, 1,
    'row delete asks for confirmation before deleting');
  assert.match(canceled.getConfirmCalls()[0].message, /Delete product/i);

  const confirmed = await renderAndDelete(true);
  assert.equal(confirmed.getConfirmCalls().length, 1,
    'confirmed row delete asks exactly once');
  assert.equal(confirmed.getDeleteCalls(), 1,
    'confirmed row delete calls the app delete callback');
  assert.deepEqual(confirmed.ctx.lastDeletedItem, {
    id: 'p1',
    url: 'https://example.test/p1'
  });

  console.log('grid-codex-actions.test.js: all assertions passed');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
