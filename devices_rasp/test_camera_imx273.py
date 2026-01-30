print("Hello")

import gxipy as gx
import numpy as np
import time
import sys
import os
from datetime import datetime
import cv2  # OpenCV for MP4 encoding

TARGET_FPS = 220
BUFFER_SECONDS = 10
BUFFER_FRAMES = TARGET_FPS * BUFFER_SECONDS


def save_ring_buffer_to_mp4_bayer(
    frame_buffer,
    ts_buffer,
    id_buffer,
    head,
    frame_count,
    target_fps=TARGET_FPS,
    out_root="captures",
):
    """
    Reorder the ring buffer into chronological order, demosaic Bayer frames
    to color using cv2.cvtColor, and save as an MP4.
    This is called only AFTER capture has stopped, so it does not affect FPS.
    """
    if frame_buffer is None or frame_count == 0:
        print("No frames to save.")
        return

    os.makedirs(out_root, exist_ok=True)
    run_dir = os.path.join(out_root, datetime.now().strftime("%Y%m%d_%H%M%S"))
    os.makedirs(run_dir, exist_ok=True)

    buffer_size = frame_buffer.shape[0]
    total_frames = min(frame_count, buffer_size)

    if total_frames < 2:
        print("Not enough frames to make a video.")
        return

    print(f"Preparing to save {total_frames} frames to: {run_dir}")

    # Determine chronological order: oldest -> newest
    if frame_count <= buffer_size:
        # Never wrapped. Valid frames are [0 .. total_frames-1]
        start = 0
    else:
        # Wrapped at least once. Oldest frame is at 'head'
        start = head

    ordered_indices = [(start + i) % buffer_size for i in range(total_frames)]

    # Compute effective FPS from timestamps
    first_ts = ts_buffer[ordered_indices[0]]
    last_ts = ts_buffer[ordered_indices[-1]]
    duration = last_ts - first_ts

    if duration > 0:
        fps = (total_frames - 1) / duration
        print(f"Measured capture FPS ≈ {fps:.2f}")
    else:
        fps = float(target_fps)
        print("Timestamps too close; using TARGET_FPS for encoding.")

    if fps <= 0 or fps > 1000:
        fps = float(target_fps)

    fps = round(fps)

    # Expect single-channel Bayer/mono frames: shape (H, W)
    sample_frame = frame_buffer[ordered_indices[0]]
    if sample_frame.ndim != 2:
        print(f"Expected 2D Bayer/mono frames, got shape: {sample_frame.shape}")
        return

    height, width = sample_frame.shape

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out_path = os.path.join(run_dir, "capture_color.mp4")

    writer = cv2.VideoWriter(out_path, fourcc, fps, (width, height), True)
    if not writer.isOpened():
        print("Failed to open VideoWriter, aborting save.")
        return

    print(f"Encoding to color MP4 at ~{fps:.2f} fps...")

    # Choose Bayer pattern here; adjust if colors look wrong
    # Common for Daheng: BayerRG8 / BayerBG8 -> COLOR_BAYER_*2BGR
    bayer_code = cv2.COLOR_BAYER_BG2BGR
    # bayer_code = cv2.COLOR_BAYER_RG2BGR
    # bayer_code = cv2.COLOR_BAYER_GR2BGR
    # bayer_code = cv2.COLOR_BAYER_GB2BGR

    for i, idx in enumerate(ordered_indices):
        raw_bayer = frame_buffer[idx]  # (H, W), uint8

        # Demosaic to BGR color
        frame_bgr = cv2.cvtColor(raw_bayer, bayer_code)

        writer.write(frame_bgr)

        if (i + 1) % 200 == 0 or i == total_frames - 1:
            print(f"  Wrote {i + 1}/{total_frames} frames")

    writer.release()

    # Also save raw Bayer frames + timestamps + ids for offline work
    frames_raw = np.stack([frame_buffer[idx] for idx in ordered_indices])
    ts_raw = np.array([ts_buffer[idx] for idx in ordered_indices])
    ids_raw = np.array([id_buffer[idx] for idx in ordered_indices])

    np.savez_compressed(
        os.path.join(run_dir, "frames_raw_bayer.npz"),
        frames=frames_raw,
        timestamps=ts_raw,
        frame_ids=ids_raw,
    )

    print(f"Done. Color MP4 saved to: {out_path}")


def configure_camera_appearance(cam):
    """Set gamma, contrast, and color correction / color transformation."""
    # --- Gamma: enable + set for brighter image ---
    try:
        if hasattr(cam, "GammaEnable") and camGammaEnable := getattr(cam, "GammaEnable"):
            if camGammaEnable.is_implemented() and camGammaEnable.is_writable():
                camGammaEnable.set(True)
                print("GammaEnable:", camGammaEnable.get())
    except Exception as e:
        print("GammaEnable config error:", e)

    try:
        if hasattr(cam, "Gamma") and camGamma := getattr(cam, "Gamma"):
            if camGamma.is_implemented() and camGamma.is_writable():
                # Gamma < 1.0 → brighter mid-tones. 0.4 is "a lot" brighter.
                camGamma.set(0.4)
                print("Gamma:", camGamma.get())
    except Exception as e:
        print("Gamma config error:", e)

    # --- Contrast: set to -50 as requested ---
    try:
        if hasattr(cam, "ContrastParam") and camContrast := getattr(cam, "ContrastParam"):
            if camContrast.is_implemented() and camContrast.is_writable():
                camContrast.set(-50)
                print("ContrastParam:", camContrast.get())
    except Exception as e:
        print("ContrastParam config error:", e)

    # --- Color correction (color transformation) for color cameras ---
    # This is Daheng's color transform matrix; acts as color correction.
    try:
        if hasattr(cam, "ColorTransformationEnable"):
            cte = cam.ColorTransformationEnable
            if cte.is_implemented() and cte.is_writable():
                cte.set(True)
                print("ColorTransformationEnable:", cte.get())
    except Exception as e:
        print("ColorTransformationEnable config error:", e)

    # Optional: if mode is available, leave default or set a standard mode.
    try:
        if hasattr(cam, "ColorTransformationMode"):
            ctm = cam.ColorTransformationMode
            if ctm.is_implemented() and ctm.is_writable():
                # Many models default to a good matrix; we just print it.
                print("ColorTransformationMode (current):", ctm.get())
    except Exception as e:
        print("ColorTransformationMode query error:", e)


