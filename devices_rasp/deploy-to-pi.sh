#!/bin/bash

# Deploy HotWheels Auto-Start Setup to Raspberry Pi
# Usage: ./deploy-to-pi.sh [PI_IP_ADDRESS]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default Raspberry Pi IPs from your system
DEFAULT_IPS=("192.168.1.39" "192.168.1.38")

echo -e "${BLUE}🚀 HotWheels Raspberry Pi Deployment Script${NC}"
echo "============================================="

# Get target IP
if [ "$1" ]; then
    PI_IP="$1"
    echo -e "${BLUE}📡 Target Pi: $PI_IP${NC}"
else
    echo -e "${YELLOW}🤖 No IP provided. Available Pis:${NC}"
    echo "   1) 192.168.1.39 (Sensor Pi)"
    echo "   2) 192.168.1.38 (Main Pi)"
    echo "   3) Enter custom IP"
    echo ""
    read -p "Select Pi (1-3): " choice
    
    case $choice in
        1) PI_IP="192.168.1.39" ;;
        2) PI_IP="192.168.1.38" ;;
        3) 
            read -p "Enter Pi IP address: " PI_IP
            ;;
        *) 
            echo -e "${RED}❌ Invalid choice${NC}"
            exit 1
            ;;
    esac
fi

echo -e "${BLUE}📡 Deploying to: pi@$PI_IP${NC}"

# Test connection
echo -e "${YELLOW}🔍 Testing connection to Pi...${NC}"
if ! ping -c 1 -W 5 "$PI_IP" > /dev/null 2>&1; then
    echo -e "${RED}❌ Cannot reach Pi at $PI_IP${NC}"
    echo "   Please check:"
    echo "   - Pi is powered on"
    echo "   - IP address is correct" 
    echo "   - Network connection is working"
    exit 1
fi

echo -e "${GREEN}✅ Pi is reachable${NC}"

# Create target directory on Pi
echo -e "${YELLOW}📁 Creating target directory on Pi...${NC}"
ssh pi@$PI_IP "mkdir -p ~/Desktop/HOTWHEELS-main/devices_rasp/"

# Copy all necessary files
echo -e "${YELLOW}📤 Copying files to Pi...${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Files to copy
FILES_TO_COPY=(
    "hotwheels-raspi.service"
    "setup-autostart.sh" 
    "RASPBERRY_PI_AUTOSTART_GUIDE.md"
    "raspi_client/"
)

for file in "${FILES_TO_COPY[@]}"; do
    if [ -e "$SCRIPT_DIR/$file" ]; then
        echo -e "  📄 Copying $file..."
        scp -r "$SCRIPT_DIR/$file" pi@$PI_IP:~/Desktop/HOTWHEELS-main/devices_rasp/
    else
        echo -e "${YELLOW}  ⚠️  File not found: $file${NC}"
    fi
done

echo -e "${GREEN}✅ Files copied successfully${NC}"

# Make setup script executable
echo -e "${YELLOW}🔧 Making setup script executable...${NC}"
ssh pi@$PI_IP "chmod +x ~/Desktop/HOTWHEELS-main/devices_rasp/setup-autostart.sh"

# Ask if user wants to run setup now
echo ""
read -p "🤔 Run the auto-start setup now? (y/N): " run_setup

if [[ $run_setup =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⚡ Running setup on Pi...${NC}"
    echo -e "${BLUE}================================================${NC}"
    
    # Run the setup script on the Pi
    ssh pi@$PI_IP "cd ~/Desktop/HOTWHEELS-main/devices_rasp/ && ./setup-autostart.sh"
    
    echo -e "${BLUE}================================================${NC}"
    echo -e "${GREEN}🎉 Setup complete on Pi $PI_IP!${NC}"
    
    # Test the service
    echo -e "${YELLOW}🧪 Testing service status...${NC}"
    if ssh pi@$PI_IP "sudo systemctl is-active hotwheels-raspi" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Service is running successfully!${NC}"
    else
        echo -e "${YELLOW}⚠️  Service may need manual start${NC}"
        echo "   Connect to Pi and run: sudo systemctl status hotwheels-raspi"
    fi
    
else
    echo -e "${BLUE}📋 Manual setup instructions:${NC}"
    echo "   1. SSH to Pi: ssh pi@$PI_IP"
    echo "   2. Go to directory: cd ~/Desktop/HOTWHEELS-main/devices_rasp/"
    echo "   3. Run setup: ./setup-autostart.sh"
fi

echo ""
echo -e "${GREEN}🎯 Deployment Summary:${NC}"
echo "   📡 Pi IP: $PI_IP" 
echo "   📁 Files: Copied to ~/Desktop/HOTWHEELS-main/devices_rasp/"
echo "   📖 Guide: See RASPBERRY_PI_AUTOSTART_GUIDE.md"
echo ""
echo -e "${BLUE}🔗 Quick Commands for Pi:${NC}"
echo "   Status: ssh pi@$PI_IP 'sudo systemctl status hotwheels-raspi'"
echo "   Logs:   ssh pi@$PI_IP 'sudo journalctl -u hotwheels-raspi -f'"
echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
