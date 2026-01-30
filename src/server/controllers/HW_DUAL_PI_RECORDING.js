// enable custom logging
const { createModuleLogger } = require('../config/logger');
const logger = createModuleLogger('DUAL_PI');
const { spawn } = require('child_process');
const path = require('path');
const net = require('net');

/**
 * @fileoverview Dual Raspberry Pi Recording Controller
 * Runs the existing test_dual_pi_recording.js script via web interface
 */

// Pi configurations - same as in test script
const PI_CONFIGS = {
    'raspi_sensor': {
        host: '192.168.1.39',
        port: 3000,
        name: 'Sensor Monitoring Pi'
    },
    'raspi_main': {
        host: '192.168.1.38',
        port: 3000,
        name: 'Main Processing Pi'
    }
};

class DualPiRecorder {
    constructor(GLOBALS) {
        this.GLOBALS = GLOBALS;
        this.isRecording = false;
        this.activeProcess = null;
        this.results = null;
    }

    /**
     * Run the existing dual Pi test script
     */
    async runTestScript(duration = 5, settings = {}) {
        if (this.isRecording) {
            throw new Error('Recording already in progress');
        }

        this.isRecording = true;
        logger.info(`🎬 Starting dual Pi recording via test script (${duration}s)`);

        return new Promise((resolve, reject) => {
            const scriptPath = path.join(__dirname, '../../../test_dual_pi_recording.js');
            
            // Run the existing test script with duration
            this.activeProcess = spawn('node', [scriptPath, duration.toString()], {
                cwd: path.join(__dirname, '../../..'),
                stdio: 'pipe'
            });

            let output = '';
            let errorOutput = '';

            this.activeProcess.stdout.on('data', (data) => {
                const text = data.toString();
                output += text;
                logger.info(`📋 Script: ${text.trim()}`);
                
                // Emit real-time updates to the web interface
                if (this.GLOBALS.SIO) {
                    this.GLOBALS.SIO.emit('DUAL_PI_UPDATE', {
                        type: 'log',
                        message: text.trim(),
                        timestamp: new Date().toISOString()
                    });
                }
            });

            this.activeProcess.stderr.on('data', (data) => {
                const text = data.toString();
                errorOutput += text;
                logger.error(`📋 Script Error: ${text.trim()}`);
                
                if (this.GLOBALS.SIO) {
                    this.GLOBALS.SIO.emit('DUAL_PI_UPDATE', {
                        type: 'error',
                        message: text.trim(),
                        timestamp: new Date().toISOString()
                    });
                }
            });

            this.activeProcess.on('close', (code) => {
                this.isRecording = false;
                this.activeProcess = null;

                if (code === 0) {
                    logger.info('✅ Dual Pi recording completed successfully');
                    
                    // Emit completion event
                    if (this.GLOBALS.SIO) {
                        this.GLOBALS.SIO.emit('DUAL_PI_COMPLETE', {
                            success: true,
                            message: 'Recording completed successfully',
                            output: output
                        });
                        
                        // Notify about new videos
                        this.GLOBALS.SIO.emit('NEW_VIDEO_READY', {
                            videos: ['raspi_sensor.mp4', 'raspi_main.mp4']
                        });
                    }
                    
                    resolve({
                        success: true,
                        message: 'Recording completed successfully',
                        output: output
                    });
                } else {
                    logger.error(`❌ Dual Pi recording failed with exit code ${code}`);
                    
                    if (this.GLOBALS.SIO) {
                        this.GLOBALS.SIO.emit('DUAL_PI_COMPLETE', {
                            success: false,
                            message: `Recording failed with exit code ${code}`,
                            error: errorOutput
                        });
                    }
                    
                    reject(new Error(`Script failed with exit code ${code}: ${errorOutput}`));
                }
            });

            this.activeProcess.on('error', (error) => {
                this.isRecording = false;
                this.activeProcess = null;
                logger.error(`❌ Failed to start script: ${error.message}`);
                reject(error);
            });
        });
    }

    /**
     * Stop the active recording process
     */
    async stopRecording() {
        if (this.activeProcess) {
            logger.info('🛑 Stopping active recording process');
            this.activeProcess.kill('SIGTERM');
            this.activeProcess = null;
        }
        
        this.isRecording = false;
        
        return {
            success: true,
            message: 'Recording stopped'
        };
    }

    /**
     * Get current recording status
     */
    getStatus() {
        return {
            isRecording: this.isRecording,
            hasActiveProcess: !!this.activeProcess,
            results: this.results
        };
    }
}

/**
 * Initialize HTTP endpoints for dual Pi recording
 */
