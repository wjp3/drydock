@echo off
rem Runs the Drydock installer. Right-click this file and choose "Run as administrator".
rem If Windows shows "Windows protected your PC", click "More info", then "Run anyway".
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Drydock.ps1"
pause
