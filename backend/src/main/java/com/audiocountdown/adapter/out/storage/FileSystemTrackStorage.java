package com.audiocountdown.adapter.out.storage;

import com.audiocountdown.application.TrackStorage;
import com.audiocountdown.domain.Track;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Properties;
import java.util.Set;
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
        migrateLegacyTracks();
    }

    @Override
    public synchronized Track save(MultipartFile file) throws IOException {
        if (file.isEmpty() || file.getSize() > maxFileSize) {
            throw new IllegalArgumentException("The audio file must be non-empty and no larger than 20 MB.");
        }
        String originalName = normalizedFileName(file.getOriginalFilename());
        String extension = extensionOf(originalName);
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException("Supported audio formats are MP3, WAV, M4A, OGG, AAC, and FLAC.");
        }
        String displayName = nextAvailableName(originalName, findAll());
        String id = UUID.randomUUID().toString();
        Path destination = contentPath(id, extension);
        Files.copy(file.getInputStream(), destination, StandardCopyOption.REPLACE_EXISTING);
        Track track = new Track(id, displayName, contentTypeFor(extension), file.getSize());
        try {
            writeMetadata(track);
        } catch (IOException error) {
            Files.deleteIfExists(destination);
            throw error;
        }
        return track;
    }

    @Override
    public List<Track> findAll() {
        try (Stream<Path> files = Files.list(directory)) {
            return files.filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().endsWith(".properties"))
                    .map(this::readMetadata)
                    .filter(track -> track != null)
                    .sorted(Comparator
                            .comparing((Track track) -> sortName(track.fileName()).baseName(), String.CASE_INSENSITIVE_ORDER)
                            .thenComparingInt(track -> sortName(track.fileName()).number())
                            .thenComparing(Track::fileName, String.CASE_INSENSITIVE_ORDER))
                    .toList();
        } catch (IOException error) {
            throw new IllegalStateException("Could not read audio storage.", error);
        }
    }

    @Override
    public InputStream open(String id) throws IOException {
        Track track = find(id);
        if (track == null) throw new java.nio.file.NoSuchFileException(id);
        return Files.newInputStream(contentPath(track.id(), extensionOf(track.fileName())));
    }

    @Override
    public Track find(String id) {
        if (!isUuid(id)) return null;
        return readMetadata(metadataPath(id));
    }

    private Track readMetadata(Path metadata) {
        if (!Files.isRegularFile(metadata)) return null;
        Properties properties = new Properties();
        try (InputStream input = Files.newInputStream(metadata)) {
            properties.load(input);
            String id = properties.getProperty("id");
            String fileName = properties.getProperty("fileName");
            String contentType = properties.getProperty("contentType");
            if (!isUuid(id) || fileName == null || contentType == null) return null;
            Path content = contentPath(id, extensionOf(fileName));
            return Files.isRegularFile(content) ? new Track(id, fileName, contentType, Files.size(content)) : null;
        } catch (IOException | IllegalArgumentException error) {
            return null;
        }
    }

    private void writeMetadata(Track track) throws IOException {
        Properties properties = new Properties();
        properties.setProperty("id", track.id());
        properties.setProperty("fileName", track.fileName());
        properties.setProperty("contentType", track.contentType());
        Path temporary = directory.resolve(track.id() + ".properties.tmp");
        try (OutputStream output = Files.newOutputStream(temporary)) {
            properties.store(output, null);
        }
        Files.move(temporary, metadataPath(track.id()), StandardCopyOption.REPLACE_EXISTING);
    }

    private void migrateLegacyTracks() throws IOException {
        List<Track> current = findAll();
        Set<String> usedNames = new HashSet<>();
        current.forEach(track -> usedNames.add(track.fileName().toLowerCase(Locale.ROOT)));
        try (Stream<Path> files = Files.list(directory)) {
            for (Path path : files.filter(Files::isRegularFile).sorted().toList()) {
                String storedName = path.getFileName().toString();
                String extension = extensionOf(storedName);
                String id = storedName.substring(0, Math.max(0, storedName.lastIndexOf('.')));
                if (!ALLOWED_EXTENSIONS.contains(extension) || !isUuid(id) || Files.exists(metadataPath(id))) continue;
                String displayName = nextAvailableName("Imported track." + extension, usedNames);
                usedNames.add(displayName.toLowerCase(Locale.ROOT));
                writeMetadata(new Track(id, displayName, contentTypeFor(extension), Files.size(path)));
            }
        }
    }

    private String normalizedFileName(String originalName) {
        String name = originalName == null ? "track" : originalName.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}\"]", "").trim();
        return name.isBlank() ? "track" : name;
    }

    private String nextAvailableName(String requestedName, List<Track> tracks) {
        Set<String> usedNames = new HashSet<>();
        tracks.forEach(track -> usedNames.add(track.fileName().toLowerCase(Locale.ROOT)));
        return nextAvailableName(requestedName, usedNames);
    }

    private String nextAvailableName(String requestedName, Set<String> usedNames) {
        if (!usedNames.contains(requestedName.toLowerCase(Locale.ROOT))) return requestedName;
        int dot = requestedName.lastIndexOf('.');
        String stem = dot < 0 ? requestedName : requestedName.substring(0, dot);
        String extension = dot < 0 ? "" : requestedName.substring(dot);
        int suffix = 1;
        String candidate;
        do {
            candidate = stem + " " + suffix++ + extension;
        } while (usedNames.contains(candidate.toLowerCase(Locale.ROOT)));
        return candidate;
    }

    private Path contentPath(String id, String extension) {
        return directory.resolve(id + "." + extension);
    }

    private Path metadataPath(String id) {
        return directory.resolve(id + ".properties");
    }

    private boolean isUuid(String value) {
        try {
            UUID.fromString(value);
            return true;
        } catch (IllegalArgumentException | NullPointerException error) {
            return false;
        }
    }

    private SortName sortName(String fileName) {
        int dot = fileName.lastIndexOf('.');
        String extension = dot < 0 ? "" : fileName.substring(dot);
        String stem = dot < 0 ? fileName : fileName.substring(0, dot);
        int space = stem.lastIndexOf(' ');
        if (space > 0) {
            try {
                return new SortName(stem.substring(0, space) + extension, Integer.parseInt(stem.substring(space + 1)));
            } catch (NumberFormatException ignored) {
                // The final word is part of the original filename, not a duplicate suffix.
            }
        }
        return new SortName(stem + extension, 0);
    }

    private record SortName(String baseName, int number) { }

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
