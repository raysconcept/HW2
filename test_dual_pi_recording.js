/**
 * Dual Raspberry Pi Simultaneous 120fps Recording Test
 * 
 * This script coordinates recording on multiple Raspberry Pis simultaneously
 * Usage: node test_dual_pi_recording.js <duration_seconds> [pi1_id] [pi2_id]
 */

const path = require('path');
const fs = require('fs');

class DualPiRecordingTest {
    constructor() {
        this.testId = Date.now();
        this.testResults = {
            testId: this.testId,
            startTime: new Date().toISOString(),
            duration: 0,
            pis: {},
            results: {},
            summary: {}
        };
        
        // Default Pi configurations - modify these for your setup
        this.piConfigs = {
            'raspi_sensor': {
                host: '192.168.1.39',
                port: 3000,
                name: 'Sensor Monitoring Pi',
                expectedCamera: 'elp_imx577'
            },
            'raspi_main': {
                host: '192.168.1.38',  // Fixed IP address
                port: 3000,
                name: 'Main Processing Pi', 
                expectedCamera: 'daheng_imx273'
            }
        };
        
        this.GLOBALS = {};
        this.responseHandlers = {};
        this.recordingSettings = {
            width: 1920,
            height: 1080, 
            fps: 120,
            // Camera-specific optimizations
            elp_imx577: {
                width: 1920,
                height: 1080,
                fps: 120
            },
            daheng_imx273: {
                width: 1440, 
                height: 1080,
                fps: 120  // Test if Daheng can do 120fps
            }
        };
    }

    async initialize() {
        console.log("🚀 Initializing Dual Pi Recording Test...\n");
        
        // Create test results directory
        const testDir = path.join(process.cwd(), 'dual_pi_test_results');
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
        
        // Load server modules
        try {
            const configDevices = require('./src/server/config/configDevices.js');
            const HW_RASPI_MULTI = require('./src/server/controllers/HW_RASPI_MULTI.js');
            
            this.GLOBALS.configDevices = configDevices;
            this.GLOBALS.HW_RASPI_MULTI = HW_RASPI_MULTI;
            
            // Mock Socket.IO for testing - create a more complete mock
            this.GLOBALS.SIO = {
                emit: (event, data) => {
                    console.log(`📡 Socket.IO Event: ${event}`, data);
                    // Route responses to active handlers
                    Object.values(this.responseHandlers).forEach(handler => {
                        if (handler) handler(data);
                    });
                },
                sockets: {
                    on: (event, callback) => {
                        // Mock socket connection handler - not needed for direct testing
                        console.log(`📡 Mock: SIO sockets.on('${event}') registered`);
                    }
                }
            };
            
            // Initialize Socket.IO integration (mimics server setup)
            // Note: This is only needed for full server integration, not direct function calls
            try {
                HW_RASPI_MULTI.HW_RASPI_MULTI_SIO(this.GLOBALS);
            } catch (error) {
                console.log("⚠️ Socket.IO setup skipped for direct testing");
            }
            
            console.log("✅ Server modules initialized\n");
            return true;
            
        } catch (error) {
            console.error("❌ Failed to initialize:", error.message);
            return false;
        }
    }

