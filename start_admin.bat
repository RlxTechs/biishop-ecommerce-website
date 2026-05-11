@echo off
cd /d %~dp0
powershell -ExecutionPolicy Bypass -File "%~dp0start_admin.ps1"
pause
