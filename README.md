# F1 Tipping Game 2026

Two-player Formula 1 tipping game for the 2026 season. Predict the Top 10 for every Qualifying, Race, Sprint Qualifying and Sprint Race.

**Scoring:** 1 point for correct driver in Top 10 · 3 points for exact position · Max 30 points per session

**Live:** https://tyrabite.github.io/f1-tipping-game/

---

## Local Development

### Prerequisites
- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools`
- Java (for Firebase Emulator): `java -version`

### Setup

1. **Clone and install**
   ```bash
   git clone https://github.com/TyraBite/f1-tipping-game.git
   cd f1-tipping-game
   npm install
   ```

2. **Copy env file**
   ```bash
   cp .env.local.example .env.local
   # Fill in Firebase values (or leave defaults for emulator-only dev)
   ```

3. **Start emulator + seed data**
   ```bash
   # Terminal 1
   npm run emulators

   # Terminal 2 (once emulator is ready)
   npm run seed
   ```

4. **Start dev server**
   ```bash
   npm run dev
   ```
   Open http://localhost:5173/f1-tipping-game/
   Login: `player1@test.com` / `test1234`

### Running Tests
```bash
npm test              # unit tests
npm run test:e2e      # E2E (requires running dev server)
```

---

## Firebase Setup (Production)

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create project → enable **Firestore** (production mode) and **Authentication** (Email/Password)
3. Copy config values from Project Settings → Your apps → Web app
4. Paste into `.env.local` and GitHub Secrets (see below)

### Firestore Rules
Deploy rules:
```bash
firebase deploy --only firestore:rules
```

---

## GitHub Actions Setup

### Deploy Workflow
Automatically deploys to GitHub Pages on every push to `main`.

**Required GitHub Secrets** (Settings → Secrets → Actions):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

### Event Sync Workflow (Phase 2)
The sync job self-schedules around race events and requires one additional secret:

**`PAT_WORKFLOW`** — GitHub Personal Access Token with `workflow` scope.

**How to create:**
1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Name: `f1-tipping-sync`
3. Repository access: Only `f1-tipping-game`
4. Permissions: **Contents** (Read & Write) + **Workflows** (Read & Write)
5. Copy token → add as `PAT_WORKFLOW` secret in repo settings

---

## Verifying 2026 Driver List

The file `data/season-2026.json` contains the known 2026 driver lineup. Verify and update before the season starts.
