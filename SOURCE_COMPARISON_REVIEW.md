# Source comparison and merge review — IN ONE Studio Pro 1.3.0

The reviewed 1.2.0 project is retained as the base. The Starter archive is an earlier project generation; its existing features were not blindly overlaid onto the newer project. The Engine Integration archive is also an earlier source snapshot.

## Added in 1.3.0
- Text Designer with ten typography styles and ten motion preview presets.
- PNG title-card export and add-text-as-caption workflow.
- Motion preset animations.
- Local video review from metadata and three sampled frames.
- Optional native Android API bridge for OpenAI-compatible, Gemini and Anthropic vision/text requests.

## Verification
- JavaScript syntax and ZIP integrity are checked during packaging.
- Android Gradle build and real-device export/network tests remain to be run in Android Studio.
- The API key is session-only and excluded from project JSON.

## Known limitations
- Video compositing, multi-track timeline rendering, automatic speech recognition, AI cutout, and 4K effects export are not complete in this release.
- Local quality score is a heuristic; AI feedback requires a valid API key and provider access.
