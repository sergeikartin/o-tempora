# Extension APIs Reference

Wikipedia REST API includes specialized endpoints for extensions beyond the core v1 APIs. These are organized by extension module, with 43 endpoints total.

**Base URL:** `https://en.wikipedia.org/w/rest.php`

## Extension Categories

- [Campaign Events](#campaign-events) (13 endpoints)
- [Growth Experiments](#growth-experiments) (9 endpoints)
- [CheckUser](#checkuser) (6 endpoints)
- [OAuth2](#oauth2) (5 endpoints)
- [IP Info](#ip-info) (4 endpoints)
- [Other Extensions](#other-extensions) (6 endpoints)

---

## Campaign Events

Campaign management and event registration APIs for coordinating community initiatives and editing campaigns.

**Base URL:** `/campaignevents/v0`

### Event Registration Management

- **POST** `/campaignevents/v0/event_registration` - Create new event registration
- **GET** `/campaignevents/v0/event_registration` - List event registrations
- **GET** `/campaignevents/v0/event_registration/{id}` - Get specific event
- **PUT** `/campaignevents/v0/event_registration/{id}` - Update event
- **DELETE** `/campaignevents/v0/event_registration/{id}` - Delete event

### Event Participation

- **GET** `/campaignevents/v0/event_registration/{id}/participants` - List participants
- **GET** `/campaignevents/v0/event_registration/{id}/participants/self` - Get current user's participation
- **POST** `/campaignevents/v0/event_registration/{id}/participants` - Join event
- **GET** `/campaignevents/v0/participant/{userid}/event_registrations` - Events for user

### Event Organizers

- **GET** `/campaignevents/v0/event_registration/{id}/organizers` - List organizers
- **GET** `/campaignevents/v0/organizer/{userid}/event_registrations` - Events organized by user

### Event Utilities

- **GET** `/campaignevents/v0/event_registration/{id}/email` - Get event email
- **GET** `/campaignevents/v0/event_registration/{id}/edits/{wiki}/{revid}` - Get edit information
- **GET** `/campaignevents/v0/formatted_time/{languageCode}/{start}/{end}` - Format dates for language
- **POST** `/campaignevents/v0/participant_questions` - Manage participant questions

### Event Contributions

- **GET** `/campaignevents/v0/event_contributions/{id}` - Get event contribution data

**Authentication:** Required (OAuth2) for POST/PUT/DELETE operations

**Use cases:**

- Coordinate editing campaigns and events
- Track contributor participation
- Manage editor groups and initiatives
- Report on event statistics

---

## Growth Experiments

APIs for supporting new editor onboarding and structured task suggestions through the Growth Experiments extension.

**Base URL:** `/growthexperiments/v0`

### Mentorship

- **GET** `/growthexperiments/v0/mentees` - List mentees
- **POST** `/growthexperiments/v0/mentees` - Add mentee relationship
- **GET** `/growthexperiments/v0/mentees/prefixsearch/{prefix}` - Search mentees

### Newcomer Tasks

- **GET** `/growthexperiments/v0/newcomertask/complete` - Mark task complete
- **POST** `/growthexperiments/v0/newcomertask/complete` - Submit task completion

### Suggested Edits

- **GET** `/growthexperiments/v0/suggestions/addimage/feedback/{title}` - Get feedback on image suggestions
- **POST** `/growthexperiments/v0/suggestions/addimage/feedback/{title}` - Submit image suggestion feedback
- **GET** `/growthexperiments/v0/suggestions/addlink/{title}` - Get link suggestions
- **GET** `/growthexperiments/v0/suggestions/info` - Get suggestions info

### User Impact

- **GET** `/growthexperiments/v0/user-impact/{user}` - Get user's contribution impact

### Welcome Survey

- **POST** `/growthexperiments/v0/welcomesurvey/skip` - Skip welcome survey

### UI Configuration

- **GET** `/growthexperiments/v0/quickstarttips/{skin}/{editor}/{tasktypeid}/{uselang}` - Get quick start tips

**Use cases:**

- Support newcomer editors with guided tasks
- Suggest improvements to articles
- Track contributor growth and impact
- Manage mentor-mentee relationships

---

## CheckUser

APIs for user investigation and IP analysis tools (administrative features).

**Base URL:** `/checkuser/v0`

### User Information

- **GET** `/checkuser/v0/userinfo` - Get current user information
- **GET** `/checkuser/v0/temporaryaccount/{name}` - Get temporary account info
- **GET** `/checkuser/v0/temporaryaccount/ip/{ip}` - Get account from IP

### Investigation Features

- **GET** `/checkuser/v0/batch-temporaryaccount` - Batch temporary account lookup
- **GET** `/checkuser/v0/useragent-clienthints/{type}/{id}` - Get client hints

### Case Management

- **GET** `/checkuser/v0/suggestedinvestigations/case/{caseId}/update` - Get case updates

**Requirements:** Admin/CheckUser privileges required

**Use cases:**

- Investigate suspicious accounts
- Track IP addresses
- Manage abuse cases
- Analyze user agent information

---

## OAuth2

OAuth2 authentication endpoints for application integration and user authorization.

**Base URL:** `/oauth2`

### Client Management

- **POST** `/oauth2/client` - Register OAuth2 client
- **GET** `/oauth2/client/{id}` - Get client information
- **POST** `/oauth2/client/{id}/reset_secret` - Reset client secret

### Authorization

- **GET** `/oauth2/authorize` - Request user authorization
- **POST** `/oauth2/access_token` - Exchange code for token

**Use cases:**

- Authenticate Wikipedia editor accounts
- Build integrated tools requiring user login
- Implement secure bot operations
- Create cross-wiki applications

**Flow:**

1. Register application to get client ID/secret
2. Redirect user to `/oauth2/authorize` endpoint
3. User grants permission
4. Exchange authorization code for access token
5. Use token in Authorization header for requests

**Example:**

```javascript
// OAuth2 flow
const clientId = "YOUR_CLIENT_ID";
const redirectUri = "https://yourapp.com/callback";

// Step 1: Redirect to authorization
const authUrl = new URL("https://en.wikipedia.org/w/rest.php/oauth2/authorize");
authUrl.searchParams.append("client_id", clientId);
authUrl.searchParams.append("redirect_uri", redirectUri);
authUrl.searchParams.append("response_type", "code");
window.location.href = authUrl.toString();

// Step 2: In callback endpoint, exchange code
const code = urlParams.get("code");
const tokenResponse = await fetch(
  "https://en.wikipedia.org/w/rest.php/oauth2/access_token",
  {
    method: "POST",
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: "YOUR_SECRET",
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirectUri,
    }),
  },
);

const tokenData = await tokenResponse.json();
const accessToken = tokenData.access_token;
```

---

## IP Info

APIs for IP address geolocation and information.

**Base URL:** `/ipinfo/v0`

### IP Analysis

- **GET** `/ipinfo/v0/revision/{revid}` - Get IP info for revision
- **GET** `/ipinfo/v0/norevision/{ip}` - Get info for IP without revision
- **GET** `/ipinfo/v0/log/{logid}` - Get IP info from log

### Archival

- **GET** `/ipinfo/v0/archivedrevision/{archiveid}` - Get archived revision IP info

**Use cases:**

- Geolocate edits
- Analyze IP information
- Track contributions by location
- Investigate vandalism patterns

---

## Other Extensions

Miscellaneous extension endpoints for specialized features.

### Math Rendering

- **GET** `/math/v0/popup/html/{formula}` - Render mathematical formula to HTML

### Flagged Revisions

- **GET** `/flaggedrevs/internal/diffheader/{oldId}/{newId}` - Get diff header
- **GET** `/flaggedrevs/internal/review/{target}` - Get review information

### Wikimedia Campaign Events

- **GET** `/wikimediacampaignevents/v0/*` - Wikimedia-specific campaign features

### SecurePoll

- **POST** `/securepoll/v0/poll/{pollId}/vote` - Vote in poll
- **GET** `/securepoll/v0/poll/{pollId}` - Get poll information

### EventBus

- **POST** `/eventbus/v0/internal/job/execute` - Execute internal job

**Use cases:**

- Render mathematical formulas
- Access flagged revision system
- Participate in polls and surveys
- Publish internal events

---

## Common Extension Patterns

### Authentication

Most extension APIs that modify data (POST, PUT, DELETE) require OAuth2 authentication:

```javascript
const headers = {
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json",
};

await fetch(endpoint, {
  method: "POST",
  headers: headers,
  body: JSON.stringify(data),
});
```

### Error Responses

Extensions follow consistent error patterns:

```json
{
  "error": "error_code",
  "message": "Human readable error message"
}
```

### Response Format

All extension APIs return JSON with consistent structure:

```json
{
  "data": {
    /* actual response */
  },
  "metadata": {
    /* optional metadata */
  }
}
```

---

## Authentication Requirements

| Extension          | Read | Write | Auth Required       |
| ------------------ | ---- | ----- | ------------------- |
| Campaign Events    | ✓    | ✓     | POST/PUT/DELETE     |
| Growth Experiments | ✓    | ✓     | Varies              |
| CheckUser          | ✓    | -     | Admin only          |
| OAuth2             | ✓    | ✓     | N/A (auth endpoint) |
| IP Info            | ✓    | -     | Public              |
| Math               | ✓    | -     | No                  |
| Flagged Revisions  | ✓    | ✓     | Varies              |
| SecurePoll         | ✓    | ✓     | Varies              |
| EventBus           | -    | ✓     | Internal only       |

---

## Rate Limiting

All extension APIs are subject to rate limiting. Monitor response headers:

- `X-RateLimit-Limit` - Maximum requests per window
- `X-RateLimit-Remaining` - Requests remaining
- `X-RateLimit-Reset` - When limit resets (Unix timestamp)

Implement exponential backoff when rate limited (HTTP 429).

---

## Best Practices for Extensions

1. **Cache extension responses** - Many extension endpoints have low change frequency
2. **Use batch endpoints** - When available (e.g., `batch-temporaryaccount`)
3. **Handle optional fields** - Extension responses may have optional fields
4. **Monitor deprecations** - Extension APIs may be updated more frequently
5. **Test on Beta** - Use test.wikipedia.org to test integrations

---

## Getting Extension-Specific Help

- **Campaign Events:** https://www.mediawiki.org/wiki/CampaignEvents
- **Growth Experiments:** https://www.mediawiki.org/wiki/Extension:GrowthExperiments
- **CheckUser:** https://www.mediawiki.org/wiki/Extension:CheckUser
- **More:** https://www.mediawiki.org/wiki/Category:Extensions

---

**Last Updated:** 2024
**API Documentation:** https://en.wikipedia.org/w/rest.php/specs/v0/module/-