    async connectToPi(piId) {
        const config = this.piConfigs[piId];
        if (!config) {
            throw new Error(`Unknown Pi ID: ${piId}`);
        }
        
        console.log(`🔌 Connecting to ${config.name} (${piId}) at ${config.host}:${config.port}...`);
        
        return new Promise((resolve, reject) => {
            const timeout = 15000; // Reduced to 15 second timeout for faster failure detection
            let connectionAttempted = false;
            
            const timeoutId = setTimeout(() => {
                delete this.responseHandlers[`${piId}_connect`];
                console.log(`  ⏰ Connection timeout for ${config.name} (${piId})`);
                console.log(`     💡 Pi may be powered off or network unreachable`);
                reject(new Error(`Connection timeout after ${timeout/1000}s to ${piId} at ${config.host}:${config.port}`));
            }, timeout);
            
            try {
                // Add Pi to configuration
                this.GLOBALS.HW_RASPI_MULTI.addRaspberryPi(piId, {
                    host: config.host,
                    port: config.port,
                    name: config.name
                });
                
                // Set up connection handler
                this.responseHandlers[`${piId}_connect`] = (data) => {
                    if (data.from === `RASPI_${piId}` && data.action === 'CONNECTED') {
                        clearTimeout(timeoutId);
                        delete this.responseHandlers[`${piId}_connect`];
                        console.log(`  ✅ Connected to ${config.name} at ${config.host}`);
                        resolve(true);
                    }
                };
                
                // Attempt connection with additional error handling
                connectionAttempted = true;
                this.GLOBALS.HW_RASPI_MULTI.connectToRaspberryPi(piId, this.GLOBALS)
                    .catch((connectionError) => {
                        // Handle connection errors gracefully
                        if (timeoutId) {
                            clearTimeout(timeoutId);
                            delete this.responseHandlers[`${piId}_connect`];
                            console.log(`  ❌ Connection failed for ${config.name}: ${connectionError.message}`);
                            reject(connectionError);
                        }
                    });
                
            } catch (error) {
                clearTimeout(timeoutId);
                delete this.responseHandlers[`${piId}_connect`];
                console.log(`  ❌ Failed to initiate connection to ${config.name}: ${error.message}`);
                reject(new Error(`Failed to initiate connection to ${piId}: ${error.message}`));
            }
        });
    }

    async detectCameraOnPi(piId) {
        console.log(`📹 Detecting camera on ${piId}...`);
        
        return new Promise((resolve, reject) => {
            const timeout = 30000; // 30 second timeout for camera detection
            
            const timeoutId = setTimeout(() => {
                delete this.responseHandlers[`${piId}_cameras`];
                reject(new Error(`Camera detection timeout after ${timeout/1000}s on ${piId}`));
            }, timeout);
            
            this.responseHandlers[`${piId}_cameras`] = (data) => {
                if (data.message?.raspiId === piId && data.message?.type === 'cameras_list') {
                    clearTimeout(timeoutId);
                    delete this.responseHandlers[`${piId}_cameras`];
                    
                    const cameras = data.message.cameras || [];
                    const usbCameras = cameras.filter(cam => 
                        cam.model !== 'unknown' || cam.name.toLowerCase().includes('usb') || cam.name.toLowerCase().includes('camera')
                    );
                    
                    console.log(`  📊 Found ${cameras.length} total cameras, ${usbCameras.length} USB cameras`);
                    usbCameras.forEach(cam => {
                        console.log(`    🎥 ${cam.name} → ${cam.model} (${cam.device})`);
                    });
                    
                    if (usbCameras.length === 0) {
                        console.log(`  ⚠️ No USB cameras detected on ${piId}`);
                        resolve({ cameras: [], detected: null });
                    } else {
                        const mainCamera = usbCameras[0];
                        resolve({ cameras: usbCameras, detected: mainCamera });
                    }
                }
            };
            
            this.GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi(piId, {
                command: 'list_cameras'
            });
        });
    }

    async resetCameraOnPi(piId, cameraIndex = 0) {
        console.log(`🔄 Resetting camera controls on ${piId}...`);
        
        return new Promise((resolve, reject) => {
            const timeout = 30000; // 30 second timeout for camera reset
            
            const timeoutId = setTimeout(() => {
                delete this.responseHandlers[`${piId}_reset`];
                console.log(`  ⚠️ Camera reset timeout on ${piId}, continuing anyway...`);
                resolve(false); // Don't reject, just continue
            }, timeout);
            
            this.responseHandlers[`${piId}_reset`] = (data) => {
                if (data.message?.raspiId === piId && data.message?.type === 'camera_reset') {
                    clearTimeout(timeoutId);
                    delete this.responseHandlers[`${piId}_reset`];
                    console.log(`  ✅ Camera controls reset on ${piId}`);
                    resolve(true);
                }
            };
            
            this.GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi(piId, {
                command: 'reset_camera_controls',
                camera_index: cameraIndex
            });
        });
    }

