# Film Space — Windows and iPhone

This repository contains the Windows desktop studio. The original iPhone app is built separately from [Max Prokopp's Film Space source](https://github.com/maxprokopp/film-space) in [your iPhone build repository](https://github.com/Moealbunni/film-space).

## Windows installation

Run **Film-Space-Desktop-0.1.0-Windows.exe**. It is a portable 64-bit Windows app. The packaged app needs no Node.js installation, Google account, AI credits, or internet connection. It has no paid publisher certificate, so Windows may display a publisher warning.

## iPhone installation — deferred until the phone is connected

**FilmSpace-unsigned.ipa** compiled successfully from the original unmodified iPhone application source. It requires iOS 18 or later and an ARKit-compatible iPhone. It has not yet been installed or tested on your phone.

An unsigned IPA cannot be installed by tapping it in Safari. Use [Sideloadly for Windows](https://sideloadly.io/) to sign it with your Apple account and install it over USB. Its official Windows instructions require the web versions of iTunes and iCloud.

1. Install Sideloadly and its Apple prerequisites from its official website.
2. Connect and unlock the iPhone. Tap **Trust** when asked.
3. Drag **FilmSpace-unsigned.ipa** into Sideloadly and select the phone.
4. Enter your Apple account in Sideloadly and complete Apple's authentication prompts yourself.
5. Start installation. If iOS asks, trust the developer profile in Settings → General → VPN & Device Management, and enable Developer Mode under Privacy & Security.
6. Open Film Space and grant Camera, Microphone, and Photos permissions as needed.

Free Apple signing expires after seven days; Sideloadly's refresh feature can re-sign it. The GitHub build needs no Apple credentials. [Official Sideloadly instructions](https://sideloadly.io/).

The successful original iPhone build is [run #2](https://github.com/Moealbunni/film-space/actions/runs/39224887751). Its online artifact is retained for seven days. The local downloaded copy remains available.

## Using Windows

1. **Stage:** in Edit mode, add a person, click to select it, and drag it across the floor. Rotate or delete the selection. Drag empty space to orbit; scroll to zoom.
2. **Frame:** choose 35, 50, 75, or 200 mm. Raise or lower the view. Lock viewpoint saves a setup; Return restores it.
3. **Move:** enter Camera mode. Drag to look; use WASD or arrow keys to move, Q/E for height, and Shift for speed.
4. **Record:** press Record video, perform the move, then stop. Save the rendered MP4 or WebM. The interface is excluded.
5. **Reuse:** Save scene stores the scene in this app. Export scene makes a portable JSON file; Import scene restores it. Export camera path saves the latest recording's movement.

To use an AI video service, upload the recorded clip as a video reference where supported. These apps do not directly connect to or spend credits on Google, Runway, Higgsfield, or any other generator.

## How the versions differ

The original iPhone app uses ARKit to track physical walking and rotation. The Windows implementation uses mouse and keyboard control. Both provide a virtual studio, figures, lens presets, viewpoint locking, and video recording.

The iPhone app records MOV with microphone audio to Photos. Windows records a silent MP4 or WebM and also exports scenes and camera paths. Live phone-to-PC synchronization and shared scene files with the original iPhone app are not implemented. Windows cannot run the SwiftUI/ARKit iPhone binary.

## Blender camera path

Open Blender's Scripting workspace. Open **blender_import_path.py**, set **PATH_FILE** to the exported camera JSON, and run it. It creates an animated camera with position, rotation, and lens keyframes at 30 fps, converting Y-up coordinates to Blender's Z-up coordinates. The script was syntax checked; it has not been tested inside Blender in this session.

## Edit and rebuild from Windows

Install Node.js, download this source, and run **npm ci**, then **npm run start**.

Run **npm run dist** to create the portable Windows executable in **dist/**. The dependency versions are recorded in **package-lock.json**, and the app bundles its dependencies for offline use.

To test the Windows renderer: run **npm run build**, then **.\node_modules\electron\dist\electron.exe smoke.cjs**. Results and a screenshot are saved in **test-output/**.

To rebuild the original iPhone app, open [the iPhone build workflow](https://github.com/Moealbunni/film-space/actions/workflows/build-ipa.yml), select **Run workflow**, and download the IPA artifact when it succeeds. GitHub's hosted Mac provides Xcode 26, so you can manage this from Windows.

## Verified status

- Original iPhone source compiled successfully; IPA archive integrity and iOS 18 minimum version checked.
- Windows runtime tests passed for scene add/delete, camera movement, MP4 export, and camera-path export.
- iPhone installation and hands-on ARKit testing are deferred until the phone is connected.
- Android and Mac releases are outside the current scope.

