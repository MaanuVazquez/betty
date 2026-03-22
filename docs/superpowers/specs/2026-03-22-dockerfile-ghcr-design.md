# Design: Dockerfile + GHCR Deployment

**Date:** 2026-03-22
**Status:** Approved

## Summary

Add a multi-stage Alpine Dockerfile and a GitHub Actions workflow that builds and pushes the image to `ghcr.io` on every push to `main`.

## Dockerfile Design

**Approach:** Multi-stage build on `node:24-alpine`.

### Builder stage
- Installs build tools: `python3 make g++ ca-certificates`
- Runs `npm ci` — which triggers `postinstall` to download the yt-dlp binary
- All compilation of native modules (`opusscript`, `prism-media`) happens here

### Runtime stage
- Base: `node:24-alpine`
- Installs only: `gcompat` (GNU libc compatibility layer ~1 MB, required for `ffmpeg-static` and `yt-dlp` glibc binaries) + `ca-certificates`
- Copies `node_modules/` and app code from builder
- Creates `audio_cache/` directory (ephemeral, no volume)
- Declares `VOLUME ["/app/database"]` for persisting language prefs and player state
- Runs as non-root user `node`
- `CMD ["node", "index.js"]`

**No ports exposed** — Discord bot has no HTTP server.

## GitHub Actions Workflow

**File:** `.github/workflows/docker.yml`
**Trigger:** `push` to `main` branch

**Steps:**
1. `actions/checkout@v4`
2. `docker/login-action@v3` — authenticates to `ghcr.io` using `GITHUB_TOKEN` (no extra secrets needed)
3. `docker/metadata-action@v5` — generates tags: `latest` + `sha-<short-commit>`
4. `docker/setup-buildx-action@v3` — enables BuildKit
5. `docker/build-push-action@v6` — builds and pushes with GitHub Actions layer cache

**Permissions required:** `contents: read`, `packages: write`

## Volume / Data Strategy

| Path | Strategy | Reason |
|------|----------|--------|
| `/app/database` | Docker `VOLUME` | Persists guild language prefs and player state across restarts |
| `/app/audio_cache` | Ephemeral (in-container) | Files are deleted after playback; no persistence needed |
