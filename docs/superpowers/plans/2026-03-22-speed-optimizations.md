# Speed Optimizations + Lyrics Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce search-to-stream latency for cold starts and queue transitions, and remove all lyrics/Genius code.

**Architecture:** Six targeted changes that stack independently: (1) a new singleton `StreamURLCache` that caches CDN URLs so yt-dlp is only called once per track, (2) wrapping `YouTube.getStream()` with that cache, (3) skipping `getStream()` in `play()` entirely when the opus file is already on disk, (4) parallelising voice connect with stream pre-resolution in `_processMusic`, (5) replacing sequential preloads with a concurrency-2 pool, and (6) deleting all lyrics/Genius code.

**Tech Stack:** Node.js CommonJS, `youtube-dl-exec`, `discord.js`, `@discordjs/voice`

---

### Task 1: `StreamURLCache` singleton

**Files:**
- Create: `src/StreamURLCache.js`

- [ ] **Step 1: Create the file**

```js
// src/StreamURLCache.js
'use strict';

const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours — conservative vs YouTube's ~6 hr CDN expiry

class StreamURLCache {
    constructor() {
        this._cache = new Map(); // url -> { streamInfo, timestamp }
    }

    /** Returns cached streamInfo or null if missing/expired. */
    get(url) {
        const entry = this._cache.get(url);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > TTL_MS) {
            this._cache.delete(url);
            return null;
        }
        return entry.streamInfo;
    }

    /** Stores streamInfo and evicts expired entries (lazy cleanup). */
    set(url, streamInfo) {
        const now = Date.now();
        for (const [k, v] of this._cache) {
            if (now - v.timestamp > TTL_MS) this._cache.delete(k);
        }
        this._cache.set(url, { streamInfo, timestamp: now });
    }

    delete(url) {
        this._cache.delete(url);
    }

    has(url) {
        return this.get(url) !== null;
    }
}

module.exports = new StreamURLCache();
```

- [ ] **Step 2: Syntax check**

