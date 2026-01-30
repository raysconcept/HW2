# 🍓 Raspberry Pi Auto-Start Setup Guide

This guide will help you set up your Raspberry Pi to automatically run the HotWheels `main.py` script whenever the Pi is powered on.

## 🚀 Quick Setup

### Step 1: Copy Files to Raspberry Pi
Transfer the entire `devices_rasp` folder to your Raspberry Pi at:
```
/home/pi/Desktop/HOTWHEELS-main/devices_rasp/
```

### Step 2: Make Setup Script Executable
```bash
cd /home/pi/Desktop/HOTWHEELS-main/devices_rasp/
chmod +x setup-autostart.sh
```

### Step 3: Run the Setup Script
```bash
./setup-autostart.sh
```

**That's it!** Your Raspberry Pi will now automatically run `main.py` on every boot.

---

## 📋 What the Setup Does

The setup script creates a **systemd service** that:
- ✅ Starts automatically when the Pi boots up
- 🔄 Restarts the script if it crashes 
- 📡 Waits for network connection before starting
- 📝 Logs all output for debugging
- 🛡️ Runs as the `pi` user (not root)

---

## 🎛️ Service Management Commands

### Check if Service is Running
```bash
sudo systemctl status hotwheels-raspi
```

### View Real-Time Logs
```bash
sudo journalctl -u hotwheels-raspi -f
```

### Manual Control
```bash
# Stop the service
sudo systemctl stop hotwheels-raspi

# Start the service  
sudo systemctl start hotwheels-raspi

# Restart the service
sudo systemctl restart hotwheels-raspi
```

### Disable Auto-Start (if needed)
```bash
sudo systemctl disable hotwheels-raspi
```

### Re-Enable Auto-Start
```bash
sudo systemctl enable hotwheels-raspi
```

---

## 🔍 Troubleshooting

### Service Won't Start
1. Check the service status:
   ```bash
   sudo systemctl status hotwheels-raspi
   ```

2. View detailed logs:
   ```bash
   sudo journalctl -u hotwheels-raspi -n 50
   ```

3. Verify file paths in the service file:
   ```bash
   cat /etc/systemd/system/hotwheels-raspi.service
   ```

### Common Issues

**❌ Permission Denied**
```bash
# Fix file permissions
chmod +x /home/pi/Desktop/HOTWHEELS-main/devices_rasp/raspi_client/main.py
```

**❌ Python Module Not Found**
```bash
# Install missing Python packages
pip3 install RPi.GPIO
```

**❌ Wrong File Paths**
- Verify the HOTWHEELS folder is at `/home/pi/Desktop/HOTWHEELS-main/`
- Re-run the setup script: `./setup-autostart.sh`

### View Service File
```bash
cat /etc/systemd/system/hotwheels-raspi.service
```

---

## 🔧 Manual Installation (Advanced)

If you prefer to set this up manually:

### 1. Create the Service File
```bash
sudo nano /etc/systemd/system/hotwheels-raspi.service
```

Copy the contents from `hotwheels-raspi.service` and update the paths.

### 2. Enable and Start
```bash
sudo systemctl daemon-reload
sudo systemctl enable hotwheels-raspi.service
sudo systemctl start hotwheels-raspi.service
```

---

## 📊 Monitoring

### Real-Time Status Dashboard
```bash
# Watch service status (updates every 2 seconds)
watch -n 2 sudo systemctl status hotwheels-raspi
```

### Log Filtering
```bash
# Show only errors
sudo journalctl -u hotwheels-raspi -p err

# Show logs from today
sudo journalctl -u hotwheels-raspi --since today

# Show logs from last boot
sudo journalctl -u hotwheels-raspi -b
```

---

## 🔄 Updating the Script

When you update `main.py` or related files:

1. **Option A:** Just restart the service
   ```bash
   sudo systemctl restart hotwheels-raspi
   ```

2. **Option B:** Stop, update, then start
   ```bash
   sudo systemctl stop hotwheels-raspi
   # Update your files here
   sudo systemctl start hotwheels-raspi
   ```

---

## 🚨 Emergency Stop

If you need to quickly stop all auto-start services:

```bash
# Stop the service immediately
sudo systemctl stop hotwheels-raspi

# Disable auto-start for next boot
sudo systemctl disable hotwheels-raspi
```

---

## ✅ Verification Checklist

After setup, verify everything works:

- [ ] Service shows as `active (running)`: `sudo systemctl status hotwheels-raspi`
- [ ] No errors in logs: `sudo journalctl -u hotwheels-raspi -n 10`
- [ ] Script responds to network requests from main server
- [ ] Restart test: `sudo reboot` and check if service auto-starts

---

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Collect logs: `sudo journalctl -u hotwheels-raspi > hotwheels-logs.txt`
3. Check network connectivity: `ping 8.8.8.8`
4. Verify Python installation: `python3 --version`

**Service starts automatically on every boot - your Raspberry Pi is now fully autonomous! 🎉**
