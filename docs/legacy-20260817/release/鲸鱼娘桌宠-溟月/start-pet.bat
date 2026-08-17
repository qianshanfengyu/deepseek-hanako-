@echo off
setlocal
rem start-pet.bat - launch whale pet (console window version)
rem Uses relative path from this script's folder so the package is portable.
set "APP_DIR=%~dp0electron"
set "ELECTRON=%APP_DIR%\node_modules\electron\dist\electron.exe"
if not exist "%ELECTRON%" (
  echo [ERROR] Electron not installed yet.
  echo Please open the "electron" folder and run:  npm install
  echo (slow network? use:  npm install --registry=https://registry.npmmirror.com)
  echo.
  pause
  exit /b 1
)
start "" "%ELECTRON%" "%APP_DIR%"
exit /b 0
