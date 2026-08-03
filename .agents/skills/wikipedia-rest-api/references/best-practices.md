# Best Practices Guide

Optimize your Wikipedia REST API usage with these proven strategies for performance, authentication, caching, and error handling.

## Performance Optimization

### 1. Choose the Right Endpoint Variant

Different endpoint variants return different amounts of data:

```
Fastest ⭐⭐⭐  → /bare      (minimal, ~1KB)
           ⭐⭐   → /          (source, ~50KB)
           ⭐    → /html     (rendered, ~100KB)
Slowest         → /with_html (both, ~150KB)
```

**When to use each:**

- **`/bare`** - Check if page exists, get page ID/title only
- **`/`** (source) - Process wikitext, extract data, programmatic access
- **`/html`** - Display on website, render to user
- **`/with_html`** - Need both source AND rendered (rare)

**Example: Optimized page fetch**

```javascript
// ✗ WRONG - Gets full HTML even if not needed
const page = await fetch("https://.../page/Einstein/html").then((r) =>
  r.json(),
);
const pageId = page.id;

// ✓ CORRECT - Gets only what you need
const page = await fetch("https://.../page/Einstein/bare").then((r) =>
  r.json(),
);
const pageId = page.id;
// 100x faster!
```

### 2. Use Search Instead of Multiple Fetches

```javascript
// ✗ WRONG - N+1 problem, hits API N times
const titles = ["Python", "Java", "Rust"];
for (const title of titles) {
  const page = await fetch(`/page/${title}/html`);
}

// ✓ CORRECT - One search, get all results
const results = await fetch(
  "/search/page?q=programming+languages&limit=50",
).then((r) => r.json());
```

### 3. Implement Response Caching

Cache responses with appropriate TTL:

```javascript
class WikiCache {
  constructor(ttl = 3600) {
    this.cache = new Map();
    this.ttl = ttl * 1000;
  }

  async get(key, fetcher) {
    if (this.cache.has(key)) {
      const item = this.cache.get(key);
      if (Date.now() - item.time < this.ttl) {
        return item.data; // From cache
      }
    }

    const data = await fetcher();
    this.cache.set(key, { data, time: Date.now() });
    return data;
  }
}

// Usage
const cache = new WikiCache(3600);
const article = await cache.get("Berlin", () =>
  fetch("/page/Berlin/html").then((r) => r.json()),
);
```

**Recommended TTL values:**

- Articles content: 24 hours
- Search results: 1 hour
- Page metadata: 1 hour
- Revision history: 24 hours

### 4. Use ETags for Conditional Requests

