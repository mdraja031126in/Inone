# IN ONE Studio Pro 1.4.0 — Android project

A local-first hybrid Android creative workspace. This release improves the existing starter, fixes WebView file selection and repairs several editing workflow issues. It is still not a full multi-track video editor or a replacement for CapCut, Alight Motion, Premiere, Blender, or a cloud AI suite.

## Implemented in this project
- Android WebView shell with Kotlin JavaScript bridge.
- Android WebView file chooser support for HTML media, subtitle, and project file inputs.
- Android document picker and Media3 Transformer trim-to-MP4 export.
- Exported MP4 is published to `Movies/IN ONE Studio` on Android 10+.
- Local video/audio/image import and preview, clip selection, reordering, removal, and timeline list.
- Playback controls with synchronized time readout and seek slider.
- Audio playlist selection and automatic next-track playback.
- Local project metadata save, JSON export/import, caption and keyframe metadata restoration.
- Imported project clip entries are shown as relink-required placeholders because browser media URLs and source media are not embedded in JSON.
- Motion transform preview and keyframe snapshots.
- Photo filter preview and PNG export.
- Manual captions, SRT/VTT-style timestamp import, and SRT export.
- VFX preview filters and CSS 3D cube rotation demo.
- AI provider setup placeholders; keys are not saved or transmitted.

## Known limitations — not implemented as production features
- Multi-track video/audio compositing, transitions, speed ramps, frame-accurate editing, waveform editing, audio mixing, and a complete rendering/export pipeline.
- Caption burn-in and automatic speech recognition.
- AI background removal, generative fill, and live AI provider calls.
- True 3D mesh editing, OBJ/GLB import/export, sculpting, UV/PBR materials, and production camera tools.
- A keyframe interpolation/timeline graph editor. Current keyframes are snapshots only.
- Project JSON does not bundle media assets; users must re-import source files after loading a project.

These features need additional native engines/libraries, model weights, backend services, API credentials, and device-level testing. The UI does not claim they are connected or complete.

## Build
1. Open this folder in Android Studio.
2. Allow Gradle sync and install Android SDK 35 if prompted.
3. Run the `app` configuration on an Android 8.0+ device/emulator.
4. Import media from the Video, Photo, or Audio workspace.

## Verification
- JavaScript syntax checked with Node.js (`node --check`).
- Source references and project archive structure reviewed.
- Android APK build and device runtime were not verified in this environment; Gradle sync, Media3 API compatibility, export behavior, and file picker behavior still require Android Studio and a real device/emulator test.


## Version 1.3.0 additions

- Text Designer with ten typography looks, ten animation previews, and 1920×1080 PNG title-card export.
- Motion preset animations (float, pulse, swing, shake, spin) and saved keyframe snapshots.
- Local video review: metadata and sampled-frame brightness, contrast, edge-detail and resolution heuristics.
- Optional AI creative assistant using OpenAI-compatible chat completions, Google Gemini generateContent, or Anthropic Messages.
- AI review sends three sampled video frames plus technical summary when the user explicitly requests an AI action.
- API credentials are not written to project JSON or local app storage; users supply their own key and pay their provider directly.

### Important limitations

The local quality score is a heuristic, not a professional quality certification. AI results depend on the selected model, API access, network, provider policies and costs. The new typography animations are previews; PNG export is a still title card. This release does not claim a full multi-track compositing/render engine, neural background removal, automatic speech recognition, or full 4K video effects rendering. Build and device verification are required before production release.


## Version 1.4.0 practical working additions
- Sequence setup controls: canvas preset, frame rate, color-space label, aspect-ratio label, and configurable local auto-save. These settings are saved as project metadata; they do not change the native render dimensions by themselves.
- Timeline organization: assign imported clip entries to V1–V4 / A1–A4 lanes and apply color labels. This is organizational track metadata, not yet a multi-track compositor.
- Timeline markers: add markers at the selected preview playhead, jump to a marker, delete markers, and persist them in project JSON.
- Selected video preview: adjustable exposure, contrast, saturation, warmth tint and playback speed. These are live preview adjustments and are not baked into native MP4 trim export.
- Motion keyframe preview: animate between stored transform snapshots using the browser animation engine. This is a preview, not rendered into a video.
- Audio live processing: 3-band Web Audio EQ and a basic dynamics compressor for playback where Web Audio is supported. Effects are not rendered to an audio file.
- Text designer: font-family, letter-spacing, stroke-width controls and extended size range.

## Honest feature boundary
This upgrade adds working local preview and project-organization controls without claiming that the app now has the full Premiere/Resolve class render engine. True simultaneous multi-track compositing, track audio mixing, transitions rendered into MP4, masks/rotoscoping, optical flow, scopes, full LUT pipeline, AI transcription, AI image/video generation, 3D mesh editing and broad professional codec support remain unimplemented and require native rendering libraries, model services, or a backend. The existing features are retained.
