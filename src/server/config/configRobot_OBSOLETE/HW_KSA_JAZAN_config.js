// MACHINE 11.2 JAZAN CALIBRATION

module.exports = {
    ////////////////////////////////////////////////////////////
    // Robot Movements /////////////////////////////////////////
    
    robot_a: 1.02, // acceleration
    robot_v: 0.4,  // speed
    robot_t: 0,    // time
    robot_r: 0,    // blend radius

    sleeptime: 1,  // Sleep time between robot actions, in seconds

    ////////////////////////////////////////////////////////////
    // Cassette Pick up ////////////////////////////////////////

    deltaX: 100,   // X-axis movement increment in millimeters
    deltaY: 55,    // Y-axis movement increment in millimeters

    homeX: -707,   // Home X position in millimeters (relative to left top)
    homeY: 725,    // Home Y position in millimeters (relative to left top)
    
    calibrationAngleDEG: -0.7, // Front view calibration angle [degrees]
    
    safetyZOffset: 0.0,   // Safety margin for pointing and picking from cassettes, [m]
    
    PICK_HOVER_Z: 210 / 1000,           // base depth calibration for all cassettes, how far to hover in front of cassette
    PICK_MOVE_IN_DISTANCE: 50 / 1000,   // Distance in meters to move in from hover position [m]
    PICK_MOVE_UP_DISTANCE: 15 / 1000, // Distance in meters to move up after picking
    PICK_MOVE_OUT_DISTANCE: -200 / 1000, // Distance in meters to retract fully
    
    PICK_ANGLEDEG: 16,               // Angle in degrees to pick at    
    PickHeightOffset: -0.035,         // how much the tcp is lowered, to match PICK_ANGLEDEG

    ////////////////////////////////////////////////////////////
    // Home/Safe Positions /////////////////////////////////////

    neutral: {
        base: 90 * Math.PI / 180,
        shoulder: -90 * Math.PI / 180,
        elbow: -120 * Math.PI / 180,
        wrist1: 120 * Math.PI / 180,
        wrist2: -90 * Math.PI / 180,
        wrist3: 90 * Math.PI / 180
    },

    left: {
        base: 180 * Math.PI / 180,
        shoulder: -90 * Math.PI / 180,
        elbow: -90 * Math.PI / 180,
        wrist1: 90 * Math.PI / 180,
        wrist2: -90 * Math.PI / 180,
        wrist3: 180 * Math.PI / 180
    },

    right: {
        base: 60 * Math.PI / 180,
        shoulder: -90 * Math.PI / 180,
        elbow: -90 * Math.PI / 180,
        wrist1: 90 * Math.PI / 180,
        wrist2: -90 * Math.PI / 180,
        wrist3: 60 * Math.PI / 180
    },

    ////////////////////////////////////////////////////////////
    // Track Drop Positions ////////////////////////////////////

    drop1To: {
        base: 139.96 * Math.PI / 180,
        shoulder: -156.01 * Math.PI / 180,
        elbow: -13.52 * Math.PI / 180,
        wrist1: -95.75 * Math.PI / 180,
        wrist2: 89.09 * Math.PI / 180,
        wrist3: -44.84 * Math.PI / 180
    },

    drop1Over: {
        base: 139.53 * Math.PI / 180,
        shoulder: -160.24 * Math.PI / 180,
        elbow: -10.97 * Math.PI / 180,
        wrist1: -97.7 * Math.PI / 180,
        wrist2: 92.96 * Math.PI / 180,
        wrist3: -44.84 * Math.PI / 180
    },

    drop1Rotate: {
        base: 139.52 * Math.PI / 180,
        shoulder: -163.05 * Math.PI / 180,
        elbow: -4.89 * Math.PI / 180,
        wrist1: -102.7 * Math.PI / 180,
        wrist2: 93.12 * Math.PI / 180,
        wrist3: -79.23 * Math.PI / 180
    },

    drop1Release: {
        base: 139.68 * Math.PI / 180,
        shoulder: -154.81 * Math.PI / 180,
        elbow: -21.41 * Math.PI / 180,
        wrist1: -94.41 * Math.PI / 180,
        wrist2: 93.1 * Math.PI / 180,
        wrist3: -79.02 * Math.PI / 180
    },

    ///////////////////////////////////////////////////////

    drop2To: {
        base: 136.02 * Math.PI / 180,
        shoulder: -145.79 * Math.PI / 180,
        elbow: -34.46 * Math.PI / 180,
        wrist1: -87.59 * Math.PI / 180,
        wrist2: 91.07 * Math.PI / 180,
        wrist3: -49.44 * Math.PI / 180
    },

    drop2Over: {
        base: 135.43 * Math.PI / 180,
        shoulder: -146.62 * Math.PI / 180,
        elbow: -38.26 * Math.PI / 180,
        wrist1: -81.96 * Math.PI / 180,
        wrist2: 90.1 * Math.PI / 180,
        wrist3: -49.41 * Math.PI / 180
    },

    drop2Rotate: {
        base: 135.95 * Math.PI / 180,
        shoulder: -146.69 * Math.PI / 180,
        elbow: -37.58 * Math.PI / 180,
        wrist1: -84.43 * Math.PI / 180,
        wrist2: 92.17 * Math.PI / 180,
        wrist3: -84.14 * Math.PI / 180
    },

    drop2Release: {
        base: 135.88 * Math.PI / 180,
        shoulder: -145.28 * Math.PI / 180,
        elbow: -40.51 * Math.PI / 180,
        wrist1: -84.6 * Math.PI / 180,
        wrist2: 92.61 * Math.PI / 180,
        wrist3: -82.06 * Math.PI / 180
    },

    ///////////////////////////////////////////////////////    

    drop3To: {
        base: 136.18 * Math.PI / 180,
        shoulder: -148.34 * Math.PI / 180,
        elbow: -28.97 * Math.PI / 180,
        wrist1: -97.01 * Math.PI / 180,
        wrist2: 94.55 * Math.PI / 180,
        wrist3: -59.6 * Math.PI / 180
    },

    drop3Over: {
        base: 135.73 * Math.PI / 180,
        shoulder: -150.34 * Math.PI / 180,
        elbow: -31.89 * Math.PI / 180,
        wrist1: -92.13 * Math.PI / 180,
        wrist2: 94.52 * Math.PI / 180,
        wrist3: -60.05 * Math.PI / 180
    },

    drop3Rotate: {
        base: 136.03 * Math.PI / 180,
        shoulder: -148.68 * Math.PI / 180,
        elbow: -35.28 * Math.PI / 180,
        wrist1: -90.28 * Math.PI / 180,
        wrist2: 93.96 * Math.PI / 180,
        wrist3: -75.27 * Math.PI / 180
    },

    drop3Release: {
        base: 136.79 * Math.PI / 180,
        shoulder: -144.13 * Math.PI / 180,
        elbow: -43.82 * Math.PI / 180,
        wrist1: -84.91 * Math.PI / 180,
        wrist2: 92.77 * Math.PI / 180,
        wrist3: -79.38 * Math.PI / 180
    },

    ///////////////////////////////////////////////////////

    drop4To: {
        base: 136.18 * Math.PI / 180,
        shoulder: -148.34 * Math.PI / 180,
        elbow: -28.97 * Math.PI / 180,
        wrist1: -97.01 * Math.PI / 180,
        wrist2: 94.55 * Math.PI / 180,
        wrist3: -59.6 * Math.PI / 180
    },

    drop4Over: {
        base: 135.73 * Math.PI / 180,
        shoulder: -150.34 * Math.PI / 180,
        elbow: -31.89 * Math.PI / 180,
        wrist1: -92.13 * Math.PI / 180,
        wrist2: 94.52 * Math.PI / 180,
        wrist3: -60.05 * Math.PI / 180
    },

    drop4Rotate: {
        base: 136.03 * Math.PI / 180,
        shoulder: -148.68 * Math.PI / 180,
        elbow: -35.28 * Math.PI / 180,
        wrist1: -90.28 * Math.PI / 180,
        wrist2: 93.96 * Math.PI / 180,
        wrist3: -75.27 * Math.PI / 180
    },

    drop4Release: {
        base: 136.79 * Math.PI / 180,
        shoulder: -144.13 * Math.PI / 180,
        elbow: -43.82 * Math.PI / 180,
        wrist1: -84.91 * Math.PI / 180,
        wrist2: 92.77 * Math.PI / 180,
        wrist3: -79.38 * Math.PI / 180
    },

    ////////////////////////////////////////////////////////////
    // Cassettes Z Calibration /////////////////////////////////
    // negative means the cassette is deeper than the others, further away from the robot

    cassettesZ: {
        // ROW 1
        1: -15,
        2: -15,
        3: -15,
        4: -15,
        5: -15,
        // ROW 2
        6: -15,
        7: -15,
        8: -15,
        9: -15,
        10: -15,
        11: -15,
        12: -15,
        // ROW 3
        13: -15,
        14: -15,
        15: -15,
        16: -15,
        17: -15,
        18: -15,
        19: -15,
        20: -15,
        21: -15,
        // ROW 4
        22: -15,
        23: -15,
        24: -15,
        25: -15,
        26: -15,
        27: -15,
        28: -15,
        29: -15,
        // ROW 5
        30: -15,
        31: -15,
        32: -15,
        33: -15,
        34: -15,
        35: -15,
        36: -15,
        37: -15,
        38: -15,
        39: -15,
        // ROW 6
        40: -15,
        41: -15,
        42: -15,
        43: -15,
        44: -15,
        45: -15,
        46: -15,
        // ROW 7
        47: 0,
        48: 0,
        49: 0,
        50: 0,
        51: 0,
        // ROW 8
        52: 0,
        53: 0,
        54: 0,
        55: 0,
        56: 0,
        // ROW 9, Center
        57: 0,
        58: 0,
        // ROW 13
        59: 0,
        60: 0,
        61: 0,
        62: 0,
        63: 0,
        64: 0,
        // ROW 14
        65: 0,
        66: 0,
        67: 0,
        68: 0,
        69: 0,
        70: 0,
        71: 0,
        72: 0,
        // ROW 15
        73: 0,
        74: 0,
        75: 0,
        76: 0,
        77: 0,
        78: 0,
        79: 0,
        80: 0,
        // ROW 16
        81: 0,
        82: 0,
        83: 0,
        84: 0,
        85: 0,
        86: 0,
        87: 0,
        88: 0,
        // ROW 17
        89: 0,
        90: 0,
        91: 0,
        92: 0,
        93: 0,
        94: 0,
        95: 0,
        96: 0,
        // ROW 18
        97: 0,
        98: 0,
        99: 0,
        100: 0,
        101: 0,
        102: 0,
        103: 0,
        104: 0,
        105: 0,
        106: 0,
        // ROW 19
        107: 0,
        108: 0,
        109: 0,
        110: 0,
        111: 0,
        112: 0,
        113: 0,
        114: 0,
        115: 0,
        116: 0,
        // ROW 20
        117: 0,
        118: 0,
        119: 0,
        120: 0,
        121: 0,
        122: 0,
        123: 0,
        124: 0,
        125: 0,
        126: 0,
        // ROW 21
        127: 0,
        128: 0,
        129: 0,
        130: 0,
        131: 0,
        132: 0,
        133: 0,
        134: 0,
        // ROW 22
        135: 0,
        136: 0,
        137: 0,
        138: 0,
        139: 0,
        140: 0,
        141: 0,
        142: 0,
        // ROW 23
        143: 0,
        144: 0,
        145: 0,
        146: 0,
        147: 0,
        148: 0,
        149: 0,
        150: 0,
        // ROW 24
        151: 0,
        152: 0,
        153: 0,
        154: 0,
        155: 0,
        156: 0,
        // ROW 25
        157: 0,
        158: 0,
        159: 0,
        160: 0,
        // ROW 26
        161: 0,
        162: 0
    }
}; 