function HW_DUAL_PI_RECORDING_HTTP(GLOBALS) {
    const recorder = new DualPiRecorder(GLOBALS);
    
    // POST start recording endpoint
    GLOBALS.Express.post('/api/dual-pi-record', async (req, res) => {
        try {
            const { duration = 5, settings = {} } = req.body;
            
            logger.info(`🎬 Web request: Start dual Pi recording (${duration}s)`);
            
            // Start recording asynchronously and respond immediately
            recorder.runTestScript(duration, settings)
                .then(result => {
                    logger.info('✅ Dual Pi recording completed:', result);
                })
                .catch(error => {
                    logger.error('❌ Dual Pi recording failed:', error);
                });

            // Return immediate response
            res.json({ 
                success: true, 
                message: 'Dual Pi recording started via test script',
                duration: duration,
                settings: settings
            });

        } catch (error) {
            logger.error('Failed to start dual Pi recording:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // POST stop recording endpoint (emergency stop/reset)
    GLOBALS.Express.post('/api/dual-pi-stop', async (req, res) => {
        try {
            logger.info('🛑 Web request: Stop/reset dual Pi recording');
            const result = await recorder.stopRecording();
            res.json(result);
        } catch (error) {
            logger.error('Failed to stop dual Pi recording:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // GET status endpoint  
    GLOBALS.Express.get('/api/dual-pi-status', (req, res) => {
        res.json(recorder.getStatus());
    });

    // POST reset endpoint (force stop and clear state)
    GLOBALS.Express.post('/api/dual-pi-reset', async (req, res) => {
        try {
            logger.info('🔄 Web request: Force reset dual Pi recording');
            await recorder.stopRecording();
            res.json({ success: true, message: 'Dual Pi recording reset' });
        } catch (error) {
            logger.error('Failed to reset dual Pi recording:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // POST ping endpoint - ping both Pis directly
    GLOBALS.Express.post('/api/dual-pi-ping', async (req, res) => {
        try {
            logger.info('🏓 Web request: Ping both Raspberry Pis');
            
            const results = {};
            const pingPromises = Object.entries(PI_CONFIGS).map(async ([piId, config]) => {
                try {
                    const pingResult = await pingRaspberryPi(piId, config);
                    results[piId] = pingResult;
                } catch (error) {
                    results[piId] = {
                        success: false,
                        error: error.message,
                        host: config.host,
                        port: config.port
                    };
                }
            });
            
            await Promise.all(pingPromises);
            
            const successCount = Object.values(results).filter(r => r.success).length;
            logger.info(`🏓 Ping results: ${successCount}/${Object.keys(PI_CONFIGS).length} Pis responded`);
            
            res.json({ 
                success: true, 
                results: results,
                summary: {
                    total: Object.keys(PI_CONFIGS).length,
                    responded: successCount
                }
            });
        } catch (error) {
            logger.error('Failed to ping Raspberry Pis:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // GET connection status endpoint - show current Pi configurations
    GLOBALS.Express.get('/api/dual-pi-connection-status', (req, res) => {
        try {
            // Try to get status from HW_RASPI_MULTI if available
            let multiPiStatus = {};
            try {
                const HW_RASPI_MULTI = require('./HW_RASPI_MULTI.js');
                multiPiStatus = HW_RASPI_MULTI.getConnectionStatus();
            } catch (e) {
                logger.debug('HW_RASPI_MULTI not available, using local config');
            }
            
            // Build response with configured Pis
            const pis = {};
            Object.entries(PI_CONFIGS).forEach(([piId, config]) => {
                pis[piId] = {
                    connected: multiPiStatus[piId]?.connected || false,
                    host: config.host,
                    port: config.port,
                    name: config.name
                };
            });
            
            res.json({ 
                success: true,
                pis: pis,
                recording: recorder.isRecording
            });
        } catch (error) {
            logger.error('Failed to get connection status:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    logger.info('📡 Dual Pi Recording HTTP endpoints initialized');
}

/**
 * Ping a single Raspberry Pi by attempting a TCP connection and sending a ping command
 * @param {string} piId - Pi identifier
 * @param {Object} config - Pi configuration {host, port, name}
 * @returns {Promise<Object>} Ping result
 */
function pingRaspberryPi(piId, config) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const timeout = 5000; // 5 second timeout
        
        const client = new net.Socket();
        let resolved = false;
        
        const cleanup = () => {
            if (!resolved) {
                resolved = true;
                try {
                    client.destroy();
                } catch (e) {}
            }
        };
        
        // Set timeout
        const timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error(`Connection timeout after ${timeout}ms`));
        }, timeout);
        
        client.connect(config.port, config.host, () => {
            // Connected! Send ping command
            logger.debug(`🏓 Connected to ${piId}, sending ping...`);
            client.write(JSON.stringify({ command: 'ping' }) + '\n');
        });
        
        client.on('data', (data) => {
            clearTimeout(timeoutId);
            const responseTime = Date.now() - startTime;
            
            try {
                const response = JSON.parse(data.toString().trim());
                cleanup();
                resolve({
                    success: true,
                    message: `Pong received in ${responseTime}ms`,
                    responseTime: responseTime,
                    host: config.host,
                    port: config.port,
                    response: response
                });
            } catch (e) {
                // Got a response but couldn't parse it - still counts as reachable
                cleanup();
                resolve({
                    success: true,
                    message: `Response received in ${responseTime}ms (non-JSON)`,
                    responseTime: responseTime,
                    host: config.host,
                    port: config.port,
                    raw: data.toString().substring(0, 200)
                });
            }
        });
        
        client.on('error', (error) => {
            clearTimeout(timeoutId);
            cleanup();
            reject(new Error(`Connection failed: ${error.message}`));
        });
        
        client.on('close', () => {
            if (!resolved) {
                clearTimeout(timeoutId);
                cleanup();
                reject(new Error('Connection closed before response'));
            }
        });
    });
}

module.exports = {
    HW_DUAL_PI_RECORDING_HTTP
};