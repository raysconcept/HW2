/**
 * @fileoverview WebRotate360 Image Rotator implementation for HotWheels 360-degree car viewer
 * @requires ./logger
 * @requires @webrotate360/imagerotator
 */


// enable custom logging
const logger = require('../server/config/logger');
const WR360 = require('@webrotate360/imagerotator');     // https://www.npmjs.com/package/@webrotate360/imagerotator

/**
 * @type {Object}
 * @description Global viewer instance for 360-degree image rotation
 * @property {string} licenseCode - License code for WebRotate360
 * @property {Object} settings - Viewer configuration settings
 * @property {string} settings.configFileURL - URL to the configuration XML file
 * @property {string} settings.graphicsPath - Path to viewer graphics assets
 * @property {string} settings.alt - Alt text for the viewer
 * @property {number} settings.responsiveBaseWidth - Base width for responsive sizing
 * @property {number} settings.responsiveMinHeight - Minimum height for responsive sizing
 * @property {Function} settings.apiReadyCallback - Callback function when API is ready
 */
const viewer = WR360.ImageRotator.Create('webrotate360');

/**
 * @type {Object}
 * @description Configuration settings for the viewer
 */
viewer.licenseCode = 'your-license-code';
viewer.settings.configFileURL = '/example/example.xml';
viewer.settings.graphicsPath = '/graphics';
viewer.settings.alt = 'Your alt image description';
viewer.settings.responsiveBaseWidth = 800;
viewer.settings.responsiveMinHeight = 300;

/**
 * @callback apiReadyCallback
 * @param {Object} api - The WebRotate360 API instance
 * @param {boolean} isFullScreen - Whether the viewer is in fullscreen mode
 * @description Callback function executed when the WebRotate360 API is ready
 */
viewer.settings.apiReadyCallback = (api, isFullScreen) => {
    this.viewerApi = api;
    this.viewerApi.images.onDrag(event => {
        logger.info(`${event.action}; current image index = ${this.viewerApi.images.getCurrentImageIndex()}`);
    });
}

/**
 * @function runImageRotator
 * @description Initializes and starts the image rotator
 */
viewer.runImageRotator();

/**
 * @function cleanup
 * @description Cleans up the viewer instance when no longer needed
 * @example
 * // Called when component unmounts
 * if (this.viewerApi) {
 *     this.viewerApi.delete();
 * }
 */
if (this.viewerApi) {
    this.viewerApi.delete();
}

/**
 * @type {Object}
 * @description Exports the viewer functionality and configuration
 */
module.exports = {
    viewer,
    viewerApi: this.viewerApi
}