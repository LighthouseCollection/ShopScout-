(function initShopScoutEventBus(root) {
  const NS = (root.ShopScoutState = root.ShopScoutState || {});

  function createEventBus() {
    const listeners = new Set();

    function subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    }

    function publish(event) {
      for (const listener of [...listeners]) {
        try {
          listener(event);
        } catch (err) {
          console.warn('eventBus listener failed', err);
        }
      }
    }

    function clear() {
      listeners.clear();
    }

    return { subscribe, publish, clear };
  }

  NS.createEventBus = createEventBus;
})(globalThis);
