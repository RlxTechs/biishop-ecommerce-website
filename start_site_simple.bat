@echo off
cd /d %~dp0
powershell -ExecutionPolicy Bypass -File "%~dp0start_site_simple.ps1"
pause
