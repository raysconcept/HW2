
/**
 * Sends the order information to the video server
 * @param {Object} userOrder - The order information to send
 */
function sendOrderToVideoServer(userOrder) {
    const videoServerClient = new net.Socket();
    const HOSTVIDEO = '192.168.56.5';
    const PORTVIDEO = 9999;

    videoServerClient.connect(PORTVIDEO, HOSTVIDEO, () => {
        logger.info('videoServerClient Connected to server');
        videoServerClient.write(JSON.stringify(userOrder));

        const FROM = "S1HWCOM";
        const ACTION = "S1HWCOM_VIDEOUPDATE";
        const MSG = 'S1HWCOM: SENDING ORDER TO VIDEO:' + userOrder;
    });

    videoServerClient.on('data', (data) => {
        logger.info('videoServerClient Received: ' + data);
        videoServerClient.destroy();
    });

    videoServerClient.on('close', () => {
        logger.info('videoServerClient: Connection closed');
    });

    videoServerClient.on('error', (err) => {
        logger.error('== ORDER: VIDEOSERVER NOT RESPONDING:', err.message);
        const FROM = "S1HWCOM";
        const ACTION = "S1HWCOM_VIDEOUPDATE";
        const MSG = 'S1HWCOM: VIDEOSERVER IS NOT RESPONDING:' + err.message;
        videoServerClient.destroy();
    });
}
