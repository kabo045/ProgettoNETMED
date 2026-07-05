@echo off
:: Doppio click su questo file lancia il test API in PowerShell
:: senza dover sbloccare ExecutionPolicy.
powershell -ExecutionPolicy Bypass -File "%~dp0test-api.ps1"
pause
