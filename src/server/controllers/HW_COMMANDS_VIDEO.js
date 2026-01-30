const { createModuleLogger } = require('../config/logger');
const logger = createModuleLogger('INVT');
// Video commands--------------------------------------------------------------------

    S1_APPX.post("/HW_VIDEO_READY", function (req, res) {
        // RFO = REQUEST FROM OPERATOR (@DASHBOARD or @OPERATOR)
        let cmnd = req.body.cmnd;
        let videoUrl = req.body.videoUrl;

        logger.info("HW_VIDEO_READY received: " + cmnd);

        // CHECK CONNECTIONS & SOCKETS
        if (cmnd == "VIDEO_READY") {
            logger.debug("SUCCES    received RFO:" + cmnd);
            logger.debug("SUCCES    received RFO videoUpdate:" + videoUrl);
            const FROM = "S1HWCOM";
            const ACTION = "S1HWCOM_VIDEO_READY";
            const MSG = "S1HWCOM: VIDEO_READY received" + videoUrl;
            GLOBALS.SIO.emit("MFS", FROM + "___" + ACTION + "___" + MSG);
        }
        else {
            logger.warn("VIDEO_READY received, but cmnd not found");
        }
        res.send("THANKYOU_FOR_THE_VIDEO " + cmnd + "=" + videoUrl);
    });

    S1_APPX.post("/HW_VIDEO_READY", function (req, res) {

        // RFO = REQUEST FROM OPERATOR (@DASHBOARD or @OPERATOR)
        let cmnd = req.body.cmnd;
        let videoUrl = req.body.videoUrl;
        logger.info("received RFO:" + cmnd);
        ////////////////////////////////////////////////////////////////////////////////////////////
        // CHECK CONNECTIONS & SOCKETS
        if (cmnd == "VIDEO_READY") {
            logger.info("SUCCES     received RFO:" + cmnd);
            logger.info("SUCCES     received RFO videoUpdate:" + videoUrl);
            const FROM = "S1HWCOM";
            const ACTION = "S1HWCOM_VIDEO_READY";
            const MSG = "S1HWCOM: VIDEO_READY received" + videoUrl;
            GLOBALS.SIO.emit("MFS", FROM + "___" + ACTION + "___" + MSG);
        }
        res.send("THANKYOU_FOR_THE_VIDEO " + cmnd + "=" + videoUrl);
        //res.end();
    });

    S1_APPX.post("/HW_VIDEO_UPDATE", function (req, res) {

        // RFO = REQUEST FROM OPERATOR (@DASHBOARD or @OPERATOR)
        let cmnd = req.body.cmnd;
        let videoUpdate = req.body.videoUpdate;
        logger.info("received RFO:" + cmnd);

        if (cmnd == "VIDEO_LOG") {
            // VIDEOLOG is de naam van de requested update
            // VIDEOUPDATE is de content van the update
            logger.info("VIDEO_LOG   SUCCES     received RFO:" + cmnd);
            logger.info("VIDEO_LOG   SUCCES     received RFO videoUpdate:" + videoUpdate);

            const FROM = "S1HWCOM";
            const ACTION = "S1HWCOM_VIDEOUPDATE";
            const MSG = "S1HWCOM: VIDEOUPDATE received" + videoUpdate;
            GLOBALS.SIO.emit("MFS", FROM + "___" + ACTION + "___" + MSG);
        }
        //res.end();
    });

    function HW_DASHBOARD_VIDEOSERVERUPDATE(S1_APPX) {
        logger.info("HW_DASHBOARD_VIDEOSERVERUPDATE");
    
        const now = "[" + new Date().toLocaleTimeString() + "]";
        const FROM = "S1HWCOM";
        const ACTION = "VIDEOSERVERUPDATE";
        const MSG = now + "S1HWCOM: connection okay, videoServer is Updating (TODO)";
    
        logger.debug("HW_DASHBOARD_VIDEOSERVERUPDATE" + MSG);
        GLOBALS.SIO.emit("MFS", FROM + "___" + ACTION + "___" + MSG);
    };