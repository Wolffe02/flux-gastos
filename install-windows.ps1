$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = Get-Command py -ErrorAction SilentlyContinue
if (-not $Python) { throw 'Instala Python 3 desde python.org y vuelve a ejecutar este instalador.' }
py -3 -m venv (Join-Path $Root '.venv')
& (Join-Path $Root '.venv\Scripts\python.exe') -m pip install --upgrade pip
& (Join-Path $Root '.venv\Scripts\python.exe') -m pip install -r (Join-Path $Root 'requirements.txt')
Write-Host 'Flux está preparado. Abre run.bat para iniciar la app.'
Write-Host 'Para la conexión bancaria, inicia Flux una vez y ejecuta trust-local-cert.ps1 install.'