    async diagnoseUnknownCamera(piId, cameraIndex = 0) {
        console.log(`  🔍 Running camera diagnostics on ${piId}...`);
        
        return new Promise((resolve) => {
            const timeout = 30000; // 30 second timeout for diagnostics
            
            const timeoutId = setTimeout(() => {
                delete this.responseHandlers[`${piId}_diagnose`];
                console.log(`    ⚠️ Diagnostics timeout on ${piId}, continuing...`);
                resolve(false);
            }, timeout);
            
            this.responseHandlers[`${piId}_diagnose`] = (data) => {
                if (data.message?.raspiId === piId && data.message?.type === 'camera_diagnostics') {
                    clearTimeout(timeoutId);
                    delete this.responseHandlers[`${piId}_diagnose`];
                    
                    console.log(`    ✅ Diagnostics completed for ${data.message.device}`);
                    console.log(`    📋 Commands run: ${data.message.commands_run.join(', ')}`);
                    console.log(`    💡 Check Pi logs for detailed diagnostic output`);
                    console.log(`    📖 Add camera support by updating identify_camera() function`);
                    resolve(true);
                }
            };
            
            this.GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi(piId, {
                command: 'diagnose_unknown_camera',
                camera_index: cameraIndex
            });
        });
    }

    async startRecordingOnPi(piId, camera, duration) {
        const cameraModel = camera.model;
        const settings = this.recordingSettings[cameraModel] || this.recordingSettings;
        
        console.log(`🎬 Starting ${duration}s recording on ${piId} (${cameraModel})...`);
        console.log(`  📐 Resolution: ${settings.width}x${settings.height}@${settings.fps}fps`);
        
        return new Promise((resolve, reject) => {
            const timeout = 30000; // 30 second timeout for recording start
            
            const timeoutId = setTimeout(() => {
                delete this.responseHandlers[`${piId}_record`];
                reject(new Error(`Recording start timeout after ${timeout/1000}s on ${piId}`));
            }, timeout);
            
            this.responseHandlers[`${piId}_record`] = (data) => {
                if (data.message?.raspiId === piId && 
                   (data.message?.type === 'recording_started' || data.message?.type === 'error')) {
                    clearTimeout(timeoutId);
                    delete this.responseHandlers[`${piId}_record`];
                    
                    if (data.message.success) {
                        console.log(`  ✅ Recording started on ${piId}`);
                        resolve(data.message);
                    } else {
                        reject(new Error(`Recording failed on ${piId}: ${data.message.error}`));
                    }
                }
            };
            
            this.GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi(piId, {
                command: 'start_recording',
                camera_model: cameraModel,
                duration: duration,
                width: settings.width,
                height: settings.height,
                fps: settings.fps
            });
        });
    }

    async stopRecordingOnPi(piId) {
        console.log(`🛑 Stopping recording on ${piId}...`);
        
        return new Promise((resolve, reject) => {
            const timeout = 90000; // 90 second timeout for recording stop (allows for video encoding)
            
            // Progress feedback every 15 seconds
            const progressInterval = setInterval(() => {
                console.log(`  ⏳ ${piId} still processing video (encoding can take 60-90s for high-res recordings)...`);
            }, 15000);
            
            const timeoutId = setTimeout(() => {
                clearInterval(progressInterval);
                delete this.responseHandlers[`${piId}_stop`];
                reject(new Error(`Recording stop timeout after ${timeout/1000}s on ${piId} - video encoding may have failed`));
            }, timeout);
            
            this.responseHandlers[`${piId}_stop`] = (data) => {
                if (data.message?.raspiId === piId && 
                   (data.message?.type === 'recording_stopped' || data.message?.type === 'error')) {
                    clearTimeout(timeoutId);
                    clearInterval(progressInterval);
                    delete this.responseHandlers[`${piId}_stop`];
                    
                    if (data.message.success) {
                        console.log(`  ✅ Recording stopped and video encoded on ${piId}`);
                        resolve(data.message);
                    } else {
                        reject(new Error(`Stop recording failed on ${piId}: ${data.message.error}`));
                    }
                }
            };
            
            this.GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi(piId, {
                command: 'stop_recording'
            });
        });
    }

