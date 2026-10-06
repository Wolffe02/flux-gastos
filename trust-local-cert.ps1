param(
    [ValidateSet('install', 'remove')]
    [string]$Action = 'install'
)

$ErrorActionPreference = 'Stop'
$ConfigDir = Join-Path $env:APPDATA 'flux-gastos'
if (-not (Test-Path $ConfigDir) -and (Test-Path (Join-Path $env:APPDATA 'claro-gastos'))) {
    $ConfigDir = Join-Path $env:APPDATA 'claro-gastos'
}
$CertificatePath = Join-Path $ConfigDir 'flux-localhost.crt'

if ($Action -eq 'install') {
    if (-not (Test-Path $CertificatePath)) {
        throw "Inicia Flux una vez para crear el certificado $CertificatePath"
    }
    & certutil.exe -user -addstore -f Root $CertificatePath
    if ($LASTEXITCODE -ne 0) { throw 'Windows no pudo importar el certificado.' }
    Write-Host 'Certificado localhost confiado para tu usuario. Reinicia el navegador.'
} else {
    if (-not (Test-Path $CertificatePath)) {
        throw "No encuentro el certificado $CertificatePath para identificarlo y retirarlo."
    }
    $Certificate = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($CertificatePath)
    $StorePath = 'Cert:\CurrentUser\Root'
    $Matches = Get-ChildItem $StorePath | Where-Object Thumbprint -eq $Certificate.Thumbprint
    foreach ($Match in $Matches) { Remove-Item (Join-Path $StorePath $Match.Thumbprint) }
    Write-Host 'Certificado localhost retirado del almacén de tu usuario.'
}