def main():
    device_manager = gx.DeviceManager()
    dev_num, dev_info_list = device_manager.update_all_device_list()
    if dev_num == 0:
        print("No Daheng cameras found.")
        sys.exit(1)

    cam = device_manager.open_device_by_index(1)

    frame_buffer = None
    ts_buffer = None
    id_buffer = None
    head = 0
    frame_count = 0

    try:
        # Basic configuration
        if cam.TriggerMode.is_implemented() and cam.TriggerMode.is_writable():
            cam.TriggerMode.set(gx.GxSwitchEntry.OFF)

        if cam.ExposureTime.is_implemented() and cam.ExposureTime.is_writable():
            cam.ExposureTime.set(1500.0)  # 1.5 ms

        if cam.Gain.is_implemented() and cam.Gain.is_writable():
            try:
                cam.Gain.set(24.0)  # high gain
                print(f"Gain set to {cam.Gain.get()} dB")
            except Exception as e:
                print(f"Failed to set gain to 24 dB: {e}")

        # --- NEW: gamma, contrast, color correction (appearance) ---
        configure_camera_appearance(cam)
        # -----------------------------------------------------------

        if hasattr(cam, "AcquisitionFrameRate") and cam.AcquisitionFrameRate.is_implemented():
            if cam.AcquisitionFrameRate.is_writable():
                try:
                    if hasattr(cam, "AcquisitionFrameRateMode"):
                        cam.AcquisitionFrameRateMode.set(gx.GxSwitchEntry.ON)
                except Exception:
                    pass
                cam.AcquisitionFrameRate.set(float(TARGET_FPS))

        cam.stream_on()

        # Grab one frame to determine resolution (assuming Bayer/mono -> 2D)
        raw_image = cam.data_stream[0].get_image()
        if raw_image is None:
            print("Failed to get initial image.")
            return

        first_numpy = raw_image.get_numpy_array()
        if first_numpy is None:
            print("Failed to get initial numpy image.")
            return

        if first_numpy.ndim != 2:
            print(f"Expected 2D Bayer/mono from camera, got shape: {first_numpy.shape}")
            return

        height, width = first_numpy.shape
        frame_buffer = np.empty((BUFFER_FRAMES, height, width), dtype=np.uint8)
        ts_buffer = np.empty(BUFFER_FRAMES, dtype=np.float64)
        id_buffer = np.empty(BUFFER_FRAMES, dtype=np.int64)
        head = 0
        frame_count = 0

        print(f"Using Bayer/mono buffer: {width} x {height}")
        print(
            f"Ring buffer for {BUFFER_FRAMES} frames "
            f"≈ {frame_buffer.nbytes / (1024**3):.2f} GiB"
        )
        print("Capturing... Ctrl+C to stop.")

        t0 = time.perf_counter()
        last_report = t0

        # Store the first frame as well
        frame_buffer[head, :, :] = first_numpy
        ts_buffer[head] = time.time()
        id_buffer[head] = raw_image.get_frame_id()
        head = (head + 1) % BUFFER_FRAMES
        frame_count += 1

        while True:
            raw_image = cam.data_stream[0].get_image(timeout=1000)
            if raw_image is None:
                continue

            numpy_image = raw_image.get_numpy_array()
            if numpy_image is None:
                continue

            # Expecting numpy_image.shape == (height, width)
            frame_buffer[head, :, :] = numpy_image
            ts_buffer[head] = time.time()
            id_buffer[head] = raw_image.get_frame_id()

            head = (head + 1) % BUFFER_FRAMES
            frame_count += 1

            # Optional FPS report
            if frame_count % 500 == 0:
                now = time.perf_counter()
                fps = 500.0 / (now - last_report)
                last_report = now
                print(f"Capture FPS (last 500): {fps:.1f}")

    except KeyboardInterrupt:
        print("\nStopping (Ctrl+C).")

    finally:
        # Stop the camera first (no more incoming frames)
        try:
            cam.stream_off()
        except Exception:
            pass
        cam.close_device()
        print("Camera closed.")

        # Now safely demosaic + encode to color MP4
        try:
            save_ring_buffer_to_mp4_bayer(
                frame_buffer,
                ts_buffer,
                id_buffer,
                head,
                frame_count,
                target_fps=TARGET_FPS,
                out_root="captures",
            )
        except Exception as e:
            print(f"Error while saving MP4: {e}")


if __name__ == "__main__":
    main()
