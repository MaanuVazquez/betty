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
