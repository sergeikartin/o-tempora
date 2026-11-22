---
status: accepted
---

# Selection navigation owns target resolution

Entity Links resolved missing slugs as data arrived. Connections relied on Profile prefetch and could ignore a click made before the target dataset loaded.

The app's Selection navigation module owns target lookup, Detail Level changes and the choice of viewport movement. It uses the Selection feature for URL and history changes and the dataset loader for progressive loading. Entity Links fit the target span. Connections keep the source open while loading, then pan at the current zoom and push a history entry. Back, another pick or closing the panel supersedes a pending Connection.
