# Design: Search-to-Stream Speed Optimizations + Lyrics Removal

**Date:** 2026-03-22
**Status:** Approved

## Goal

Reduce latency from `/play <query>` to audio start for both cold starts (first track) and queue transitions (next track in queue). Also remove all lyrics/Genius code to eliminate unnecessary HTTP calls and simplify the codebase.

## Current Hot Path Analysis

**Cold start (text query, worst case ~8–10 sec):**
1. `YouTube.search()` → yt-dlp `ytsearch1:` → ~1.5–3 sec
2. If duration missing → extra `YouTube.getInfo()` call → +1.5–3 sec (common)
3. `player.connect()` → voice join (sequential, after search) → ~0.5–1 sec
4. `YouTube.getStream()` → yt-dlp CDN URL (sequential, after connect) → ~1.5–3 sec
5. HTTP fetch for direct streaming → ~0.3 sec

**Queue transitions (~1.5–3 sec wasted):**
- `preloadTrack()` downloads the file to disk in background while current track plays
- `play()` for the next track still calls `getStream()` even when the opus file is already on disk
- `sequentialPreload()` processes one track at a time — slow for large queues

---

## Optimizations

### 1. `StreamURLCache` (new `src/StreamURLCache.js`)

Singleton in-memory Map keyed by YouTube watch URL, storing `streamInfo` objects returned by `getStream()`. TTL: 2 hours (conservative vs. YouTube's ~6 hr CDN expiry).

- `get(url)` → returns cached `streamInfo` or `null` if missing/expired
- `set(url, streamInfo)` → stores with timestamp; evicts expired entries on write
- `delete(url)` → explicit invalidation

No interval timer needed — lazy cleanup on each `set()`.

### 2. `YouTube.getStream()` — wrap with cache

Before invoking yt-dlp, check `StreamURLCache.get(url)` **only when `startSeconds === 0`**. Seeks embed a `begin=` offset into the CDN URL — cached URLs from `startSeconds=0` fetches must not be reused for seeks, or the resumed track starts from the wrong position. When `startSeconds > 0`, always call yt-dlp and do not write the result to the cache.

On a cache miss with `startSeconds === 0`: invoke yt-dlp as today and call `StreamURLCache.set(url, result)` before returning.

`preloadTrack()` calls `getStream()` for queued tracks while the current track plays — this write to `StreamURLCache` is automatic. By the time `play()` runs for a queued track, the cache is warm and `getStream()` returns in <1 ms instead of 1.5–3 sec.

### 3. `YouTube.search()` — drop `getInfo()` fallback

Remove the block that calls `getInfo()` when a search result has `duration === 0`. Duration `0` is acceptable — it's cosmetic in the embed and not required for playback.

### 4. `MusicPlayer.play()` — skip `getStream()` when file on disk

Before the `getStream()` call, check if the cached opus file already exists on disk (`audio_cache/track_<md5>.opus` with size > 0) **and `seekMs === 0`**. If it does, skip `getStream()` entirely: set `shouldDownload = false`, set `downloadedFile` to the cached path, and synthesize a minimal `streamInfo` from the track object:

```js
streamInfo = {
    url: null,
    duration: currentTrack.duration || 0,
    bitrate: currentTrack.bitrate || 128,
    type: 'opus',
    canSeek: false,
    httpHeaders: {}
};
```

This satisfies the watchdog, metadata fields, and downstream consumers without a yt-dlp call. For seeks (`seekMs > 0`), always call `getStream()` as today since the cached file must be re-streamed from offset.

### 5. `MusicEmbedManager._processMusic()` — parallel voice connect + stream resolution

The `connect()` call lives in `_processMusic` (line ~77), not in `play.js`. `play()` internally calls `getStream()` which takes 1.5–3 sec. These two operations are independent and can run in parallel.

Change `_processMusic` so that when the player is idle (first track): fire `player.connect()` and `YouTube.getStream(firstTrack.url)` (or the appropriate provider's `getStream`) concurrently with `Promise.all`. Cache the resolved `streamInfo` in `StreamURLCache` so that when `player.play()` runs immediately after, `getStream()` returns from cache instantly.

If `player.connection` already exists (bot already in channel), skip the connect and only call `getStream()` — no change from today's behavior.

### 6. `MusicEmbedManager.sequentialPreload()` → parallel (concurrency 2)

Replace the sequential loop with a simple promise pool that runs 2 preloads at a time. Order doesn't need to be preserved — preloads are background work. Concurrency capped at 2 to avoid hammering yt-dlp.

---

## Lyrics + Genius Removal

All lyrics and Genius API code is removed entirely.

| File | Change |
|------|--------|
| `src/LyricsManager.js` | Delete file |
| `src/MusicPlayer.js` | Remove `LyricsManager` require and all calls |
| `src/MusicEmbedManager.js` | Remove lyrics button from button deck, remove `LyricsManager` import and calls |
| `events/buttonHandler.js` | Remove `lyrics` button case handler |
| `package.json` | Remove `genius-lyrics` dependency |
| `config.js` | Remove `genius: { clientId, clientSecret }` block |
| `docker-compose.example.yml` | Remove `GENIUS_CLIENT_ID` / `GENIUS_CLIENT_SECRET` env vars |

After removal: run `npm install` to regenerate `package-lock.json`.

---

## Files Changed Summary

| File | Type | Change |
|------|------|--------|
| `src/StreamURLCache.js` | New | TTL cache for CDN stream URLs |
| `src/YouTube.js` | Modify | Wrap `getStream()` with cache; drop `getInfo()` in `search()` |
| `src/MusicPlayer.js` | Modify | Skip `getStream()` when file on disk; remove lyrics |
| `src/MusicEmbedManager.js` | Modify | Parallel connect + stream resolve in `_processMusic`; parallel preload (concurrency 2); remove lyrics |
| `events/buttonHandler.js` | Modify | Remove lyrics handler |
| `src/LyricsManager.js` | Delete | — |
| `package.json` | Modify | Remove `genius-lyrics` |
| `config.js` | Modify | Remove `genius` block |
| `docker-compose.example.yml` | Modify | Remove Genius env vars |

---

## Expected Impact

| Scenario | Before | After |
|----------|--------|-------|
| Cold start, text query (worst) | ~8–10 sec | ~2–4 sec |
| Cold start, YouTube URL | ~4–6 sec | ~1.5–3 sec |
| Queued track transition (preloaded) | ~2–4 sec | <0.5 sec |
| Queued track transition (not preloaded) | ~4–6 sec | ~2–3 sec |
