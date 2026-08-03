# Real-World Examples and Recipes

Complete, working examples for common Wikipedia REST API tasks in JavaScript, Python, Rust, and Go.

## 1. Read an Article with Metadata

**Goal:** Fetch a Wikipedia article with title, content, edit info, and images.

### JavaScript

```javascript
async function getArticleWithMetadata(title) {
  const baseUrl = "https://en.wikipedia.org/w/rest.php/v1";

  try {
    // Fetch page with both source and HTML
    const pageResponse = await fetch(
      `${baseUrl}/page/${encodeURIComponent(title)}/with_html`,
    );

    if (!pageResponse.ok) {
      throw new Error(`HTTP ${pageResponse.status}: Page not found`);
    }

    const page = await pageResponse.json();

    // Fetch images used in the page
    const mediaResponse = await fetch(
      `${baseUrl}/page/${encodeURIComponent(title)}/links/media`,
    );
    const media = mediaResponse.ok ? await mediaResponse.json() : { media: [] };

    // Fetch language versions
    const langResponse = await fetch(
      `${baseUrl}/page/${encodeURIComponent(title)}/links/language`,
    );
    const languages = langResponse.ok
      ? await langResponse.json()
      : { languages: [] };

    return {
      title: page.title,
      pageId: page.id,
      url: `https://en.wikipedia.org/wiki/${page.key}`,
      content: page.source,
      html: page.html,
      images: media.media || [],
      languages: languages.languages || [],
      lastEdited: page.latest.timestamp,
      license: page.license.title,
    };
  } catch (error) {
    console.error("Error fetching article:", error);
    throw error;
  }
}

// Usage
getArticleWithMetadata("Albert Einstein").then((article) => {
  console.log(`Title: ${article.title}`);
  console.log(`Images: ${article.images.length}`);
  console.log(
    `Available in: ${article.languages.map((l) => l.lang).join(", ")}`,
  );
});
```

### Python

```python
import requests
import json
from typing import Dict, Any

def get_article_with_metadata(title: str) -> Dict[str, Any]:
    """Fetch Wikipedia article with metadata."""
    base_url = 'https://en.wikipedia.org/w/rest.php/v1'

    try:
        # Fetch page with both source and HTML
        page_response = requests.get(
            f'{base_url}/page/{title}/with_html'
        )
        page_response.raise_for_status()
        page = page_response.json()

        # Fetch images
        media_response = requests.get(
            f'{base_url}/page/{title}/links/media'
        )
        media = media_response.json() if media_response.ok else {'media': []}

        # Fetch language versions
        lang_response = requests.get(
            f'{base_url}/page/{title}/links/language'
        )
        languages = lang_response.json() if lang_response.ok else {'languages': []}

        return {
            'title': page['title'],
            'page_id': page['id'],
            'url': f"https://en.wikipedia.org/wiki/{page['key']}",
            'content': page['source'],
            'html': page['html'],
            'images': media.get('media', []),
            'languages': languages.get('languages', []),
            'last_edited': page['latest']['timestamp'],
            'license': page['license']['title']
        }
    except requests.exceptions.RequestException as e:
        print(f'Error fetching article: {e}')
        raise

# Usage
article = get_article_with_metadata('Albert Einstein')
print(f"Title: {article['title']}")
print(f"Images: {len(article['images'])}")
print(f"Languages: {', '.join(l['lang'] for l in article['languages'])}")
```

### Rust

```rust
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::error::Error;

#[derive(Serialize, Deserialize, Debug)]
struct Article {
    title: String,
    page_id: u64,
    url: String,
    images: Vec<String>,
    languages: Vec<String>,
    last_edited: String,
    license: String,
}

