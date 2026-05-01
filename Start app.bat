@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed yet.
  echo.
  echo Please install Node.js, then double-click this file again.
  echo Download it from: https://nodejs.org/
  echo.
  pause
  exit /b
)

start "Brixham Swim Forecast Server" cmd /k "cd /d "%~dp0" && node tools\static-server.js"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8123"
