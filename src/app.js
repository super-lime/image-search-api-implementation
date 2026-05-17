const express = require('express');
const cacheService = require('./services/cacheService');
const restRoutes = require('./routes/rest');

const app = express();

// Optional: preload cache from disk at startup
cacheService.loadFromDisk().catch(err => console.error('Cache load error', err));

app.use('/', restRoutes);   // or app.use('/api', restRoutes)

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`REST API running on port ${PORT}`));