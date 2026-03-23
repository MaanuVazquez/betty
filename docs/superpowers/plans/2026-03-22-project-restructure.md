# Project Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the codebase from flat root-level folders to organized `src/` structure with `constants/`, `modules/`, and `utils/` subdirectories.

**Architecture:** Move entry points, commands, events, and core modules into `src/`. Separate Discord-specific code into `src/modules/discord/`. Keep platform-agnostic modules at `src/modules/` level. Move config and languages to `src/constants/`.

**Tech Stack:** Node.js, discord.js, CommonJS modules

---

## File Structure Changes

### Files to Create (by moving)

| New Path | Old Path |
|----------|----------|
| `src/index.js` | `index.js` |
| `src/shard.js` | `shard.js` |
| `src/constants/config.js` | `config.js` |
| `src/constants/languages/*.json` | `languages/*.json` (22 files) |
| `src/modules/discord/commands/*.js` | `commands/*.js` (5 files) |
| `src/modules/discord/events/*.js` | `events/*.js` (2 files) |
| `src/modules/discord/MusicPlayer.js` | `src/MusicPlayer.js` |
| `src/modules/discord/MusicEmbedManager.js` | `src/MusicEmbedManager.js` |
| `src/modules/LanguageManager.js` | `src/LanguageManager.js` |
| `src/modules/PlayerStateManager.js` | `src/PlayerStateManager.js` |
| `src/modules/YouTube.js` | `src/YouTube.js` |
| `src/modules/Spotify.js` | `src/Spotify.js` |
| `src/modules/SoundCloud.js` | `src/SoundCloud.js` |
| `src/modules/DirectLink.js` | `src/DirectLink.js` |
| `src/modules/StreamURLCache.js` | `src/StreamURLCache.js` |
| `src/utils/commandLoader.js` | `src/commandLoader.js` |
| `src/utils/ErrorHandler.js` | `src/ErrorHandler.js` |

### Files to Modify

- `package.json` - Update main entry and scripts paths
- `Dockerfile` - Update CMD path
- All moved files - Update `require()` paths

---

## Implementation Tasks

### Task 1: Create Directory Structure

**Action:** Create the new folder hierarchy.

- [ ] **Step 1: Create directories**

```bash
mkdir -p src/constants/languages
mkdir -p src/modules/discord/commands
mkdir -p src/modules/discord/events
mkdir -p src/utils
```

- [ ] **Step 2: Verify structure**

Run: `find src -type d | sort`
Expected output shows all 5 directories created.

- [ ] **Step 3: Commit**

```bash
git add src/
git commit -m "chore: create new directory structure"
```

---

### Task 2: Move Entry Points

**Files:**
- Move: `index.js` → `src/index.js`
- Move: `shard.js` → `src/shard.js`

- [ ] **Step 1: Move index.js and update path**

```bash
git mv index.js src/index.js
```

- [ ] **Step 2: Update shard.js reference in src/index.js**

Edit `src/index.js` line referencing shard mode detection (if any). Look for `require('./shard')` or similar - this likely doesn't exist as they're separate entry points.

- [ ] **Step 3: Move shard.js**

```bash
git mv shard.js src/shard.js
```

- [ ] **Step 4: Update shard.js spawn path**

Edit `src/shard.js`, find the ShardingManager constructor:

```javascript
// OLD:
const manager = new ShardingManager('./index.js', {

// NEW:
const manager = new ShardingManager('./src/index.js', {
```

- [ ] **Step 5: Verify both files moved**

Run: `ls -la src/*.js`
Expected: `src/index.js` and `src/shard.js`

- [ ] **Step 6: Commit**

```bash
git commit -m "chore: move entry points to src/"
```

---

### Task 3: Move Config and Languages

**Files:**
- Move: `config.js` → `src/constants/config.js`
- Move: `languages/*.json` → `src/constants/languages/*.json`

- [ ] **Step 1: Move config.js**

```bash
git mv config.js src/constants/config.js
```

- [ ] **Step 2: Move all language files**

```bash
git mv languages/* src/constants/languages/
rmdir languages
```

- [ ] **Step 3: Verify moves**

Run: `ls src/constants/`
Expected: `config.js` and `languages/`

