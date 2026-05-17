const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const CACHE_DIR = path.join(__dirname, '../../cache');
const memory = new Map(); // query -> { status, data, promise }

async function ensureDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (_) {}
}

function getFileName(query) {
  const hash = crypto.createHash('sha256').update(query).digest('hex');
  return path.join(CACHE_DIR, `${hash}.json`);
}

// Load all cached files into memory at startup (status = 'cached')
async function loadFromDisk() {
  await ensureDir();
  const files = await fs.readdir(CACHE_DIR).catch(() => []);
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const filePath = path.join(CACHE_DIR, file);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const { query, data } = JSON.parse(content);
      memory.set(query, { status: 'cached', data, promise: null });
    } catch (_) {}
  }
}

// Public API: get data if already cached, otherwise null
function get(query) {
  const entry = memory.get(query);
  return entry && entry.status === 'cached' ? entry.data : null;
}

// Check if a query is currently pending (being fetched)
function isPending(query) {
  const entry = memory.get(query);
  return entry && entry.status === 'pending';
}

// Return the pending promise for a query (if any)
function getPendingPromise(query) {
  const entry = memory.get(query);
  return entry && entry.status === 'pending' ? entry.promise : null;
}

// Mark a query as pending and store the promise
function setPending(query, promise) {
  memory.set(query, { status: 'pending', data: null, promise });
}

// Mark a query as cached with the fetched data (also writes to disk async)
async function setCached(query, data) {
  memory.set(query, { status: 'cached', data, promise: null });
  const filePath = getFileName(query);
  const toStore = { query, data };
  // Fire‑and‑forget write
  fs.writeFile(filePath, JSON.stringify(toStore)).catch(() => {});
}

// Remove a pending entry on failure (cleanup)
function removePending(query) {
  memory.delete(query);
}

module.exports = {
  loadFromDisk,
  get,
  isPending,
  getPendingPromise,
  setPending,
  setCached,
  removePending
};