# Frontend MVP

This frontend is a Vite + React + TypeScript client for the Sports Strategy Engine API.

## Local URLs

- Backend API: `http://localhost:8000`
- Frontend dev server: `http://localhost:5173`

## Install

```bash
cd frontend
npm install
```

## Run The Backend

From the repository root:

```bash
uvicorn backend.app.main:app --reload
```

## Run The Frontend

From `frontend/`:

```bash
npm run dev
```

## Production Build

```bash
npm run build
```

The frontend assumes the backend is available at `http://localhost:8000`.
