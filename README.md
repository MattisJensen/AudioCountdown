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

## Local development

Start the API with `mvn spring-boot:run` from `backend`, then start the frontend with `npm install && npm run dev` from `frontend`.
