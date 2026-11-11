@echo off
chcp 65001 >nul
title Quan Nhau OS - Ket Noi May In Nhiet K80 Tu Dong (LAN 9100)
cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo ====================================================================
    echo [CHUA CAI PYTHON] May tinh nay chua cai Python 3.
    echo Hay tai Python 3 mien phi tai https://www.python.org/downloads/
    echo Luu y tich chon o "Add Python to PATH" khi cai dat, sau do mo lai tep nay!
    echo ====================================================================
    pause
    exit /b 1
)

python quannhau_print_bridge.py --server https://munbao.com
pause
