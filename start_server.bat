@echo off
chcp 65001 >nul
cd /d "%~dp0backend"
echo Dang khoi dong Quan Nhau OS (FastAPI + PostgreSQL 16) tai http://localhost:8765 ...
python server.py
pause