    async forceStopRecordingOnPi(piId) {
        console.log(`🔧 Force-stopping any recording on ${piId}...`);
        
        return new Promise((resolve, reject) => {
            const timeout = 10000; // 10 second timeout for force stop
            
            const timeoutId = setTimeout(() => {
                delete this.responseHandlers[`${piId}_force_stop`];
                reject(new Error(`Force stop timeout after ${timeout/1000}s on ${piId}`));
            }, timeout);
            
            this.responseHandlers[`${piId}_force_stop`] = (data) => {
                if (data.message?.raspiId === piId && 
                   (data.message?.type === 'recording_stopped' || data.message?.type === 'error')) {
                    clearTimeout(timeoutId);
                    delete this.responseHandlers[`${piId}_force_stop`];
                    
                    // Accept both success and "Not recording" as valid outcomes
                    if (data.message.success || data.message.error === 'Not recording') {
                        resolve(data.message);
                    } else {
                        // Even if stop fails, we consider it handled for force-stop
                        resolve({ success: true, message: `Force stop completed: ${data.message.error}` });
                    }
                }
            };
            
            // Send stop_recording command (same as regular stop, but with different handling)
            this.GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi(piId, {
                command: 'stop_recording'
            });
        });
    }

    async uploadVideoOnPi(piId) {
        console.log(`📤 Uploading video from ${piId}...`);
        
        return new Promise((resolve, reject) => {
            const timeout = 60000; // 60 second timeout for upload (larger files need more time)
            
            const timeoutId = setTimeout(() => {
                delete this.responseHandlers[`${piId}_upload`];
                reject(new Error(`Upload timeout after ${timeout/1000}s on ${piId}`));
            }, timeout);
            
            this.responseHandlers[`${piId}_upload`] = (data) => {
                if (data.message?.raspiId === piId && 
                   (data.message?.type === 'video_upload' || data.message?.type === 'error')) {
                    clearTimeout(timeoutId);
                    delete this.responseHandlers[`${piId}_upload`];
                    
                    if (data.message.success) {
                        console.log(`  ✅ Video uploaded from ${piId}`);
                        resolve(data.message);
                    } else {
                        reject(new Error(`Upload failed on ${piId}: ${data.message.error}`));
                    }
                }
            };
            
            this.GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi(piId, {
                command: 'upload_video',
                server_ip: '192.168.1.2',  // ✅ AUTO-DETECTED: Server's stable LAN IP
                raspi_id: piId             
            });
        });
    }

    async waitForRecordingComplete(piId, duration) {
        const maxWait = duration + 60; // Recording time + 1 minute buffer
        console.log(`⏳ Waiting for ${piId} recording completion (max ${maxWait}s)...`);
        
        return new Promise((resolve) => {
            let checkCount = 0;
            const maxChecks = Math.ceil(maxWait / 10);
            
            const checkStatus = () => {
                checkCount++;
                
                this.GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi(piId, {
                    command: 'camera_status'
                });
                
                const statusHandler = (data) => {
                    if (data.message?.raspiId === piId && data.message?.type === 'camera_status') {
                        delete this.responseHandlers[`${piId}_status_${checkCount}`];
                        
                        if (!data.message.recording && data.message.last_recording) {
                            console.log(`  ✅ ${piId} recording completed: ${path.basename(data.message.last_recording)}`);
                            resolve(true);
                        } else if (checkCount >= maxChecks) {
                            console.log(`  ⚠️ ${piId} recording timeout after ${maxWait}s`);
                            resolve(false);
                        } else {
                            console.log(`  🔄 ${piId} progress check ${checkCount}/${maxChecks} (${checkCount * 10}s elapsed)`);
                            setTimeout(checkStatus, 10000);
                        }
                    }
                };
                
                this.responseHandlers[`${piId}_status_${checkCount}`] = statusHandler;
            };
            
            // Start checking after initial delay
            setTimeout(checkStatus, Math.max(10000, duration * 1000));
        });
    }

