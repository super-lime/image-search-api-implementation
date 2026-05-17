const path = require('path');
const crypto = require('crypto');

const batchInterval = parseInt(process.env.RATE_LIMIT_MS, 10) || 500;

// The last instant a batch (3 image libraries) API call is made.
let lastCallTime = 0;
let currentPromise = Promise.resolve();

// Function to rate limit the outgoing API calls
function rateLimit() {
  // We only run the next batch API call at least 500ms after the last one.
  const result = currentPromise.then(async () => {
    const now = Date.now();
    const wait = batchInterval - (now - lastCallTime);
    // We wait if the waiting time is > 0
    if (wait > 0) 
        await new Promise(r => setTimeout(r, wait));
    // We update lastCallTime
    lastCallTime = Date.now();
  });
  currentPromise = result;
  return result;
}

// Compute the needed HMAC for StoryBlocks
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
        tags: []
      };
    },
    // We need another API call to get the tags of the image.
    postProcess: async (searchResult) => {
      if (!searchResult.image_ID) return searchResult;
      const photoId = searchResult.image_ID;
      const url = `https://api.unsplash.com/photos/${photoId}`;
      const headers = { 'Authorization': `Client-ID ${process.env.UNSPLASH_KEY}` };
      try {
        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error(`Photo details error: ${response.status}`);
        const details = await response.json();
        searchResult.tags = details.tags?.map(tag => tag.title) || [];
      } catch (err) {
        console.error(`Unsplash details failed: ${err.message}`);
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
        tags: []
      };
    },
    // We need another API call to get the tags of the image.
    postProcess: async (searchResult) => {
      if (!searchResult.image_ID) return searchResult;
      const imageId = searchResult.image_ID;
      const publicKey = process.env.STORYBLOCKS_PUBLIC_KEY;
      const privateKey = process.env.STORYBLOCKS_PRIVATE_KEY;
      const expires = Math.floor(Date.now() / 1000) + (35 * 60 * 60);
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
        searchResult.tags = details.keywords || [];
      } catch (err) {
        console.error(`StoryBlocks details failed: ${err.message}`);
        searchResult.tags = [];
      }
      return searchResult;
    }
  }
];

async function fetchOneApi(config, query) {
  const url = config.url(query);
  const response = await fetch(url, { headers: config.headers });
  // Handle response error
  if (!response.ok) throw new Error(`${config.name} API error: ${response.status}`);
  const rawData = await response.json();
  return config.extract(rawData);
}

// ---------- fetchAll with rate limit queue ----------
async function fetchAll(query) {
  // Wait until the rate limit is over.
  await rateLimit();

  //Do the API calls
  const results = await Promise.all(
    apiConfigs.map(async (config) => {
      const searchResult = await fetchOneApi(config, query);
      if (config.postProcess) {
        return await config.postProcess(searchResult);
      }
      return searchResult;
    })
  );
  return results.length === 1 ? results[0] : results;
}

module.exports = { fetchAll };