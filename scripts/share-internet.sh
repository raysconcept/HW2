#!/usr/bin/env bash
# Enables IPv4 forwarding and NAT from the Wi-Fi uplink to the wired interface.
# Adjust WIFI_IF and WIRED_IF if your interface names differ.

set -euo pipefail

WIFI_IF=${WIFI_IF:-wlp0s20f3}
WIRED_IF=${WIRED_IF:-eno1}

echo "Enabling IPv4 forwarding..."
sudo sysctl -w net.ipv4.ip_forward=1

echo "Configuring iptables NAT (Wi-Fi -> Ethernet)..."
sudo iptables -t nat -A POSTROUTING -o "$WIFI_IF" -j MASQUERADE
sudo iptables -A FORWARD -i "$WIFI_IF" -o "$WIRED_IF" -m state --state RELATED,ESTABLISHED -j ACCEPT
sudo iptables -A FORWARD -i "$WIRED_IF" -o "$WIFI_IF" -j ACCEPT

echo "Internet sharing rules applied."
