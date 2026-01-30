#!/bin/bash

# HotWheels Raspberry Pi Auto-Start Setup Script
# This script sets up the Raspberry Pi to automatically run main.py on boot

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🍓 HotWheels Raspberry Pi Auto-Start Setup${NC}"
echo "=================================================="

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}❌ This script should NOT be run as root${NC}"
   echo "   Please run as the 'pi' user: ./setup-autostart.sh"
   exit 1
fi

# Verify we're in the correct directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAIN_PY_PATH="$SCRIPT_DIR/raspi_client/main.py"

if [ ! -f "$MAIN_PY_PATH" ]; then
    echo -e "${RED}❌ main.py not found at: $MAIN_PY_PATH${NC}"
    echo "   Please run this script from the devices_rasp directory"
    exit 1
fi

echo -e "${GREEN}✅ Found main.py at: $MAIN_PY_PATH${NC}"

# Update the service file with the correct paths
SERVICE_FILE="$SCRIPT_DIR/hotwheels-raspi.service"
TEMP_SERVICE="/tmp/hotwheels-raspi.service"

echo -e "${YELLOW}📝 Updating service file paths...${NC}"

# Replace placeholder paths with actual paths
sed "s|/home/pi/Desktop/HOTWHEELS-main/devices_rasp|$SCRIPT_DIR|g" "$SERVICE_FILE" > "$TEMP_SERVICE"

echo -e "${GREEN}✅ Service file updated${NC}"

# Install the service
echo -e "${YELLOW}🔧 Installing systemd service...${NC}"
sudo cp "$TEMP_SERVICE" /etc/systemd/system/hotwheels-raspi.service
sudo chmod 644 /etc/systemd/system/hotwheels-raspi.service

# Reload systemd daemon
echo -e "${YELLOW}🔄 Reloading systemd daemon...${NC}"
sudo systemctl daemon-reload

# Enable the service (start on boot)
echo -e "${YELLOW}⚡ Enabling auto-start service...${NC}"
sudo systemctl enable hotwheels-raspi.service

# Start the service now
echo -e "${YELLOW}▶️  Starting service...${NC}"
sudo systemctl start hotwheels-raspi.service

# Wait a moment for service to start
sleep 2

# Check service status
echo -e "${BLUE}📊 Service Status:${NC}"
sudo systemctl status hotwheels-raspi.service --no-pager -l

echo ""
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo ""
echo -e "${BLUE}📋 Quick Commands:${NC}"
echo "   Check status:    sudo systemctl status hotwheels-raspi"
echo "   View logs:       sudo journalctl -u hotwheels-raspi -f"
echo "   Stop service:    sudo systemctl stop hotwheels-raspi"
echo "   Start service:   sudo systemctl start hotwheels-raspi"
echo "   Restart service: sudo systemctl restart hotwheels-raspi"
echo "   Disable autostart: sudo systemctl disable hotwheels-raspi"
echo ""
echo -e "${GREEN}✅ The Raspberry Pi will now automatically run main.py on every boot!${NC}"

# Clean up
rm "$TEMP_SERVICE"
