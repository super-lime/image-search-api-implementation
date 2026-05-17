// src/tests/restSpamTest.js
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config(".env"); // load .env from project root

// ------------------- Parse command line arguments -------------------
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node src/tests/restSpamTest.js <base_url> [api_key]');
  console.error('Example: node src/tests/restSpamTest.js http://localhost:3000');
  process.exit(1);
}

const BASE_URL = args[0].replace(/\/$/, ''); // remove trailing slash if any
const API_KEY = args[1] || process.env.APPLICATION_API_KEY;
if (!API_KEY) {
  console.error('Error: No API key provided. Set API_KEY in .env or pass as second argument.');
  process.exit(1);
}

// ------------------- Configuration -------------------
const TERMS = ['cat', 'dog', 'bird', 'fish', 'tree', 'mouse', 'table', 'bear', 'flower', 'sun'];
const REQUESTS_PER_TERM = 100;         // 10 terms * 100 = 1000 total
const OUTPUT_DIR = path.join(__dirname, '../../restresponses');

// ------------------- Helper: ensure output directory -------------------
async function ensureDir() {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

// ------------------- Send a single request and save response -------------------
async function sendRequest(term, index) {
  const url = `${BASE_URL}/rest/search?q=${encodeURIComponent(term)}&apiKey=${API_KEY}`;
  const start = Date.now();
  const response = await fetch(url);
  const elapsed = Date.now() - start;
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for term "${term}" – ${await response.text()}`);
  }
  const data = await response.json();
  const timestamp = Date.now();
  const fileName = `${term}_${index}_${timestamp}.json`;
  const filePath = path.join(OUTPUT_DIR, fileName);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  return { term, index, elapsed, fileName };
}

// ------------------- Main test -------------------
async function runSpamTest() {
  await ensureDir();
  console.log(`=== Spamming ${REQUESTS_PER_TERM * TERMS.length} requests to ${BASE_URL} ===`);
  console.log(`Terms: ${TERMS.join(', ')} (${REQUESTS_PER_TERM} each)\n`);

  // Build array of 1000 request promises (all launched concurrently)
  const promises = [];
  for (const term of TERMS) {
    for (let i = 1; i <= REQUESTS_PER_TERM; i++) {
      promises.push(sendRequest(term, i));
    }
  }
  // Shuffle to mix order (optional)
  for (let i = promises.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [promises[i], promises[j]] = [promises[j], promises[i]];
  }

  const startTime = Date.now();
  const results = await Promise.all(promises);
  const totalTime = Date.now() - startTime;

  console.log(`\n✅ All ${results.length} requests completed in ${totalTime}ms`);
  console.log(`Responses saved to: ${OUTPUT_DIR}`);
  console.log(`Average response time: ${(totalTime / results.length).toFixed(2)}ms`);
}

runSpamTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});