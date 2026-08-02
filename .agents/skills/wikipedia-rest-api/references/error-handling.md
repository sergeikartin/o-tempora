# Error Handling & Troubleshooting Guide

Common errors, solutions, and recovery strategies for Wikipedia REST API usage.

## HTTP Status Codes

### 2xx - Success

| Code | Name         | Meaning                           |
| ---- | ------------ | --------------------------------- |
| 200  | OK           | Request successful, data returned |
| 201  | Created      | New resource created              |
| 304  | Not Modified | Content unchanged (ETag match)    |

### 4xx - Client Errors

| Code | Name              | Cause                                     | Solution                                   |
| ---- | ----------------- | ----------------------------------------- | ------------------------------------------ |
| 400  | Bad Request       | Invalid parameters or malformed request   | Check query params, validate input         |
| 401  | Unauthorized      | Missing or invalid authentication         | Use correct OAuth2 token                   |
| 403  | Forbidden         | Permission denied, auth required          | Authenticate with OAuth2                   |
| 404  | Not Found         | Page, revision, or endpoint doesn't exist | Check page title spelling, verify endpoint |
| 409  | Conflict          | Edit conflict (stale version)             | Fetch current version, retry               |
| 429  | Too Many Requests | Rate limited                              | Implement backoff, reduce request rate     |

### 5xx - Server Errors

| Code | Name                  | Cause                          | Solution                 |
| ---- | --------------------- | ------------------------------ | ------------------------ |
| 500  | Internal Server Error | API bug or unexpected error    | Retry with backoff       |
| 502  | Bad Gateway           | Temporary network issue        | Retry after delay        |
| 503  | Service Unavailable   | Server maintenance or overload | Retry after longer delay |

---

## Common Error Scenarios

### 1. Page Not Found (404)

**Error Response:**

```json
{
  "httpStatus": 404,
  "httpStatusText": "Not Found",
  "error": "page_not_found",
  "message": "Page 'NonexistentPage' does not exist."
}
```

**Causes & Solutions:**

```javascript
// ✗ WRONG - Typo in page title
const page = await fetch("/page/Pyton"); // Misspelled Python
// → 404 Not Found

// ✓ SOLUTION 1 - Check spelling
const page = await fetch("/page/Python");

// ✓ SOLUTION 2 - Search if unsure
const results = await fetch("/search/title?q=python");

// ✓ SOLUTION 3 - Handle gracefully
const response = await fetch("/page/UnknownPage");
if (response.status === 404) {
  console.log("Page does not exist");
  // Show suggestions via search
  const suggestions = await fetch("/search/title?q=similar");
}
```

**Prevention Tips:**

- Use `/search/title` to find correct page names
- Check page URLs on Wikipedia to get exact titles
- Remember that page titles are case-sensitive for first character

---

### 2. Rate Limiting (429)

**Error Response:**

```json
{
  "httpStatus": 429,
  "message": "Rate limit exceeded"
}
```

**Response Headers:**

```
X-RateLimit-Limit: 50
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1702464600 (Unix timestamp)
```

**Causes & Solutions:**

```javascript
// ✗ WRONG - No backoff, hammering API
for (let i = 0; i < 1000; i++) {
  await fetch(`/page/Article${i}`); // Too fast!
}
// → HTTP 429 Too Many Requests

// ✓ SOLUTION 1 - Add delay between requests
for (let i = 0; i < 1000; i++) {
  await fetch(`/page/Article${i}`);
  await new Promise((r) => setTimeout(r, 100)); // Wait 100ms
}

// ✓ SOLUTION 2 - Batch with concurrency limit
async function fetchWithLimit(urls, concurrency = 5) {
  const results = [];
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    results.push(
      ...(await Promise.all(
        batch.map((url) => fetch(url).then((r) => r.json())),
      )),
    );
    await new Promise((r) => setTimeout(r, 500)); // Delay between batches
  }
  return results;
}

// ✓ SOLUTION 3 - Implement exponential backoff
async function fetchWithBackoff(url) {
  let delay = 1000;
  let retries = 0;

  while (retries < 5) {
    const response = await fetch(url);

    if (response.status !== 429) return response;

    const resetTime = response.headers.get("X-RateLimit-Reset");
    const waitTime = resetTime
      ? new Date(resetTime).getTime() - Date.now()
      : delay;

    console.log(`Rate limited, waiting ${waitTime}ms...`);
    await new Promise((r) => setTimeout(r, waitTime));

    delay *= 2; // Exponential backoff
    retries++;
  }

  throw new Error("Rate limit retry failed");
}
```

**Prevention Tips:**

- Monitor `X-RateLimit-Remaining` header
- Implement adaptive backoff based on headers
- Cache responses to reduce API calls
- Use batch operations where possible
- Spread requests over time instead of bursts

**Default Limits:**

