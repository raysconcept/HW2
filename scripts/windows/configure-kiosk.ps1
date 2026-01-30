<#
.SYNOPSIS
Configures Windows kiosk (Assigned Access) for the Optiplex.

.DESCRIPTION
Creates a local kiosk user (if needed), optionally sets the password,
and maps that account to a single-app kiosk experience (default: Microsoft Edge).
Run this script from an elevated PowerShell session.

.PARAMETER UserName
Local account to dedicate to kiosk mode. Defaults to 'KioskUser'.

.PARAMETER Password
Plain-text password for the kiosk account. If omitted and the account does not
exist, you will be prompted.

.PARAMETER AppAumid
The AUMID of the kiosk app. Defaults to Microsoft Edge in fullscreen kiosk mode.

.PARAMETER AutoLogon
Switch that enables automatic logon for the kiosk account.
#>
[CmdletBinding()]
param(
    [string]$UserName = 'KioskUser',

    [SecureString]$Password,

    [string]$AppAumid = 'Microsoft.MicrosoftEdge_8wekyb3d8bbwe!MicrosoftEdge',

    [switch]$AutoLogon
)

function Assert-Admin {
    if (-not ([bool](net session) 2>$null)) {
        throw "Run this script from an elevated PowerShell session (Run as administrator)."
    }
}

function Ensure-Password {
    param(
        [SecureString]$Password
    )

    if ($Password) {
        return $Password
    }

    Write-Host "Enter password for kiosk account (input hidden):"
    return Read-Host -AsSecureString
}

function Ensure-KioskUser {
    param(
        [string]$UserName,
        [SecureString]$Password
    )

    $localUser = Get-LocalUser -Name $UserName -ErrorAction SilentlyContinue
    if ($null -eq $localUser) {
        Write-Host "Creating kiosk user '$UserName'..."
        New-LocalUser -Name $UserName -Password $Password -PasswordNeverExpires -UserMayNotChangePassword | Out-Null
    } elseif ($Password) {
        Write-Host "Updating password for existing user '$UserName'..."
        $plain = [Runtime.InteropServices.Marshal]::PtrToStringUni([Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password))
        net user $UserName $plain | Out-Null
    }

    Add-LocalGroupMember -Group 'Users' -Member $UserName -ErrorAction SilentlyContinue
}

function Enable-AutoLogon {
    param(
        [string]$UserName,
        [SecureString]$Password
    )

    $plain = [Runtime.InteropServices.Marshal]::PtrToStringUni([Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password))
    $regPath = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon'

    Set-ItemProperty -Path $regPath -Name 'AutoAdminLogon' -Value '1'
    Set-ItemProperty -Path $regPath -Name 'DefaultUserName' -Value $UserName
    Set-ItemProperty -Path $regPath -Name 'DefaultPassword' -Value $plain
}

try {
    Assert-Admin

    $resolvedPassword = Ensure-Password -Password $Password
    Ensure-KioskUser -UserName $UserName -Password $resolvedPassword

    Write-Host "Configuring Assigned Access for '$UserName' with app '$AppAumid'..."
    Set-AssignedAccess -UserName $UserName -AUMID $AppAumid

    if ($AutoLogon) {
        Write-Host "Enabling automatic logon..."
        Enable-AutoLogon -UserName $UserName -Password $resolvedPassword
    }

    Write-Host "Kiosk mode configured. Sign out and choose the '$UserName' account to verify."
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