async fn get_article_with_metadata(title: &str) -> Result<Article, Box<dyn Error>> {
    let client = Client::new();
    let base_url = "https://en.wikipedia.org/w/rest.php/v1";

    // Fetch page
    let page: serde_json::Value = client
        .get(&format!("{}/page/{}/with_html", base_url, title))
        .send()
        .await?
        .json()
        .await?;

    // Fetch media
    let media_resp = client
        .get(&format!("{}/page/{}/links/media", base_url, title))
        .send()
        .await;

    let media: Vec<String> = if let Ok(resp) = media_resp {
        if let Ok(data) = resp.json::<serde_json::Value>().await {
            data.get("media")
                .and_then(|m| m.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.get("title").and_then(|t| t.as_str()).map(|s| s.to_string())).collect())
                .unwrap_or_default()
        } else {
            vec![]
        }
    } else {
        vec![]
    };

    Ok(Article {
        title: page["title"].as_str().unwrap_or("").to_string(),
        page_id: page["id"].as_u64().unwrap_or(0),
        url: format!("https://en.wikipedia.org/wiki/{}", page["key"].as_str().unwrap_or("")),
        images: media,
        languages: vec![],
        last_edited: page["latest"]["timestamp"].as_str().unwrap_or("").to_string(),
        license: page["license"]["title"].as_str().unwrap_or("").to_string(),
    })
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let article = get_article_with_metadata("Albert Einstein").await?;
    println!("Title: {}", article.title);
    Ok(())
}
```

### Go

```go
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type Article struct {
	Title      string   `json:"title"`
	PageID     int64    `json:"page_id"`
	URL        string   `json:"url"`
	Images     []string `json:"images"`
	Languages  []string `json:"languages"`
	LastEdited string   `json:"last_edited"`
	License    string   `json:"license"`
}

func getArticleWithMetadata(title string) (*Article, error) {
	baseURL := "https://en.wikipedia.org/w/rest.php/v1"
	client := &http.Client{}

	// Fetch page
	resp, err := client.Get(fmt.Sprintf("%s/page/%s/with_html", baseURL, title))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var page map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&page)

	// Fetch media
	mediaResp, _ := client.Get(fmt.Sprintf("%s/page/%s/links/media", baseURL, title))
	defer mediaResp.Body.Close()

	article := &Article{
		Title: page["title"].(string),
		URL: fmt.Sprintf("https://en.wikipedia.org/wiki/%s", page["key"]),
	}

	return article, nil
}

func main() {
	article, err := getArticleWithMetadata("Albert Einstein")
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	fmt.Printf("Title: %s\n", article.Title)
}
```

---

## 2. Search Wikipedia and Display Results

**Goal:** Search for articles and display results with previews and images.

### JavaScript

```javascript
async function searchWikipedia(query, limit = 10) {
  const baseUrl = "https://en.wikipedia.org/w/rest.php/v1";

  try {
    const response = await fetch(
      `${baseUrl}/search/page?q=${encodeURIComponent(query)}&limit=${limit}`,
    );

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    const results = await response.json();

    return {
      query: query,
      resultCount: results.pages.length,
      results: results.pages.map((page) => ({
        title: page.title,
        excerpt: page.excerpt.replace(/<[^>]*>/g, ""), // Remove HTML tags
        url: `https://en.wikipedia.org/wiki/${page.key}`,
        image: page.thumbnail?.url || null,
        pageId: page.id,
      })),
    };
  } catch (error) {
    console.error("Search error:", error);
    throw error;
  }
}

// Usage - Display results
async function displaySearchResults() {
  const results = await searchWikipedia("machine learning", 5);

  results.results.forEach((result) => {
    console.log(`\n${result.title}`);
    console.log(`${result.excerpt.substring(0, 100)}...`);
    if (result.image) console.log(`Image: ${result.image}`);
    console.log(`Link: ${result.url}`);
  });
}

displaySearchResults();
```

### Python

```python
import requests
from typing import List, Dict, Any
import re

