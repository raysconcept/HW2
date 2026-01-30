// enable custom logging
const { createModuleLogger } = require('../server/config/logger');
const logger = createModuleLogger('VideoCompiler2');


camIntro = 'raceVideo/CAM_INTRO.MP4';
camFPV = 'raceVideo/CAM_FPV.MP4';
cam1 = 'raceVideo/CAM1.MP4';
cam2 = 'raceVideo/CAM2.MP4';
cam3 = 'raceVideo/CAM3.MP4';
cam4 = 'raceVideo/CAM4.MP4';
cam5 = 'raceVideo/CAM5.MP4';
cam6 = 'raceVideo/CAM6.MP4';
cam7 = 'raceVideo/CAM7.MP4';
cam8 = 'raceVideo/CAM8.MP4';
camFallBack = 'raceVideo/CAM_FPV.MP4';

const LOGO = 'raceOverlay/hwlogo.png';
const CLOCK = 'raceOverlay/clock.png';
const SQUARE = 'raceOverlay/square.png';

const dir360 = "hw_cars";
car1img = dir360 + "/HKG27/images/Photo024.png";
car2img = dir360 + "/HKG28/images/Photo024.png";
car3img = dir360 + "/HKG29/images/Photo024.png";
car4img = dir360 + "/HKG30/images/Photo024.png";
car5img = dir360 + "/HKG31/images/Photo024.png";

// durations (must be below recording time -/- offset)
// if recording time = 5s, and offset is at 2s, duration must be lower then 3s
t_dur_intro = 2;
t_dur_start = 2;
t_dur_drop = 2;
t_dur_looping = 2;
t_dur_uTurn = 2;
t_dur_knot = 2;
t_dur_flatrun = 2;
t_dur_jumps = 2;
t_dur_leaderboard = 2;
t_dur_outro = 2;

// offset start times
t_ofs_intro = 0;
t_ofs_start = 0.5;
t_ofs_drop = 0;
t_ofs_looping = 0;
t_ofs_uTurn = 0;
t_ofs_knot = 0;
t_ofs_flatrun = 0;
t_ofs_jumps = 0;
t_ofs_leaderboard = 0;
t_ofs_outro = 0;

// ref times for overlays
t_s_intro = 0;
t_s_start = t_s_intro + t_dur_intro;
t_s_drop = t_s_start + t_dur_start;
t_s_looping = t_s_drop + t_dur_drop;
t_s_uTurn = t_s_looping + t_dur_looping;
t_s_knot = t_s_uTurn + t_dur_uTurn;
t_s_flatrun = t_s_knot + t_dur_knot;
t_s_jumps = t_s_flatrun + t_dur_flatrun;
t_s_leaderboard = t_s_jumps + t_dur_jumps;
t_s_outro = t_s_leaderboard + t_dur_leaderboard;
t_end = t_s_outro + t_dur_outro;