Run: `ls src/constants/languages/ | wc -l`
Expected: 22 files

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: move config and languages to src/constants/"
```

---

### Task 4: Move Discord Commands

**Files:**
- Move: `commands/help.js` → `src/modules/discord/commands/help.js`
- Move: `commands/language.js` → `src/modules/discord/commands/language.js`
- Move: `commands/nowplaying.js` → `src/modules/discord/commands/nowplaying.js`
- Move: `commands/play.js` → `src/modules/discord/commands/play.js`
- Move: `commands/search.js` → `src/modules/discord/commands/search.js`

- [ ] **Step 1: Move all command files**

```bash
git mv commands/* src/modules/discord/commands/
rmdir commands
```

- [ ] **Step 2: Update config import paths in all commands**

For each file in `src/modules/discord/commands/*.js`, change:

```javascript
// OLD:
const config = require('../config');

// NEW:
const config = require('../../../constants/config');
```

Also update src/ imports:

```javascript
// OLD:
const MusicPlayer = require('../src/MusicPlayer');
const MusicEmbedManager = require('../src/MusicEmbedManager');
const LanguageManager = require('../src/LanguageManager');
const ErrorHandler = require('../src/ErrorHandler');

// NEW:
const MusicPlayer = require('../../modules/discord/MusicPlayer');
const MusicEmbedManager = require('../../modules/discord/MusicEmbedManager');
const LanguageManager = require('../../modules/LanguageManager');
const ErrorHandler = require('../../utils/ErrorHandler');
```

Files to edit:
- `src/modules/discord/commands/help.js`
- `src/modules/discord/commands/language.js`
- `src/modules/discord/commands/nowplaying.js`
- `src/modules/discord/commands/play.js`
- `src/modules/discord/commands/search.js` (note: uses `require('../config.js')` with .js extension)

- [ ] **Step 3: Verify commands moved**

Run: `ls src/modules/discord/commands/`
Expected: 5 JS files

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: move Discord commands to src/modules/discord/commands/"
```

---

### Task 5: Move Discord Events

**Files:**
- Move: `events/buttonHandler.js` → `src/modules/discord/events/buttonHandler.js`
- Move: `events/modalHandler.js` → `src/modules/discord/events/modalHandler.js`

- [ ] **Step 1: Move all event files**

```bash
git mv events/* src/modules/discord/events/
rmdir events
```

- [ ] **Step 2: Update config import paths in all events**

For each file in `src/modules/discord/events/*.js`, change:

```javascript
// OLD:
const config = require('../config');

// NEW:
const config = require('../../../constants/config');
```

Also update src/ and commands/ imports:

```javascript
// OLD:
const MusicPlayer = require('../src/MusicPlayer');
const LanguageManager = require('../src/LanguageManager');
const ErrorHandler = require('../src/ErrorHandler');

// NEW:
const MusicPlayer = require('../MusicPlayer');
const LanguageManager = require('../../LanguageManager');
const ErrorHandler = require('../../../utils/ErrorHandler');
```

Files to edit:
- `src/modules/discord/events/buttonHandler.js`
- `src/modules/discord/events/modalHandler.js`

- [ ] **Step 3: Verify events moved**

Run: `ls src/modules/discord/events/`
Expected: 2 JS files

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: move Discord events to src/modules/discord/events/"
```

---

### Task 6: Move Core Modules

**Files:**
- Move within src/: `src/MusicPlayer.js` → `src/modules/discord/MusicPlayer.js`
- Move within src/: `src/MusicEmbedManager.js` → `src/modules/discord/MusicEmbedManager.js`
- Move within src/: `src/LanguageManager.js` → `src/modules/LanguageManager.js`
- Move within src/: `src/PlayerStateManager.js` → `src/modules/PlayerStateManager.js`
- Move within src/: `src/YouTube.js` → `src/modules/YouTube.js`
- Move within src/: `src/Spotify.js` → `src/modules/Spotify.js`
- Move within src/: `src/SoundCloud.js` → `src/modules/SoundCloud.js`
- Move within src/: `src/DirectLink.js` → `src/modules/DirectLink.js`
- Move within src/: `src/StreamURLCache.js` → `src/modules/StreamURLCache.js`

- [ ] **Step 1: Move Discord-specific modules**

```bash
git mv src/MusicPlayer.js src/modules/discord/
git mv src/MusicEmbedManager.js src/modules/discord/
```

- [ ] **Step 2: Move platform-agnostic modules**

```bash
git mv src/LanguageManager.js src/modules/
git mv src/PlayerStateManager.js src/modules/
git mv src/YouTube.js src/modules/
git mv src/Spotify.js src/modules/
git mv src/SoundCloud.js src/modules/
git mv src/DirectLink.js src/modules/
git mv src/StreamURLCache.js src/modules/
```

- [ ] **Step 3: Update import paths in moved Discord modules**

Edit `src/modules/discord/MusicPlayer.js`:

```javascript
// OLD:
const config = require('../config');

// NEW:
const config = require('../../constants/config');
```

Edit `src/modules/discord/MusicEmbedManager.js`:

```javascript
// OLD:
const config = require('../config');

// NEW:
const config = require('../../constants/config');
```

- [ ] **Step 4: Update import paths in platform-agnostic modules**

Edit `src/modules/LanguageManager.js`:

```javascript
// OLD:
path.join(__dirname, '..', 'languages')

// NEW:
path.join(__dirname, '..', 'constants', 'languages')
```

Edit `src/modules/PlayerStateManager.js`:

```javascript
// OLD:
const config = require('../config');

// NEW:
const config = require('../constants/config');
```

Edit `src/modules/YouTube.js`:

```javascript
// OLD:
const config = require('../config');

// NEW:
const config = require('../constants/config');
```

Edit `src/modules/Spotify.js`:

```javascript
// OLD:
const config = require('../config');

// NEW:
const config = require('../constants/config');
```

Edit `src/modules/SoundCloud.js`:

```javascript
// OLD:
const config = require('../config');

// NEW:
const config = require('../constants/config');
```

Note: `DirectLink.js` does not import config, no changes needed.

- [ ] **Step 5: Verify modules moved**

Run: `ls src/modules/`
Expected: DirectLink.js, LanguageManager.js, PlayerStateManager.js, SoundCloud.js, Spotify.js, StreamURLCache.js, YouTube.js, discord/

- [ ] **Step 6: Commit**

```bash
git commit -m "chore: move core modules to src/modules/"
```

---

### Task 7: Move Utils

**Files:**
- Move: `src/commandLoader.js` → `src/utils/commandLoader.js`
- Move: `src/ErrorHandler.js` → `src/utils/ErrorHandler.js`

- [ ] **Step 1: Move utility files**

```bash
git mv src/commandLoader.js src/utils/
git mv src/ErrorHandler.js src/utils/
```

- [ ] **Step 2: Update commandLoader.js paths**

Edit `src/utils/commandLoader.js`:

```javascript
// OLD:
const commandsPath = path.join(__dirname, '..', 'commands');

// NEW:
const commandsPath = path.join(__dirname, '..', 'modules', 'discord', 'commands');
```

Also check for any `require('../config')` and update to `require('../constants/config')`.

Also update LanguageManager import in ErrorHandler.js:

```javascript
// OLD:
const LanguageManager = require('./LanguageManager');

// NEW:
const LanguageManager = require('../modules/LanguageManager');
```

- [ ] **Step 3: Verify utils moved**

Run: `ls src/utils/`
Expected: `commandLoader.js` and `ErrorHandler.js`

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: move utilities to src/utils/"
```

---

### Task 8: Update Root index.js Imports

**Files:**
- Modify: `src/index.js`

- [ ] **Step 1: Update all require paths in src/index.js**

Edit `src/index.js` and update imports:

```javascript
// OLD:
const config = require('./config');

// NEW:
const config = require('./constants/config');
```

```javascript
// OLD:
const MusicPlayer = require('./src/MusicPlayer');

// NEW:
const MusicPlayer = require('./modules/discord/MusicPlayer');
```

```javascript
// OLD:
const YouTube = require('./src/YouTube');

// NEW:
const YouTube = require('./modules/YouTube');
```

```javascript
// OLD:
const Spotify = require('./src/Spotify');

// NEW:
const Spotify = require('./modules/Spotify');
```

```javascript
// OLD:
const SoundCloud = require('./src/SoundCloud');

// NEW:
const SoundCloud = require('./modules/SoundCloud');
```

```javascript
// OLD:
const DirectLink = require('./src/DirectLink');

// NEW:
const DirectLink = require('./modules/DirectLink');
```

```javascript
// OLD:
const ErrorHandler = require('./src/ErrorHandler');

// NEW:
const ErrorHandler = require('./utils/ErrorHandler');
```

```javascript
// OLD:
const LanguageManager = require('./src/LanguageManager');

// NEW:
const LanguageManager = require('./modules/LanguageManager');
```

```javascript
// OLD:
const PlayerStateManager = require('./src/PlayerStateManager');

// NEW:
const PlayerStateManager = require('./modules/PlayerStateManager');
```

```javascript
// OLD:
const commandLoader = require('./src/commandLoader');

// NEW:
const commandLoader = require('./utils/commandLoader');
```

```javascript
// OLD:
const MusicEmbedManager = require('./src/MusicEmbedManager');

// NEW:
const MusicEmbedManager = require('./modules/discord/MusicEmbedManager');
```

```javascript
// OLD:
const buttonHandler = require('./events/buttonHandler');

// NEW:
const buttonHandler = require('./modules/discord/events/buttonHandler');
```

```javascript
// OLD:
const modalHandler = require('./events/modalHandler');

// NEW:
const modalHandler = require('./modules/discord/events/modalHandler');
```

- [ ] **Step 2: Commit**

```bash
git commit -m "chore: update import paths in src/index.js"
```

---

### Task 9: Update Root shard.js Imports

**Files:**
- Modify: `src/shard.js`

- [ ] **Step 1: Update config import in src/shard.js**

Edit `src/shard.js`:

```javascript
// OLD:
const config = require('./config');

// NEW:
const config = require('./constants/config');
```

- [ ] **Step 2: Verify shard.js already updated**

Confirm the ShardingManager path was updated in Task 2.

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: update import paths in src/shard.js"
```

---

### Task 10: Update Discord Module Cross-References

**Files:**
- Modify: `src/modules/discord/MusicPlayer.js`
- Modify: `src/modules/discord/MusicEmbedManager.js`

- [ ] **Step 1: Update MusicPlayer.js internal imports**

Edit `src/modules/discord/MusicPlayer.js`:

Check for and update any references to:
- `require('../YouTube')` → `require('../YouTube')` (still same relative level - both in modules/)
- `require('../Spotify')` → `require('../Spotify')` (still same relative level)
- `require('../SoundCloud')` → `require('../SoundCloud')` (still same relative level)
- `require('../DirectLink')` → `require('../DirectLink')` (still same relative level)
- `require('../StreamURLCache')` → `require('../StreamURLCache')` (still same relative level)
- `require('./LanguageManager')` → `require('../LanguageManager')` (LanguageManager is in parent modules/)
- `require('./PlayerStateManager')` → `require('../PlayerStateManager')` (PlayerStateManager is in parent modules/)
- `require('./ErrorHandler')` → `require('../../utils/ErrorHandler')` (ErrorHandler is in utils/)

- [ ] **Step 2: Update MusicEmbedManager.js internal imports**

Edit `src/modules/discord/MusicEmbedManager.js`:

Check for and update any references to:
- `require('./LanguageManager')` → `require('../LanguageManager')` (LanguageManager is in parent modules/)
- `require('./ErrorHandler')` → `require('../../utils/ErrorHandler')` (ErrorHandler is in utils/)

- [ ] **Step 3: Verify no broken imports**

Run: `grep -r "require.*\.\.\/\.\.\/config" src/ || echo "No old config imports found"`
Expected: "No old config imports found"

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: update cross-references in Discord modules"
```

---

### Task 11: Update Button and Modal Handlers

**Files:**
- Modify: `src/modules/discord/events/buttonHandler.js`
- Modify: `src/modules/discord/events/modalHandler.js`

- [ ] **Step 1: Update buttonHandler.js imports**

Edit `src/modules/discord/events/buttonHandler.js`:

```javascript
// OLD:
const config = require('../config');

// NEW:
const config = require('../../../constants/config');
```

Check for other imports and update:
- `require('../src/MusicPlayer')` → `require('../MusicPlayer')`
- `require('../src/LanguageManager')` → `require('../../LanguageManager')`
- `require('../src/ErrorHandler')` → `require('../../../utils/ErrorHandler')`

Also check for inline requires inside method bodies:
- `require('../commands/language.js')` → `require('../commands/language')` (path stays same relative to new location)
- `require('../commands/help.js')` → `require('../commands/help')`
- `require('../src/MusicEmbedManager')` → `require('../MusicEmbedManager')`

- [ ] **Step 2: Update modalHandler.js imports**

Edit `src/modules/discord/events/modalHandler.js`:

```javascript
// OLD:
const config = require('../config');

// NEW:
const config = require('../../../constants/config');
```

Check for other imports and update similarly to buttonHandler.

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: update imports in event handlers"
```

---

### Task 12: Update package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update main entry point**

Edit `package.json`:

```json
// OLD:
"main": "index.js",

// NEW:
"main": "src/index.js",
```

- [ ] **Step 2: Update scripts**

Edit `package.json`:

```json
// OLD:
"scripts": {
  "start": "node index.js",
  "shard": "node shard.js",
  "test": "node --check index.js"
}

// NEW:
"scripts": {
  "start": "node src/index.js",
  "shard": "node src/shard.js",
  "test": "node --check src/index.js"
}
```

- [ ] **Step 3: Verify package.json**

Run: `cat package.json | grep -A5 '"scripts"'`
Expected: Shows updated paths with `src/`

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: update package.json paths"
```

---

### Task 13: Update Dockerfile

**Files:**
- Modify: `Dockerfile`

- [ ] **Step 1: Update CMD instruction**

Edit `Dockerfile`:

```dockerfile
# OLD:
CMD ["node", "index.js"]

# NEW:
CMD ["node", "src/index.js"]
```

- [ ] **Step 2: Verify Dockerfile**

Run: `grep CMD Dockerfile`
Expected: `CMD ["node", "src/index.js"]`

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: update Dockerfile CMD path"
```

---

### Task 14: Verify Syntax

**Files:**
- All moved and modified JS files

- [ ] **Step 1: Run syntax check**

```bash
npm test
```

Expected: No output (syntax check passes) or process exits with code 0.

- [ ] **Step 2: Check for any remaining broken imports**

```bash
grep -r "require.*\.\./commands" src/ --include="*.js" || echo "No old command imports"
grep -r "require.*\.\./events" src/ --include="*.js" || echo "No old event imports"
grep -r "require.*\.\./config" src/ --include="*.js" || echo "No old config imports"
```

Expected: All three echo "No old ... imports"

- [ ] **Step 3: Verify no orphaned files**

Run: `ls -la commands/ 2>/dev/null || echo "commands/ removed"`
Expected: "commands/ removed"

Run: `ls -la events/ 2>/dev/null || echo "events/ removed"`
Expected: "events/ removed"

Run: `ls -la languages/ 2>/dev/null || echo "languages/ removed"`
Expected: "languages/ removed"

- [ ] **Step 4: Commit (if any fixes made)**

If any issues were found and fixed, commit them. Otherwise, continue.

---

### Task 15: Final Verification

- [ ] **Step 1: Show final directory structure**

```bash
find src -type f -name "*.js" | sort
```

Expected: Shows all 22 JS files in their new locations.

- [ ] **Step 2: Verify root is clean**

Run: `ls *.js 2>/dev/null || echo "No JS files at root"`
Expected: "No JS files at root" (except if there are other files not part of this restructure)

- [ ] **Step 3: Final commit**

```bash
git status
```

Verify all changes are staged or committed, then:

```bash
git log --oneline -5
```

Expected: Shows the series of commits made during this restructure.

---

## Summary

This restructure moves:
- 2 entry points to `src/`
- 1 config file to `src/constants/`
- 22 language files to `src/constants/languages/`
- 5 command files to `src/modules/discord/commands/`
- 2 event files to `src/modules/discord/events/`
- 9 core modules to `src/modules/` (2 in discord/, 7 at modules level)
- 2 utility files to `src/utils/`

And updates:
- `package.json` scripts and main entry
- `Dockerfile` CMD instruction
- All internal `require()` paths

**No functional changes** - purely structural reorganization.
