# Sharing Internet from the Ubuntu Dev PC to the Windows Optiplex

This guide documents the steps taken to let the Ubuntu-based development PC (Wi-Fi uplink) share its internet connection with the Windows Optiplex via a direct Ethernet cable.

## Pre-flight Checks
- Confirm the Ethernet cable is connected between the two machines.
- On Ubuntu, identify interfaces with `ip -br link` (Wi-Fi `wlp0s20f3`, wired `eno1` in our case).
- Verify Ubuntu has working internet on the Wi-Fi interface: `ping 8.8.8.8`.
- On Windows, ensure the Ethernet adapter appears in `Apparaatbeheer` (Device Manager) under `Netwerkadapters` with no warning icons.

## Configure Ubuntu (dev PC)
1. Set the wired profile to share internet:
   ```bash
   nmcli connection modify "Wired connection 1" ifname eno1 ipv4.method shared ipv6.method ignore autoconnect yes
   nmcli connection down "Wired connection 1"
   nmcli connection up "Wired connection 1"
   ```
   *Use the actual profile name if it differs.*
2. Confirm the wired interface now owns `10.42.0.1/24`:
   ```bash
   ip addr show eno1
   ```
3. Enable IP forwarding and NAT from Wi-Fi → Ethernet:
   ```bash
   sudo sysctl -w net.ipv4.ip_forward=1
   sudo iptables -t nat -A POSTROUTING -o wlp0s20f3 -j MASQUERADE
   sudo iptables -A FORWARD -i wlp0s20f3 -o eno1 -m state --state RELATED,ESTABLISHED -j ACCEPT
   sudo iptables -A FORWARD -i eno1 -o wlp0s20f3 -j ACCEPT
   ```
   *Replace interface names if yours differ.* Keep the terminal open or persist these commands via a startup script/scripted service later.
4. (Optional) Watch for Windows pings:
   ```bash
   sudo tcpdump -i eno1 icmp
   ```

## Configure Windows (Optiplex)
1. Verify the Ethernet adapter status:
   - `Win + X` → `Apparaatbeheer`.
   - Expand `Netwerkadapters`, right-click the Ethernet device → `Uitschakelen`, then right-click → `Inschakelen`.
2. Ensure IPv4 properties are set to automatic:
   - `Win + R` → `ncpa.cpl`.
   - Right-click `Ethernet` → `Eigenschappen`.
   - Double-click `Internet Protocol versie 4 (TCP/IPv4)` → select both `Een IP-adres automatisch laten toewijzen` and `DNS-serveradres automatisch laten toewijzen`.
3. If automatic DNS fails, set manual DNS servers (e.g. `8.8.8.8` and `1.1.1.1`) in the same dialog.
4. Enable ICMP echo replies for easier diagnostics:
   - Start → search `Firewall` → open **Windows-beveiliging** → **Firewall en netwerkbeveiliging** → **Geavanceerde instellingen**.
   - In **Binnenkomende regels**, find **Bestands- en printerdeling (Echo-aanvraag - ICMPv4-In)** and choose **Inschakelen**.

## Verification
- On Windows:
  ```cmd
  ipconfig
  ping 10.42.0.1
  ping 8.8.8.8
  nslookup microsoft.com
  ```
- **Before running any installers or scripts on the Optiplex, confirm the steps above succeed.** Lack of outbound internet is the most common reason winget, PowerShell Gallery, or direct downloads fail. If `ping 8.8.8.8` or `Invoke-WebRequest https://aka.ms/wsl2kernel` fails, rerun the sharing script on Ubuntu and retest before continuing.
- On Ubuntu:
  ```bash
  ping 10.42.0.84   # replace with the Optiplex IP shown by ipconfig
  ```

## Direct Router Setup (Optiplex = 192.168.1.2)
If you’re wiring the Optiplex straight into a router (gateway `192.168.1.1`) and want it on a fixed IP:

1. **Router Prep**
   - Reserve `192.168.1.2` for the Optiplex MAC address in the router’s DHCP reservation table, or disable DHCP for that port if you plan to assign it statically.
   - Confirm the router’s LAN subnet is `192.168.1.0/24` with gateway `192.168.1.1`.

2. **Optiplex Windows Settings**
   - `Win + R` → `ncpa.cpl` → right-click `Ethernet` → `Eigenschappen`.
   - Double-click `Internet Protocol versie 4 (TCP/IPv4)` and set:
     ```
     IP-adres:        192.168.1.2
     Subnetmasker:    255.255.255.0
     Standaardgateway:192.168.1.1
     Voorkeur-DNS:    8.8.8.8
     Alternatieve DNS:1.1.1.1  (or 192.168.1.1 if you prefer the router DNS)
     ```
   - OK → Close → disable/enable the adapter once.

3. **Verify Windows Connectivity**
   ```powershell
   ipconfig                  # should show 192.168.1.2
   ping 192.168.1.1          # router reachability
   ping 8.8.8.8              # raw internet
   nslookup microsoft.com    # DNS resolution
   ```

4. **Ubuntu / Dev PC Adjustments**
   - Ensure the Ubuntu box stays on a different IP (e.g., DHCP from the router) to avoid conflicts.
   - If you still need SSH/SCP access from Ubuntu, use `ssh dell@192.168.1.2`.

5. **Troubleshooting Checklist**
   - If `ping 192.168.1.1` fails, double-check the Ethernet cable and router port LEDs.
   - If internet fails but router ping works, inspect the DNS settings or router WAN link.
   - For intermittent issues, clear ARP caches (`arp -d *` in Windows CMD) and reboot the router.
- A successful `ping 8.8.8.8` from Windows confirms internet routing is active.

## Troubleshooting Notes
- If Windows shows a `169.254.x.x` address, run `ipconfig /release` then `ipconfig /renew`, or temporarily set a static IP (`10.42.0.10/24`, gateway `10.42.0.1`).
- If Ubuntu cannot ping the Optiplex, check the firewall rule above and verify the link with `sudo ethtool eno1`.
- Reapply the NAT rules after a reboot unless they are made persistent.
- Keep Dell LAN drivers handy; if the adapter disappears, reinstall them from Dell Support.

## Next Steps
- Once internet sharing is reliable, proceed with the Windows language automation script and the deployment automation plan.