    async runDualPiTest(duration, piIds) {
        console.log(`🎯 Starting simultaneous ${duration}s recording on ${piIds.length} Pis\n`);
        
        const results = {};
        
        try {
            // Phase 1: Connect to all Pis
            console.log("📡 Phase 1: Connecting to Raspberry Pis...");
            console.log("   ⏳ Attempting connections (15s timeout per Pi)...\n");
            
            const connectionPromises = piIds.map(async (piId) => {
                try {
                    await this.connectToPi(piId);
                    results[piId] = { connected: true };
                    return { piId, success: true };
                } catch (error) {
                    console.error(`❌ Connection failed to ${piId}: ${error.message}`);
                    const config = this.piConfigs[piId];
                    if (config) {
                        console.error(`   🔍 Troubleshooting ${piId}:`);
                        console.error(`      • Check Pi power: Is ${config.name} powered on?`);
                        console.error(`      • Check network: Can you ping ${config.host}?`);
                        console.error(`      • Check service: Is main.py running on port ${config.port}?`);
                        console.error(`      • Check firewall: Is port ${config.port} open?`);
                        console.error(`   💡 Run: ssh user@${config.host} 'sudo systemctl status hotwheels-raspi'\n`);
                    }
                    results[piId] = { connected: false, error: error.message };
                    return { piId, success: false, error: error.message };
                }
            });
            
            // Wait for all connection attempts to complete
            const connectionResults = await Promise.allSettled(connectionPromises);
            const connectedPis = connectionResults
                .filter(result => result.status === 'fulfilled' && result.value.success)
                .map(result => result.value);
            
            const failedPis = connectionResults
                .filter(result => result.status === 'fulfilled' && !result.value.success)
                .map(result => result.value);
            
            console.log("=".repeat(60));
            console.log(`📊 CONNECTION SUMMARY: ${connectedPis.length}/${piIds.length} Pis connected`);
            console.log("=".repeat(60));
            
            connectedPis.forEach(result => {
                const config = this.piConfigs[result.piId];
                console.log(`✅ ${result.piId}: ${config?.name} (${config?.host})`);
            });
            
            failedPis.forEach(result => {
                const config = this.piConfigs[result.piId];
                console.log(`❌ ${result.piId}: ${config?.name} (${config?.host}) - ${result.error}`);
            });
            
            if (connectedPis.length === 0) {
                console.error("\n🚫 NO RASPBERRY PIS CONNECTED - CANNOT PROCEED");
                console.error("   💡 Fix connection issues above and try again");
                return results;
            }
            
            console.log(`\n✅ CONTINUING WITH ${connectedPis.length} AVAILABLE PI(S)\n`);
            
            // Phase 2: Detect cameras on connected Pis only  
            console.log("🔍 Phase 2: Detecting cameras on connected Pis...");
            const connectedPiIds = connectedPis.map(p => p.piId);
            
            for (const piId of connectedPiIds) {
                try {
                    const cameraInfo = await this.detectCameraOnPi(piId);
                    results[piId].camera = cameraInfo;
                    
                    if (cameraInfo.detected && cameraInfo.detected.model === 'unknown') {
                        console.log(`⚠️ ${piId}: Camera detected but model unknown`);
                        console.log(`   📋 Camera: ${cameraInfo.detected.name} (${cameraInfo.detected.device})`);
                        console.log(`   🔧 Run diagnostics with: diagnose_unknown_camera command`);
                        console.log(`   📖 See CAMERA_SETTINGS_GUIDE.md for troubleshooting steps`);
                        
                        // Automatically run diagnostics for unknown cameras
                        try {
                            await this.diagnoseUnknownCamera(piId, cameraInfo.detected.index);
                        } catch (error) {
                            console.log(`   ❌ Auto-diagnostics failed: ${error.message}`);
                        }
                    }
                } catch (error) {
                    console.error(`❌ Camera detection failed on ${piId}: ${error.message}`);
                    results[piId].camera = { error: error.message };
                }
            }
            console.log("");
            
            // Phase 3: Reset camera controls on connected Pis
            console.log("🔄 Phase 3: Resetting camera controls on connected Pis...");
            for (const piId of connectedPiIds) {
                if (results[piId].camera?.detected) {
                    await this.resetCameraOnPi(piId, results[piId].camera.detected.index);
                }
            }
            console.log("");
            
            // Phase 3.5: Force-stop any previous recordings
            console.log("🛑 Phase 3.5: Force-stopping any previous recordings...");
            const forceStopPromises = [];
            
            for (const piId of connectedPiIds) {
                forceStopPromises.push(
                    this.forceStopRecordingOnPi(piId)
                        .then(result => ({ piId, success: true, result }))
                        .catch(error => ({ piId, success: false, error: error.message }))
                );
            }
            
            const forceStopResults = await Promise.all(forceStopPromises);
            forceStopResults.forEach(result => {
                if (result.success) {
                    console.log(`✅ ${result.piId}: Recording state cleared`);
                } else {
                    console.log(`⚠️ ${result.piId}: Stop command completed (${result.error})`);
                }
            });
            console.log("");
            
            // Phase 4: Start simultaneous recordings on connected Pis
            console.log("🎬 Phase 4: Starting simultaneous recordings...");
            const recordingPromises = [];
            const recordingStartTime = Date.now();
            
            for (const piId of connectedPiIds) {
                if (results[piId].camera?.detected) {
                    const camera = results[piId].camera.detected;
                    recordingPromises.push(
                        this.startRecordingOnPi(piId, camera, duration)
                            .then(result => ({ piId, success: true, result }))
                            .catch(error => ({ piId, success: false, error: error.message }))
                    );
                }
            }
            
            // Wait for all recordings to start
            const recordingResults = await Promise.all(recordingPromises);
            recordingResults.forEach(result => {
                if (result.success) {
                    console.log(`✅ ${result.piId}: Recording started successfully`);
                    results[result.piId].recordingStarted = true;
                } else {
                    console.error(`❌ ${result.piId}: Recording failed - ${result.error}`);
                    results[result.piId].recordingStarted = false;
                    results[result.piId].recordingError = result.error;
                }
            });
            console.log("");
            
            // Phase 5: Wait for recording duration
            console.log(`⏳ Phase 5: Waiting ${duration}s for recording duration...`);
            await new Promise(resolve => setTimeout(resolve, duration * 1000));
            console.log("✅ Recording duration elapsed, stopping recordings...");
            
            // Phase 6: Stop all recordings  
            console.log("🛑 Phase 6: Stopping recordings...");
            console.log("   📝 Note: This can take 60-90 seconds as videos are being encoded on each Pi");
            const stopPromises = [];
            
            for (const piId of piIds) {
                if (results[piId].recordingStarted) {
                    stopPromises.push(
                        this.stopRecordingOnPi(piId)
                            .then(result => ({ piId, success: true, result }))
                            .catch(error => ({ piId, success: false, error: error.message }))
                    );
                }
            }
            
            const stopResults = await Promise.all(stopPromises);
            stopResults.forEach(result => {
                if (result.success) {
                    console.log(`✅ ${result.piId}: Recording stopped successfully`);
                    results[result.piId].recordingCompleted = true;
                    results[result.piId].stopResult = result.result;
                } else {
                    console.error(`❌ ${result.piId}: Recording stop failed - ${result.error}`);
                    results[result.piId].recordingCompleted = false;
                    results[result.piId].stopError = result.error;
                }
            });
            
            // Phase 7: Upload videos to server from connected Pis (RE-ENABLED)
            console.log("📤 Phase 7: Uploading videos to server from connected Pis...");
            const uploadPromises = [];
            
            for (const piId of connectedPiIds) {
                if (results[piId].recordingCompleted) {
                    uploadPromises.push(
                        this.uploadVideoOnPi(piId)
                            .then(result => ({ piId, success: true, result }))
                            .catch(error => ({ piId, success: false, error: error.message }))
                    );
                }
            }
            
            if (uploadPromises.length > 0) {
                const uploadResults = await Promise.all(uploadPromises);
                uploadResults.forEach(result => {
                    if (result.success) {
                        console.log(`✅ ${result.piId}: Video uploaded successfully`);
                        results[result.piId].videoUploaded = true;
                        results[result.piId].uploadResult = result.result;
                    } else {
                        console.error(`❌ ${result.piId}: Video upload failed - ${result.error}`);
                        results[result.piId].videoUploaded = false;
                        results[result.piId].uploadError = result.error;
                    }
                });
            } else {
                console.log("📤 No videos to upload (no completed recordings)");
            }
            
            /* UPLOAD PHASE DISABLED VERSION - Use this to skip uploads
            console.log("📤 Phase 7: Upload phase skipped - videos saved locally on Pis");
            console.log("💡 Videos are available at: /home/user/recordings/ on each Pi");
            
            // Mark all completed recordings as having no upload attempt
            for (const piId of connectedPiIds) {
                if (results[piId].recordingCompleted) {
                    results[piId].videoUploaded = false;
                    results[piId].uploadSkipped = true;
                }
            }
            */
            
            return results;
            
        } catch (error) {
            console.error(`❌ Dual Pi test error: ${error.message}`);
            return results;
        }
    }

