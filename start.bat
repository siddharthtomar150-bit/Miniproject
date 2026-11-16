@echo off
title Student Performance Tracker
echo ===================================================
echo   Starting Student Performance Tracker Server...
echo   Dashboard will open at: http://localhost:8000
echo ===================================================
timeout /t 2 /nobreak >nul
start "" "http://localhost:8000"
python run.py
pause
