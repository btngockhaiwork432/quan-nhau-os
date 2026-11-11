@echo off
chcp 65001 >nul
title Cai Tu Khoi Dong Cung Windows - Quan Nhau Print Bridge
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "TARGET_BAT=%~dp0CHAY_KET_NOI_MAY_IN_LAN.bat"
set "SHORTCUT_VBS=%TEMP%\create_qn_print_shortcut.vbs"

echo Set oWS = WScript.CreateObject("WScript.Shell") > "%SHORTCUT_VBS%"
echo sLinkFile = "%STARTUP_DIR%\QuanNhau_AutoPrint_LAN.lnk" >> "%SHORTCUT_VBS%"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%SHORTCUT_VBS%"
echo oLink.TargetPath = "%TARGET_BAT%" >> "%SHORTCUT_VBS%"
echo oLink.WorkingDirectory = "%~dp0" >> "%SHORTCUT_VBS%"
echo oLink.WindowStyle = 7 >> "%SHORTCUT_VBS%"
echo oLink.Description = "Tu dong ket noi may in nhiet LAN cho Quan Nhau OS" >> "%SHORTCUT_VBS%"
echo oLink.Save >> "%SHORTCUT_VBS%"

cscript //nologo "%SHORTCUT_VBS%"
del "%SHORTCUT_VBS%" >nul 2>nul

echo ======================================================================
echo DA CAI DAT THANH CONG!
echo Tu nay moi khi bat may tinh Thu ngan len, bo ket noi may in nhiet LAN
echo se TU DONG CHAY NGAM duoi thanh Taskbar ma khong can bam tay nua.
echo ======================================================================
pause
