package com.audiocountdown.adapter.out.storage;

import com.audiocountdown.application.TrackStorage;
import com.audiocountdown.domain.Track;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.stream.Stream;

@Component
public class FileSystemTrackStorage implements TrackStorage {
    private static final List<String> ALLOWED_EXTENSIONS = List.of("mp3", "wav", "m4a", "ogg", "aac", "flac");
    private final Path directory;
    private final long maxFileSize;

    public FileSystemTrackStorage(
            @Value("${audio.storage-directory}") String directory,
            @Value("${audio.max-file-size-bytes}") long maxFileSize) throws IOException {
        this.directory = Path.of(directory).toAbsolutePath().normalize();
        this.maxFileSize = maxFileSize;
        Files.createDirectories(this.directory);
    }

    @Override
    public Track save(MultipartFile file) throws IOException {
        if (file.isEmpty() || file.getSize() > maxFileSize) {
            throw new IllegalArgumentException("The audio file must be non-empty and no larger than 100 MB.");
        }
        String originalName = file.getOriginalFilename() == null ? "track" : file.getOriginalFilename();
        String extension = extensionOf(originalName);
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException("Supported audio formats are MP3, WAV, M4A, OGG, AAC, and FLAC.");
        }
        String id = UUID.randomUUID().toString();
        String safeName = id + "." + extension;
        Path destination = directory.resolve(safeName).normalize();
        if (!destination.getParent().equals(directory)) throw new IllegalArgumentException("Invalid file name.");
        Files.copy(file.getInputStream(), destination, StandardCopyOption.REPLACE_EXISTING);
        return new Track(id, originalName, contentTypeFor(extension), file.getSize());
    }

    @Override
    public List<Track> findAll() {
        try (Stream<Path> files = Files.list(directory)) {
            return files.filter(Files::isRegularFile)
                    .filter(path -> ALLOWED_EXTENSIONS.contains(extensionOf(path.getFileName().toString())))
                    .map(path -> {
                        String name = path.getFileName().toString();
                        String id = name.substring(0, name.lastIndexOf('.'));
                        try {
                            return new Track(id, name, contentTypeFor(extensionOf(name)), Files.size(path));
                        } catch (IOException error) {
                            return null;
                        }
                    })
                    .filter(track -> track != null)
                    .sorted(Comparator.comparing(Track::fileName, String.CASE_INSENSITIVE_ORDER))
                    .toList();
        } catch (IOException error) {
            throw new IllegalStateException("Could not read audio storage.", error);
        }
    }

    @Override
    public InputStream open(String id) throws IOException {
        Track track = find(id);
        if (track == null) throw new java.nio.file.NoSuchFileException(id);
        return Files.newInputStream(pathFor(track));
    }

    @Override
    public Track find(String id) {
        return findAll().stream().filter(track -> track.id().equals(id)).findFirst().orElse(null);
    }

    private Path pathFor(Track track) {
        return directory.resolve(track.id() + "." + extensionOf(track.fileName())).normalize();
    }

    private String extensionOf(String fileName) {
        int dot = fileName.lastIndexOf('.');
        return (dot < 0 ? "" : fileName.substring(dot + 1)).toLowerCase(Locale.ROOT);
    }

    private String contentTypeFor(String extension) {
        return switch (extension) {
            case "mp3" -> "audio/mpeg";
            case "wav" -> "audio/wav";
            case "m4a" -> "audio/mp4";
            case "ogg" -> "audio/ogg";
            case "aac" -> "audio/aac";
            case "flac" -> "audio/flac";
            default -> "application/octet-stream";
        };
    }
}
