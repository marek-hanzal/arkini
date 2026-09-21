# Serakki recording setup

OBS Studio 32.2.2 on macOS Apple Silicon. One gameplay scene with a circular FaceTime camera overlay and a purple ring.

## Import

1. Install OBS Studio (`brew install --cask obs`). Allow screen/system-audio recording and microphone access in macOS when requested.
2. In **Profile → Import**, select this `profile/` directory, then select **Serakki YouTube** from the Profile menu.
3. In **Scene Collection → Import**, choose `serakki-youtube.json`, import it, then select **Serakki YouTube** from the Scene Collection menu.
4. In **Settings → Output → Recording**, select your local recording directory, for example `~/Movies/Serakki`. The portable profile deliberately omits a machine-specific path.
5. Launch Serakki. Open properties for **Serakki window**, keep **Window Capture**, and select the actual Serakki window. Do not switch to Display Capture: that would record your desktop.
6. Open properties for **Game audio - Serakki** and verify **Application Audio Capture → Serakki**. Launch the game first if it is missing from the list.
7. Open properties for **Voice - DJI Wireless Mic Rx** and select **Wireless Mic Rx**. The template leaves the device unbound; it never deliberately falls back to the MacBook microphone.

8. If OBS reports missing files, select `obs/assets/` in its missing-file search dialog. The scene references `assets/camera-mask.png` and `assets/camera-ring.png`; bind them explicitly in the camera mask filter and ring image properties if your OBS importer does not resolve relative paths.
9. In **FaceTime camera** properties, choose the built-in **FaceTime HD Camera**, not the iPhone continuity camera. Keep the 1280 × 720 preset and camera audio disabled.

The local setup on Marek's Mac already has the DJI receiver selected and records to `~/Movies/Serakki`. Those device IDs and paths are not part of the template. OBS uses its own imported copies; edits in OBS do not change these repository files.

## Picture

- Canvas and output: **1920 × 1080, 60 fps**, SDR Rec.709.
- The window source captures video only; its audio is muted and unassigned. **Game audio - Serakki** separately captures application audio, including sound that the window capture misses. Keep its method set to **Application Audio Capture** with **Serakki** selected; no desktop-wide audio is recorded.
- The scene fits the complete window inside 16:9 without stretching or cutting off gameplay. A differently shaped window leaves black bars.
- The complete game window is recorded, including its title bar and borders. All four crop values are zero.
- For a frame-filling recording, use a complete window with a 16:9 aspect ratio. Keep the game window size fixed during a take. Keep the cursor visible for demonstrations.
- Window IDs are session-specific. After relaunching the game, check the preview and reselect the window if needed. An unbound source is blank rather than a fallback desktop capture.

## Camera overlay

The built-in FaceTime camera is cropped from 1280 × 720 to a 720 × 720 square offset toward the left of the camera image, then alpha-masked into a circle. A separate purple (`#9B63D8`) ring sits above it. Both layers occupy a **288 × 288** box, **36 px** from the top and right of the 1080p canvas. Keep their positions and sizes together when moving the overlay. To hide the webcam, hide both layers.

To adjust your face inside the fixed ring, open **FaceTime camera → Filters → Square portrait**. The current crop removes **180 px left** and **380 px right**. Reduce the left crop and increase the right crop by the same amount to move your face right within the circle; reverse this to move it left. Keep their sum at 560 px and top/bottom at zero to preserve the square.

The PNG mask and ring live in `assets/`. Device IDs stay local. Camera audio is disabled so it does not duplicate the DJI microphone.

## Sound

| Track | Content |
| --- | --- |
| 1 — Mix | Game and microphone; use for ordinary playback/upload |
| 2 — Voice | DJI microphone only; useful for editing |
| 3 — Game | Game audio only; useful for editing |

DJI is downmixed to mono so a single transmitter is heard in both ears. With two transmitters, this combines them; use another routing setup if you need separate speakers. Game gain starts at −12 dB, microphone gain at 0 dB, and monitoring is off. No global microphone or desktop capture is included.

Use headphones. Before the first take, speak at your normal recording distance and adjust the receiver/input gain so the microphone does not clip; peaks around −12 to −6 dBFS are a useful starting point. No noise gate, suppression, or compression is baked in before listening to the actual voice signal.

## Recording

Apple VT hardware H.264, quality-based recording at quality 70; 48 kHz audio with three 320 kbps AAC tracks. Records to **MKV** and automatically remuxes to **MP4** after stopping, without re-encoding. Keep the MKV until you have checked the MP4; the two files take additional disk space.

Start and stop recording in OBS. No hotkeys are assigned, so the setup does not collide with Serakki's F5/F9 save shortcuts. Record a short test and check picture, voice, game audio, and synchronization before a longer take. Separate audio tracks are for editing, not separate user-selectable YouTube commentary tracks.

## Updating the shared setup

Export the scene collection and profile through OBS into `obs/local/` first. Before updating the tracked templates, remove local window IDs, device IDs, recording paths, and any streaming credentials. Keep the gameplay crop, track routing, and recording settings intentional. Do not commit footage or OBS's entire application configuration.

Reference: [OBS macOS capture](https://obsproject.com/kb/macos-screen-capture-source), [recording output](https://obsproject.com/kb/standard-recording-output-guide).

## Before each take and after restarting Serakki

- Start Serakki before OBS. After restarting the game, reselect its window in **Serakki window** properties.
- Audio has its own connection: open **Game audio - Serakki** properties, keep **Application Audio Capture**, select the empty application entry, then select **Serakki** again and click OK. This rebuilds capture for the running process; refreshing the video source alone does not refresh audio.
- Check the **Game audio - Serakki** meter while gameplay is producing music or effects. A silent main menu is not a useful signal test. The source must be unmuted; the template starts at −12 dB. Very low gain can make captured audio practically inaudible.
- Keep **Serakki window** audio muted: the separate application source owns sound. In Advanced Audio Properties, game audio belongs to tracks 1 and 3, and the DJI microphone to tracks 1 and 2. Recording must include tracks 1–3; ordinary playback should use track 1 (Mix).
- If reselecting does not restore the meter, restart OBS with Serakki already running. Check a short recording before a long take.
