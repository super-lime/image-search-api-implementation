require('dotenv').config();   // load environment variables first

const express = require('express');
const cacheService = require('./services/cacheService');
const restRoutes = require('./routes/rest');
const graphqlHandler = require('./routes/graphql');

const app = express();

// Preload cache from disk into memory (optional but recommended)
cacheService.loadFromDisk().catch(err => console.error('Cache load error', err));

// REST endpoint
app.use('/rest', restRoutes);

// GraphQL endpoint
app.use('/graphql', graphqlHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`REST endpoint (local, replace localhost with domain if deployed on cloud):`);
  console.log(`   http://localhost:${PORT}/rest/search?q=cat&apiKey=<your_api_key>`);
  console.log(`GraphQL endpoint (local, replace localhost with domain if deployed on cloud):`);
  console.log(`   http://localhost:${PORT}/graphql`);
  console.log(`   Example query (POST /graphql with header X-API-Key):`);
  console.log(`   { "query": "{ search(q: \\"cat\\") { source image_ID title tags } }" }`);
  console.log(`   GraphiQL interface available in non‑production environments.\n`);
});