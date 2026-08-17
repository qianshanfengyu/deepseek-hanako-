@echo off
setlocal
set "APP_DIR=E:\AI\dsh-jiadaizi-like-pet\electron"
set "ELECTRON=%APP_DIR%\node_modules\electron\dist\electron.exe"
start "" "%ELECTRON%" "%APP_DIR%"
exit /b 0