```javascript
async function fetchPageWithETag(title) {
  const headers = {};
  const cached = localCache.get(`page:${title}`);

  if (cached?.etag) {
    headers["If-None-Match"] = cached.etag;
  }

  const response = await fetch(`https://.../page/${title}/html`, { headers });

  // 304 Not Modified = save bandwidth!
  if (response.status === 304) {
    return cached.data;
  }

  const data = await response.json();
  localCache.set(`page:${title}`, {
    data,
    etag: response.headers.get("etag"),
  });

  return data;
}
```

### 5. Batch Operations with Proper Concurrency

```javascript
async function fetchMultipleWithLimit(titles, concurrency = 5) {
  const results = [];

  for (let i = 0; i < titles.length; i += concurrency) {
    const batch = titles.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((title) =>
        fetch(`/page/${title}/bare`)
          .then((r) => r.json())
          .catch((e) => ({ error: e.message })),
      ),
    );
    results.push(...batchResults);

    // Add delay between batches to avoid rate limiting
    if (i + concurrency < titles.length) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return results;
}
```

## Authentication & Authorization

### OAuth2 Flow for Editing

Wikipedia REST API requires OAuth2 authentication to edit pages.

**Step 1: Register Your Application**

1. Go to https://meta.wikimedia.org/wiki/Special:OAuthConsumerRegistration
2. Register as "Owner-only consumer"
3. Get Client ID and Secret

**Step 2: Implement OAuth Flow**

```javascript
class WikiOAuth2 {
  constructor(clientId, clientSecret, redirectUri) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
  }

  // Generate authorization URL
  getAuthUrl() {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: "edit",
    });
    return `https://en.wikipedia.org/w/rest.php/oauth2/authorize?${params}`;
  }

  // Exchange code for token (server-side)
  async getAccessToken(code) {
    const response = await fetch(
      "https://en.wikipedia.org/w/rest.php/oauth2/access_token",
      {
        method: "POST",
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: "authorization_code",
          code: code,
          redirect_uri: this.redirectUri,
        }),
      },
    );

    return response.json();
  }

  // Refresh token when expired
  async refreshAccessToken(refreshToken) {
    const response = await fetch(
      "https://en.wikipedia.org/w/rest.php/oauth2/access_token",
      {
        method: "POST",
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
      },
    );

    return response.json();
  }
}
```

**Step 3: Use Token for Edits**

```javascript
async function editPage(title, content, comment, accessToken) {
  const response = await fetch(
    `https://en.wikipedia.org/w/rest.php/v1/page/${title}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: content,
        comment: comment,
      }),
    },
  );

  return response.json();
}
```

### Token Refresh Strategy

```javascript
class TokenManager {
  constructor(oauth, refreshToken) {
    this.oauth = oauth;
    this.refreshToken = refreshToken;
    this.accessToken = null;
    this.expiresAt = 0;
  }

  async getValidToken() {
    // Check if token is still valid (with 5-min buffer)
    if (this.accessToken && Date.now() < this.expiresAt - 300000) {
      return this.accessToken;
    }

    // Refresh token
    const data = await this.oauth.refreshAccessToken(this.refreshToken);
    this.accessToken = data.access_token;
    this.expiresAt = Date.now() + data.expires_in * 1000;

    return this.accessToken;
  }
}
```

## Rate Limiting

### Monitor Rate Limit Headers

Every response includes rate limit info:

```javascript
const response = await fetch(url);
console.log("Rate limit:", response.headers.get("X-RateLimit-Limit"));
console.log("Remaining:", response.headers.get("X-RateLimit-Remaining"));
console.log("Reset:", response.headers.get("X-RateLimit-Reset"));
```

### Implement Exponential Backoff

```javascript
async function fetchWithBackoff(url, maxRetries = 3) {
  let delay = 1000; // Start with 1 second

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url);

      if (response.status === 429) {
        // Rate limited - wait and retry
        const resetTime = response.headers.get("X-RateLimit-Reset");
        const waitTime = resetTime
          ? new Date(resetTime).getTime() - Date.now()
          : delay;

        console.log(`Rate limited, waiting ${waitTime}ms...`);
        await new Promise((r) => setTimeout(r, waitTime));
        delay *= 2; // Exponential backoff
        continue;
      }

      if (response.status >= 500) {
        // Server error - retry with backoff
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
        continue;
      }

      if (response.ok) return response;

      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;

      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
    }
  }
}
```

### Distributed Rate Limiting

If using across multiple processes/servers:

```javascript
// Use Redis or similar for shared rate limit state
class DistributedRateLimiter {
  constructor(redis, limit = 50, windowSeconds = 1) {
    this.redis = redis;
    this.limit = limit;
    this.window = windowSeconds;
  }

  async isAllowed(key) {
    const current = await this.redis.incr(key);

    if (current === 1) {
      await this.redis.expire(key, this.window);
    }

    return current <= this.limit;
  }
}

// Usage
const limiter = new DistributedRateLimiter(redis);

if (await limiter.isAllowed("wikipedia_api")) {
  const data = await fetch(url);
}
```

## Error Handling

### Handle Common Errors

```javascript
async function fetchPageSafely(title) {
  try {
    const response = await fetch(`/page/${title}`);

    switch (response.status) {
      case 200:
        return await response.json();

      case 404:
        console.error(`Page "${title}" not found`);
        return null;

      case 400:
        throw new Error("Invalid request parameters");

      case 409:
        throw new Error("Edit conflict - page was modified");

      case 429:
        throw new Error("Rate limited - retry later");

      case 500:
      case 502:
      case 503:
        throw new Error("Server error - retry");

      default:
        throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    console.error("Fetch error:", error);
    // Fallback behavior
    return null;
  }
}
```

### Validate Response Data

```javascript
function validatePage(page) {
  const required = ["id", "title", "key"];

  for (const field of required) {
    if (!(field in page)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (typeof page.id !== "number") {
    throw new Error("Page ID must be a number");
  }

  if (!page.title.trim()) {
    throw new Error("Page title cannot be empty");
  }

  return page;
}
```

## Data Freshness

### Handling Replication Lag

Wikipedia uses database replication which can introduce lag:

```javascript
// For time-sensitive data, consider using the primary database
async function getLatestPageData(title) {
  const page = await fetch(`/page/${title}`).then(r => r.json());

  // If data is critical and old, refetch
  const lastEditAge = Date.now() - new Date(page.latest.timestamp);
  const maxAge = 5 * 60 * 1000; // 5 minutes

  if (lastEditAge < maxAge && /* other conditions */) {
    // Might be replication lag, consider refetching
    await new Promise(r => setTimeout(r, 1000));
    return fetch(`/page/${title}`).then(r => r.json());
  }

  return page;
}
```

### Cache Invalidation

```javascript
// Invalidate cache when making edits
async function editPageAndInvalidateCache(title, content, token) {
  // Make the edit
  await fetch(`/page/${title}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ source: content }),
  });

  // Immediately invalidate related caches
  cache.delete(`page:${title}`);
  cache.delete(`page:${title}:html`);
  cache.delete(`page:${title}:history`);

  // Clear search results that might include this page
  cache.delete("search:*");
}
```

## Security Best Practices

### Never Expose Secrets

```javascript
// ✗ WRONG - Secret visible in browser
const clientSecret = "abc123secret";

