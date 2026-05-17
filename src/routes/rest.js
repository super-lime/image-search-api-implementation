const express = require('express');
const router = express.Router();
const { getOrFetch } = require('../services/dataService');
const validateApiKey = require('../middleware/auth');

router.get('/search', validateApiKey, async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter "q"' });
  }

  try {
    const data = await getOrFetch(query);
    res.json(data);
  } catch (err) {
    console.error(`Request failed for "${query}":`, err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;