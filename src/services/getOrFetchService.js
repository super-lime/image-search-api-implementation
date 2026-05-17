const cacheService = require('./cacheService');
const { fetchAll } = require('./fetchService');

async function getOrFetch(query) {
  // 1. Return directly from cache if already cached.
  const cached = cacheService.get(query);
  if (cached) return cached;

  // 2. Wait if the the same query is currently pending.
  if (cacheService.isPending(query)) {
    const promise = cacheService.getPendingPromise(query);
    return await promise;
  }

  // 3. Fetch from APIs if it is not cached nor pending
  const fetchPromise = (async () => {
    try {
      const freshData = await fetchAll(query);
      await cacheService.setCached(query, freshData);
      return freshData;
    } catch (err) {
      cacheService.removePending(query);
      throw err;
    }
  })();

  cacheService.setPending(query, fetchPromise);
  return await fetchPromise;
}

module.exports = { getOrFetch };