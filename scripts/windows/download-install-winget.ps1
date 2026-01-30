<#
.SYNOPSIS
Downloads the latest App Installer bundle (includes winget) and installs it.

.DESCRIPTION
Fetches the official App Installer .msixbundle from https://aka.ms/getwinget,
saves it to %TEMP%, then installs it via Add-AppxPackage. Run from an elevated
PowerShell session on the Windows target machine.
#>
[CmdletBinding()]
param()

if (-not ([bool](net session) 2>$null)) {
    throw "Run this script from an elevated PowerShell session (Run as administrator)."
}

$tempDir = Join-Path $env:TEMP 'winget-install'
if (-not (Test-Path $tempDir)) {
    New-Item -ItemType Directory -Path $tempDir | Out-Null
}

$appInstallerPath = Join-Path $tempDir 'AppInstaller.msixbundle'

Write-Host "Downloading App Installer (winget) bundle..."
Invoke-WebRequest -Uri 'https://aka.ms/getwinget' -OutFile $appInstallerPath -UseBasicParsing

Write-Host "Installing App Installer from $appInstallerPath ..."
Add-AppxPackage -Path $appInstallerPath -ForceApplicationShutdown

Write-Host "winget installation complete. Open a new PowerShell window and run 'winget --version' to verify."
