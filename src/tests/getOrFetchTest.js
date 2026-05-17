require('dotenv').config();   // load .env from project root.

const { getOrFetch } = require('../services/getOrFetchService');

(async () => {
  const TERMS = ['cat', 'dog', 'bird', 'fish', 'tree', 'mouse', 'table', 'bear', 'flower', 'sun'];
  const REQUESTS_PER_TERM = 100;
  const TOTAL_REQUESTS = TERMS.length * REQUESTS_PER_TERM;

  // Build request list
  const requests = [];
  for (const term of TERMS) {
    for (let i = 0; i < REQUESTS_PER_TERM; i++) requests.push(term);
  }
  // Shuffle
  for (let i = requests.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [requests[i], requests[j]] = [requests[j], requests[i]];
  }

  console.log(`=== High‑Load Test (no cache preload) ===`);
  console.log(`${TOTAL_REQUESTS} requests, ${TERMS.length} unique terms.\n`);

  const startTime = Date.now();
  let completed = 0;

  const promises = requests.map(async (term, idx) => {
    const launchTime = Date.now();
    console.log(`[Launch] ${idx + 1} for "${term}" at +${launchTime - startTime}ms`);
    const result = await getOrFetch(term);
    const finishTime = Date.now();
    console.log(`[Done]   ${idx + 1} for "${term}" finished in ${finishTime - launchTime}ms (total +${finishTime - startTime}ms)`);
    completed++;
    if (completed === TOTAL_REQUESTS) console.log(`\n✅ All done.`);
    return result;
  });

  const results = await Promise.all(promises);
  const totalDuration = Date.now() - startTime;

  // Verify consistency
  const termData = new Map();
  for (let i = 0; i < requests.length; i++) {
    const term = requests[i];
    const data = results[i];
    if (!termData.has(term)) termData.set(term, data);
    else if (JSON.stringify(data) !== JSON.stringify(termData.get(term)))
      throw new Error(`Inconsistent data for "${term}"`);
  }

  console.log(`\n🎉 Test passed: ${TOTAL_REQUESTS} requests, ${TERMS.length} unique terms.`);
  console.log(`Total time: ${totalDuration}ms`);
  console.log(`Average per request: ${(totalDuration / TOTAL_REQUESTS).toFixed(2)}ms`);

  // Show sample returned data for the first term
  const sampleTerm = TERMS[0];
  const sampleData = termData.get(sampleTerm);
  console.log(`\n📦 Returned data for "${sampleTerm}":`);
  console.log(JSON.stringify(sampleData, null, 2).slice(0, 800) + (JSON.stringify(sampleData).length > 800 ? '...' : ''));
})().catch(err => { console.error('❌ Test failed:', err); process.exit(1); });