- Typically 50 requests per 1 second per IP
- Limits apply per endpoint
- Authenticated requests may have higher limits

---

### 3. Edit Conflict (409)

**Error Response:**

```json
{
  "httpStatus": 409,
  "httpStatusText": "Conflict",
  "error": "conflict",
  "message": "The page was modified since you accessed it."
}
```

**Causes & Solutions:**

```javascript
// ✗ WRONG - Not handling version conflicts
async function editPage(title, content, token) {
  const response = await fetch(`/page/${title}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ source: content }),
  });

  if (response.status === 409) {
    // Oops, conflict but no handling!
    return { error: "Conflict" };
  }
}

// ✓ CORRECT - Handle conflicts with retry
async function editPageWithConflictHandling(title, content, token) {
  let retries = 0;

  while (retries < 3) {
    // Get current version (with ETag)
    const currentResp = await fetch(`/page/${title}`);
    const current = await currentResp.json();
    const etag = currentResp.headers.get("etag");

    // Attempt edit with conflict detection
    const editResp = await fetch(`/page/${title}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "If-Match": etag || "",
      },
      body: JSON.stringify({
        source: content,
        comment: "Edit",
        if_match: etag,
      }),
    });

    if (editResp.status === 409) {
      // Conflict - someone else edited
      console.log("Edit conflict, retrying with fresh data...");
      retries++;

      // In a real app, merge changes or ask user
      continue;
    }

    if (editResp.ok) {
      return await editResp.json();
    }

    throw new Error(`Edit failed: ${editResp.status}`);
  }

  throw new Error("Edit failed after retries");
}
```

**Prevention Tips:**

- Always use ETag/If-Match headers
- Fetch current version before editing
- Implement merge logic for conflicts
- Allow user to review conflicting edits
- Consider warning user if page is frequently edited

---

### 4. Unauthorized/Forbidden (401/403)

**Error Response:**

```json
{
  "httpStatus": 403,
  "httpStatusText": "Forbidden",
  "error": "unauthorized",
  "message": "You do not have permission to edit this page."
}
```

**Causes & Solutions:**

```javascript
// ✗ WRONG - Trying to edit without auth
const response = await fetch("/page/Article", {
  method: "PUT",
  body: JSON.stringify({ source: "New content" }),
});
// → HTTP 403 Forbidden

// ✓ SOLUTION 1 - Add OAuth2 token
const response = await fetch("/page/Article", {
  method: "PUT",
  headers: {
    Authorization: `Bearer ${accessToken}`, // Required!
  },
  body: JSON.stringify({ source: "New content" }),
});

// ✓ SOLUTION 2 - Check if token is valid
async function isTokenValid(token) {
  const response = await fetch("/v1/page/Test", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401 || response.status === 403) {
    console.log("Token is invalid or expired");
    return false;
  }

  return true;
}

// ✓ SOLUTION 3 - Refresh expired token
async function editWithTokenRefresh(title, content, tokenManager) {
  const token = await tokenManager.getValidToken();

  const response = await fetch(`/page/${title}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ source: content }),
  });

  if (response.status === 401) {
    // Token expired, refresh
    await tokenManager.refreshToken();
    const newToken = await tokenManager.getValidToken();

    return fetch(`/page/${title}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${newToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source: content }),
    });
  }

  return response;
}
```

**Prevention Tips:**

- Always include Authorization header for edits
- Use OAuth2 tokens for authenticated operations
- Monitor token expiration and refresh proactively
- Handle 401 errors gracefully (redirect to login)

---

### 5. Bad Request (400)

**Error Response:**

```json
{
  "httpStatus": 400,
  "httpStatusText": "Bad Request",
  "error": "bad_request",
  "message": "Invalid parameter 'limit': must be between 1 and 100"
}
```

**Causes & Solutions:**

```javascript
// ✗ WRONG - Invalid parameters
const response = await fetch("/search/page?q=&limit=1000");
// → HTTP 400 Bad Request (limit > 100)

// ✓ CORRECT - Validate parameters
function validateSearchParams(query, limit) {
  if (!query || query.trim().length === 0) {
    throw new Error("Query cannot be empty");
  }

  if (limit < 1 || limit > 100) {
    throw new Error("Limit must be between 1 and 100");
  }

  return { query: query.trim(), limit };
}

// Usage
const params = validateSearchParams("python", 50); // Valid
const response = await fetch(
  `/search/page?q=${params.query}&limit=${params.limit}`,
);

// ✗ WRONG - Malformed JSON in request body
const response = await fetch("/page/Article", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: "{invalid json}", // Syntax error
});

// ✓ CORRECT - Validate JSON before sending
try {
  const body = JSON.stringify({ source: content });
  const response = await fetch("/page/Article", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: body,
  });
} catch (error) {
  console.error("Invalid JSON:", error);
}
```

**Common 400 Errors:**

- Limit outside valid range (1-100)
- Empty search query
- Malformed JSON body
- Missing required parameters
- Invalid parameter types

**Prevention Tips:**

- Validate all input before sending
- Check API documentation for parameter ranges
- Use typed languages (TypeScript, Rust) when possible
- Test with invalid inputs during development

---

### 6. Server Errors (500/502/503)

**Error Response:**

```json
{
  "httpStatus": 500,
  "httpStatusText": "Internal Server Error",
  "error": "internal_error",
  "message": "An unexpected error occurred"
}
```

**Causes & Solutions:**

```javascript
// Server errors are temporary, implement retry
async function fetchWithRetry(url, maxRetries = 3) {
  let lastError;
  let delay = 1000;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);

      // Retry on server errors
      if (response.status >= 500) {
        console.log(`Server error ${response.status}, retrying...`);
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2; // Exponential backoff
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
    }
  }

  throw lastError || new Error("Request failed after retries");
}

// Usage
const response = await fetchWithRetry("/page/Article");
```

**Prevention Tips:**

- Implement exponential backoff for retries
- Check Wikipedia status page during outages
- Don't retry 4xx errors indefinitely
- Use circuit breaker pattern for repeated failures

---

## Debugging Techniques

### 1. Enable Request Logging

```javascript
// Intercept all requests for debugging
function setupRequestLogging() {
  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const [resource, config] = args;
    const startTime = Date.now();

    console.log(`→ ${config?.method || "GET"} ${resource}`);

    try {
      const response = await originalFetch(...args);
      const duration = Date.now() - startTime;

      console.log(`← ${response.status} (${duration}ms)`);
      console.log(
        `  Rate limit: ${response.headers.get("X-RateLimit-Remaining")}/${response.headers.get("X-RateLimit-Limit")}`,
      );

      return response;
    } catch (error) {
      console.error(`✗ Error:`, error);
      throw error;
    }
  };
}

setupRequestLogging();
```

### 2. Inspect Response Headers

```javascript
async function debugResponse(url) {
  const response = await fetch(url);

  console.log("Response Headers:");
  for (const [key, value] of response.headers) {
    console.log(`  ${key}: ${value}`);
  }

  console.log("Body:", await response.clone().text());

  return response;
}
```

### 3. Test with curl

```bash
# Get page
curl -v https://en.wikipedia.org/w/rest.php/v1/page/Berlin

# Search
curl -v "https://en.wikipedia.org/w/rest.php/v1/search/page?q=python"

# Check rate limiting
curl -i https://en.wikipedia.org/w/rest.php/v1/page/Berlin/bare
```

### 4. Use API Tools

- **Postman** - Test API endpoints with UI
- **curl** - Command line API testing
- **HTTPie** - User-friendly curl alternative
- **Insomnia** - REST client

---

## Recovery Strategies

### Circuit Breaker Pattern

```javascript
class CircuitBreaker {
  constructor(failureThreshold = 5, resetTimeout = 60000) {
    this.failureThreshold = failureThreshold;
    this.resetTimeout = resetTimeout;
    this.failures = 0;
    this.state = "CLOSED"; // CLOSED, OPEN, HALF_OPEN
    this.nextRetryTime = null;
  }

  async call(fn) {
    if (this.state === "OPEN") {
      if (Date.now() < this.nextRetryTime) {
        throw new Error("Circuit breaker is OPEN");
      }
      this.state = "HALF_OPEN";
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    this.state = "CLOSED";
  }

  onFailure() {
    this.failures++;
    if (this.failures >= this.failureThreshold) {
      this.state = "OPEN";
      this.nextRetryTime = Date.now() + this.resetTimeout;
    }
  }
}

// Usage
const breaker = new CircuitBreaker(5, 60000);

async function fetchPage(title) {
  return breaker.call(() => fetch(`/page/${title}`).then((r) => r.json()));
}
```

### Fallback/Cache Strategy

```javascript
async function fetchWithFallback(url, cache) {
  try {
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      cache.set(url, data); // Update cache
      return data;
    }
  } catch (error) {
    console.log("Fetch failed, checking cache");
  }

  // Fallback to cached version
  const cached = cache.get(url);
  if (cached) {
    console.log("Using cached data");
    return cached;
  }

  throw new Error("No data available");
}
```

---

## API Health Status

Check Wikipedia's status page:
https://status.wikimedia.org/

Subscribe to notifications for maintenance windows and incidents.

---

## Getting Help

- **API Documentation**: https://en.wikipedia.org/w/rest.php/specs/v0/module/-
- **MediaWiki API**: https://www.mediawiki.org/wiki/API
- **GitHub Issues**: Report bugs on MediaWiki GitHub
- **Wikimedia Mailing Lists**: Join developer mailing list
- **Stack Overflow**: Tag questions with `mediawiki-api`

---

**Last Updated:** 2024
**Related:** See `best-practices.md` for optimization strategies
