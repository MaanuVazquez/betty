# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start the bot (single instance)
npm start          # node index.js

# Start with sharding (1000+ servers)
npm run shard      # node shard.js

# Syntax check only (no test framework exists)
npm test           # node --check index.js

# Install dependencies (also runs postinstall: updates yt-dlp binary)
npm install
```

## Architecture

This is a **Discord music bot** ("Beatra/Betty") built on discord.js v14 + @discordjs/voice. The core pattern is one `MusicPlayer` instance per guild, stored in `client.players` (a Map keyed by guild ID).

### Data Flow

```
Slash command → commands/ → MusicEmbedManager → Provider (YouTube/Spotify/SoundCloud/DirectLink)
                                              → MusicPlayer (audio engine, queue, voice)
Button interaction → events/buttonHandler.js → MusicPlayer methods
```

### Key Architectural Points

**Local audio cache**: `MusicPlayer` downloads tracks as `.opus` files to `audio_cache/` via yt-dlp before playback. It pre-fetches the entire queue in parallel. Files are deleted after playback. `PlayerStateManager` tracks "protected" cache files to prevent deletion on restart.

**Session IDs on buttons**: Button custom IDs are encoded as `buttonType:requesterId:sessionId`. The session ID changes each time a new track starts, so stale button clicks from old embeds are rejected.

**Voice reconnection watchdog**: `MusicPlayer` runs a health-check interval and will auto-reconnect up to 5 times on disconnect.

**State persistence**: Player state (queue, position, volume, loop/shuffle flags) is saved every 5 seconds to `database/playerState.json` via `PlayerStateManager`. On bot startup, `index.js` restores sessions from this file.

**Command deployment**: `src/commandLoader.js` deploys slash commands to Discord via REST on every startup. Guild-scoped if `GUILD_ID` is set, global otherwise.

### Module Responsibilities

| File | Responsibility |
|------|---------------|
| `index.js` | Client bootstrap, event wiring, session restore, graceful shutdown |
| `shard.js` | ShardingManager wrapper for large deployments |
| `config.js` | Central config reading from `.env` with defaults |
| `src/MusicPlayer.js` (~2300 lines) | Audio engine: voice connection, AudioPlayer, queue, cache, watchdog |
| `src/MusicEmbedManager.js` | Discord embed rendering, button deck, `handleMusicData` orchestration |
| `src/YouTube.js` | yt-dlp-based search/info; handles PO tokens, cookies, iOS client fallback |
| `src/Spotify.js` | Spotify API → resolves to YouTube for actual audio |
| `src/SoundCloud.js` | yt-dlp with SoundCloud filtering |
| `src/DirectLink.js` | Direct audio URL support (mp3/wav/ogg/flac/etc.) |
| `src/LanguageManager.js` | 22-language i18n; per-guild prefs in `database/languages.json` |
| `src/LyricsManager.js` | Genius scraping + LRCLIB fallback, in-memory TTL cache |
| `src/ErrorHandler.js` | Classifies errors and returns localized messages |
| `src/PlayerStateManager.js` | Reads/writes `database/playerState.json` |
| `events/buttonHandler.js` | All button/select-menu interactions |
| `events/modalHandler.js` | Volume modal submit, autoplay genre select |

### Configuration

All configuration flows through `config.js` which reads `.env`. The `.env` file (committed with empty secret fields) is effectively the template. Required variables:

- `DISCORD_TOKEN`, `CLIENT_ID` — required to run
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` — required for Spotify support
- `GUILD_ID` — optional; enables fast guild-scoped command deployment
- `COOKIES_FROM_BROWSER` or `COOKIES_FILE` — needed when YouTube applies bot-detection (see `YOUTUBE_FIX.md`)

### Language Files

i18n strings live in `languages/` as JSON files named by locale (e.g. `en.json`, `es.json`). All 22 packs are loaded into memory at startup by `LanguageManager`. When adding new user-facing strings, add the key to all language files.

### No TypeScript, No Linting, No Test Framework

The project is vanilla CommonJS JavaScript. There is no ESLint config, no TypeScript, and no test runner. The `npm test` script only performs a syntax check.
