<#
.SYNOPSIS
Sets the Windows UI/system language, locale, and keyboard layout to English (United States).

.DESCRIPTION
Installs the required language capabilities (if not already present), then applies
the en-US locale settings for the current user, the welcome screen, and new accounts.
Run this script from an elevated PowerShell session on the target Windows machine.

.PARAMETER Language
Language tag to install and activate. Defaults to en-US.

.PARAMETER InstallSpeech
Install the speech capability pack for the language.

.PARAMETER InstallHandwriting
Install the handwriting capability pack for the language.

.EXAMPLE
PS C:\> .\set-windows-english.ps1

Installs the English (United States) language pack and sets it as the system language.

.NOTES
- Requires Windows 10/11 with access to Windows Update or pre-downloaded language packs.
- A reboot or sign-out is required for all UI surfaces to reflect the change.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$Language = 'en-US',

    [switch]$InstallSpeech,
    [switch]$InstallHandwriting
)

function Ensure-WindowsCapability {
    param(
        [Parameter(Mandatory)]
        [string]$CapabilityName
    )

    $capability = Get-WindowsCapability -Online |
        Where-Object { $_.Name -eq $CapabilityName }

    if (-not $capability) {
        Write-Warning "Capability '$CapabilityName' not found on this system."
        return
    }

    if ($capability.State -eq 'Installed') {
        Write-Verbose "Capability '$CapabilityName' already installed."
        return
    }

    Write-Host "Installing Windows capability: $CapabilityName ..."
    Add-WindowsCapability -Online -Name $CapabilityName -ErrorAction Stop | Out-Null
    Write-Host "Capability '$CapabilityName' installed."
}

function Update-LanguageSettings {
    param(
        [Parameter(Mandatory)]
        [string]$LanguageTag
    )

    Write-Host "Setting UI language override to $LanguageTag ..."
    Set-WinUILanguageOverride -Language $LanguageTag

    Write-Host "Setting system locale to $LanguageTag ..."
    Set-WinSystemLocale -SystemLocale $LanguageTag

    Write-Host "Setting culture to $LanguageTag ..."
    Set-Culture $LanguageTag

    Write-Host "Setting home location to United States ..."
    Set-WinHomeLocation -GeoId 244

    $languageList = New-WinUserLanguageList -Language $LanguageTag
    Write-Host "Updating user language list ..."
    Set-WinUserLanguageList -LanguageList $languageList -Force

    # Default English (US) keyboard layout TIP: 0409:00000409
    Write-Host "Setting default input method override ..."
    Set-WinDefaultInputMethodOverride -InputTip '0409:00000409'
}

function Copy-LocaleSettingsToSystem {
    param(
        [Parameter(Mandatory)]
        [string]$LanguageTag
    )

    $localeFile = Join-Path $env:TEMP 'locale-en.xml'

    $localeContent = @"
<?xml version="1.0" encoding="utf-8"?>
<gs:GlobalizationServices xmlns:gs="urn:longhornGlobalizationUnattend">
  <gs:UserList>
    <gs:User UserID="CurrentUser">
      <gs:UserLocale Name="$LanguageTag" />
      <gs:Location Value="244" />
    </gs:User>
  </gs:UserList>
  <gs:LocationPreferences>
    <gs:GeoID Value="244" />
  </gs:LocationPreferences>
  <gs:SystemLocale Name="$LanguageTag" />
  <gs:Formats>
    <gs:Format Name="$LanguageTag" />
  </gs:Formats>
  <gs:UserLocalePreferences>
    <gs:UserLocale Name="$LanguageTag" Script="Latn" />
  </gs:UserLocalePreferences>
</gs:GlobalizationServices>
"@

    Set-Content -Path $localeFile -Value $localeContent -Encoding UTF8

    Write-Host "Applying locale settings to welcome screen and new user profiles ..."
    & "$env:SystemRoot\System32\control.exe" "intl.cpl,,/f:`"$localeFile`""
}

function Update-DefaultUserRegistry {
    param(
        [Parameter(Mandatory)]
        [string]$LanguageTag
    )

    Write-Host "Updating default user registry locale settings ..."
    reg add 'HKU\.DEFAULT\Control Panel\International' /v LocaleName /t REG_SZ /d $LanguageTag /f | Out-Null
    reg add 'HKU\.DEFAULT\Keyboard Layout\Preload' /v 1 /t REG_SZ /d 00000409 /f | Out-Null
}

if (-not ([bool](net session) 2>$null)) {
    Write-Warning "This script must be run from an elevated PowerShell session."
    return
}

Write-Host "Target language: $Language"

Ensure-WindowsCapability -CapabilityName "Language.Basic~~~$Language~0.0.1.0"

if ($InstallSpeech.IsPresent) {
    Ensure-WindowsCapability -CapabilityName "Language.Speech~~~$Language~0.0.1.0"
}

if ($InstallHandwriting.IsPresent) {
    Ensure-WindowsCapability -CapabilityName "Language.Handwriting~~~$Language~0.0.1.0"
}

Update-LanguageSettings -LanguageTag $Language
Copy-LocaleSettingsToSystem -LanguageTag $Language
Update-DefaultUserRegistry -LanguageTag $Language

Write-Host "Language configuration complete. Please sign out or reboot to apply the changes everywhere."
