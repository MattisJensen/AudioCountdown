package com.audiocountdown.presentation.web;

import com.audiocountdown.application.TimerService;
import com.audiocountdown.application.TrackUpload;
import com.audiocountdown.infrastructure.storage.FileSystemTrackStorage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class TrackControllerTest {
    @TempDir
    Path directory;

    @Test
    void streamsRequestedAudioByteRange() throws Exception {
        var storage = new FileSystemTrackStorage(directory.toString(), 1024);
        byte[] audio = {0, 1, 2, 3, 4, 5, 6, 7};
        var track = storage.save(new TrackUpload("sound.mp3", audio.length, new ByteArrayInputStream(audio)));
        try (var timer = new TimerService(trackId -> { })) {
            var controller = new TrackController(timer, storage);

            var response = controller.content(track.id(), "bytes=2-5");
            var output = new ByteArrayOutputStream();
            response.getBody().writeTo(output);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.PARTIAL_CONTENT);
            assertThat(response.getHeaders().getFirst(HttpHeaders.ACCEPT_RANGES)).isEqualTo("bytes");
            assertThat(response.getHeaders().getFirst(HttpHeaders.CONTENT_RANGE)).isEqualTo("bytes 2-5/8");
            assertThat(response.getHeaders().getContentLength()).isEqualTo(4);
            assertThat(output.toByteArray()).containsExactly(2, 3, 4, 5);
        }
    }
}