// ✓ CORRECT - Use backend for token exchange
// Frontend only has temporary token from backend
```

### Validate User Input

```javascript
function validatePageTitle(title) {
  // Remove suspicious characters
  const clean = title.replace(/[<>"]/g, "");

  // Check length
  if (clean.length === 0 || clean.length > 255) {
    throw new Error("Invalid page title");
  }

  return clean;
}
```

### Use HTTPS Only

```javascript
// ✓ CORRECT
const url = "https://en.wikipedia.org/w/rest.php/v1/page/...";

// ✗ WRONG - Never use HTTP
const url = "http://en.wikipedia.org/w/rest.php/v1/page/...";
```

## Monitoring & Debugging

### Log API Calls

```javascript
const logger = {
  request(url, method) {
    console.log(`[${new Date().toISOString()}] ${method} ${url}`);
  },

  response(url, status, time) {
    console.log(`← ${status} (${time}ms)`);
  },

  error(url, error) {
    console.error(`✗ ${url}: ${error}`);
  },
};

// Usage
const start = Date.now();
logger.request(url, "GET");

try {
  const response = await fetch(url);
  logger.response(url, response.status, Date.now() - start);
} catch (error) {
  logger.error(url, error);
}
```

### Add Metrics

```javascript
class APIMetrics {
  constructor() {
    this.requests = 0;
    this.errors = 0;
    this.totalTime = 0;
  }

  recordRequest(duration) {
    this.requests++;
    this.totalTime += duration;
  }

  recordError() {
    this.errors++;
  }

  getStats() {
    return {
      totalRequests: this.requests,
      errorCount: this.errors,
      errorRate: ((this.errors / this.requests) * 100).toFixed(2) + "%",
      avgResponseTime: (this.totalTime / this.requests).toFixed(0) + "ms",
    };
  }
}
```

## Language-Specific Tips

### JavaScript

- Use `fetch` API (modern) or `axios` (convenience)
- Implement request/response interceptors for auth
- Use async/await for cleaner code

### Python

- Use `requests` library for simplicity
- Use `aiohttp` for async operations
- Implement connection pooling for multiple requests

```python
import requests
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry

def requests_retry_session(
    retries=3,
    backoff_factor=0.3,
    session=None,
):
    session = session or requests.Session()
    retry = Retry(
        total=retries,
        read=retries,
        connect=retries,
        backoff_factor=backoff_factor,
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount('http://', adapter)
    session.mount('https://', adapter)
    return session
```

### Rust

- Use `reqwest` for HTTP client
- Use `tokio` for async runtime
- Leverage type safety for validation

### Go

- Use `net/http` standard library
- Implement connection pooling with `http.Client`
- Use `context` for timeouts and cancellation

---

**Last Updated:** 2024
**Related:** See `error-handling.md` for detailed error recovery strategies
