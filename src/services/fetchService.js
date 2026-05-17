const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// ---------- Helper for StoryBlocks HMAC ----------
function getStoryBlocksAuth(resource, expires) {
  const privateKey = process.env.STORYBLOCKS_PRIVATE_KEY;
  const hmacKey = privateKey + expires;
  const hmac = crypto.createHmac('sha256', hmacKey).update(resource).digest('hex');
  return { expires, hmac };
}

// ---------- API configurations ----------
const apiConfigs = [
  {
    name: "Unsplash",
    headers: { 'Authorization': `Client-ID ${process.env.UNSPLASH_KEY}` },
    url: (query) => `https://api.unsplash.com/search/photos?page=1&per_page=1&query=${query}`,
    extract: (apiResponse) => {
      const firstResult = apiResponse.results?.[0];
      return {
        image_ID: firstResult?.id || null,
        thumbnails: firstResult?.urls?.thumb || null,
        preview: firstResult?.urls?.regular || null,
        title: firstResult?.alt_description || null,
        source: "Unsplash",
        tags: firstResult?.tags || []
      };
    }
  },
  {
    name: "Pixabay",
    headers: {},
    url: (query) => `https://pixabay.com/api/?key=${process.env.PIXABAY_KEY}&page=1&per_page=3&q=${query}`,
    extract: (apiResponse) => {
      const firstResult = apiResponse.hits?.[0];
      const tagsString = firstResult?.tags || '';
      const tagsArray = tagsString ? tagsString.split(' ') : [];
      return {
        image_ID: firstResult?.id || null,
        thumbnails: firstResult?.previewURL || null,
        preview: firstResult?.webformatURL || null,
        title: firstResult?.user || null,
        source: "Pixabay",
        tags: tagsArray
      };
    }
  },
  {
    name: "StoryBlocks",
    headers: {},
    url: (query) => {
      const publicKey = process.env.STORYBLOCKS_PUBLIC_KEY;
      const expires = Math.floor(Date.now() / 1000) + (35 * 60 * 60);
      const resource = "/api/v2/images/search";
      const { hmac } = getStoryBlocksAuth(resource, expires);
      const userId = process.env.STORYBLOCKS_USER_ID || 'test_user';
      const projectId = process.env.STORYBLOCKS_PROJECT_ID || 'test_project';
      return `https://api.storyblocks.com/api/v2/images/search?APIKEY=${publicKey}&EXPIRES=${expires}&HMAC=${hmac}&keyword=${encodeURIComponent(query)}&user_id=${userId}&project_id=${projectId}`;
    },
    extract: (apiResponse) => {
      const firstResult = apiResponse.results?.[0];
      return {
        image_ID: firstResult?.id || null,
        thumbnails: firstResult?.thumbnail_url || null,
        preview: firstResult?.preview_url || null,
        title: firstResult?.title || null,
        source: "StoryBlocks",
        tags: []  // placeholder, will be filled by postProcess
      };
    },
    // Hardcoded details logic inside the config
    secondAPICall: async (searchResult) => {
      if (!searchResult.image_ID) return searchResult;  // nothing to fetch

      const imageId = searchResult.image_ID;
      const publicKey = process.env.STORYBLOCKS_PUBLIC_KEY;
      const expires = Math.floor(Date.now() / 1000) + (35 * 60 * 60);
      const resource = `/api/v2/images/details/${imageId}`; // ⚠️ replace with actual endpoint
      const { hmac } = getStoryBlocksAuth(resource, expires);
      const userId = process.env.STORYBLOCKS_USER_ID || 'test_user';
      const projectId = process.env.STORYBLOCKS_PROJECT_ID || 'test_project';
      const detailsUrl = `https://api.storyblocks.com/api/v2/images/details/${imageId}?APIKEY=${publicKey}&EXPIRES=${expires}&HMAC=${hmac}&user_id=${userId}&project_id=${projectId}`;

      try {
        const response = await fetch(detailsUrl);
        if (!response.ok) throw new Error(`Details API error: ${response.status}`);
        const details = await response.json();
        // Assuming the details JSON has a "categories" array
        searchResult.tags = details.categories || [];
      } catch (err) {
        console.error(`StoryBlocks details fetch failed for ID ${imageId}:`, err.message);
        searchResult.tags = [];
      }
      return searchResult;
    }
  }
];

// ---------- Generic fetch function ----------
async function fetchOneApi(config, query) {
  const url = config.url(query);
  const response = await fetch(url, { headers: config.headers });
  if (!response.ok) {
    throw new Error(`${config.name} API error: ${response.status}`);
  }
  const rawData = await response.json();
  return config.extract(rawData);
}

// ---------- Rate limiter ----------
let lastBatchInstant = 0;
const batchInterval = 500;

async function fetchAll(query) {
  const now = Date.now();
  const timeSinceLast = now - lastBatchInstant;
  if (timeSinceLast < batchInterval) {
    await new Promise(resolve => setTimeout(resolve, batchInterval - timeSinceLast));
  }
  lastBatchInstant = now;

  // Fetch all APIs concurrently (search only)
  const results = await Promise.all(
    apiConfigs.map(config => fetchOneApi(config, query))
  );

  // Apply postProcess to any config that has it (currently only StoryBlocks)
  const finalResults = await Promise.all(
    apiConfigs.map(async (config, idx) => {
      if (config.secondAPICall) {
        return await config.secondAPICall(results[idx]);
      }
      return results[idx];
    })
  );

  return finalResults.length === 1 ? finalResults[0] : finalResults;
}

module.exports = { fetchAll };