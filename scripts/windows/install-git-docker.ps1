<#
.SYNOPSIS
Installs Git and Docker Desktop on Windows using winget.

.DESCRIPTION
Checks for administrative privileges, optionally enables virtualization
features, and installs Git (with Git LFS) and Docker Desktop in unattended
mode via winget. Run from an elevated PowerShell session on the target machine.

.PARAMETER EnableHyperV
Enable the Hyper-V and Containers features required for Docker Desktop on
Windows Pro/Enterprise editions.

.PARAMETER EnableWSL
Enable the Windows Subsystem for Linux feature. Docker Desktop leverages WSL2
on modern Windows builds.

.EXAMPLE
PS C:\> .\install-git-docker.ps1 -EnableHyperV -EnableWSL

Enables virtualization features, installs Git, Git LFS, and Docker Desktop.
#>
[CmdletBinding()]
param(
    [switch]$EnableHyperV,
    [switch]$EnableWSL
)

function Assert-Admin {
    if (-not ([bool](net session) 2>$null)) {
        throw "Run this script from an elevated PowerShell session (Run as administrator)."
    }
}

function Assert-Winget {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw "winget (App Installer) is not available. Install App Installer from the Microsoft Store, then rerun this script."
    }
}

function Install-WindowsFeature {
    param(
        [Parameter(Mandatory)]
        [string]$FeatureName
    )

    try {
        $feature = Get-WindowsOptionalFeature -Online -FeatureName $FeatureName -ErrorAction Stop
    } catch {
        Write-Warning "Feature '$FeatureName' is unavailable on this edition of Windows."
        return
    }

    if ($feature.State -eq 'Enabled') {
        Write-Verbose "Feature '$FeatureName' already enabled."
        return
    }

    Write-Host "Enabling Windows feature: $FeatureName ..."
    Enable-WindowsOptionalFeature -Online -FeatureName $FeatureName -All -NoRestart -ErrorAction Stop | Out-Null
    Write-Host "Feature '$FeatureName' enabled. A restart may be required."
}

function Install-WingetPackage {
    param(
        [Parameter(Mandatory)]
        [string]$Id,

        [string]$DisplayName
    )

    if ([string]::IsNullOrWhiteSpace($DisplayName)) {
        $DisplayName = $Id
    }

    $installed = winget list --id $Id --source winget 2>$null
    if ($LASTEXITCODE -eq 0 -and $installed) {
        Write-Host "$DisplayName already installed. Skipping."
        return
    }

    Write-Host "Installing $DisplayName ..."
    winget install --id $Id --exact --silent --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) {
        throw "winget failed to install $DisplayName (exit code $LASTEXITCODE)."
    }
    Write-Host "$DisplayName installed."
}

try {
    Assert-Admin
    Assert-Winget

    if ($EnableHyperV) {
        Install-WindowsFeature -FeatureName 'Microsoft-Hyper-V-All'
        Install-WindowsFeature -FeatureName 'VirtualMachinePlatform'
        Install-WindowsFeature -FeatureName 'Containers'
    }

    if ($EnableWSL) {
        Install-WindowsFeature -FeatureName 'Microsoft-Windows-Subsystem-Linux'
        Install-WindowsFeature -FeatureName 'VirtualMachinePlatform'
    }

    Install-WingetPackage -Id 'Git.Git' -DisplayName 'Git'
    Install-WingetPackage -Id 'GitHub.GitLFS' -DisplayName 'Git LFS'
    Install-WingetPackage -Id 'Docker.DockerDesktop' -DisplayName 'Docker Desktop'

    Write-Host "Running 'wsl --update' to ensure the kernel is current ..."
    try {
        wsl --update
    } catch {
        Write-Warning "wsl --update failed: $($_.Exception.Message)"
    }

    Write-Host ""
    Write-Host "Git and Docker Desktop installation complete."
    if ($EnableHyperV -or $EnableWSL) {
        Write-Host "A reboot is recommended to finalize Windows feature changes."
    }
    Write-Host "After reboot, launch Docker Desktop once to finish setup,"
    Write-Host "and verify 'docker version' plus 'git --version' from a new terminal."
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