def search_wikipedia(query: str, limit: int = 10) -> Dict[str, Any]:
    """Search Wikipedia and return results with metadata."""
    base_url = 'https://en.wikipedia.org/w/rest.php/v1'

    try:
        response = requests.get(
            f'{base_url}/search/page',
            params={'q': query, 'limit': limit}
        )
        response.raise_for_status()
        results = response.json()

        return {
            'query': query,
            'result_count': len(results['pages']),
            'results': [
                {
                    'title': page['title'],
                    'excerpt': re.sub('<[^>]*>', '', page['excerpt']),
                    'url': f"https://en.wikipedia.org/wiki/{page['key']}",
                    'image': page['thumbnail']['url'] if page['thumbnail'] else None,
                    'page_id': page['id']
                }
                for page in results['pages']
            ]
        }
    except requests.exceptions.RequestException as e:
        print(f'Search error: {e}')
        raise

# Usage
results = search_wikipedia('quantum computing', 5)
print(f"Found {results['result_count']} results for '{results['query']}':\n")

for result in results['results']:
    print(f"• {result['title']}")
    print(f"  {result['excerpt'][:100]}...")
    print(f"  {result['url']}\n")
```

### Rust

```rust
use reqwest::Client;
use serde_json::Value;

async fn search_wikipedia(query: &str, limit: u32) -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let client = Client::new();
    let base_url = "https://en.wikipedia.org/w/rest.php/v1";

    let response = client
        .get(&format!("{}/search/page", base_url))
        .query(&[("q", query), ("limit", &limit.to_string())])
        .send()
        .await?;

    let data: Value = response.json().await?;

    let results: Vec<String> = data["pages"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|page| {
            Some(format!(
                "{} - {}",
                page["title"].as_str()?,
                page["excerpt"].as_str()?
            ))
        })
        .collect();

    Ok(results)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let results = search_wikipedia("machine learning", 5).await?;
    for result in results {
        println!("{}", result);
    }
    Ok(())
}
```

### Go

```go
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
)

func searchWikipedia(query string, limit int) ([]map[string]interface{}, error) {
	baseURL := "https://en.wikipedia.org/w/rest.php/v1/search/page"

	params := url.Values{}
	params.Add("q", query)
	params.Add("limit", fmt.Sprintf("%d", limit))

	resp, err := http.Get(baseURL + "?" + params.Encode())
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	pages := result["pages"].([]interface{})
	results := make([]map[string]interface{}, len(pages))

	for i, p := range pages {
		results[i] = p.(map[string]interface{})
	}

	return results, nil
}

