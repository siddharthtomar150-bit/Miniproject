Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  Starting Student Performance Tracker Server..." -ForegroundColor Cyan
Write-Host "  Dashboard URL: http://localhost:8000" -ForegroundColor Yellow
Write-Host "===================================================" -ForegroundColor Cyan

Start-Process "http://localhost:8000"
python run.py
