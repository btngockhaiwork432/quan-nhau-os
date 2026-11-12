@echo off
chcp 65001 >nul
title Quan Nhau OS - Ket Noi May In Nhiet K80 Tu Dong (USB + Wi-Fi/LAN)
cd /d "%~dp0"

set "PY_CMD="
python -c "import sys" >nul 2>nul
if %errorlevel% equ 0 (
    set "PY_CMD=python"
) else (
    py -3 -c "import sys" >nul 2>nul
    if not errorlevel 1 set "PY_CMD=py -3"
)

if "%PY_CMD%"=="" (
    echo ====================================================================
    echo [CHUA CAI PYTHON] May tinh nay chua cai Python 3.
    echo Hay tai Python 3 mien phi tai https://www.python.org/downloads/
    echo Luu y tich chon o "Add Python to PATH" khi cai dat, sau do mo lai tep nay!
    echo ====================================================================
    pause
    exit /b 1
)

%PY_CMD% quannhau_print_bridge.py --server https://munbao.com
pause
