package com.audiocountdown.infrastructure.storage;

import com.audiocountdown.application.TrackUpload;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayInputStream;
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

    @Test
    void renamesTracksWithoutChangingTheirFormatAndNumbersDuplicates() throws Exception {
        var storage = new FileSystemTrackStorage(directory.toString(), 20 * 1024 * 1024);
        var first = storage.save(audio("first.mp3"));
        var second = storage.save(audio("second.mp3"));

        var renamed = storage.rename(second.id(), "first.mp3");

        assertThat(renamed.fileName()).isEqualTo("first 1.mp3");
        assertThat(storage.find(second.id()).fileName()).isEqualTo("first 1.mp3");
        assertThat(storage.open(first.id(), 0)).hasBinaryContent(new byte[]{1, 2, 3});
    }

    @Test
    void deletesTrackContentAndMetadata() throws Exception {
        var storage = new FileSystemTrackStorage(directory.toString(), 20 * 1024 * 1024);
        var track = storage.save(audio("remove.mp3"));

        storage.delete(track.id());

        assertThat(storage.find(track.id())).isNull();
        assertThat(storage.findAll()).isEmpty();
    }

    private TrackUpload audio(String fileName) {
        byte[] content = {1, 2, 3};
        return new TrackUpload(fileName, content.length, new ByteArrayInputStream(content));
    }
}
