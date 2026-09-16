# Audio Countdown

A single-session random audio countdown with a Spring Boot API and a React frontend.

The UI follows the system color theme by default. You can also select Light or Dark explicitly. The selected preference is kept in the browser.

## Architecture

The backend follows Clean Architecture dependency boundaries:

- `core` contains framework-independent domain models.
- `application` contains countdown behavior and storage/event ports.
- `infrastructure` contains Spring configuration and filesystem persistence.
- `presentation` contains HTTP controllers, validation, error mapping, and server-sent events.

The frontend separates core formatting, application API/player/theme state, and presentation components. Audio content supports HTTP byte ranges so browsers can read duration metadata and seek without downloading the whole file.

## Run with Docker Compose

```bash
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000). Uploaded audio files are kept in the `audio-data` Docker volume.

Supported formats: MP3, WAV, M4A, OGG, AAC, and FLAC. Audio uploads are limited to 20 MB. The range uses inclusive whole minutes. When a countdown completes, the browser plays the selected track and immediately starts a new random countdown.

## Firefox music control

The optional Firefox companion extension can pause music in Apple Music, Spotify, YouTube, YouTube Music, and SoundCloud before the countdown track plays. It resumes only audio that it stopped as soon as the countdown track ends, with a two-second fade-in. The UI also provides manual stop and continue buttons, a shared volume control for supported music tabs, and a separate volume control for Audio Countdown.

For local development:

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Select **Load Temporary Add-on**.
3. Select `firefox-extension/manifest.json` from this repository.
4. Refresh Audio Countdown and any already-open supported music tabs.

Firefox removes temporary add-ons when the browser closes. A permanent installation requires a signed extension package. The extension requests access only to the Audio Countdown localhost page and the supported music sites.

## Local development

Start the API with `mvn spring-boot:run` from `backend`, then start the frontend with `npm install && npm run dev` from `frontend`.
