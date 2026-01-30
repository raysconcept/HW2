<#
.SYNOPSIS
Installs and enables the Windows OpenSSH Server.

.DESCRIPTION
Adds the OpenSSH.Server capability, starts the sshd service, configures it to
launch automatically, and opens the firewall rule for inbound SSH connections.
Run this from an elevated PowerShell session on the Windows machine.

.EXAMPLE
PS C:\> .\enable-openssh-server.ps1

Installs OpenSSH Server (if missing) and ensures it is running and enabled.
#>
[CmdletBinding()]
param()

function Assert-Admin {
    if (-not ([bool](net session) 2>$null)) {
        throw "Run this script from an elevated PowerShell session (Run as administrator)."
    }
}

function Install-OpenSSH {
    Write-Host "Installing OpenSSH Server capability (if needed)..."
    $result = Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0 -ErrorAction Continue

    if ($result -and $result.RestartNeeded -eq 'True') {
        Write-Warning "Windows reports a restart is required to finish installing OpenSSH Server."
    }
}

function Configure-Service {
    Write-Host "Starting sshd service..."
    Start-Service sshd -ErrorAction SilentlyContinue

    Write-Host "Setting sshd service to start automatically..."
    Set-Service -Name sshd -StartupType Automatic
}

function Configure-Firewall {
    Write-Host "Enabling Windows Firewall rule for OpenSSH Server..."
    Enable-NetFirewallRule -Name "OpenSSH-Server-In-TCP" -ErrorAction SilentlyContinue
}

try {
    Assert-Admin
    Install-OpenSSH
    Configure-Service
    Configure-Firewall

    Write-Host "OpenSSH Server is installed and enabled."
    Write-Host "Test connectivity from another machine with: ssh <user>@<windows-ip>"
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
