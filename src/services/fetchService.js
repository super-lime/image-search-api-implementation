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
            tags: []  // placeholder, will be filled by postProcess
        };
        },
        // Second call to get photo details (includes tags)
        postProcess: async (searchResult) => {
        if (!searchResult.image_ID) return searchResult;
        const photoId = searchResult.image_ID;
        const url = `https://api.unsplash.com/photos/${photoId}`;
        const headers = { 'Authorization': `Client-ID ${process.env.UNSPLASH_KEY}` };
        try {
            const response = await fetch(url, { headers });
            if (!response.ok) throw new Error(`Photo details error: ${response.status}`);
            const details = await response.json();
            // Extract tag titles from the 'tags' array (each tag has a 'title' field)
            const tagsArray = details.tags?.map(tag => tag.title) || [];
            searchResult.tags = tagsArray;
        } catch (err) {
            console.error(`Unsplash details fetch failed for ID ${photoId}:`, err.message);
            searchResult.tags = [];
        }
        return searchResult;
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
        return `https://api.storyblocks.com/api/v2/images/search?APIKEY=${publicKey}&EXPIRES=${expires}&HMAC=${hmac}&keywords=${encodeURIComponent(query)}&user_id=${userId}&project_id=${projectId}`;
    },
    extract: (apiResponse) => {
        const firstResult = apiResponse.results?.[0];
        return {
        image_ID: firstResult?.id || null,
        thumbnails: firstResult?.thumbnail_url || null,
        preview: firstResult?.preview_url || null,
        title: firstResult?.title || null,
        source: "StoryBlocks",
        tags: []  // will be filled by postProcess
        };
    },
    postProcess: async (searchResult) => {
        if (!searchResult.image_ID) return searchResult;
        const imageId = searchResult.image_ID;
        const publicKey = process.env.STORYBLOCKS_PUBLIC_KEY;
        const privateKey = process.env.STORYBLOCKS_PRIVATE_KEY;
        const expires = Math.floor(Date.now() / 1000) + (35 * 60 * 60);
        // Important: resource must exactly match the path in the details URL
        const resource = `/api/v2/images/stock-item/details/${imageId}`;
        const hmacKey = privateKey + expires;
        const hmac = crypto.createHmac('sha256', hmacKey).update(resource).digest('hex');
        const userId = process.env.STORYBLOCKS_USER_ID || 'test_user';
        const projectId = process.env.STORYBLOCKS_PROJECT_ID || 'test_project';
        const detailsUrl = `https://api.storyblocks.com/api/v2/images/stock-item/details/${imageId}?APIKEY=${publicKey}&EXPIRES=${expires}&HMAC=${hmac}&user_id=${userId}&project_id=${projectId}`;
        try {
        const response = await fetch(detailsUrl);
        if (!response.ok) throw new Error(`Details API error: ${response.status}`);
        const details = await response.json();
        // Use "keywords" field as tags (assuming it's an array of strings)
        searchResult.tags = details.keywords || [];
        } catch (err) {
        console.error(`StoryBlocks details fetch failed for ID ${imageId}:`, err.message);
        searchResult.tags = [];
        }
        return searchResult;
    }
    }
];

// ---------- Generic fetch ----------
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

  // Step 1: fetch all search results
  const results = await Promise.all(
    apiConfigs.map(config => fetchOneApi(config, query))
  );

  // Step 2: run postProcess for any config that has it (Unsplash, maybe future ones)
  const finalResults = await Promise.all(
    apiConfigs.map(async (config, idx) => {
      if (config.postProcess) {
        return await config.postProcess(results[idx]);
      }
      return results[idx];
    })
  );

  return finalResults.length === 1 ? finalResults[0] : finalResults;
}

module.exports = { fetchAll };