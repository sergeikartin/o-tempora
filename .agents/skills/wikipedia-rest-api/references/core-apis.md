# Core v1 APIs Reference

Wikipedia REST API v1 provides **29 endpoints** for reading and editing Wikipedia content. All endpoints use JSON for request/response format.

**Base URL:** `https://en.wikipedia.org/w/rest.php/v1`

## Endpoint Categories

- [Page Operations](#page-operations) (4 endpoints)
- [Revision Access](#revision-access) (6 endpoints)
- [Page History](#page-history) (2 endpoints)
- [Search](#search) (3 endpoints)
- [Transformations](#transformations) (9 endpoints)
- [File Operations](#file-operations) (1 endpoint)
- [Additional Features](#additional-features) (4 endpoints)

---

## Page Operations

Work with article content - get, update, and create pages.

### GET /page/{title}

Get a Wikipedia page's content in wikitext format (page source).

**Parameters:**

- **title** (string, required): Wiki page title in reading-friendly format (e.g., "Albert Einstein")
- **redirect** (boolean, optional): Whether to follow redirects (default: true)

**Response:** Page object with `id`, `key`, `title`, `latest`, `content_model`, `license`, and `source`

**Examples:**

```bash
# Get page content
curl 'https://en.wikipedia.org/w/rest.php/v1/page/Berlin'
```

```javascript
// JavaScript
const response = await fetch(
  "https://en.wikipedia.org/w/rest.php/v1/page/Berlin",
);
const page = await response.json();
console.log(page.source); // Wikitext content
```

```python
# Python
import requests
r = requests.get('https://en.wikipedia.org/w/rest.php/v1/page/Berlin')
page = r.json()
print(page['source'])
```

```rust
// Rust
let response = reqwest::blocking::get(
    "https://en.wikipedia.org/w/rest.php/v1/page/Berlin"
)?;
let page: serde_json::Value = response.json()?;
```

```go
// Go
resp, _ := http.Get("https://en.wikipedia.org/w/rest.php/v1/page/Berlin")
var page map[string]interface{}
json.NewDecoder(resp.Body).Decode(&page)
```

---

### GET /page/{title}/bare

Get minimal page data without rendered HTML (fastest option).

**Parameters:**

- **title** (string, required): Wiki page title
- **redirect** (boolean, optional): Follow redirects

**Response:** Minimal page object with basic metadata

**Use when:** You only need page ID and title, not content

```bash
curl 'https://en.wikipedia.org/w/rest.php/v1/page/Berlin/bare'
```

---

### GET /page/{title}/html

Get a page's rendered HTML (parsed and formatted).

**Parameters:**

- **title** (string, required): Wiki page title
- **redirect** (boolean, optional): Follow redirects

**Response:** Page object with `html` field containing rendered HTML

**Use when:** Displaying page on a website or for display purposes

```bash
curl 'https://en.wikipedia.org/w/rest.php/v1/page/Berlin/html'
```

```javascript
// Display on website
const response = await fetch(
  "https://en.wikipedia.org/w/rest.php/v1/page/Berlin/html",
);
const page = await response.json();
document.getElementById("content").innerHTML = page.html;
```

---

### GET /page/{title}/with_html

Get page source AND rendered HTML together.

**Parameters:**

- **title** (string, required): Wiki page title
- **redirect** (boolean, optional): Follow redirects

**Response:** Page object with both `source` (wikitext) and `html` (rendered)

**Use when:** You need both the source code and rendered version

```bash
curl 'https://en.wikipedia.org/w/rest.php/v1/page/Berlin/with_html'
```

---

### PUT /page/{title}

Update an existing page (requires OAuth2 authentication).

**Parameters:**

- **title** (string, required): Page title to update

**Request Body:**

```json
{
  "source": "New content here",
  "comment": "Edit summary",
  "if_match": "previous_etag_value"
}
```

**Response:** Confirmation with new revision ID

**Requires:** OAuth2 token in Authorization header

```bash
curl -X PUT \
  'https://en.wikipedia.org/w/rest.php/v1/page/Sandbox' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"source":"Updated content","comment":"My edit"}'
```

```javascript
// JavaScript with OAuth2
const response = await fetch(
  "https://en.wikipedia.org/w/rest.php/v1/page/Sandbox",
  {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source: "Updated content",
      comment: "My edit",
    }),
  },
);
```

---

### POST /page

Create a new page (requires OAuth2 authentication).

**Request Body:**

```json
{
  "title": "New Page Title",
  "source": "Page content",
  "comment": "Creation summary"
}
```

**Response:** New page with revision ID and metadata

**Requires:** OAuth2 token

```bash
curl -X POST \
  'https://en.wikipedia.org/w/rest.php/v1/page' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"title":"New Article","source":"Content here","comment":"Created new article"}'
```

---

## Revision Access

Work with specific page revisions, compare versions, and access revision metadata.

### GET /revision/{id}

Get a specific revision's content by revision ID.

**Parameters:**

- **id** (integer, required): Revision ID

**Response:** Revision object with source content and metadata

```bash
curl 'https://en.wikipedia.org/w/rest.php/v1/revision/1234567'
```

```javascript
const response = await fetch(
  "https://en.wikipedia.org/w/rest.php/v1/revision/1234567",
);
const revision = await response.json();
console.log(revision.source);
```

---

### GET /revision/{id}/html

Get a revision's content as rendered HTML.

**Parameters:**

- **id** (integer, required): Revision ID

**Response:** Revision object with HTML content

```bash
curl 'https://en.wikipedia.org/w/rest.php/v1/revision/1234567/html'
```

---

### GET /revision/{id}/bare

Get minimal revision data.

**Parameters:**

- **id** (integer, required): Revision ID

**Response:** Basic revision metadata

```bash
curl 'https://en.wikipedia.org/w/rest.php/v1/revision/1234567/bare'
```

---

### GET /revision/{id}/with_html

Get revision source AND HTML.

**Parameters:**

- **id** (integer, required): Revision ID

**Response:** Revision with both source and HTML

```bash
curl 'https://en.wikipedia.org/w/rest.php/v1/revision/1234567/with_html'
```

---

### GET /revision/{id}/lint

Get linter warnings for a revision.

**Parameters:**

- **id** (integer, required): Revision ID

**Response:** Array of lint errors and warnings

```bash
curl 'https://en.wikipedia.org/w/rest.php/v1/revision/1234567/lint'
```

---

### GET /revision/{from}/compare/{to}

Compare two revisions and get the diff.

**Parameters:**

- **from** (integer, required): First revision ID
- **to** (integer, required): Second revision ID (usually newer)

**Response:** Diff showing changes between versions

```bash
curl 'https://en.wikipedia.org/w/rest.php/v1/revision/1234567/compare/1234568'
```

```javascript
// Compare revisions
const response = await fetch(
  "https://en.wikipedia.org/w/rest.php/v1/revision/1234567/compare/1234568",
);
const diff = await response.json();
console.log(diff); // Shows what changed
```

---

## Page History

Access page edit history and statistics.

### GET /page/{title}/history

Get the edit history of a page (list of revisions).

**Parameters:**

- **title** (string, required): Page title
- **older_than** (integer, optional): Revision ID - get revisions older than this
- **newer_than** (integer, optional): Revision ID - get revisions newer than this
- **filter** (string, optional): Filter by type: "anonymous", "bot", "reverted", "minor"

**Response:** Object with `revisions` array and `latest` revision info

**Features:**

- Returns 20 revisions per request
- Use `older_than`/`newer_than` for pagination
- Filter by edit type (bots, anonymous, reverts, minor edits)

```bash
# Get latest 20 edits
curl 'https://en.wikipedia.org/w/rest.php/v1/page/Berlin/history'

# Get older edits (pagination)
curl 'https://en.wikipedia.org/w/rest.php/v1/page/Berlin/history?older_than=1234567'

# Get only bot edits
curl 'https://en.wikipedia.org/w/rest.php/v1/page/Berlin/history?filter=bot'
```

```javascript
// Fetch page history with pagination
async function getPageHistory(title, olderThan = null) {
  const url = new URL(
    `https://en.wikipedia.org/w/rest.php/v1/page/${title}/history`,
  );
  if (olderThan) url.searchParams.append("older_than", olderThan);

  const response = await fetch(url);
  const history = await response.json();

  console.log(`${history.revisions.length} revisions`);
  history.revisions.forEach((rev) => {
    console.log(`${rev.timestamp}: ${rev.user?.name || "unknown"}`);
  });
}
```

---

### GET /page/{title}/history/counts/{type}

Get statistics on page edits by type.

**Parameters:**

- **title** (string, required): Page title
- **type** (string, required): Count type: "edits", "editors", "bot_edits", "anonymous_edits"

**Response:** Edit count object

```bash
# Count total edits
curl 'https://en.wikipedia.org/w/rest.php/v1/page/Berlin/history/counts/edits'

# Count bot edits
curl 'https://en.wikipedia.org/w/rest.php/v1/page/Berlin/history/counts/bot_edits'

# Count anonymous edits
curl 'https://en.wikipedia.org/w/rest.php/v1/page/Berlin/history/counts/anonymous_edits'

# Count unique editors
curl 'https://en.wikipedia.org/w/rest.php/v1/page/Berlin/history/counts/editors'
```

---

## Search

Search Wikipedia articles by title or content.

### GET /search

Full-text search across Wikipedia.

**Parameters:**

- **q** (string, required): Search query
- **limit** (integer, optional): Results per page, 1-100 (default: 50)

**Response:** Object with `pages` array of results

```bash
curl 'https://en.wikipedia.org/w/rest.php/v1/search?q=quantum+physics&limit=10'
```

```javascript
// Full-text search
const response = await fetch(
  "https://en.wikipedia.org/w/rest.php/v1/search?q=quantum+physics&limit=10",
);
const results = await response.json();
results.pages.forEach((page) => {
  console.log(`${page.title}: ${page.excerpt}`);
});
```

---

### GET /search/page

Search for pages by title and content with snippets.

**Parameters:**

- **q** (string, required): Search query
- **limit** (integer, optional): 1-100 results (default: 50)

**Response:** Pages with title, excerpt, and thumbnail

**Best for:** General searches with result previews

```bash
curl 'https://en.wikipedia.org/w/rest.php/v1/search/page?q=machine+learning'
```

```python
# Python search with results
import requests

response = requests.get(
    'https://en.wikipedia.org/w/rest.php/v1/search/page',
    params={'q': 'machine learning', 'limit': 5}
)
results = response.json()

for page in results['pages']:
    print(f"Title: {page['title']}")
    print(f"Excerpt: {page['excerpt']}")
    print(f"Image: {page['thumbnail']['url']}")
    print()
```

---

### GET /search/title

Search by title only (faster than full-text search).

**Parameters:**

- **q** (string, required): Title search query
- **limit** (integer, optional): 1-100 results (default: 50)

**Response:** Pages matching title

**Best for:** Finding specific articles when you know the title

```bash
curl 'https://en.wikipedia.org/w/rest.php/v1/search/title?q=Python'
```

---

## Transformations

Convert content between wikitext and HTML formats, and validate markup.

### POST /transform/wikitext/to/html

Convert wikitext source to rendered HTML.

**Request Body:**

```json
{
  "wikitext": "== Heading ==\nThis is '''bold''' text"
}
```

**Response:** `{"html": "...rendered html..."}`

```bash
curl -X POST \
  'https://en.wikipedia.org/w/rest.php/v1/transform/wikitext/to/html' \
  -H 'Content-Type: application/json' \
  -d '{"wikitext":"== Heading ==\nThis is '"'"'bold'"'"' text"}'
```

```javascript
// Convert wikitext to HTML
const response = await fetch(
  "https://en.wikipedia.org/w/rest.php/v1/transform/wikitext/to/html",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wikitext: "== Heading ==\nThis is '''bold''' text",
    }),
  },
);
const result = await response.json();
console.log(result.html);
```

---

### POST /transform/html/to/wikitext

Convert HTML back to wikitext format.

**Request Body:**

```json
{
  "html": "<h2>Heading</h2>\n<p>This is <b>bold</b> text</p>"
}
```

**Response:** `{"wikitext": "...converted wikitext..."}`

```bash
curl -X POST \
  'https://en.wikipedia.org/w/rest.php/v1/transform/html/to/wikitext' \
  -H 'Content-Type: application/json' \
  -d '{"html":"<h2>Heading</h2>"}'
```

---

### POST /transform/wikitext/to/lint

Validate wikitext and get linting warnings.

**Request Body:**

```json
{
  "wikitext": "== Heading ==\nContent here"
}
```

**Response:** Array of lint errors and warnings

```bash
curl -X POST \
  'https://en.wikipedia.org/w/rest.php/v1/transform/wikitext/to/lint' \
  -H 'Content-Type: application/json' \
  -d '{"wikitext":"== Heading ==\nContent"}'
```

```python
# Lint wikitext
import requests
import json

wikitext = "== Section ==\nText with [[link]]"
response = requests.post(
    'https://en.wikipedia.org/w/rest.php/v1/transform/wikitext/to/lint',
    json={'wikitext': wikitext}
)
lint_errors = response.json()
for error in lint_errors:
    print(f"Line {error['line']}: {error['message']}")
```

---

### POST /transform/wikitext/to/html/{title}

Convert wikitext with page context (templates, variables resolved).

**Parameters:**

- **title** (string, required): Page title for context

**Request Body:**

```json
{
  "wikitext": "{{PAGENAME}}"
}
```

**Response:** HTML with variables resolved for that page

---

### POST /transform/html/to/wikitext/{title}

Convert HTML with page context.

**Parameters:**

- **title** (string, required): Page title for context

---

### POST /transform/wikitext/to/lint/{title}

Lint wikitext with page context.

**Parameters:**

- **title** (string, required): Page title for context

---

### POST /transform/wikitext/to/html/{title}/{revision}

Convert wikitext with specific revision context.

**Parameters:**

- **title** (string, required): Page title
- **revision** (integer, required): Revision ID for context

---

### POST /transform/html/to/wikitext/{title}/{revision}

Convert HTML with specific revision context.

**Parameters:**

- **title** (string, required): Page title
- **revision** (integer, required): Revision ID for context

---

## File Operations

Access file and media information.

### GET /file/{title}

Get information about a file (image, video, etc.).

**Parameters:**

- **title** (string, required): File title (including "File:" namespace)

**Response:** File metadata including thumbnail, size, license, etc.

```bash
curl 'https://en.wikipedia.org/w/rest.php/v1/file/File:Example.jpg'
```

```javascript
// Get file metadata
const response = await fetch(
  "https://en.wikipedia.org/w/rest.php/v1/file/File:Albert_Einstein_1921_by_F_Schmutzer.jpg",
);
const file = await response.json();
console.log(file.title);
console.log(file.thumbnail.url);
```

---

## Additional Features

### GET /page/{title}/links/language

Get language versions of an article.

**Parameters:**

- **title** (string, required): Page title

**Response:** Object with language links array

```bash
curl 'https://en.wikipedia.org/w/rest.php/v1/page/Berlin/links/language'
```

```javascript
// Get article in other languages
const response = await fetch(
  "https://en.wikipedia.org/w/rest.php/v1/page/Berlin/links/language",
);
const links = await response.json();
links.languages.forEach((lang) => {
  console.log(`${lang.lang}: ${lang.title}`);
});
```

---

### GET /page/{title}/links/media

Get all media (images, videos, audio) used in a page.

**Parameters:**

- **title** (string, required): Page title

**Response:** Array of media items with URLs and metadata

```bash
curl 'https://en.wikipedia.org/w/rest.php/v1/page/Berlin/links/media'
```

---

### GET /page/{title}/lint

Get linting warnings for a page.

**Parameters:**

- **title** (string, required): Page title

**Response:** Array of lint issues

```bash
curl 'https://en.wikipedia.org/w/rest.php/v1/page/Berlin/lint'
```

---

## Response Format

All successful responses are JSON with status 200 (OK).

### Page Object

```json
{
  "id": 3343,
  "key": "Berlin",
  "title": "Berlin",
  "latest": {
    "id": 1234567,
    "timestamp": "2024-01-15T10:30:00Z"
  },
  "content_model": "wikitext",
  "license": {
    "url": "https://creativecommons.org/licenses/by-sa/4.0/",
    "title": "Creative Commons Attribution-Share Alike 4.0"
  },
  "source": "Page source in wikitext format...",
  "html": "<html>Rendered content...</html>"
}
```

### Revision Object

```json
{
  "id": 1234567,
  "timestamp": "2024-01-15T10:30:00Z",
  "minor": false,
  "size": 15234,
  "comment": "Updated introduction",
  "user": {
    "id": 12345,
    "name": "WikiContributor"
  },
  "delta": 120
}
```

### Search Results Object

```json
{
  "pages": [
    {
      "id": 3343,
      "key": "Berlin",
      "title": "Berlin",
      "excerpt": "Berlin is the capital of Germany...",
      "matched_title": null,
      "description": "Capital city of Germany",
      "thumbnail": {
        "url": "https://...",
        "width": 100,
        "height": 100
      }
    }
  ]
}
```

---

## Error Codes

| Status | Meaning           | Explanation                   |
| ------ | ----------------- | ----------------------------- |
| 200    | OK                | Request successful            |
| 400    | Bad Request       | Invalid parameters            |
| 404    | Not Found         | Page doesn't exist            |
| 409    | Conflict          | Edit conflict (stale version) |
| 429    | Too Many Requests | Rate limited                  |
| 500    | Server Error      | API error (retry)             |

---

## Tips & Best Practices

1. **Use the right endpoint variant**

   - `/bare` - Fastest, minimal data
   - `/html` - For display
   - `/with_html` - Need both formats

2. **Search efficiently**

   - Use `/search/title` for title search (faster)
   - Use `/search/page` for content search with previews
   - Use `/search` for full text search

3. **Pagination for history**

   - Use `older_than` to get older revisions
   - Each request returns 20 revisions max
   - Use revision IDs for cursor-based pagination

4. **Handle conflicts when editing**

   - Always include `if_match` header with current ETag
   - Retry with fresh data on 409 errors

5. **Respect the API**
   - Cache responses with appropriate TTL
   - Use ETags for conditional requests
   - Implement exponential backoff on errors

---

**Last Updated:** 2024
**API Documentation:** https://en.wikipedia.org/w/rest.php/specs/v0/module/-
