const path = require('path');

// Project root is two levels up from this file (src/constants/ -> src/ -> root)
const PROJECT_ROOT = path.join(__dirname, '..', '..');

/**
 * Centralized paths configuration
 * All paths are relative to the project root
 */
const paths = {
    // Root directory
    root: PROJECT_ROOT,

    // Source directory
    src: path.join(PROJECT_ROOT, 'src'),

    // Constants directory
    constants: path.join(PROJECT_ROOT, 'src', 'constants'),

    // Modules directory
    modules: path.join(PROJECT_ROOT, 'src', 'modules'),

    // Utils directory
    utils: path.join(PROJECT_ROOT, 'src', 'utils'),

    // Discord-specific modules
    discord: path.join(PROJECT_ROOT, 'src', 'modules', 'discord'),

    // Commands directory
    commands: path.join(PROJECT_ROOT, 'src', 'modules', 'discord', 'commands'),

    // Events directory
    events: path.join(PROJECT_ROOT, 'src', 'modules', 'discord', 'events'),

    // Language files
    languages: path.join(PROJECT_ROOT, 'src', 'constants', 'languages'),

    // Database directory
    database: path.join(PROJECT_ROOT, 'database'),

    // Player state database file
    playerState: path.join(PROJECT_ROOT, 'database', 'playerState.json'),

    // Language preferences database file
    languageDb: path.join(PROJECT_ROOT, 'database', 'languages'),

    // Audio cache directory
    audioCache: path.join(PROJECT_ROOT, 'audio_cache'),

    // Cookies file
    cookies: path.join(PROJECT_ROOT, 'database', 'cookies.txt'),

    // Scripts directory
    scripts: path.join(PROJECT_ROOT, 'scripts'),
};

module.exports = paths;