    printResults(results, duration, piIds) {
        console.log("\n" + "=".repeat(70));
        console.log("🎬 DUAL RASPBERRY PI RECORDING TEST SUMMARY");
        console.log("=".repeat(70));
        
        const summary = {
            total: piIds.length,
            connected: 0,
            camerasDetected: 0,
            recordingsStarted: 0,
            recordingsCompleted: 0,
            videosUploaded: 0
        };
        
        piIds.forEach(piId => {
            const result = results[piId] || {};
            console.log(`\n📡 ${piId} (${this.piConfigs[piId]?.name || 'Unknown'}):`);
            
            if (result.connected) {
                summary.connected++;
                console.log("  ✅ Connection: Success");
                
                if (result.camera?.detected) {
                    summary.camerasDetected++;
                    const cam = result.camera.detected;
                    console.log(`  📹 Camera: ${cam.name} → ${cam.model}`);
                    
                    if (result.recordingStarted) {
                        summary.recordingsStarted++;
                        console.log("  🎬 Recording Start: Success");
                        
                        if (result.recordingCompleted) {
                            summary.recordingsCompleted++;
                            console.log("  ✅ Recording Complete: Success");
                            
                            if (result.videoUploaded) {
                                summary.videosUploaded++;
                                console.log("  📤 Video Upload: Success");
                            } else if (result.videoUploaded === false) {
                                console.log("  ❌ Video Upload: Failed");
                            } else {
                                console.log("  ⚠️ Video Upload: Not attempted");
                            }
                        } else {
                            console.log("  ⚠️ Recording Complete: Timeout/In Progress");
                        }
                    } else {
                        console.log(`  ❌ Recording Start: Failed - ${result.recordingError || 'Unknown error'}`);
                    }
                } else if (result.camera?.error) {
                    console.log(`  ❌ Camera: Detection failed - ${result.camera.error}`);
                } else {
                    console.log("  ❌ Camera: No USB cameras found");
                }
            } else {
                console.log(`  ❌ Connection: Failed - ${result.error || 'Unknown error'}`);
            }
        });
        
        console.log("\n📊 Overall Summary:");
        console.log(`  🔌 Connected: ${summary.connected}/${summary.total}`);
        console.log(`  📹 Cameras Detected: ${summary.camerasDetected}/${summary.total}`);
        console.log(`  🎬 Recordings Started: ${summary.recordingsStarted}/${summary.total}`);
        console.log(`  ✅ Recordings Completed: ${summary.recordingsCompleted}/${summary.total}`);
        console.log(`  📤 Videos Uploaded: ${summary.videosUploaded}/${summary.recordingsCompleted}`);
        
        if (summary.recordingsCompleted === summary.total && summary.videosUploaded === summary.recordingsCompleted && summary.total > 0) {
            console.log("\n🎉 SUCCESS! All Raspberry Pis completed recording and uploaded videos!");
        } else if (summary.recordingsCompleted === summary.total && summary.total > 0) {
            console.log("\n🎬 All recordings completed! Upload videos with separate commands if needed.");
        } else {
            console.log("\n⚠️ Some recordings did not complete successfully. Check individual Pi status above.");
        }
        
        console.log("\n💡 Tip: Videos are recorded locally on each Pi first, then uploaded separately.");
        console.log("    This allows for better error handling and offline recording capability.");
        console.log("    Uploaded videos are saved to: /public/video/ (one file per Pi)");
        console.log("    Files: raspi_sensor.mp4, raspi_main.mp4 (new recordings overwrite previous)");
    }

