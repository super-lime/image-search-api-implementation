# Image Search API Aggregator

Aggregates image results from Unsplash, Pixabay, and Storyblocks via REST and GraphQL.  
Features:
- Image APIs triggered simultaneously per query
- Handling response error or null results from image libraries.
- Built on Node.JS.
- Basic API key authentication only.
- Both REST and GraphQL endpoints are supported.
- GitHub Actions can build the Docker Image of this application automatically.
- Deployed on AWS (IPv4: 13.213.62.207:3000).
- Can handle large amounts of requests together by using caching (otherwise the free image APIs will be rate-limited/ banned).

---

## 0. Try it live (no installation)

A working instance is deployed at `13.213.62.207:3000`.  
Use the API key `secret_api_key_123`.

### REST

```bash
curl -H "X-API-Key: secret_api_key_123" "http://13.213.62.207:3000/rest/search?q=cat"
```

Replace `cat` with any search term.

### GraphQL

```bash
curl -X POST -H "Content-Type: application/json" -H "X-API-Key: secret_api_key_123" \
  -d '{"query":"{ search(q: \"cat\") { source image_ID title tags } }"}' \
  http://13.213.62.207:3000/graphql
```

You can also open `http://13.213.62.207:3000/graphql` in a browser for the GraphiQL interface (use the same API key in the `X-API-Key` header).

---

## 1. Clone & Install

```bash
git clone <your-repo-url>
cd image-search-api-implementation
npm install
```

The repo includes a `.env` file. Replace placeholder API keys with real ones.  
The default API key for your own endpoints is: **`secret_api_key_123`**

---

## 2. Run Locally

```bash
node src/app.js
```

Server starts at `http://localhost:3000`

---

## 3. Test with `curl`

### REST
```bash
curl -H "X-API-Key: secret_api_key_123" "http://localhost:3000/rest/search?q=cat"
```

### GraphQL
```bash
curl -X POST -H "Content-Type: application/json" -H "X-API-Key: secret_api_key_123" \
  -d '{"query":"{ search(q: \"cat\") { source image_ID title tags } }"}' \
  http://localhost:3000/graphql
```

---

## 4. High‑Load Spam Tests

Run **after** server is started. The spam scripts accept a base URL as the first argument.

### Local server

```bash
# REST spam (1000 requests)
node src/tests/restSpamTest.js http://localhost:3000

# GraphQL spam (1000 requests)
node src/tests/graphqlSpamTest.js http://localhost:3000
```

### Live AWS server

```bash
# REST spam against the deployed instance
node src/tests/restSpamTest.js http://13.213.62.207:3000

# GraphQL spam against the deployed instance
node src/tests/graphqlSpamTest.js http://13.213.62.207:3000
```

Responses are saved in `restresponses/` and `graphqlresponses/`.  
The scripts send 1000 concurrent requests (10 search terms × 100 each).  
Only 10 real external API calls are made (coalescing works), and the total time reflects the global 500ms rate limiter.

---

## 5. Run with Docker Locally

```bash
docker build -t image-search-api .
docker run -d -p 3000:3000 --env-file .env image-search-api
```

Now the API is available at `http://localhost:3000` from inside the container.

---

## 6. Deploy to AWS (CI/CD)

The GitHub Actions workflow (`.github/workflows/docker-build-push.yml`) builds the image and pushes it to **Amazon ECR** on every push to `main`.  

After deployment, test your AWS instance with the same spam scripts:

```bash
node src/tests/restSpamTest.js http://<aws-host>:3000
node src/tests/graphqlSpamTest.js http://<aws-host>:3000
```

---

## Project Structure (key files)

```
├── src/
│   ├── app.js
│   ├── routes/ (rest.js, graphql.js)
│   ├── services/ (cache, fetch, auth, getOrFetch)
│   └── tests/ (spam scripts)
├── cache/                (auto‑created)
├── .env                  (API keys)
└── Dockerfile
```

**Environment variables** (`.env`): `UNSPLASH_KEY`, `PIXABAY_KEY`, `STORYBLOCKS_*`, `API_KEY=secret_api_key_123`, `RATE_LIMIT_MS=500`.
```