package com.audiocountdown.adapter.out.storage;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class FileSystemTrackStorageTest {
    @TempDir
    Path directory;

    @Test
    void keepsOriginalNamesAndNumbersDuplicatesAcrossRestarts() throws Exception {
        var storage = new FileSystemTrackStorage(directory.toString(), 20 * 1024 * 1024);

        var first = storage.save(audio("Drik ud.mp3"));
        var second = storage.save(audio("Drik ud.mp3"));
        var reloaded = new FileSystemTrackStorage(directory.toString(), 20 * 1024 * 1024);
        var third = reloaded.save(audio("Drik ud.mp3"));

        assertThat(first.fileName()).isEqualTo("Drik ud.mp3");
        assertThat(second.fileName()).isEqualTo("Drik ud 1.mp3");
        assertThat(third.fileName()).isEqualTo("Drik ud 2.mp3");
        assertThat(reloaded.findAll()).extracting("fileName")
                .containsExactly("Drik ud.mp3", "Drik ud 1.mp3", "Drik ud 2.mp3");
    }

    @Test
    void removesPathComponentsFromUploadedNames() throws Exception {
        var storage = new FileSystemTrackStorage(directory.toString(), 20 * 1024 * 1024);

        var track = storage.save(audio("../folder/track.mp3"));

        assertThat(track.fileName()).isEqualTo("track.mp3");
    }

    private MockMultipartFile audio(String fileName) {
        return new MockMultipartFile("file", fileName, "audio/mpeg", new byte[]{1, 2, 3});
    }
}