    cleanup() {
        // Clear any remaining response handlers
        this.responseHandlers = {};
        
        // Disconnect from all Raspberry Pis
        if (this.GLOBALS?.HW_RASPI_MULTI) {
            try {
                Object.keys(this.piConfigs).forEach(piId => {
                    this.GLOBALS.HW_RASPI_MULTI.disconnectFromRaspberryPi?.(piId);
                });
            } catch (error) {
                // Silent cleanup - errors during cleanup are expected
            }
        }
        
        console.log("🧹 Cleanup completed - all resources freed");
    }
}

async function main() {
    try {
        const args = process.argv.slice(2);
        
        if (args.length < 1) {
            console.log("Usage: node test_dual_pi_recording.js <duration_seconds> [pi1_id] [pi2_id]");
            console.log("");
            console.log("Examples:");
            console.log("  node test_dual_pi_recording.js 5                    # 5s on default Pis");
            console.log("  node test_dual_pi_recording.js 10 raspi_sensor      # 10s on one Pi");
            console.log("  node test_dual_pi_recording.js 3 raspi_sensor raspi_main  # 3s on both");
            console.log("");
            console.log("Available Pi IDs (edit script to add more):");
            console.log("  - raspi_sensor (192.168.1.39) - ELP IMX577 expected");
            console.log("  - raspi_main (192.168.1.38) - Daheng IMX273 expected");
            process.exit(1);
        }
        
        const duration = parseInt(args[0]);
        const piIds = args.slice(1);
        
        if (piIds.length === 0) {
            // Default to both Pis if none specified
            piIds.push('raspi_sensor', 'raspi_main');
        }
        
        console.log(`🚀 Dual Pi Recording Test`);
        console.log(`📊 Duration: ${duration} seconds`);
        console.log(`🎯 Target Pis: ${piIds.join(', ')}\n`);
        
        const test = new DualPiRecordingTest();
        
        console.log("💡 Note: Script will continue with available Pis even if some are disconnected\n");
        
        if (!await test.initialize()) {
            console.error("❌ Failed to initialize test environment");
            process.exit(1);
        }
        
        // Add overall timeout for the entire process
        const totalTimeoutMs = (duration + 120) * 1000; // recording time + 2 minutes buffer
        const overallTimeout = setTimeout(() => {
            console.log("⏰ Overall timeout reached - stopping script...");
            test.cleanup();
            process.exit(0);
        }, totalTimeoutMs);

        const results = await test.runDualPiTest(duration, piIds);
        test.printResults(results, duration, piIds);
        
        console.log("✅ Script completed successfully!");
        console.log("🏁 Stopping script in 3 seconds...\n");
        
        // Clear the overall timeout since we completed successfully
        clearTimeout(overallTimeout);
        
        // Auto-stop after completion
        setTimeout(() => {
            test.cleanup();
            console.log("👋 Script stopped. Console logs ended.");
            process.exit(0);
        }, 3000);
        
    } catch (error) {
        console.error(`❌ Main script error: ${error.message}`);
        console.error("   💡 Script designed to continue with available Pis");
        console.log("🏁 Stopping script due to error...\n");
        
        setTimeout(() => {
            console.log("👋 Script stopped. Console logs ended.");
            process.exit(0);
        }, 2000);
    }
}

// Add process-level error handling to prevent crashes
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Unhandled Promise Rejection:', reason?.message || reason);
    console.error('   📍 This error was caught to prevent script crash');
    console.error('   💡 Continuing with available Pis...\n');
});

process.on('uncaughtException', (error) => {
    console.error('⚠️ Uncaught Exception:', error.message);
    console.error('   📍 This error was caught to prevent script crash');
    console.error('   💡 Continuing with available Pis...\n');
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT (Ctrl+C)');
    console.log('🏁 Stopping script gracefully...');
    
    setTimeout(() => {
        console.log('👋 Script stopped. Console logs ended.');
        process.exit(0);
    }, 1000);
});

if (require.main === module) {
    main().catch((error) => {
        console.error(`❌ Fatal error: ${error.message}`);
        console.error("   💡 Exiting gracefully...");
        
        setTimeout(() => {
            console.log("👋 Script stopped. Console logs ended.");
            process.exit(0);
        }, 2000);
    });
  test.printResults(results, duration, piIds);
}

if (require.main === module) {
    main().catch(console.error);
