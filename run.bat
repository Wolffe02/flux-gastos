@echo off
setlocal
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" app.py
) else (
  py -3 app.py
)
if errorlevel 1 (
  echo Flux no se pudo iniciar. Ejecuta primero install-windows.ps1.
  pause
)
