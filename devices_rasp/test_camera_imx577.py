#!/usr/bin/env python3
"""
cam_capture.py

- Set camera controls via v4l2-ctl (exposure, gain, WB, etc.)
- Capture MJPEG from USB camera to a raw .mkv file at high FPS (e.g. 1080p120)
- Then re-encode it to a normal H.264 .mp4 file.

Run: python3 cam_capture.py --help  for options.
"""

import argparse
import datetime
import shlex
import subprocess
import sys
from pathlib import Path


def run_cmd(cmd: str, check: bool = True):
    """Run a shell command and print it first."""
    print(f"\n>>> {cmd}")
    try:
        subprocess.run(cmd, shell=True, check=check)
    except subprocess.CalledProcessError as e:
        print(f"Command failed: {e}", file=sys.stderr)
        if check:
            sys.exit(1)


def set_control(device: str, name: str, value):
    """Set a single V4L2 control, ignore if it fails."""
    cmd = f"v4l2-ctl -d {shlex.quote(device)} --set-ctrl={name}={value}"
    print(f"Setting control {name}={value}")
    try:
        run_cmd(cmd, check=True)
    except SystemExit:
        print(f"Warning: failed to set {name}, value={value}. "
              f"Check v4l2-ctl -d {device} -l for valid ranges.",
              file=sys.stderr)


def build_parser():
    p = argparse.ArgumentParser(
        description="Configure USB camera, capture MJPEG, then encode to H.264."
    )

    # Basic device / capture options
    p.add_argument("--device", default="/dev/video0",
                   help="Video device (default: /dev/video0)")
    p.add_argument("--width", type=int, default=1920,
                   help="Capture width (default: 1920)")
    p.add_argument("--height", type=int, default=1080,
                   help="Capture height (default: 1080)")
    p.add_argument("--fps", type=int, default=120,
                   help="Capture framerate (default: 120)")
    p.add_argument("--duration", type=float,
                   help="Record duration in seconds. "
                        "If omitted, press Ctrl+C to stop recording.")

    p.add_argument("--raw-file",
                   help="Output file for raw MJPEG capture (.mkv/.avi). "
                        "Default: capture_<timestamp>.mkv")
    p.add_argument("--encoded-file",
                   help="Output H.264 MP4 filename. "
                        "Default: same as raw, but .mp4")

    # Encoding options
    p.add_argument("--crf", type=int, default=20,
                   help="x264 CRF quality (lower=better, default=20)")
    p.add_argument("--preset", default="slow",
                   help="x264 preset (ultrafast..placebo, default=slow)")

    # Camera controls (common UVC ones)
    # NOTE: check actual available controls with: v4l2-ctl -d /dev/video0 -l
    p.add_argument("--exposure-auto", type=int,
                   help="exposure_auto (often 1=manual, 3=auto)")
    p.add_argument("--exposure", type=int,
                   help="exposure_absolute (in 100us units for UVC)")
    p.add_argument("--gain", type=int,
                   help="Gain")
    p.add_argument("--brightness", type=int,
                   help="Brightness")
    p.add_argument("--contrast", type=int,
                   help="Contrast")
    p.add_argument("--saturation", type=int,
                   help="Saturation")
    p.add_argument("--gamma", type=int,
                   help="Gamma")
    p.add_argument("--sharpness", type=int,
                   help="Sharpness")

    # White balance controls (if supported by your cam)
    p.add_argument("--wb-auto", type=int,
                   help="white_balance_temperature_auto (0=manual,1=auto)")
    p.add_argument("--wb-temp", type=int,
                   help="white_balance_temperature (e.g. 3000-8000 K)")

    # Backlight / power line frequency (optional)
    p.add_argument("--backlight-compensation", type=int,
                   help="backlight_compensation")
    p.add_argument("--power-line-frequency", type=int,
                   help="power_line_frequency (e.g. 1=50Hz, 2=60Hz)")

    return p


def main():
    parser = build_parser()
    args = parser.parse_args()

    device = args.device

    # 1) Apply camera controls
    controls = {
        "exposure_auto": args.exposure_auto,
        "exposure_absolute": args.exposure,
        "gain": args.gain,
        "brightness": args.brightness,
        "contrast": args.contrast,
        "saturation": args.saturation,
        "gamma": args.gamma,
        "sharpness": args.sharpness,
        "white_balance_temperature_auto": args.wb_auto,
        "white_balance_temperature": args.wb_temp,
        "backlight_compensation": args.backlight_compensation,
        "power_line_frequency": args.power_line_frequency,
    }

    print("=== Applying camera controls (if given) ===")
    for name, value in controls.items():
        if value is not None:
            set_control(device, name, value)

    # 2) Decide filenames
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    if args.raw_file:
        raw_path = Path(args.raw_file)
    else:
        raw_path = Path(f"capture_{ts}_{args.width}x{args.height}_{args.fps}fps.mkv")

    if args.encoded_file:
        enc_path = Path(args.encoded_file)
    else:
        enc_path = raw_path.with_suffix(".mp4")

    print(f"\nRaw capture file    : {raw_path}")
    print(f"Encoded output file : {enc_path}")

    # 3) Capture MJPEG from the camera
    print("\n=== Starting raw MJPEG capture ===")
    duration_part = f"-t {args.duration}" if args.duration else ""
    capture_cmd = (
        f"ffmpeg -y "
        f"-f v4l2 "
        f"-input_format mjpeg "
        f"-video_size {args.width}x{args.height} "
        f"-framerate {args.fps} "
        f"-thread_queue_size 512 "
        f"-i {shlex.quote(device)} "
        f"-c:v copy "
        f"{duration_part} "
        f"{shlex.quote(str(raw_path))}"
    )
    print("Note: if no --duration given, press Ctrl+C to stop recording.")
    try:
        run_cmd(capture_cmd, check=True)
    except SystemExit:
        print("Capture aborted or failed.", file=sys.stderr)
        sys.exit(1)

    # 4) Re-encode to H.264 MP4
    print("\n=== Encoding MJPEG to H.264 MP4 ===")
    encode_cmd = (
        f"ffmpeg -y "
        f"-i {shlex.quote(str(raw_path))} "
        f"-c:v libx264 "
        f"-preset {shlex.quote(args.preset)} "
        f"-crf {args.crf} "
        f"-pix_fmt yuv420p "
        f"{shlex.quote(str(enc_path))}"
    )
    run_cmd(encode_cmd, check=True)

    print("\n=== Done ===")
    print(f"Raw MJPEG file : {raw_path}")
    print(f"H.264 MP4 file: {enc_path}")


if __name__ == "__main__":
    main()
