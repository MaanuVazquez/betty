# ── Builder stage ──────────────────────────────────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /app

# Build tools required for native modules (opusscript, prism-media)
RUN apk add --no-cache python3 make g++ ca-certificates

COPY package*.json ./
COPY ./scripts ./scripts

# npm ci triggers postinstall which downloads the yt-dlp binary
RUN npm ci

COPY . .

# ── Runtime stage ──────────────────────────────────────────────────────────
FROM node:24-alpine

WORKDIR /app

# gcompat: GNU libc compatibility layer (~1 MB) required for:
#   - ffmpeg-static: ships a glibc-compiled ffmpeg binary
#   - yt-dlp:        standalone binary compiled against glibc
# ca-certificates: HTTPS connections (Spotify, Genius, LRCLIB, YouTube)
RUN apk add --no-cache gcompat ca-certificates python3 su-exec ffmpeg

COPY --from=builder /app .

# Ensure writable dirs exist and are owned by the non-root node user
RUN mkdir -p audio_cache database && chown -R node:node /app

# Persist guild language preferences and player state across restarts.
# Mount a named volume here: docker run -v betty-db:/app/database ...
VOLUME ["/app/database"]

# Discord bot — no HTTP server, no port to expose

# Entrypoint runs as root to fix volume ownership, then drops to node via su-exec
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "index.js"]