```bash
node --check src/StreamURLCache.js
```

Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add src/StreamURLCache.js
git commit -m "feat: add StreamURLCache singleton (TTL 2h) for CDN stream URLs"
```

---

### Task 2: `YouTube.getStream()` — wrap with cache

**Files:**
- Modify: `src/YouTube.js` (method `getStream`, lines ~150–195)

`getStream()` currently always calls yt-dlp. Add a cache read before and a cache write after. Bypass entirely for seeks (`startSeconds > 0`) because cached CDN URLs don't embed the seek offset.

- [ ] **Step 1: Add cache read at the top of `getStream()`**

In `src/YouTube.js`, locate `static async getStream(url, guildId = null, startSeconds = 0)`.

Replace:
```js
        // Get stream URL with simple format
        const info = await youtubedl(url, this.getYtDlpOptions({
```

With:
```js
        const StreamURLCache = require('./StreamURLCache');

        // Cache hit — only for fresh plays. Seeks embed begin= in the CDN URL
        // so a cached startSeconds=0 URL must never be reused for a seek.
        if (startSeconds === 0) {
            const cached = StreamURLCache.get(url);
            if (cached) return cached;
        }

        // Get stream URL with simple format
        const info = await youtubedl(url, this.getYtDlpOptions({
```

- [ ] **Step 2: Add cache write before the return**

Locate the `return {` statement inside `getStream()` that builds the result object. Replace it with:

```js
            const result = {
                url: finalUrl,
                rawUrl: baseUrl,
                type: info.acodec && info.acodec.includes('opus') ? 'opus' : 'arbitrary',
                duration: info.duration || 0,
                bitrate: info.abr || info.tbr || 0,
                canSeek,
                format: info.format,
                httpHeaders: info.http_headers || {}
            };

            // Cache for subsequent calls (only fresh plays — see read guard above)
            if (startSeconds === 0) {
                StreamURLCache.set(url, result);
            }

            return result;
```

- [ ] **Step 3: Syntax check**

```bash
node --check src/YouTube.js
```

- [ ] **Step 4: Commit**

```bash
git add src/YouTube.js
git commit -m "perf: cache getStream() CDN URLs in StreamURLCache (skip for seeks)"
```

---

### Task 3: `YouTube.search()` — drop `getInfo()` fallback

**Files:**
- Modify: `src/YouTube.js` (method `search`, lines ~84–98)

When a search result has `duration === 0` the code calls `getInfo()` to fill it in. This is an extra yt-dlp call per result. Duration 0 is fine — it's cosmetic in the embed and not needed for playback.

- [ ] **Step 1: Remove the `getInfo()` block in `search()`**

Locate and delete this block inside the `for (const item of results.entries...)` loop:

```js
                    // If duration is missing from search, try to get it from getInfo
                    if (!track.duration || track.duration === 0) {

                        const detailedInfo = await this.getInfo(track.url, guildId);
                        if (detailedInfo && detailedInfo.duration) {
                            track.duration = detailedInfo.duration;

                        }
                    }
```

- [ ] **Step 2: Syntax check**

```bash
node --check src/YouTube.js
```

- [ ] **Step 3: Commit**

```bash
git add src/YouTube.js
git commit -m "perf: remove getInfo() fallback in search() for missing duration"
```

---

### Task 4: `MusicPlayer.play()` — skip `getStream()` when opus file is cached

**Files:**
- Modify: `src/MusicPlayer.js` (method `play`, around line 769)

`play()` calls `getStream()` (1.5–3 sec) even when the opus file is already on disk from a previous preload. The existing code already checks the disk cache to set `downloadedFile` (lines ~858–873), but `getStream()` fires first. We add a fast-path check before the `if (!streamInfo)` switch that synthesises a minimal `streamInfo` from the track object, skipping yt-dlp entirely.

The synthetic `streamInfo` satisfies the watchdog (`scheduleTrackWatchdog`), metadata fields, and downstream consumers. `rawUrl: null` is safe here because seeks are guarded by the `resumeFromMs === 0` condition.

- [ ] **Step 1: Locate the insertion point**

Find this block in `play()` (after the `preloadedStreams` check, before the `if (!streamInfo)` switch):

```js
        if (!streamInfo && preloaded) {
            streamInfo = preloaded.info;
            // Remove from cache since we're using it
            this.preloadedStreams.delete(this.currentTrack.url);
        }

        if (!streamInfo) {
            // Get stream normally
            switch (this.currentTrack.platform) {
```

- [ ] **Step 2: Insert the disk-cache fast path**

```js
        if (!streamInfo && preloaded) {
            streamInfo = preloaded.info;
            // Remove from cache since we're using it
            this.preloadedStreams.delete(this.currentTrack.url);
        }

        // Fast path: opus file already on disk and no seek requested.
        // Synthesise a minimal streamInfo to skip the getStream() yt-dlp call entirely.
        // The existing downloadedFile block below will confirm the file and set shouldDownload=false.
        if (!streamInfo && resumeFromMs === 0) {
            const hash = crypto.createHash('md5').update(this.currentTrack.url).digest('hex');
            const cachedPath = path.join(CACHE_DIR, `track_${hash}.opus`);
            if (fsSync.existsSync(cachedPath) && fsSync.statSync(cachedPath).size > 0) {
                streamInfo = {
                    url: null,
                    rawUrl: null,
                    duration: this.currentTrack.duration || 0,
                    bitrate: this.currentTrack.bitrate || 128,
                    type: 'opus',
                    canSeek: false,
                    httpHeaders: {}
                };
            }
        }

        if (!streamInfo) {
            // Get stream normally
            switch (this.currentTrack.platform) {
```

- [ ] **Step 3: Syntax check**

```bash
node --check src/MusicPlayer.js
```

- [ ] **Step 4: Commit**

```bash
git add src/MusicPlayer.js
git commit -m "perf: skip getStream() in play() when opus file already cached on disk"
```

---

### Task 5: `MusicEmbedManager._processMusic()` — parallel connect + stream pre-resolve

**Files:**
- Modify: `src/MusicEmbedManager.js` (method `_processMusic`, lines ~75–83)

Currently: `connect()` → `play()` → inside `play()`, `getStream()` is called sequentially.
After: `connect()` and `getStream()` fire in parallel. By the time `play()` runs, the stream URL is already in `StreamURLCache` and `getStream()` returns instantly. `play()`'s internal `connect()` check (`if (!this.connection)`) is a no-op because the connection already exists.

Applies only to YouTube tracks (platform known at this stage). Spotify/SoundCloud fall back to normal `play()` behavior.

- [ ] **Step 1: Locate the block to replace in `_processMusic()`**

Find:
```js
                    // Ses kanalına bağlan ve çalmaya başla
                    try {
                        if (!player.connection) {
                            await player.connect();
                        }
                        await player.play();
```

- [ ] **Step 2: Replace with parallel execution**

```js
                    // Ses kanalına bağlan ve çalmaya başla
                    try {
                        // Run voice connect and YouTube stream pre-resolution in parallel.
                        // getStream() writes to StreamURLCache so player.play() finds it
                        // cached and skips the yt-dlp call entirely.
                        const connectPromise = !player.connection
                            ? player.connect()
                            : Promise.resolve();

                        let preResolvePromise = Promise.resolve();
                        if (track.platform === 'youtube' && track.url) {
                            const YouTube = require('./YouTube');
                            // Errors are safe to swallow — play() calls getStream() as fallback
                            preResolvePromise = YouTube.getStream(track.url, guildId).catch(() => {});
                        }

                        await Promise.all([connectPromise, preResolvePromise]);
                        await player.play();
```

- [ ] **Step 3: Syntax check**

```bash
node --check src/MusicEmbedManager.js
```

- [ ] **Step 4: Commit**

```bash
git add src/MusicEmbedManager.js
git commit -m "perf: parallel voice connect + stream pre-resolve in _processMusic"
```

---

### Task 6: `MusicEmbedManager` — parallel preload (concurrency 2)

**Files:**
- Modify: `src/MusicEmbedManager.js` (method `sequentialPreload`, line 15; call site, line 97)

Replace the sequential one-at-a-time loop (with 100 ms delays) with a concurrency-limited parallel runner that processes 2 tracks at a time. The 100 ms delay is removed — the concurrency cap already throttles yt-dlp load.

- [ ] **Step 1: Replace `sequentialPreload()` with `parallelPreload()`**

Replace the entire `sequentialPreload` method (lines 15–31):

```js
    /**
     * Pre-downloads queued tracks in parallel (concurrency 2) to fill the
     * opus file cache while the current track plays.
     */
    async parallelPreload(player, tracks) {
        const CONCURRENCY = 2;
        let index = 0;

        const runWorker = async () => {
            while (index < tracks.length) {
                const track = tracks[index++];
                if (
                    player.preloadedStreams.has(track.url) ||
                    player.preloadingQueue.includes(track.url)
                ) continue;
                try {
                    await player.preloadTrack(track);
                } catch (err) {
                    console.error(`❌ Preload error for ${track.title}:`, err.message);
                }
            }
        };

        await Promise.all(Array.from({ length: CONCURRENCY }, runWorker));
    }
```

- [ ] **Step 2: Update the call site**

Find (line ~97):
```js
            this.sequentialPreload(player, player.queue.slice()).catch(err =>
                console.error('❌ Sequential preload error:', err.message)
            );
```

Replace with:
```js
            this.parallelPreload(player, player.queue.slice()).catch(err =>
                console.error('❌ Parallel preload error:', err.message)
            );
```

- [ ] **Step 3: Syntax check**

```bash
node --check src/MusicEmbedManager.js
```

- [ ] **Step 4: Commit**

```bash
git add src/MusicEmbedManager.js
git commit -m "perf: replace sequential preload with parallel pool (concurrency 2)"
```

---

### Task 7: Remove lyrics — core files

**Files:**
- Modify: `src/MusicPlayer.js`
- Modify: `src/MusicEmbedManager.js`
- Delete: `src/LyricsManager.js`

- [ ] **Step 1: Remove `LyricsManager` from `MusicPlayer.js`**

Remove the require at line 19:
```js
const LyricsManager = require('./LyricsManager');
```

Remove the lyrics state in the constructor (line ~112–113):
```js
        // Lyrics system (button-only, no sync)
        this.currentLyrics = null; // Lyrics data for current track
```

Remove the `fetchAndStartLyrics()` call in `play()` (line ~1065–1066):
```js
            // Fetch and start lyrics system
            this.fetchAndStartLyrics();
```

Remove the `fetchAndStartLyrics()` method (lines ~2169–2190) and the `hasLyrics()` method (lines ~2194–2196):
```js
    async fetchAndStartLyrics() { ... }

    hasLyrics() {
        return Boolean(this.currentLyrics && this.currentLyrics.plain);
    }
```

- [ ] **Step 2: Syntax check `MusicPlayer.js`**

```bash
node --check src/MusicPlayer.js
```

- [ ] **Step 3: Remove lyrics button from `MusicEmbedManager.js`**

Find and remove the lyrics button block (lines ~494–501):
```js
        // Lyrics button (only show if lyrics available)
        const lyricsLabel = await LanguageManager.getTranslation(guildId, 'buttons.lyrics') || 'Lyrics';
        const lyricsButton = new ButtonBuilder()
            .setCustomId(`music_lyrics:${requesterId}:${sessionId}`)
            .setLabel(lyricsLabel)
            ...
            .setDisabled(disabled || !player.hasLyrics());
```

Remove `lyricsButton` from the `addComponents` call (line ~507):
```js
            .addComponents(volumeButton, loopButton, autoplayButton, lyricsButton)
```
→
```js
            .addComponents(volumeButton, loopButton, autoplayButton)
```

- [ ] **Step 4: Syntax check `MusicEmbedManager.js`**

```bash
node --check src/MusicEmbedManager.js
```

- [ ] **Step 5: Delete `LyricsManager.js`**

```bash
git rm src/LyricsManager.js
```

- [ ] **Step 6: Commit**

```bash
git add src/MusicPlayer.js src/MusicEmbedManager.js
git commit -m "feat: remove lyrics system (LyricsManager, fetchAndStartLyrics, lyrics button)"
```

---

### Task 8: Remove lyrics/Genius — config, deps, events

**Files:**
- Modify: `events/buttonHandler.js`
- Modify: `package.json`
- Modify: `config.js`
- Modify: `docker-compose.example.yml`

- [ ] **Step 1: Remove lyrics handler from `buttonHandler.js`**

Remove the case in the button router (~line 102–103):
```js
                case 'music_lyrics':
                    await this.handleLyrics(interaction, player);
```

Remove the entire `handleLyrics()` method (~lines 991–1122):
```js
    async handleLyrics(interaction, player) { ... }
```

- [ ] **Step 2: Syntax check `buttonHandler.js`**

```bash
node --check events/buttonHandler.js
```

- [ ] **Step 3: Remove `genius-lyrics` from `package.json`**

Remove the line:
```json
    "genius-lyrics": "^4.4.7",
```

- [ ] **Step 4: Remove `genius` block from `config.js`**

Remove:
```js
    // Genius API Settings
    genius: {
        clientId: process.env.GENIUS_CLIENT_ID || '',
        clientSecret: process.env.GENIUS_CLIENT_SECRET || '',
    },
```

- [ ] **Step 5: Remove Genius env vars from `docker-compose.example.yml`**

Remove:
```yaml
      GENIUS_CLIENT_ID: ""            # Higher Genius API rate limits
      GENIUS_CLIENT_SECRET: ""
```

- [ ] **Step 6: Syntax check remaining files**

```bash
node --check config.js && node --check events/buttonHandler.js
```

- [ ] **Step 7: Regenerate `package-lock.json`**

```bash
npm install
```

Expected: `genius-lyrics` and its transitive deps removed from `node_modules/` and `package-lock.json`.

- [ ] **Step 8: Final syntax check**

```bash
node --check index.js
```

Expected: no output (clean).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json config.js docker-compose.example.yml events/buttonHandler.js
git commit -m "feat: remove Genius API config, genius-lyrics dep, and lyrics button handler"
```
