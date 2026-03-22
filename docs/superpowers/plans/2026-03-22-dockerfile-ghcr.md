# Dockerfile + GHCR Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a multi-stage Alpine Dockerfile and a GitHub Actions workflow that builds and pushes the image to `ghcr.io` on every push to `main`.

**Architecture:** Two-stage Alpine build — builder stage compiles native modules with build tools (`python3`, `make`, `g++`), runtime stage copies artifacts and adds only `gcompat` (GNU libc compatibility for `ffmpeg-static` and `yt-dlp`). A GitHub Actions workflow authenticates to ghcr.io using `GITHUB_TOKEN` and tags the image as `latest` plus `sha-<short-commit>`.

**Tech Stack:** Docker (multi-stage), `node:24-alpine`, `gcompat`, GitHub Actions, `docker/build-push-action@v6`, `docker/metadata-action@v5`

---

### Task 1: `.dockerignore`

**Files:**
- Create: `.dockerignore`

- [ ] **Step 1: Create `.dockerignore`**

  ```
  node_modules
  .git
  .env
  audio_cache
  database
  docs
  *.bat
  *.log
  README*.md
  SHARDING.md
  YOUTUBE_FIX.md
  PRIVACY_POLICY.md
  TERMS_OF_SERVICE.md
  ```

  This keeps secrets (`.env`), runtime-generated data (`audio_cache`, `database`), and documentation out of the build context.

- [ ] **Step 2: Verify build context is clean**

  Run: `docker build --no-cache --dry-run . 2>&1 | head -5` (or just confirm the file exists and is well-formed)

- [ ] **Step 3: Commit**

  ```bash
  git add .dockerignore
  git commit -m "chore: add .dockerignore for Docker build context"
  ```

---

### Task 2: `Dockerfile`

**Files:**
- Create: `Dockerfile`

- [ ] **Step 1: Write the Dockerfile**

  ```dockerfile
  # ── Builder stage ──────────────────────────────────────────────────────────
  FROM node:24-alpine AS builder

  WORKDIR /app

  # Build tools required for native modules (opusscript, prism-media)
  RUN apk add --no-cache python3 make g++ ca-certificates

  COPY package*.json ./

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
  RUN apk add --no-cache gcompat ca-certificates

  COPY --from=builder /app .

  # Ensure writable dirs exist and are owned by the non-root node user
  RUN mkdir -p audio_cache database && chown -R node:node /app

  # Persist guild language preferences and player state across restarts.
  # Mount a named volume here: docker run -v betty-db:/app/database ...
  VOLUME ["/app/database"]

  # Discord bot — no HTTP server, no port to expose

  USER node

  CMD ["node", "index.js"]
  ```

- [ ] **Step 2: Build the image locally to verify it compiles**

  ```bash
  docker build -t betty:local .
  ```

  Expected: build completes without errors. The `npm ci` step will download the yt-dlp binary — this is normal and takes ~30 s on first run.

- [ ] **Step 3: Smoke-test the image starts (will exit without valid credentials — that's fine)**

  ```bash
  docker run --rm betty:local
  ```

  Expected: process starts, logs a Discord login error or token error, then exits. It must NOT fail with `ffmpeg not found`, `yt-dlp: not found`, or a `SIGILL`/`Illegal instruction` crash (which would indicate a glibc ABI mismatch).

- [ ] **Step 4: Commit**

  ```bash
  git add Dockerfile
  git commit -m "feat: add multi-stage Alpine Dockerfile"
  ```

---

### Task 3: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/docker.yml`

- [ ] **Step 1: Create the workflow directory and file**

  ```bash
  mkdir -p .github/workflows
  ```

  Create `.github/workflows/docker.yml`:

  ```yaml
  name: Build and Push Docker Image

  on:
    push:
      branches: [main]

  jobs:
    build-and-push:
      runs-on: ubuntu-latest
      permissions:
        contents: read
        packages: write  # required to push to ghcr.io

      steps:
        - name: Checkout
          uses: actions/checkout@v4

        - name: Log in to GitHub Container Registry
          uses: docker/login-action@v3
          with:
            registry: ghcr.io
            username: ${{ github.actor }}
            password: ${{ secrets.GITHUB_TOKEN }}

        - name: Extract metadata
          id: meta
          uses: docker/metadata-action@v5
          with:
            images: ghcr.io/${{ github.repository }}
            tags: |
              type=raw,value=latest
              type=sha

        - name: Set up Docker Buildx
          uses: docker/setup-buildx-action@v3

        - name: Build and push
          uses: docker/build-push-action@v6
          with:
            context: .
            push: true
            tags: ${{ steps.meta.outputs.tags }}
            labels: ${{ steps.meta.outputs.labels }}
            cache-from: type=gha
            cache-to: type=gha,mode=max
  ```

  The `type=sha` tag produces `sha-<7-char-commit>` (e.g. `sha-abc1234`), making every pushed image traceable to a specific commit.

- [ ] **Step 2: Verify YAML syntax**

  ```bash
  docker run --rm -v "$PWD":/data cytopia/yamllint .github/workflows/docker.yml
  ```

  Or simply inspect the file for indentation errors.

- [ ] **Step 3: Commit and push**

  ```bash
  git add .github/workflows/docker.yml
  git commit -m "ci: add GitHub Actions workflow to build and push to ghcr.io"
  git push origin main
  ```

- [ ] **Step 4: Verify the workflow triggered**

  Go to the repository's **Actions** tab on GitHub. The `Build and Push Docker Image` workflow should appear and pass. Check `ghcr.io/<owner>/<repo>` under **Packages** to confirm the image is published with `latest` and `sha-*` tags.

---

## Runtime usage note

Secrets are passed at `docker run` time — they are never baked into the image:

```bash
docker run -d \
  --name betty \
  -e DISCORD_TOKEN=your_token \
  -e CLIENT_ID=your_client_id \
  -e SPOTIFY_CLIENT_ID=... \
  -e SPOTIFY_CLIENT_SECRET=... \
  -v betty-db:/app/database \
  ghcr.io/<owner>/<repo>:latest
```
