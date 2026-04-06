# Mitch OS 88

Mitch OS 88 is a full-stack web application that simulates a restricted early-1990s desktop operating system with a single globally shared WAV file. Only one listener can access the file at a time, and every listening session permanently mutates and overwrites the canonical audio on the server.

## Stack

- Backend: FastAPI
- Frontend: Next.js (React)
- Audio processing: numpy, scipy, soundfile

## Project Layout

- `backend/` FastAPI API, queue/session logic, persistent state, destructive audio pipeline
- `frontend/` Next.js System 7-style desktop UI
- `backend/data/` canonical WAV and persisted global state

## Run The Backend

```bash
cd /Users/Mr.Mitch/Documents/Viral Song/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The backend seeds `backend/data/mitch_os_88_master.wav` automatically on first start if no canonical file exists.

## Run The Frontend

```bash
cd /Users/Mr.Mitch/Documents/Viral Song/frontend
npm install
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 npm run dev
```

Open `http://127.0.0.1:3000`.

## Deploy

### Backend on Render

This backend permanently rewrites the canonical WAV, so it needs persistent writable storage. A serverless host is not a good fit.

This repo includes:

- [`render.yaml`](/Users/Mr.Mitch/Documents/Viral%20Song/render.yaml) for a Render web service with an attached disk
- [`backend/Dockerfile`](/Users/Mr.Mitch/Documents/Viral%20Song/backend/Dockerfile) for container deployment

Recommended steps:

1. Create a new Render Blueprint from this repo.
2. Deploy the `mitch-os-88-backend` service.
3. Set `MITCH_OS_88_ALLOWED_ORIGINS` to your Vercel frontend URL once you have it.
4. Note the public backend URL, for example `https://mitch-os-88-backend.onrender.com`.

### Frontend on Vercel

Once the backend is live, set this environment variable in Vercel for the frontend project:

```bash
NEXT_PUBLIC_API_URL=https://your-backend-host.example.com
```

Then deploy the `frontend/` app to Vercel.

## Core Behavior

- One active listener globally, enforced with a backend queue
- Session damage is based on real listened progress, not a fake visual filter
- Every completed or interrupted session mutates the stored WAV in place
- Death occurs when the file becomes undecodable or acoustically unusable
- Playback is disabled after death
