/**
 * @fileoverview Video Upload Handler for Raspberry Pi camera recordings
 * @description Handles multiple simultaneous video uploads with queue management
 *              using raw HTTP body streaming (no multer).
 */

const fs = require('fs');
const path = require('path');
const { createModuleLogger } = require('../config/logger.js');
const logger = createModuleLogger('VIDEO');

// Upload queue to handle multiple simultaneous uploads
let videoQueue = [];
let queueProcessor = null;
let isProcessing = false; // prevent race conditions in queue processing

/**
 * Process video upload queue - one video file per Pi (overwrite previous)
 */
function processVideoQueue() {
    if (isProcessing) return;
    if (videoQueue.length === 0) return;

    isProcessing = true;

    // Take a snapshot of the queue and clear it so new arrivals go into a new batch
    const batch = videoQueue;
    videoQueue = [];

    // Use existing video directory
    const videoDir = path.join(__dirname, '../../../public/video');
    if (!fs.existsSync(videoDir)) {
        fs.mkdirSync(videoDir, { recursive: true });
    }

    // Process all videos in batch
    let processed = 0;
    const totalVideos = batch.length;

    batch.forEach(video => {
        const raspiId = video.raspiId;
        const cameraModel = video.cameraModel || 'unknown';

        // Simple filename: just the Pi ID
        const fileName = `${raspiId}.mp4`;
        const finalPath = path.join(videoDir, fileName);

        logger.info(`📹 Saving video from ${raspiId} (${cameraModel}): ${fileName} (${(fs.statSync(video.tempPath).size / 1024 / 1024).toFixed(1)}MB)`);

        fs.rename(video.tempPath, finalPath, (err) => {
            processed++;
            
            if (err) {
                logger.error(`❌ Failed to save ${fileName}: ${err.message}`);
            } else {
                logger.info(`✅ Video saved: /public/video/${fileName} (${cameraModel})`);
            }

            // After processing all videos in batch
            if (processed === totalVideos) {
                isProcessing = false;
                logger.info(`📁 Batch complete: ${totalVideos} video(s) saved to /public/video/`);
            }
        });
    });
}

/**
 * Initialize video upload system (raw streaming, no multer)
 */
function HW_VIDEO_UPLOAD_INIT(GLOBALS) {
    // Ensure temp directory exists
    const tempDir = path.join(__dirname, '../../temp/video_uploads');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    // Upload endpoint: raw request body is the video file
    GLOBALS.Express.post('/api/upload-video', (req, res) => {
        const raspiId = req.headers['x-raspi-id'] || 'unknown';
        const cameraModel = req.headers['x-camera-model'] || 'unknown';
        const timestamp = Date.now();

        const tempPath = path.join(tempDir, `video_${raspiId}_${cameraModel}_${timestamp}.mp4`);
        const writeStream = fs.createWriteStream(tempPath);

        let bytesReceived = 0;
        const MAX_SIZE = 500 * 1024 * 1024; // 500 MB
        let responded = false;

        const safeRespond = (status, body) => {
            if (responded) return;
            responded = true;
            if (!res.headersSent) {
                res.status(status).json(body);
            }
        };

        req.on('data', (chunk) => {
            bytesReceived += chunk.length;

            // Enforce max size
            if (bytesReceived > MAX_SIZE) {
                logger.warn(`Upload from ${raspiId} exceeded size limit, aborting.`);
                safeRespond(413, {
                    success: false,
                    error: 'File too large',
                    maxBytes: MAX_SIZE
                });
                req.destroy();
                writeStream.destroy();
                fs.unlink(tempPath, () => {});
            }
        });

        req.on('aborted', () => {
            logger.warn(`Upload aborted from ${raspiId}`);
            writeStream.destroy();
            fs.unlink(tempPath, () => {});
            // usually client is gone, but just in case:
            safeRespond(400, { success: false, error: 'Upload aborted by client' });
        });

        req.on('error', (err) => {
            logger.error(`Request error from ${raspiId}: ${err.message}`);
            writeStream.destroy();
            fs.unlink(tempPath, () => {});
            safeRespond(500, { success: false, error: 'Request stream error' });
        });

        writeStream.on('error', (err) => {
            logger.error(`Write error for ${raspiId}: ${err.message}`);
            fs.unlink(tempPath, () => {});
            safeRespond(500, { success: false, error: 'Failed to store video' });
        });

        writeStream.on('finish', () => {
            if (responded) {
                // we already sent an error (e.g. size exceeded), don't queue
                return;
            }

            logger.info(
                `Video upload received from ${raspiId} (${(bytesReceived / 1024 / 1024).toFixed(2)} MB)`
            );

            // Add to queue
            const entry = {
                tempPath,
                raspiId,
                cameraModel,
                timestamp,
                size: bytesReceived
            };
            videoQueue.push(entry);

            logger.debug(`Queue length: ${videoQueue.length}`);

            safeRespond(200, {
                success: true,
                message: `Video queued from ${raspiId}`,
                queuePosition: videoQueue.length,
                fileSize: bytesReceived
            });
        });

        // Start piping the request body into the file
        req.pipe(writeStream);
    });

    // Start queue processor
    if (!queueProcessor) {
        queueProcessor = setInterval(processVideoQueue, 2000); // Process every 2 seconds
        logger.info('Video upload queue processor started');
    }

    logger.info('Video upload system initialized (raw stream, no multer)');
    logger.info('📁 Videos will be saved to: /public/video/ (one file per Pi)');
    logger.info('📝 Filename format: [pi_id].mp4 (e.g. raspi_sensor.mp4, raspi_main.mp4)');
}

module.exports = {
    HW_VIDEO_UPLOAD_INIT
};