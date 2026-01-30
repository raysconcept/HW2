# Windows ↔ Ubuntu SSH File Transfer Setup

This note captures the steps used to move files from the Ubuntu dev PC to the Windows Optiplex over the shared Ethernet link using SSH/SCP.

## 1. Prepare the Windows account
- Confirm the Windows username with `whoami` (output format `COMPUTER\username`; use only the username, e.g. `dell`).
- Assign a non-empty password (required for OpenSSH logins):
  ```powershell
  net user <username> <NewStrongPassword>
  ```
  Run this from an elevated PowerShell/Command Prompt on the Optiplex.

## 2. Enable OpenSSH Server on Windows
1. Copy `scripts/windows-install/enable-openssh-server.ps1` to the Optiplex (USB or other means).
2. Open PowerShell **as administrator** and run:
   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
   .\enable-openssh-server.ps1
   ```
   The script installs the `OpenSSH.Server` capability, starts the `sshd` service, configures automatic startup, and opens the firewall rule `OpenSSH-Server-In-TCP`.
3. Reboot if prompted that a restart is required (usually not needed, but some builds request it).

## 3. Verify SSH locally
- On the Optiplex run:
  ```powershell
  Get-Service sshd
  ```
  Ensure the status is `Running`.
- Optionally test loopback login:
  ```powershell
  ssh <username>@localhost
  ```
  Accept the host key, then exit.

## 4. Transfer files from Ubuntu
- From the Ubuntu dev PC, use `scp` pointing to the Windows Desktop:
  ```bash
  scp /path/to/file <username>@10.42.0.84:'C:/Users/<username>/Desktop/file'
  ```
  Replace the IP with whatever `ipconfig` reports on the Optiplex (e.g. `10.42.0.84`).
- To copy directories, add `-r`:
  ```bash
  scp -r ./scripts/windows-install <username>@10.42.0.84:'C:/Users/<username>/Desktop/windows-install'
  ```
- The first connection prompts to trust the host key—type `yes` and enter the Windows password.

## 5. Troubleshooting tips
- If authentication fails, confirm the password works locally and that the account is not blank-password restricted (`net user <username>` shows `Password required: Yes`).
- Check the firewall rule with:
  ```powershell
  Get-NetFirewallRule -Name "OpenSSH-Server-In-TCP"
  ```
- Ensure the Windows machine still holds the 10.42.0.x address from the Ubuntu share; run `ipconfig` and reapply the sharing script on Ubuntu if needed.
- For repeated transfers, consider setting up SSH keys (`~/.ssh/authorized_keys` under `C:\Users\<username>\.ssh`) after the first successful password login.
