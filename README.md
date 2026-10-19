# Film Space â€” Windows and iPhone

This repository contains the Windows desktop studio. The iPhone app is built separately from [Max Prokopp's Film Space source](https://github.com/maxprokopp/film-space) in [your iPhone build repository](https://github.com/Moealbunni/film-space).

## Windows installation

Download [Windows 0.4.0 from Releases](https://github.com/Moealbunni/film-space-universal/releases/tag/v0.4.0), then run **Film-Space-Desktop-0.4.0-Windows.exe**. It is a portable 64-bit Windows app. The packaged app needs no Node.js installation, Google account, AI credits, or internet connection. It has no paid publisher certificate, so Windows may display a publisher warning.

## iPhone editor

The updated native iPhone app includes object presets, names/colors, transforms, local scene saving, floor sizing, a lock/unlock toggle and physical ARKit camera tracking. Get the [iPhone release](https://github.com/Moealbunni/film-space/releases/tag/iphone-v1.2.0) and follow its [complete installation and usage guide](https://github.com/Moealbunni/film-space#readme). Installation from Windows requires signing the IPA with your Apple account. Physical installation and phone testing remain deferred.

## Using Windows

1. **Add:** choose Person, Child, Car, Bike, Box, Sphere, Wall, Cylinder, Cone, Circle, Plane, or Torus and click Add object. Cars and bikes are simple reference shapes.
2. **Select:** click an object in the scene or its name in Scene objects. Drag it across the floor in Edit mode.
3. **Edit:** change its name, color, position X/Y/Z, rotation in degrees, or scale X/Y/Z. Y is height. Bigger/Smaller resizes all three axes together. Duplicate makes an offset copy. Delete removes the selection. Name a box “Cat” if it represents a cat; naming does not generate a detailed model.
4. **Floor:** scroll down to Camera & floor. Floor size changes the ground from 2 to 200 meters.
5. **Frame:** drag empty space to orbit. Scroll to move closer/farther. Lens presets include 18, 24, 35, 50, 75 and 200 mm.
6. **Lock:** Lock viewpoint freezes navigation while object editing remains available. The same button becomes Unlock viewpoint. Click it once to resume navigation. Return recalls the saved locked viewpoint.
7. **Move:** in Camera mode, drag to look; WASD/arrows move horizontally, Q/E move down/up, and the wheel moves along the viewing direction. Raise/Lower also change height. Shift doubles movement speed. Camera speed is meters per second; use 0.1–0.5 for slow moves. Mouse sensitivity controls how quickly dragging turns the view. These are slow camera moves, not slowed object animation.
8. **Record:** click Record video, move the camera, then Stop recording. Only the rendered scene is exported; buttons, object lists, and camera details are HTML overlays and are never captured. The editor grid and axes are hidden during recording. The checkerboard floor remains part of the scene. Windows exports MP4 when supported, otherwise a correctly named WebM.
9. **Save:** Save scene stores one scene locally. Export scene writes a named JSON download; keep separate files for multiple scenes. Load scene restores the local save. Import scene opens exported files. Version 0.1 scenes can still be imported. Object names, colors, transforms, floor size, lens and view are saved. Export camera path saves the latest recorded motion for Blender.

To use an AI video service, upload the recorded clip as a video reference where supported. These apps do not directly connect to or spend credits on Google, Runway, Higgsfield, or any other generator.

## How the versions differ

The updated iPhone app uses ARKit to track physical walking and rotation. The Windows implementation uses mouse and keyboard control. Both provide a virtual studio, figures, lens presets, viewpoint locking, and video recording.

The updated iPhone app records MP4 with microphone audio to Photos. Windows records a silent MP4 or WebM and also exports scenes and camera paths. Local Wi-Fi pairing supports explicit scene transfer in both directions and an iPhone live monitor on Windows. Windows cannot run the SwiftUI/ARKit iPhone binary.

## Blender camera path

Open Blender's Scripting workspace. Open **blender_import_path.py**, set **PATH_FILE** to the exported camera JSON, and run it. It creates an animated camera with position, rotation, and lens keyframes at 30 fps, converting Y-up coordinates to Blender's Z-up coordinates. The script was syntax checked; it has not been tested inside Blender in this session.

## Edit and rebuild from Windows

Install Node.js, download this source, and run **npm ci**, then **npm run start**.

Run **npm run dist** to create the portable Windows executable in **dist/**. The dependency versions are recorded in **package-lock.json**, and the app bundles its dependencies for offline use.

To test the Windows renderer: run **npm run build**, then **.\node_modules\electron\dist\electron.exe smoke.cjs**. Results and a screenshot are saved in **test-output/**.

To rebuild the iPhone app, open [the iPhone build workflow](https://github.com/Moealbunni/film-space/actions/workflows/build-ipa.yml), select **Run workflow**, and download the IPA artifact when it succeeds. GitHub's hosted Mac provides Xcode 26, so you can manage this from Windows.

## Verified status

- See the iPhone release and Actions run for native build verification; device testing is separate.
- Windows 0.3 runtime tests passed for all 12 object types, inspector transforms/color/name, save/load round trips, duplicate/delete, lock/unlock labels, camera movement, MP4 export, and camera-path export.
- iPhone installation and hands-on ARKit testing are deferred until the phone is connected.
- Android and Mac releases are outside the current scope.



## Axis locks, resets, and direct controls

- Camera **Position X/Y/Z** locks hold individual world coordinates. Camera **Rotation X/Y/Z** locks hold the current angles: X is tilt, Y is heading, Z is roll. You can enter 45 degrees and lock that rotation axis. Other axes remain free. Locks remain active when changing modes.
- **Lock lens / zoom** prevents changes to focal length. A perspective camera has no useful object-size scale, so use lens controls for zoom.
- Objects have separate locks for all X/Y/Z position, rotation, and scale values. A closed lock holds that value during dragging, resizing, and quick edits.
- **Reset position** returns an object to the origin; **Reset rotation** returns all angles to zero; **Reset size** returns all scales to 1. Each reset clears its group's locks. Reset size makes a child adult-sized; use Smaller to shrink it again.
- For the camera, Position Reset returns to (0, 1.6, 4) meters; Rotation Reset faces along the default forward direction. **Reset camera** clears position/rotation locks and full viewpoint locking, then restores both defaults.
- On Windows, select an object and use its floating **Move / Rotate / Resize** buttons to show draggable 3D handles. Bigger/Smaller and Lift/Lower are beside the object. The side inspector provides exact numbers and locks.
- On iPhone, tap an object or select it in Objects & scene. The right-hand quick panel provides Bigger/Smaller, Lift/Lower and Edit details. **Camera controls** opens the axis lock panel in either mode.
- Resizing from ground level keeps the object's base on the floor; Lift/Lower changes its height deliberately. Floor resizing scales the checkerboard squares along with the ground.
- Recording captures only the scene. Quick panels and 3D editing handles are excluded.


## Connect iPhone and Windows on Wi-Fi

1. Install Windows **0.4.0** and iPhone **1.2**. Put both devices on the same private Wi-Fi network and keep both apps open.
2. On Windows, expand **Connect iPhone**, then click **Start pairing**. If Windows asks, allow Film Space on **Private networks**. A QR code appears. If multiple addresses appear, choose your Wi-Fi adapter's address.
3. On iPhone, tap **Desktop link → Scan desktop QR**. Scan the code displayed on Windows and allow **Local Network** access. You can also paste the pairing address and tap Connect.
4. Tap **Done**, then choose **Camera** on iPhone. On Windows, click **Live Monitor**. You see the actual rendered iPhone camera view, plus its recording status. Click **Back to desktop editor** to close the monitor.
5. On iPhone, start recording. The menus automatically disappear, leaving **Stop recording** and **Controls**. Tap Controls to bring them back, then Hide controls to clear them again. These buttons never enter the MP4.
6. Each app can edit and record independently. Record the full-quality phone MP4 on iPhone; it saves to Photos. Record the Windows scene using its Record video button after closing Live Monitor. The Windows monitor does not save a second phone MP4 or remotely press the phone's recording button.
7. Click **Stop sharing** on Windows (or Disconnect on iPhone) when finished. Starting pairing again creates a new code; old codes no longer connect.

### Move scenes in either direction

- **Windows → iPhone:** save any phone scene you need, click **Prepare scene for phone** on Windows, then tap **Load desktop scene** on iPhone. Return to the camera after loading.
- **iPhone → Windows:** save any Windows scene you need, tap **Send scene to desktop** on iPhone, then click **Load received phone scene** on Windows.
- Transfers replace the receiving scene. They include object presets, names, colors, position/rotation/scale, floor size and lens. They do not merge ongoing edits. Camera viewpoints, axis locks, local saves and recorded clips remain on their original device.
- The apps use different rendering engines, so materials and basic preset shapes may look slightly different after transfer. Live Monitor shows the actual iPhone image.

### Preview quality and connection help

The monitor uses JPEG previews capped at 640 pixels on the long edge, targeting about 6 frames per second without audio. This is a framing monitor, not a full-quality video stream. Smoothness depends on phone performance and Wi-Fi. The native phone recording uses its separate MP4 recorder. Physical-device performance still needs testing.

If pairing fails, check that both devices use the same network, that Windows permits the app on Private networks, and that iPhone Settings allows Local Network and Camera access. Guest Wi-Fi can block communication between devices. VPNs and multiple network adapters may require choosing the Wi-Fi address in Windows. If preview pauses, return to Camera mode on iPhone and keep it awake. Re-pair after restarting Windows sharing.

The connection uses a random session token and direct local HTTP, with no cloud account or AI credits. It is not encrypted; use trusted private Wi-Fi and keep the pairing QR private. Internet access is not required for editing, recording or the local link.

### Developer checks

Run `node --test phone-link.test.cjs` for authorization, scene validation, JPEG handling, transfer and token rotation checks. Run `npm run build`, then `.\node_modules\electron\dist\electron.exe monitor-smoke.cjs` for the real Electron preload/IPC, QR pairing, received preview, recording indicator, monitor toggle and scene import checks. `smoke.cjs` tests the existing editor, axis locks, persistence and MP4 export. The phone simulator tests include pairing address validation and scene serialization. A simulated sender exercises Windows preview tests; a physical iPhone session is still pending.

