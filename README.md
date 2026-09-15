# Audio Countdown

A single-session random audio countdown with a Spring Boot API and a React frontend.

## Run with Docker Compose

```bash
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000). Uploaded audio files are kept in the `audio-data` Docker volume.

Supported formats: MP3, WAV, M4A, OGG, AAC, and FLAC. The range uses inclusive whole minutes. When a countdown completes, the browser plays the selected track and immediately starts a new random countdown.

## Local development

Start the API with `mvn spring-boot:run` from `backend`, then start the frontend with `npm install && npm run dev` from `frontend`.
