# Collaborative Code Editor — Frontend

This is a minimal React + Vite + TypeScript frontend for a collaborative code editor. It uses Monaco Editor and connects to a backend over REST and WebSocket for collaborative editing.

Assumptions
- Backend HTTP API base is provided in `VITE_BACKEND_HTTP` (see `.env.example`).
- Backend WebSocket endpoint is `VITE_BACKEND_WS`.
- WebSocket messages are simple JSON patches with shape: { type: 'update', id, content }

Run locally

1. copy `.env.example` to `.env`
2. npm install
3. npm run dev

Open http://localhost:5173

Deployed on Vercel for now: https://codellab-editor-nggklgdhr-farazs-projects-f2fc8a60.vercel.app
