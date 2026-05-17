const API_KEY = process.env.APPLICATION_API_KEY;

function validateApiKey(req, res, next) {
  const providedKey = req.headers['x-api-key'] || req.query.apiKey;
  if (!providedKey || providedKey !== API_KEY) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }
  next();
}

module.exports = validateApiKey;