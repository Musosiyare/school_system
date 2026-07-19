@echo off
REM Starts the backend API and the frontend dev server together.
REM Double-click this file (or run it from a terminal) to launch the whole
REM app — the frontend will automatically open in your default browser once
REM Vite finishes starting (see frontend/vite.config.js -> server.open).

echo Starting backend...
start "School System - Backend" cmd /k "cd backend && npm run dev"

echo Starting frontend...
start "School System - Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Both servers are starting in separate windows.
echo The app will open in your browser automatically in a few seconds.
