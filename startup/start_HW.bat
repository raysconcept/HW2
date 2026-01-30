@echo off
echo Starting HotWheels Application...

rem Open Database control pannel
rem start C:\xampp\xampp-control.exe

rem timeout 2

cd %~dp0
cd ..

rem Open Web Interface
start chrome http://192.168.1.12:3001/HW

cmd /k "npm start"

echo.
echo Application has stopped running.
echo Press any key to close this window...

pause > nul