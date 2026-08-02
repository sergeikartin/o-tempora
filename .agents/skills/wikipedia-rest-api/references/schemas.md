# Common Schemas and Data Structures

This document defines the common data structures used across Wikipedia REST API endpoints.

## Core Objects

### Page Object

Represents a Wikipedia page/article.

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
  "source": "== History ==\nBerlin's history is diverse and complex...",
  "html": "<h2>History</h2>\n<p>Berlin's history is diverse...</p>"
}
```

**Fields:**

| Field         | Type    | Description                                          |
| ------------- | ------- | ---------------------------------------------------- |
| id            | integer | Unique page identifier                               |
| key           | string  | URL-friendly page title (use for links)              |
| title         | string  | Human-readable page title                            |
| latest        | object  | Latest revision info                                 |
| content_model | string  | "wikitext" (markdown-like format)                    |
| license       | object  | Wiki content license                                 |
| source        | string  | Page source in wikitext format (not always included) |
| html          | string  | Rendered HTML version (not always included)          |

**Notes:**

- `key` is the page title in URL-friendly format (underscores for spaces)
- `source` field only present when explicitly requested
- `html` field only present for `/html` endpoints
- `latest` contains revision ID and timestamp

---

### Revision Object

Represents a specific version of a page.

```json
{
  "id": 1234567,
  "timestamp": "2024-01-15T10:30:00Z",
  "minor": false,
  "size": 15234,
  "comment": "Updated introduction with recent statistics",
  "user": {
    "id": 12345,
    "name": "WikiContributor"
  },
  "delta": 120,
  "source": "Page content in wikitext...",
  "html": "<p>Page content rendered...</p>"
}
```

**Fields:**

| Field     | Type    | Description                                          |
| --------- | ------- | ---------------------------------------------------- |
| id        | integer | Revision identifier (unique)                         |
| timestamp | string  | ISO 8601 datetime when revision was made             |
| minor     | boolean | Whether this was marked as a minor edit              |
| size      | integer | Page size in bytes after this revision               |
| comment   | string  | Edit summary/comment                                 |
| user      | object  | User who made the edit                               |
| delta     | integer | Size change from previous revision (can be negative) |
| source    | string  | Revision content in wikitext (optional)              |
| html      | string  | Revision content rendered as HTML (optional)         |

**Notes:**

- Revision ID is unique across Wikipedia
- Timestamp is always in UTC
- Comment is often empty for bot edits
- Delta: positive = content added, negative = content removed, 0 = no size change

---

### User Object

Represents a Wikipedia editor.

```json
{
  "id": 12345,
  "name": "WikiContributor",
  "is_registered": true,
  "is_temp": false
}
```

**Fields:**

| Field         | Type    | Description                         |
| ------------- | ------- | ----------------------------------- |
| id            | integer | Unique user ID (null for anonymous) |
| name          | string  | Username (IP address if anonymous)  |
| is_registered | boolean | Whether user is logged in           |
| is_temp       | boolean | Whether this is a temporary account |

**Types:**

- **Registered user:** Named account with id > 0
- **Anonymous user:** IP address, usually null id
- **Temporary account:** Temporary anonymous user (introduced 2024)

---

### License Object

Represents the content license for pages.

```json
{
  "url": "https://creativecommons.org/licenses/by-sa/4.0/",
  "title": "Creative Commons Attribution-Share Alike 4.0"
}
```

**Common licenses on Wikipedia:**

- CC BY-SA 4.0 (Most common)
- CC BY-SA 3.0
- GNU Free Documentation License

---

### Search Result Object

Represents a single search result.

```json
{
  "id": 3343,
  "key": "Berlin",
  "title": "Berlin",
  "excerpt": "Berlin is the capital and largest city of Germany. It is located in northeastern Germany, in an area of low-lying land...",
  "matched_title": null,
  "description": "Capital city of Germany",
  "thumbnail": {
    "url": "https://upload.wikimedia.org/wikipedia/commons/.../320px-Berlin_coat_of_arms.svg.png",
    "width": 100,
    "height": 100
  }
}
```

**Fields:**

| Field         | Type    | Description                                |
| ------------- | ------- | ------------------------------------------ |
| id            | integer | Page ID                                    |
| key           | string  | URL-friendly title                         |
| title         | string  | Display title                              |
| excerpt       | string  | Preview text with search terms highlighted |
| matched_title | string  | If title contains match (otherwise null)   |
| description   | string  | Short description of page                  |
| thumbnail     | object  | Thumbnail image info                       |

---

### History Object

Represents page edit history.

```json
{
  "revisions": [
    {
      "id": 1234567,
      "timestamp": "2024-01-15T10:30:00Z",
      "minor": false,
      "size": 15234,
      "comment": "Updated content",
      "user": {
        "id": 12345,
        "name": "Editor1"
      },
      "delta": 120
    },
    {
      "id": 1234566,
      "timestamp": "2024-01-14T09:15:00Z",
      "minor": true,
      "size": 15114,
      "comment": "Fixed typo",
      "user": {
        "id": 54321,
        "name": "Editor2"
      },
      "delta": -10
    }
  ],
  "latest": {
    "id": 1234567,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

**Fields:**

| Field     | Type   | Description               |
| --------- | ------ | ------------------------- |
| revisions | array  | List of revision objects  |
| latest    | object | Most recent revision info |

**Pagination:**

- Returns up to 20 revisions per request
- Use `older_than` or `newer_than` parameters for pagination
- Cursor uses revision ID

---

### Lint Issue Object

Represents a code quality issue in wikitext.

```json
{
  "line": 5,
  "column": 10,
  "type": "missing-end-tag",
  "message": "Missing end tag </span>",
  "severity": "warning"
}
```

**Fields:**

| Field    | Type    | Description             |
| -------- | ------- | ----------------------- |
| line     | integer | Line number in wikitext |
| column   | integer | Column number           |
| type     | string  | Issue type code         |
| message  | string  | Human-readable message  |
| severity | string  | "warning" or "error"    |

**Common types:**

- `missing-end-tag` - Unclosed HTML tag
- `obsolete-tag` - Deprecated HTML tag
- `bare-word-in-heading` - Text without proper formatting
- `multi-colon-escape` - Improper colon escaping

---

### File Object

Represents a file/media on Wikipedia.

```json
{
  "title": "File:Example.jpg",
  "key": "File:Example.jpg",
  "id": 98765,
  "latest": {
    "id": 9876543,
    "timestamp": "2024-01-10T12:00:00Z"
  },
  "file": {
    "name": "Example.jpg",
    "description": "A photo example",
    "url": "https://upload.wikimedia.org/wikipedia/commons/...",
    "size": 102400,
    "width": 1024,
    "height": 768,
    "mime": "image/jpeg"
  },
  "source": "File source/metadata...",
  "html": "<div class='fileinfo'>...</div>"
}
```

**Fields:**

| Field       | Type    | Description               |
| ----------- | ------- | ------------------------- |
| title       | string  | Full file title           |
| file.name   | string  | Just the filename         |
| file.url    | string  | Direct URL to file        |
| file.size   | integer | File size in bytes        |
| file.width  | integer | Width in pixels (images)  |
| file.height | integer | Height in pixels (images) |
| file.mime   | string  | MIME type                 |

---

## Collection Objects

### Pagination Info

Used when results are paginated.

```json
{
  "total": 1000,
  "limit": 50,
  "offset": 0,
  "has_more": true,
  "next_token": "revision:1234567"
}
```

**Fields:**

| Field      | Type    | Description                  |
| ---------- | ------- | ---------------------------- |
| total      | integer | Total results available      |
| limit      | integer | Results per page             |
| offset     | integer | Current offset               |
| has_more   | boolean | More results available       |
| next_token | string  | Token for next page (cursor) |

---

### Language Links Collection

Links to the same article in other languages.

```json
{
  "languages": [
    {
      "lang": "de",
      "title": "Berlin",
      "url": "https://de.wikipedia.org/wiki/Berlin"
    },
    {
      "lang": "fr",
      "title": "Berlin",
      "url": "https://fr.wikipedia.org/wiki/Berlin"
    }
  ]
}
```

**Language codes:** Standard ISO 639-1 codes (de, fr, es, etc.)

---

### Media Links Collection

Media files used in an article.

```json
{
  "media": [
    {
      "title": "File:Example_image.jpg",
      "url": "https://upload.wikimedia.org/wikipedia/commons/.../Example_image.jpg",
      "type": "image",
      "width": 1024,
      "height": 768
    },
    {
      "title": "File:Example_audio.ogg",
      "url": "https://upload.wikimedia.org/wikipedia/commons/.../Example_audio.ogg",
      "type": "audio"
    }
  ]
}
```

---

## Transformation Objects

### HTML to Wikitext Conversion

Request for HTML to wikitext transformation.

```json
{
  "html": "<h2>Section</h2>\n<p>This is <b>bold</b> text</p>",
  "title": "Sandbox",
  "revision": 1234567
}
```

**Fields:**

| Field    | Type    | Description                 |
| -------- | ------- | --------------------------- |
| html     | string  | HTML to convert (required)  |
| title    | string  | Page context (optional)     |
| revision | integer | Revision context (optional) |

---

### Wikitext to HTML Conversion

Request for wikitext to HTML transformation.

```json
{
  "wikitext": "== Section ==\nThis is '''bold''' text",
  "title": "Sandbox",
  "revision": 1234567
}
```

**Fields:**

| Field    | Type    | Description                    |
| -------- | ------- | ------------------------------ |
| wikitext | string  | Wikitext to convert (required) |
| title    | string  | Page context (optional)        |
| revision | integer | Revision context (optional)    |

---

### Wikitext Lint Result

```json
[
  {
    "line": 10,
    "column": 5,
    "type": "missing-end-tag",
    "message": "Missing closing tag for <span>",
    "severity": "error"
  }
]
```

---

## Error Objects

### Error Response

Standard error response format.

```json
{
  "httpStatus": 404,
  "httpStatusText": "Not Found",
  "error": "page_not_found",
  "message": "Page 'NonexistentPage' does not exist."
}
```

**Fields:**

| Field          | Type    | Description                  |
| -------------- | ------- | ---------------------------- |
| httpStatus     | integer | HTTP status code             |
| httpStatusText | string  | HTTP status text             |
| error          | string  | Machine-readable error code  |
| message        | string  | Human-readable error message |

**Common error codes:**

- `page_not_found` (404)
- `bad_request` (400)
- `unauthorized` (401)
- `forbidden` (403)
- `conflict` (409)
- `internal_error` (500)

---

## Response Envelope

Most API responses follow this envelope:

```json
{
  "batchRequests": [...],
  "success": true
}
```

Or for single item:

```json
{
  "id": 123,
  "title": "Example",
  "success": true
}
```

---

## Comparing Endpoint Responses

Different endpoint variants return different fields:

| Endpoint     | Includes            | Size   | Speed  |
| ------------ | ------------------- | ------ | ------ |
| `/bare`      | id, key, title      | ~1KB   | ⭐⭐⭐ |
| `/` (source) | all + source        | ~50KB  | ⭐⭐   |
| `/html`      | all + html          | ~100KB | ⭐     |
| `/with_html` | all + source + html | ~150KB | ⭐     |

**Recommendation:**

- Use `/bare` for checking existence
- Use `/` for programmatic processing
- Use `/html` for display
- Use `/with_html` only when both needed

---

## Type Mappings

### JavaScript/TypeScript

```typescript
interface Page {
  id: number;
  key: string;
  title: string;
  latest: { id: number; timestamp: string };
  content_model: string;
  license: { url: string; title: string };
  source?: string;
  html?: string;
}

interface Revision {
  id: number;
  timestamp: string;
  minor: boolean;
  size: number;
  comment: string | null;
  user: { id: number; name: string } | null;
  delta: number;
}

interface SearchResult {
  id: number;
  key: string;
  title: string;
  excerpt: string;
  description: string;
  thumbnail: { url: string; width: number; height: number };
}
```

### Python

```python
from typing import Dict, List, Optional
from dataclasses import dataclass
from datetime import datetime

@dataclass
class License:
    url: str
    title: str

@dataclass
class Revision:
    id: int
    timestamp: str
    minor: bool
    size: int
    comment: Optional[str]
    user: Optional[Dict[str, any]]
    delta: int

@dataclass
class Page:
    id: int
    key: str
    title: str
    latest: Dict[str, any]
    content_model: str
    license: License
    source: Optional[str] = None
    html: Optional[str] = None
```

### Rust

```rust
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct Page {
    pub id: u64,
    pub key: String,
    pub title: String,
    pub latest: RevisionInfo,
    pub content_model: String,
    pub license: License,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub html: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct Revision {
    pub id: u64,
    pub timestamp: String,
    pub minor: bool,
    pub size: u64,
    pub comment: Option<String>,
    pub user: Option<User>,
    pub delta: i64,
}

#[derive(Serialize, Deserialize)]
pub struct License {
    pub url: String,
    pub title: String,
}
```

### Go

```go
type Page struct {
    ID           int64       `json:"id"`
    Key          string      `json:"key"`
    Title        string      `json:"title"`
    Latest       RevisionRef `json:"latest"`
    ContentModel string      `json:"content_model"`
    License      License     `json:"license"`
    Source       *string     `json:"source,omitempty"`
    HTML         *string     `json:"html,omitempty"`
}

type Revision struct {
    ID        int64       `json:"id"`
    Timestamp string      `json:"timestamp"`
    Minor     bool        `json:"minor"`
    Size      int64       `json:"size"`
    Comment   *string     `json:"comment"`
    User      *User       `json:"user"`
    Delta     int64       `json:"delta"`
}

type License struct {
    URL   string `json:"url"`
    Title string `json:"title"`
}
```

---

## Best Practices

1. **Always check for null values** - User field can be null for deleted users
2. **Handle optional fields** - source/html not always present
3. **Use proper types** - Timestamps are strings, not Unix timestamps
4. **Map keys are URLs** - Page keys use underscores for spaces
5. **Validate content model** - Most pages are "wikitext", but others exist

---

**Last Updated:** 2024
**API Documentation:** https://en.wikipedia.org/w/rest.php/specs/v0/module/-