func main() {
	results, _ := searchWikipedia("machine learning", 5)
	for _, result := range results {
		fmt.Printf("• %v\n", result["title"])
	}
}
```

---

## 3. Edit a Wikipedia Page

**Goal:** Update Wikipedia page content with proper error handling (requires OAuth2).

### JavaScript

```javascript
async function editWikipediaPage(title, newContent, editSummary, accessToken) {
  const baseUrl = "https://en.wikipedia.org/w/rest.php/v1";

  try {
    // First, get current version for conflict detection
    const currentResponse = await fetch(
      `${baseUrl}/page/${encodeURIComponent(title)}`,
    );

    if (!currentResponse.ok) {
      throw new Error(`Page not found: ${title}`);
    }

    const current = await currentResponse.json();
    const etag = currentResponse.headers.get("etag");

    // Update the page
    const updateResponse = await fetch(
      `${baseUrl}/page/${encodeURIComponent(title)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "If-Match": etag || "",
        },
        body: JSON.stringify({
          source: newContent,
          comment: editSummary,
          if_match: etag,
        }),
      },
    );

    if (updateResponse.status === 409) {
      throw new Error("Edit conflict - page was modified by someone else");
    }

    if (!updateResponse.ok) {
      throw new Error(`Update failed: ${updateResponse.status}`);
    }

    const result = await updateResponse.json();

    return {
      success: true,
      newRevisionId: result.latest.id,
      timestamp: result.latest.timestamp,
    };
  } catch (error) {
    console.error("Edit error:", error);
    throw error;
  }
}

// Usage
editWikipediaPage(
  "User:MyBot/Sandbox",
  "== New Section ==\nUpdated content here",
  "Updated with new information",
  "your_oauth2_token",
)
  .then((result) => {
    console.log(`Edit successful! Revision: ${result.newRevisionId}`);
  })
  .catch((error) => {
    console.error(`Edit failed: ${error}`);
  });
```

### Python

```python
import requests
from typing import Dict, Any

def edit_wikipedia_page(
    title: str,
    new_content: str,
    edit_summary: str,
    access_token: str
) -> Dict[str, Any]:
    """Edit a Wikipedia page."""
    base_url = 'https://en.wikipedia.org/w/rest.php/v1'

    try:
        # Get current version
        current_response = requests.get(f'{base_url}/page/{title}')
        if not current_response.ok:
            raise Exception(f'Page not found: {title}')

        current = current_response.json()
        etag = current_response.headers.get('ETag')

        # Update page
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json',
            'If-Match': etag or ''
        }

        update_response = requests.put(
            f'{base_url}/page/{title}',
            headers=headers,
            json={
                'source': new_content,
                'comment': edit_summary,
                'if_match': etag
            }
        )

        if update_response.status_code == 409:
            raise Exception('Edit conflict - page was modified')

        if not update_response.ok:
            raise Exception(f'Update failed: {update_response.status_code}')

        result = update_response.json()
        return {
            'success': True,
            'new_revision_id': result['latest']['id'],
            'timestamp': result['latest']['timestamp']
        }
    except Exception as e:
        print(f'Edit error: {e}')
        raise

# Usage
result = edit_wikipedia_page(
    'User:MyBot/Sandbox',
    '== New Section ==\nUpdated content',
    'Updated information',
    'your_oauth2_token'
)
print(f"Edit successful! New revision: {result['new_revision_id']}")
```

### Rust & Go versions follow similar patterns with proper error handling...

---

## 4. Convert Between Wikitext and HTML

**Goal:** Transform content between wikitext (edit format) and HTML (display format).

### JavaScript

```javascript
async function convertWikitextToHtml(wikitext, title = null) {
  const baseUrl = "https://en.wikipedia.org/w/rest.php/v1";

  const endpoint = title
    ? `${baseUrl}/transform/wikitext/to/html/${encodeURIComponent(title)}`
    : `${baseUrl}/transform/wikitext/to/html`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wikitext }),
  });

  const data = await response.json();
  return data.html;
}

async function convertHtmlToWikitext(html, title = null) {
  const baseUrl = "https://en.wikipedia.org/w/rest.php/v1";

  const endpoint = title
    ? `${baseUrl}/transform/html/to/wikitext/${encodeURIComponent(title)}`
    : `${baseUrl}/transform/html/to/wikitext`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html }),
  });

  const data = await response.json();
  return data.wikitext;
}

// Usage
const wikitext =
  "== Section ==\nThis is '''bold''' text\n[[Link|Display text]]";
const html = await convertWikitextToHtml(wikitext);
console.log(html); // <h2>Section</h2><p>This is <b>bold</b> text...</p>
```

### Python

```python
import requests
import json

def convert_wikitext_to_html(wikitext: str, title: str = None) -> str:
    """Convert wikitext to HTML."""
    base_url = 'https://en.wikipedia.org/w/rest.php/v1'

    if title:
        endpoint = f'{base_url}/transform/wikitext/to/html/{title}'
    else:
        endpoint = f'{base_url}/transform/wikitext/to/html'

    response = requests.post(
        endpoint,
        json={'wikitext': wikitext}
    )

    return response.json()['html']

def convert_html_to_wikitext(html: str, title: str = None) -> str:
    """Convert HTML to wikitext."""
    base_url = 'https://en.wikipedia.org/w/rest.php/v1'

    if title:
        endpoint = f'{base_url}/transform/html/to/wikitext/{title}'
    else:
        endpoint = f'{base_url}/transform/html/to/wikitext'

    response = requests.post(
        endpoint,
        json={'html': html}
    )

    return response.json()['wikitext']

# Usage
wikitext = "== Section ==\nThis is '''bold''' text"
html = convert_wikitext_to_html(wikitext)
print(html)
```

---

## 5. Get Page History and Statistics

**Goal:** Retrieve page edit history with filtering and pagination.

### JavaScript

```javascript
async function getPageHistory(title, filters = {}) {
  const baseUrl = "https://en.wikipedia.org/w/rest.php/v1";
  const params = new URLSearchParams();

  if (filters.olderThan) params.append("older_than", filters.olderThan);
  if (filters.newerThan) params.append("newer_than", filters.newerThan);
  if (filters.type) params.append("filter", filters.type);

  const response = await fetch(
    `${baseUrl}/page/${encodeURIComponent(title)}/history?${params}`,
  );

  const history = await response.json();

  return {
    title: title,
    totalRevisions: history.revisions.length,
    latestRevision: history.latest.id,
    revisions: history.revisions.map((rev) => ({
      id: rev.id,
      timestamp: new Date(rev.timestamp),
      author: rev.user?.name || "anonymous",
      summary: rev.comment,
      sizeBytes: rev.size,
      delta: rev.delta,
      isMinor: rev.minor,
    })),
  };
}

async function getPageEditStats(title) {
  const baseUrl = "https://en.wikipedia.org/w/rest.php/v1";

  const [total, bots, anonymous] = await Promise.all([
    fetch(`${baseUrl}/page/${title}/history/counts/edits`)
      .then((r) => r.json())
      .then((d) => d.count),
    fetch(`${baseUrl}/page/${title}/history/counts/bot_edits`)
      .then((r) => r.json())
      .then((d) => d.count),
    fetch(`${baseUrl}/page/${title}/history/counts/anonymous_edits`)
      .then((r) => r.json())
      .then((d) => d.count),
  ]);

  return {
    totalEdits: total,
    botEdits: bots,
    anonymousEdits: anonymous,
    humanEdits: total - bots - anonymous,
  };
}

// Usage
const history = await getPageHistory("Berlin");
console.log(`Page has ${history.totalRevisions} revisions`);

const stats = await getPageEditStats("Berlin");
console.log(`Total edits: ${stats.totalEdits}`);
console.log(`Bot edits: ${stats.botEdits}`);
```

---

## 6. Compare Two Revisions

**Goal:** Show differences between two page versions.

### JavaScript

```javascript
async function compareRevisions(revisionId1, revisionId2) {
  const baseUrl = "https://en.wikipedia.org/w/rest.php/v1";

  const response = await fetch(
    `${baseUrl}/revision/${revisionId1}/compare/${revisionId2}`,
  );

  const diff = await response.json();

  return {
    from: revisionId1,
    to: revisionId2,
    diff: diff.diff,
    fromSize: diff.from.size,
    toSize: diff.to.size,
    sizeDelta: diff.to.size - diff.from.size,
  };
}

// Usage
const diff = await compareRevisions(1234567, 1234568);
console.log(`Size change: ${diff.sizeDelta} bytes`);
```

---

## 7. Validate Wikitext with Linting

**Goal:** Check wikitext for errors and warnings.

### JavaScript

```javascript
async function lintWikitext(wikitext, title = null) {
  const baseUrl = "https://en.wikipedia.org/w/rest.php/v1";

  const endpoint = title
    ? `${baseUrl}/transform/wikitext/to/lint/${encodeURIComponent(title)}`
    : `${baseUrl}/transform/wikitext/to/lint`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wikitext }),
  });

  const issues = await response.json();

  return {
    issueCount: issues.length,
    errors: issues.filter((i) => i.severity === "error"),
    warnings: issues.filter((i) => i.severity === "warning"),
    issues: issues,
  };
}

// Usage
const result = await lintWikitext("== Section ==\nMissing closing tag here");
console.log(
  `Found ${result.errors.length} errors, ${result.warnings.length} warnings`,
);

result.errors.forEach((error) => {
  console.log(`Line ${error.line}: ${error.message}`);
});
```

---

## 8. OAuth2 Authentication Flow

**Goal:** Complete OAuth2 flow for user authorization.

### JavaScript

```javascript
class WikipediaOAuth2 {
  constructor(clientId, clientSecret, redirectUri) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.baseUrl = "https://en.wikipedia.org/w/rest.php";
  }

  getAuthorizationUrl() {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: "edit",
    });
    return `${this.baseUrl}/oauth2/authorize?${params}`;
  }

  async exchangeCodeForToken(code) {
    const response = await fetch(`${this.baseUrl}/oauth2/access_token`, {
      method: "POST",
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: this.redirectUri,
      }),
    });

    return response.json();
  }

  async refreshToken(refreshToken) {
    const response = await fetch(`${this.baseUrl}/oauth2/access_token`, {
      method: "POST",
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    return response.json();
  }
}

// Usage
const oauth = new WikipediaOAuth2(
  "client_id",
  "client_secret",
  "https://myapp.com/callback",
);

// Step 1: Redirect user
console.log(oauth.getAuthorizationUrl());

// Step 2: In callback endpoint
const tokenData = await oauth.exchangeCodeForToken(authCode);
console.log(`Access token: ${tokenData.access_token}`);
```

---

## 9. Batch Operations - Fetch Multiple Articles

**Goal:** Efficiently fetch multiple articles.

### JavaScript

```javascript
async function getMultipleArticles(titles) {
  const baseUrl = "https://en.wikipedia.org/w/rest.php/v1";

  const requests = titles.map((title) =>
    fetch(`${baseUrl}/page/${encodeURIComponent(title)}/bare`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  );

  const results = await Promise.all(requests);

  return titles.map((title, i) => ({
    title: title,
    data: results[i],
    found: results[i] !== null,
  }));
}

// Usage with concurrency limit
async function getMultipleArticlesWithLimit(titles, limit = 5) {
  const results = [];

  for (let i = 0; i < titles.length; i += limit) {
    const batch = titles.slice(i, i + limit);
    const batchResults = await getMultipleArticles(batch);
    results.push(...batchResults);
  }

  return results;
}

// Usage
const articles = await getMultipleArticlesWithLimit(
  ["Python", "JavaScript", "Rust", "Go", "Java"],
  3,
);

articles.forEach((article) => {
  console.log(`${article.title}: ${article.found ? "found" : "not found"}`);
});
```

---

## 10. Create an Article Cache with TTL

**Goal:** Cache Wikipedia articles with time-to-live.

### JavaScript

```javascript
class WikipediaCache {
  constructor(ttlSeconds = 3600) {
    this.cache = new Map();
    this.ttl = ttlSeconds * 1000;
  }

  set(key, value) {
    this.cache.set(key, {
      value: value,
      expires: Date.now() + this.ttl,
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  clear() {
    this.cache.clear();
  }
}

class CachedWikipediaClient {
  constructor(ttlSeconds = 3600) {
    this.cache = new WikipediaCache(ttlSeconds);
    this.baseUrl = "https://en.wikipedia.org/w/rest.php/v1";
  }

  async getPage(title) {
    const cached = this.cache.get(`page:${title}`);
    if (cached) {
      console.log(`Cache hit: ${title}`);
      return cached;
    }

    console.log(`Fetching: ${title}`);
    const response = await fetch(
      `${this.baseUrl}/page/${encodeURIComponent(title)}/bare`,
    );

    if (!response.ok) return null;

    const page = await response.json();
    this.cache.set(`page:${title}`, page);
    return page;
  }
}

// Usage
const client = new CachedWikipediaClient(60); // 1 minute TTL

await client.getPage("Berlin"); // Fetches from API
await client.getPage("Berlin"); // Returns from cache
await new Promise((r) => setTimeout(r, 61000));
await client.getPage("Berlin"); // Fetches again (cache expired)
```

---

## More Resources

- **Full API Reference:** See `core-apis.md` for all v1 endpoints
- **Extensions:** See `extensions.md` for specialized APIs
- **Error Handling:** See `error-handling.md` for troubleshooting
- **Best Practices:** See `best-practices.md` for optimization tips

---

**Last Updated:** 2024
**API Documentation:** https://en.wikipedia.org/w/rest.php/specs/v0/module/-
