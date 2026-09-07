@echo off
setlocal

rem Start the Disaster Information System so other devices on this network can open it.
set "ROOT=%~dp0"
set "APP=%ROOT%artifacts\disaster-information-system"
set "PORT=5173"
set "BASE_PATH=/"

for /f "tokens=*" %%I in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 -PrefixOrigin Dhcp | Where-Object { $_.IPAddress -notlike '169.254.*' -and $_.IPAddress -ne '127.0.0.1' } | Select-Object -First 1 -ExpandProperty IPAddress)"') do set "LAN_IP=%%I"

if not defined LAN_IP set "LAN_IP=YOUR-COMPUTER-IP"

echo.
echo Disaster Information System is starting...
echo.
echo Share this link with users on the same Wi-Fi or LAN:
echo   http://%LAN_IP%:%PORT%/
echo.
echo Keep this window open while the app is being used.
echo Press Ctrl+C to stop the server.
echo.

cd /d "%APP%"
call pnpm run dev

endlocal
