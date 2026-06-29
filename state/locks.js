(function initShopScoutLocks(root) {
  const NS = (root.ShopScoutState = root.ShopScoutState || {});

  function createLockManager() {
    const tails = new Map();
    const depths = new Map();

    async function runWithLock(key, task) {
      const lockKey = String(key || 'global');
      const prior = tails.get(lockKey) || Promise.resolve();
      depths.set(lockKey, (depths.get(lockKey) || 0) + 1);

      let release;
      const current = new Promise(resolve => { release = resolve; });
      tails.set(lockKey, prior.then(() => current, () => current));

      await prior.catch(() => {});
      try {
        return await task();
      } finally {
        const nextDepth = (depths.get(lockKey) || 1) - 1;
        if (nextDepth > 0) depths.set(lockKey, nextDepth);
        else depths.delete(lockKey);
        release();
        if (tails.get(lockKey) === current) tails.delete(lockKey);
      }
    }

    function isLocked(key) {
      return (depths.get(String(key || 'global')) || 0) > 0;
    }

    function queueDepth(key) {
      return depths.get(String(key || 'global')) || 0;
    }

    return { runWithLock, isLocked, queueDepth };
  }

  NS.createLockManager = createLockManager;
})(globalThis);
