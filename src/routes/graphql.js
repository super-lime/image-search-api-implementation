const { createHandler } = require('graphql-http/lib/use/express');
const { buildSchema } = require('graphql');
const { getOrFetch } = require('../services/getOrFetchService');
const validateApiKey = require('../services/authService');

const schema = buildSchema(`
  type ImageResult {
    image_ID: String
    thumbnails: String
    preview: String
    title: String
    source: String
    tags: [String]
  }
  type Query {
    search(q: String!): [ImageResult]
  }
`);

const root = {
  search: async ({ q }) => {
    if (!q) throw new Error('Missing query parameter "q"');
    return await getOrFetch(q);
  }
};

// Middleware that checks API key then handles GraphQL
const graphqlWithAuth = (req, res, next) => {
  validateApiKey(req, res, (err) => {
    if (err) return;
    createHandler({
      schema,
      rootValue: root,
      graphiql: process.env.NODE_ENV !== 'production',
    })(req, res, next);
  });
};

module.exports = graphqlWithAuth;