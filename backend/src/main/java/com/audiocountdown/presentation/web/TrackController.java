package com.audiocountdown.presentation.web;

import com.audiocountdown.application.TimerService;
import com.audiocountdown.application.TrackStorage;
import com.audiocountdown.application.TrackUpload;
import com.audiocountdown.core.TimerSnapshot;
import com.audiocountdown.core.TimerStatus;
import com.audiocountdown.core.Track;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpRange;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.List;

@RestController
@RequestMapping("/api/tracks")
public class TrackController {
    private final TimerService timerService;
    private final TrackStorage trackStorage;

    public TrackController(TimerService timerService, TrackStorage trackStorage) {
        this.timerService = timerService;
        this.trackStorage = trackStorage;
    }

    @GetMapping
    public List<Track> tracks() { return trackStorage.findAll(); }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Track upload(@RequestPart("file") MultipartFile file) throws IOException {
        try (InputStream content = file.getInputStream()) {
            return trackStorage.save(new TrackUpload(file.getOriginalFilename(), file.getSize(), content));
        }
    }

    @PatchMapping("/{id}")
    public Track rename(@PathVariable String id, @Valid @RequestBody RenameTrackRequest request) throws IOException {
        return trackStorage.rename(id, request.fileName());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) throws IOException {
        TimerSnapshot snapshot = timerService.snapshot();
        if (snapshot.status() != TimerStatus.IDLE && id.equals(snapshot.selectedTrackId())) {
            throw new TrackInUseException();
        }
        trackStorage.delete(id);
        timerService.clearTrackIfSelected(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/content")
    public ResponseEntity<StreamingResponseBody> content(
            @PathVariable String id,
            @RequestHeader(value = HttpHeaders.RANGE, required = false) String rangeHeader) {
        Track track = trackStorage.find(id);
        if (track == null) return ResponseEntity.notFound().build();

        ByteRange range = parseRange(rangeHeader, track.size());
        StreamingResponseBody body = output -> {
            try (InputStream input = trackStorage.open(id, range.start())) {
                transfer(input, output, range.length());
            }
        };

        ResponseEntity.BodyBuilder response = ResponseEntity.status(range.partial() ? HttpStatus.PARTIAL_CONTENT : HttpStatus.OK)
                .contentType(MediaType.parseMediaType(track.contentType()))
                .contentLength(range.length())
                .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + track.fileName().replace("\"", "") + "\"");
        if (range.partial()) {
            response.header(HttpHeaders.CONTENT_RANGE,
                    "bytes " + range.start() + "-" + range.end() + "/" + track.size());
        }
        return response.body(body);
    }

    private ByteRange parseRange(String rangeHeader, long fileSize) {
        if (rangeHeader == null || rangeHeader.isBlank()) {
            return new ByteRange(0, fileSize - 1, false);
        }
        try {
            List<HttpRange> ranges = HttpRange.parseRanges(rangeHeader);
            if (ranges.size() != 1) throw new InvalidRangeException(fileSize);
            long start = ranges.getFirst().getRangeStart(fileSize);
            long end = ranges.getFirst().getRangeEnd(fileSize);
            if (start < 0 || start >= fileSize || end < start) throw new InvalidRangeException(fileSize);
            return new ByteRange(start, end, true);
        } catch (IllegalArgumentException error) {
            throw new InvalidRangeException(fileSize);
        }
    }

    private void transfer(InputStream input, OutputStream output, long length) throws IOException {
        byte[] buffer = new byte[8192];
        long remaining = length;
        while (remaining > 0) {
            int read = input.read(buffer, 0, (int) Math.min(buffer.length, remaining));
            if (read < 0) break;
            output.write(buffer, 0, read);
            remaining -= read;
        }
    }

    private record ByteRange(long start, long end, boolean partial) {
        long length() { return end - start + 1; }
    }

    public record RenameTrackRequest(@NotBlank @Size(max = 200) String fileName) { }
}
