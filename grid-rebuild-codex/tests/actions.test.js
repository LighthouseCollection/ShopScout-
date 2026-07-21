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

function createContext() {
  const elements = new Map([
    ['productGrid', makeElement('productGrid')],
    ['ssGridHost', makeElement('ssGridHost')],
    ['ssGridStatus', makeElement('ssGridStatus')],
    ['productSearchInput', makeElement('productSearchInput')],
    ['productSearchScope', Object.assign(makeElement('productSearchScope'), { value: 'current' })]
  ]);
  let capturedOptions = null;
  let deleteCalls = 0;
  let detailCalls = 0;
  const openedUrls = [];
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
    ShopScoutAgGridAdapter: {
      create(_host, projection, options) {
        capturedOptions = options;
        return {
          update() {},
          destroy() {},
          projection
        };
      }
    },
    ShopScoutUI: {},
    open(url, target, features) {
      'use strict';
      if (!this || this.__shopScoutOpenReceiver !== true) {
        throw new Error('root.open fallback was called without its global receiver');
      }
      openedUrls.push({ url, target, features });
      return { closed: false };
    },
    async openProductDetailById(item) {
      detailCalls += 1;
      ctx.lastOpenedDetailItem = item;
    },
    async deleteProductById(item) {
      deleteCalls += 1;
      ctx.lastDeletedItem = item;
    }
  };
  ctx.globalThis = ctx;
  ctx.__shopScoutOpenReceiver = true;
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
    getDetailCalls: () => detailCalls,
    getOpenedUrls: () => openedUrls.slice()
  };
}

async function renderAndDelete() {
  const harness = createContext();
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
  const opened = createContext();
  await opened.ctx.ShopScoutGrid.render();
  const openOptions = opened.getOptions();
  await openOptions.onAction('open', {
    id: 'p1',
    title: 'Pocket camera',
    url: 'https://example.test/p1',
    _shopScout: {
      productId: 'p1',
      url: 'https://example.test/p1'
    }
  });
  assert.equal(opened.getDetailCalls(), 0,
    'row open action should not open the internal product detail view');
  assert.deepEqual(opened.getOpenedUrls(), [{
    url: 'https://example.test/p1',
    target: '_blank',
    features: 'noopener'
  }], 'row open action opens the product URL in a new tab/window');

  const deleted = await renderAndDelete();
  assert.equal(deleted.getDeleteCalls(), 1,
    'row delete calls the app delete callback without confirmation');
  assert.deepEqual(deleted.ctx.lastDeletedItem, {
    id: 'p1',
    url: 'https://example.test/p1'
  });

  console.log('grid-codex-actions.test.js: all assertions passed');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