function compileVideo(outputFile) {
  // mainstream
  // feeds are clipped to start at offset (ofs)
  const VIDEOS = "" +
    "[0:v]scale=1920:1080,trim=start=" + t_ofs_intro + ":end=" + t_dur_intro + ",setpts=PTS-STARTPTS[v0];\n" +
    "[1:v]scale=1920:1080,trim=start=" + t_ofs_start + ":end=" + t_dur_start + ",setpts=PTS-STARTPTS[v1];\n" +
    "[2:v]scale=1920:1080,trim=start=" + t_ofs_drop + ":end=" + t_dur_drop + ",setpts=PTS-STARTPTS[v2];\n" +
    "[3:v]scale=1920:1080,trim=start=" + t_ofs_looping + ":end=" + t_dur_looping + ",setpts=PTS-STARTPTS[v3];\n" +
    "[4:v]scale=1920:1080,trim=start=" + t_ofs_uTurn + ":end=" + t_dur_uTurn + ",setpts=PTS-STARTPTS[v4];\n" +
    "[5:v]scale=1920:1080,trim=start=" + t_ofs_knot + ":end=" + t_dur_knot + ",setpts=PTS-STARTPTS[v5];\n" +
    "[6:v]scale=1920:1080,trim=start=" + t_ofs_flatrun + ":end=" + t_dur_flatrun + ",setpts=PTS-STARTPTS[v6];\n" +
    "[7:v]scale=1920:1080,trim=start=" + t_ofs_jumps + ":end=" + t_dur_jumps + ",setpts=PTS-STARTPTS[v7];\n" +
    "[8:v]scale=1920:1080,trim=start=" + t_ofs_leaderboard + ":end=" + t_dur_leaderboard + ",setpts=PTS-STARTPTS[v8];\n" +
    "[9:v]scale=1920:1080,trim=start=" + t_ofs_outro + ":end=" + t_dur_outro + ",setpts=PTS-STARTPTS[v9];\n" +
    "[v0][v1][v2][v3][v4][v5][v6][v7][v8][v9]concat=n=10:v=1:a=0\n" +
    "[VCAMS];\n[VCAMS]\n";

  // #########################################################################################################
  //# voeg overlay images toe aan V_CAMS, eindig met V_WITH_IMAGES
  //#########################################################################################################
  img1 = "'raceOverlay/clock.png'";//  # Path to the first image    
  slide_in_duration1 = 2;//  # Duration for sliding in the images in seconds    
  w = 1920;
  w1 = 400;
  h1 = 180;
  /*
    const CARIMGS =
      "[10:v]scale=400:180[car1];\n" +
      "[11:v]scale=400:180[car2];\n" +
      "[12:v]scale=400:180[car3];\n" +
      "[13:v]scale=400:180[car4];\n" +
      "[14:v]scale=400:180[car5];\n";
      */

  const IMGS =
    "[10:v]scale=400:180[logo];\n" +
    "[11:v]scale=400:180[clock];\n" +
    "[12:v]scale=400:180[square];\n" +
    "[13:v]scale=200:150[car_1];\n" +
    "[14:v]scale=200:150[car_2];\n" +
    "[15:v]scale=200:150[car_3];\n" +
    "[16:v]scale=200:150[car_4];\n" +
    "[17:v]scale=200:150[car_5];\n";




  
  car1 = "car1";
  car2 = "car2";
  car3 = "car3";
  car4 = "car4";
  car5 = "car5";

  car1_time = "" + 2010;
  car2_time = "" + 2020;
  car3_time = "" + 2030;
  car4_time = "" + 2040;
  car5_time = "" + 2050;

  /*
  text to speach
  https://www.youtube.com/watch?v=ag3Gb1QVm_0
  https://www.youtube.com/watch?v=pgvD9QE4IAc (capcut)
  https://localai.io/features/text-to-audio/ (localAi)

  https://manpages.debian.org/experimental/ffmpeg/ffmpeg-filters.1.en.html
  filterchain=comma seperated=> filter,filter,filter
  filtergraph= ; seperated=> filterchain;filterchain
  filter= enclosed with labels => [filtername]filter_name@id=arguments[filtername]
  .. filter_name is the name of the filter class of which the described filter is an instance of, 
  .. and has to be the name of one of the filter classes registered in the program optionally 
  .. followed by "@id". The name of the filter class is optionally followed by a string "=arguments".
  argument= a string which contains the parameters used to initialize the filter instance. It may have one of two forms:
  
  */

  deltaY = 110;
  carlist = [
    "car_1", "car_2", "car_3", "car_4", "car_5"
  ];
  cartimelist = ["1500", "1600", "1850", "2500", "3500"];  
  animate_leader = "enable='between(t,10,15)'";
  fontLeader = 'fontcolor=orange:fontsize=80:fontfile=raceOverlay/font/TTSupermolotCondensed-BoldItalic.ttf';
  fontCar = 'fontcolor=white:fontsize=40:fontfile=raceOverlay/font/TTSupermolotCondensed-BoldItalic.ttf';

  let leaderboard =
    "\ndrawbox=x=550:y=250:w=900:h=40:color=black@0.6:t=fill:" + animate_leader +"\n[x];[x]" +
    "\ndrawtext=text='LEADERBOARD':" + fontLeader +"\n:x=700:y=200:" + animate_leader +"\n[x];[x]\n"+
    "\ndrawbox=x=530:y=200:w=940:h=640:color=blue@0.8:t=fill:"+ animate_leader +"\n[x];[x]" +
    "\ndrawbox=x=550:y=220:w=900:h=600:color=black@0.5:t=fill:"+ animate_leader +"\n[x];[x]";
  for (c = 0; c < 5; c++) {
    tshow = "enable='between(t," + (10 + c) + ",20)'";
    leaderboard +=
      "\ndrawbox=x=550:y=" + (290 + deltaY * c) + ":w=900:h=45:color=black@0.6:t=fill:" + tshow + "\n[x];[x]" +
      "\ndrawtext=text='" + carlist[c] + "':" + fontCar +
      "\n:x=600:y=" + (300 + deltaY * c) + ":" + tshow + "\n[x];[x]" +
      "\ndrawtext=text='" + cartimelist[c] + "':" + fontCar +
      "\n:x=1000:y=" + (300 + deltaY * c) + ":" + tshow + "\n[x];[x]" +
      "\n[" + carlist[c] + "]overlay=" + tshow + ":x=1200:y=" + (250 + deltaY * c) + "\n[x" + c + "];[x" + c + "]";
  }

  // drawbox does not support t dependency
  const IMGS_ANIMATIONS =
    //"[VCAMS]\n" +
    //"\ndrawbox=x=530:y=200:w=940:h=640:color=blue@0.8:t=fill:enable='between(t,9.5,20)'\n[x];[x]" +
    //"\ndrawbox=x=550:y=220:w=900:h=600:color=black@0.5:t=fill:enable='between(t,9,20)'\n[x];[x]" +

    leaderboard +

    "\n[logo]overlay=enable='between(t, 0, " + t_end + ")':x=50:y=10[v_logo];[v_logo]" +//:rotate=PI*t/2
    "\n[clock]overlay=enable='between(t, 0, 0)':x=5000:y=500[v_clock];[v_clock]" +
    "\n[square]overlay=enable='between(t, 0, 0)':x=5000:y=800" +
    "\n[x];[x]";

  speed = 5000;

  slideInX0 = "'if(lt(t,25),max(400, w-" + speed + "*t))'";
  slideInX1 = "'if(lt(t,25),max(0, w-" + speed + "*t))'";
  slideInX2 = "'if(lt(t,25),max(0, w-" + speed + "*t))'";
  slideInY0 = "000";
  slideInY1 = "200";
  slideInY2 = "600";
  fontFile = 'raceOverlay/font/TTSupermolotCondensed-BoldItalic.ttf';
  fontSize = 200;

  T0T = "HotWheels SpeedChallenge!";
  T0DECO = "fontcolor=yellow:fontsize=" + 100 + ":fontfile=" + fontFile + ":alpha=1";
  T0BOX = "box=1:boxcolor=black:boxborderw=1"; //:rotation=45 //:rotation=a=1
  T0 = "" +
    "\ndrawtext=text='" + T0T + "'" +
    "\n:x=" + slideInX0 +
    "\n:y=" + slideInY0 +
    "\n:" + "enable = 'between(t," + 0 + "," + (t_end) + ")'" +
    "\n:" + T0DECO +
    "\n:" + T0BOX;//+

  T1T = "START RACE, GO!";
  T1DECO = "fontcolor=yellow:fontsize=" + 200 + ":fontfile=" + fontFile + ":alpha=sin(2*t)";
  T1BOX = "box=1:boxcolor=black:boxborderw=1"; //:rotation=45 //:rotation=a=1
  T1 = "" +
    "\ndrawtext=text='" + T1T + "'" +
    "\n:x=" + slideInX1 +
    "\n:y=" + slideInY1 +
    "\n:" + "enable = 'between(t," + 0 + "," + (t_s_intro + 3) + ")'" +
    "\n:" + T1DECO +
    "\n:" + T1BOX;//+

  T2T = "We Have A Winner! Congrats!"+carlist[0];
  T2DECO = "'fontcolor=yellow:fontsize=" + 50 + ":fontfile=" + fontFile + ":alpha=1'";
  T2BOX = "'box=1:boxcolor=black:boxborderw=1'";
  T2 = "" +
    "\ndrawtext=text='" + T2T + "'" +
    "\n:x=" + slideInX2 +
    "\n:y=" + slideInY2 +
    "\n:" + "enable = 'between(t," + (t_s_leaderboard) + "," + t_end + ")'" +
    "\n:" + T2DECO +
    "\n:" + T2BOX;// +
  // "[T2]";
  ////////////////////////////////////////////////////////////
  const filterComplex =
    // CARIMGS +
    IMGS +
    VIDEOS +
    IMGS_ANIMATIONS +
    T0 + "\n[x];[x]" +
    T1 + "\n[x];[x]" +
    T2 +
    "[out]";
  ////////////////////////////////////////////////////////////
  const ffmpeg = require('fluent-ffmpeg');

  // Construct FFmpeg command
  const ffmpegCommand = ffmpeg();

  // Apply the filters
  logger.info("----------------------------");
  logger.info(filterComplex);
  logger.info("----------------------------");

  ffmpegCommand
    .input(camIntro)//0
    .input(camFPV)//1
    .input(cam1)//2
    .input(cam2)//3
    .input(cam3)//4
    .input(cam4)//5
    .input(cam5)//6
    .input(cam6)//7
    .input(cam7)//8
    .input(cam8)//9

    .input(LOGO)//10
    .input(CLOCK)//11
    .input(SQUARE)//12

    .input(car1img)//13
    .input(car2img)//14
    .input(car3img)//15
    .input(car4img)//16
    .input(car5img)//17

    //.input('raceOverlay/clock.png')//10
    .complexFilter(filterComplex)
    .outputOptions('-map', '[out]')
    .outputOptions('-r', '30')
    .outputOptions('-loglevel', 'verbose')
    .on('progress', function (progress) {
      logger.info('Processing: ' + progress.percent + '% done @ ' + progress.currentFps + ' fps');
    })
    .on('end', () => {
      logger.info('Processing finished successfully!' + outputFile);
    })
    .on('error', (err) => {
      logger.error('Error occurred: ' + err + err.message);
    })
    .save(outputFile);
}

const outputFile = 'V4.mp4'; // Desired output file name
compileVideo(outputFile);
