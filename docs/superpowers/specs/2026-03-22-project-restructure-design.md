# Project Restructure Design

**Date:** 2026-03-22
**Goal:** Reorganize codebase for better separation of concerns and maintainability

## Current Structure

```
├── index.js              # Entry point
├── shard.js              # Sharding entry point
├── config.js             # Configuration
├── commands/             # Discord slash commands (5 files)
├── events/               # Discord event handlers (2 files)
├── src/                  # Core modules (11 files, flat)
└── scripts/              # Maintenance scripts (stays)
```

## Target Structure

```
src/
├── index.js              # Bot client (moved from root)
├── shard.js              # Sharding manager (moved from root)
├── constants/
│   ├── config.js         # Configuration (moved from root)
│   └── languages/        # i18n JSON files (moved from root)
├── modules/
│   ├── discord/          # All Discord-specific code
│   │   ├── commands/     # Slash commands (5 files)
│   │   │   ├── help.js
│   │   │   ├── language.js
│   │   │   ├── nowplaying.js
│   │   │   ├── play.js
│   │   │   └── search.js
│   │   ├── events/       # Event handlers (2 files)
│   │   │   ├── buttonHandler.js
│   │   │   └── modalHandler.js
│   │   ├── MusicPlayer.js
│   │   └── MusicEmbedManager.js
│   ├── LanguageManager.js    # i18n (platform-agnostic)
│   ├── PlayerStateManager.js # State persistence
│   ├── YouTube.js        # Audio providers
│   ├── Spotify.js
│   ├── SoundCloud.js
│   ├── DirectLink.js
│   └── StreamURLCache.js
└── utils/
    ├── commandLoader.js  # Command registration
    └── ErrorHandler.js   # Error classification
```

## Unchanged at Root

- `database/` - Data persistence files
- `scripts/` - Maintenance scripts (update-ytdlp.js)
- `package.json` - Updated paths only
- `Dockerfile` - Updated paths only
- `README.md` and other docs

## Key Changes

1. **Entry points**: Both `index.js` and `shard.js` moved to `src/` (must remain separate - shard.js spawns index.js as child processes)
2. **Constants**: `config.js` and `languages/` → `src/constants/`
3. **Discord modules**: All Discord-specific code under `src/modules/discord/`
4. **Shared modules**: LanguageManager, PlayerStateManager, and audio providers in `src/modules/`
5. **Utils**: Command loader and error handler in `src/utils/`

## Path Updates Required

### Files with hardcoded paths that must change:

| File | Old Path | New Path |
|------|----------|----------|
| `utils/commandLoader.js` | `../commands` | `../modules/discord/commands` |
| `modules/LanguageManager.js` | `../languages` | `../constants/languages` |
| `modules/discord/MusicPlayer.js` | `../config` | `../../constants/config` |
| `modules/discord/MusicEmbedManager.js` | `../config` | `../../constants/config` |
| `modules/PlayerStateManager.js` | `../config` | `../constants/config` |
| `modules/YouTube.js` | `../config` | `../constants/config` |
| `modules/Spotify.js` | `../config` | `../constants/config` |
| `modules/SoundCloud.js` | `../config` | `../constants/config` |
| `modules/DirectLink.js` | `../config` | `../constants/config` |
| `modules/discord/commands/*.js` | `../../config` | `../../../constants/config` or `../../constants/config` |
| `modules/discord/events/*.js` | `../../config` | `../../../constants/config` or `../../constants/config` |
| Root files | `./src/...` | `./src/...` or `./src/modules/...` |

### Package.json Updates

```json
{
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "shard": "node src/shard.js",
    "test": "node --check src/index.js"
  }
}
```

### Dockerfile Updates

```dockerfile
CMD ["node", "src/index.js"]
```

## Rationale

- **Separation of concerns**: Discord-specific vs platform-agnostic logic
- **Clear boundaries**: Constants, modules, utils each have distinct purposes
- **Scalable**: Easy to add new commands, events, or providers
- **Maintainable**: Related code lives together

## Implementation Notes

- All `require()` paths must be updated per the table above
- `shard.js` cannot be merged with `index.js` - ShardingManager spawns child processes
- `database/` path stays relative to project root
- `languages/` moved to `src/constants/languages/`
- No functional changes, pure restructure
