# 🎬 CineSync — Watch Party App

Stream movies from your PC and watch with friends in real time.
Synced playback · live chat · emoji reactions · anyone can create a room.

---

## How Rooms Work

- **Anyone** can create a room — they become the host
- The host gets a **Room ID** (e.g. `AB12CD`) to share with friends
- Friends enter the Room ID + password to join
- Host controls play/pause/seek for everyone
- If the host leaves, the next person automatically becomes host

---

## Local Setup (Dev)

### 1. Install dependencies

```bash
# Server
cd server && npm install

# Client
cd ../client && npm install
```

### 2. Add movies

```bash
mkdir server/movies
# Copy your .mp4 / .mkv / .webm files into server/movies/
```

### 3. Run (two terminals)

```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
cd client && npm run dev
```

Open **http://localhost:5173**

---

## Deploy to Render (Real Web Link)

This gives you a permanent public URL like `https://cinesync-client.onrender.com`

### Step 1 — Push to GitHub

```bash
cd watch-party-v2
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/cinesync.git
git push -u origin main
```

### Step 2 — Deploy the Backend (Server)

1. Go to https://render.com and sign in
2. Click **New → Web Service**
3. Connect your GitHub repo
4. Settings:
   - **Name**: `cinesync-server`
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
   - **Instance Type**: Free
5. Add Environment Variables:
   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `CLIENT_URL` | *(leave blank for now — fill after step 3)* |
6. Click **Deploy**. Copy the URL it gives you, e.g. `https://cinesync-server.onrender.com`

### Step 3 — Deploy the Frontend (Client)

1. Click **New → Static Site**
2. Connect your same GitHub repo
3. Settings:
   - **Name**: `cinesync-client`
   - **Root Directory**: `client`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Add Environment Variable:
   | Key | Value |
   |-----|-------|
   | `VITE_SERVER_URL` | `https://cinesync-server.onrender.com` *(your server URL from step 2)* |
5. Add Redirect Rule:
   - Source: `/*`
   - Destination: `/index.html`
   - Type: Rewrite
6. Click **Deploy**. Copy the URL, e.g. `https://cinesync-client.onrender.com`

### Step 4 — Link them together

Go back to your **cinesync-server** service on Render:
- Environment → `CLIENT_URL` → set to `https://cinesync-client.onrender.com`
- Click **Save** and let it redeploy

### Done! 🎉

Your app is live at `https://cinesync-client.onrender.com`

Share this link with anyone — they can create rooms or join existing ones.

---

## ⚠️ About Video Files on Render

Render's free tier does **not** have persistent disk storage. This means:

- You **cannot** upload movies to Render directly
- The `movies/` folder only works locally
- **For production**, you have two options:

### Option A — Keep hosting locally (recommended for now)
Run the server on your laptop, deploy only the frontend to Render:
- Frontend (Render static site): handles the UI
- Backend (your laptop): handles video streaming + Socket.IO
- Use **ngrok** or **Cloudflare Tunnel** to expose your local server

Set `VITE_SERVER_URL` on Render to your ngrok URL, e.g.:
```
VITE_SERVER_URL=https://abc123.ngrok.io
```

### Option B — Use cloud video storage
Store videos on **Cloudflare R2** or **Backblaze B2** (both free tier available),
then update `video.js` to stream from those URLs instead of the local filesystem.

---

## Supported Formats

| Format | Browser Support |
|--------|----------------|
| `.mp4` | ✅ All browsers |
| `.webm` | ✅ Chrome, Firefox |
| `.mkv` | ⚠️ Chrome/Edge only |

> Tip: Convert to MP4 with HandBrake for best compatibility.

---

## Tech Stack

- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: React 18, Vite, Tailwind CSS
- **Video**: HTML5 + Express range streaming
- **Realtime**: Socket.IO WebSockets
- **Hosting**: Render

