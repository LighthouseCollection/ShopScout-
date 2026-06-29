const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const files = [
  'state/eventBus.js',
  'state/locks.js',
  'state/actions.js',
  'state/selectors.js',
  'state/appStore.js'
];

const warnings = [];
const testConsole = Object.assign({}, console, {
  warn: (...args) => warnings.push(args)
});

const ctx = {
  globalThis: null,
  console: testConsole,
  setTimeout,
  clearTimeout,
  Promise
};
ctx.globalThis = ctx;
vm.createContext(ctx);

for (const file of files) {
  const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  vm.runInContext(src, ctx, { filename: file });
}

assert.ok(ctx.ShopScoutState, 'ShopScoutState namespace is exposed');
assert.ok(ctx.ShopScoutState.Actions, 'state actions are exposed');
assert.ok(ctx.ShopScoutState.Selectors, 'state selectors are exposed');

const { Actions, Selectors, createStore, createLockManager, createEventBus } = ctx.ShopScoutState;

(async () => {
  const eventBus = createEventBus();
  let reachedHealthyListener = false;
  eventBus.subscribe(() => { throw new Error('broken listener'); });
  eventBus.subscribe(event => { reachedHealthyListener = event.type === 'event-bus-test'; });
  eventBus.publish({ type: 'event-bus-test' });
  assert.strictEqual(reachedHealthyListener, true, 'event bus isolates listener failures');
  assert.strictEqual(warnings.length, 1, 'event bus logs listener failures');

  const store = createStore({
    initialState: {
      activeListId: 'list-a',
      lists: {
        'list-a': { id: 'list-a', name: 'Cameras', productIds: ['p1'] },
        'list-b': { id: 'list-b', name: 'Lights', productIds: ['p2'] }
      },
      products: {
        p1: { id: 'p1', listId: 'list-a', title: 'Camera', newPrice: '10', _revision: 1 },
        p2: { id: 'p2', listId: 'list-b', title: 'Light', newPrice: '20', _revision: 1 }
      }
    }
  });

  let notified = 0;
  let lastEventType = '';
  const unsubscribe = store.subscribe(event => {
    notified++;
    lastEventType = event.type;
  });

  let result = await store.dispatch(Actions.productEdited({
    listId: 'list-a',
    productId: 'p1',
    changes: { newPrice: '11' },
    baseRevision: 1
  }));
  assert.strictEqual(result.ok, true, 'manual edit succeeds with current base revision');
  assert.strictEqual(Selectors.productById(store.getState(), 'p1').newPrice, '11');
  assert.strictEqual(Selectors.productById(store.getState(), 'p1')._revision, 2);

  result = await store.dispatch(Actions.productRescanned({
    listId: 'list-a',
    productId: 'p1',
    product: { title: 'Stale camera', newPrice: '9' },
    baseRevision: 1
  }));
  assert.strictEqual(result.ok, false, 'stale rescan is rejected');
  assert.strictEqual(result.reason, 'revision-conflict');
  assert.strictEqual(Selectors.productById(store.getState(), 'p1').title, 'Camera');
  assert.strictEqual(Selectors.productById(store.getState(), 'p1')._revision, 2);

  result = await store.dispatch(Actions.productRescanned({
    listId: 'list-a',
    productId: 'p1',
    product: { rating: '4.8' },
    baseRevision: 2
  }));
  assert.strictEqual(result.ok, true, 'rescan succeeds against current base revision');
  assert.strictEqual(Selectors.productById(store.getState(), 'p1').rating, '4.8');
  assert.strictEqual(Selectors.productById(store.getState(), 'p1')._revision, 3);

  await store.dispatch(Actions.productsImported({
    listId: 'list-c',
    listName: 'Imported',
    products: [{ id: 'p3', title: 'Tripod' }]
  }));
  assert.deepStrictEqual(
    Array.from(Selectors.productsForList(store.getState(), 'list-c'), product => product.title),
    ['Tripod'],
    'import creates list and normalized product'
  );

  await store.dispatch(Actions.aiRunStarted({ runId: 'run-1', listId: 'list-a' }));
  await store.dispatch(Actions.aiRunPartialResultSaved({
    runId: 'run-1',
    stage: { id: 'verification', status: 'completed', responseText: 'ok' }
  }));
  await store.dispatch(Actions.aiRunFailed({ runId: 'run-1', error: 'quota exceeded' }));
  const run = Selectors.aiRunById(store.getState(), 'run-1');
  assert.strictEqual(run.status, 'partial', 'failed AI run with saved stage is partial');
  assert.strictEqual(run.stages.length, 1, 'partial AI stage is preserved');

  const previousRevision = store.getState().revision;
  store.replaceState({
    activeListId: 'list-z',
    lists: { 'list-z': { id: 'list-z', name: 'Replacement', productIds: [] } },
    products: {}
  });
  assert.strictEqual(Selectors.activeList(store.getState()).name, 'Replacement', 'replaceState swaps state');
  assert.strictEqual(lastEventType, 'replace', 'replaceState notifies subscribers with replace event');
  assert.strictEqual(store.getState().revision, 0, 'replaceState normalizes the incoming snapshot');
  assert.notStrictEqual(store.getState().revision, previousRevision, 'replaceState does not preserve old revision');

  unsubscribe();
  assert.ok(notified >= 6, 'store subscribers are notified after state changes');

  const locks = createLockManager();
  let releaseA;
  const order = [];
  const a1 = locks.runWithLock('list-a', async () => {
    order.push('a1-start');
    await new Promise(resolve => { releaseA = resolve; });
    order.push('a1-end');
  });
  const a2 = locks.runWithLock('list-a', async () => { order.push('a2'); });
  const b1 = locks.runWithLock('list-b', async () => { order.push('b1'); });

  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepStrictEqual(order, ['a1-start', 'b1'], 'different list locks can run independently');
  releaseA();
  await Promise.all([a1, a2, b1]);
  assert.deepStrictEqual(order, ['a1-start', 'b1', 'a1-end', 'a2'], 'same list lock serializes operations');

  console.log('state-contract.test.js: all assertions passed');
})().catch(err => { console.error(err); process.exit(1); });
