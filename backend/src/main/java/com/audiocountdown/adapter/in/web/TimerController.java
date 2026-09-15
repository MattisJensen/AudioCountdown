package com.audiocountdown.adapter.in.web;

import com.audiocountdown.application.TimerEventPublisher;
import com.audiocountdown.application.TimerService;
import com.audiocountdown.application.TrackStorage;
import com.audiocountdown.domain.TimerSnapshot;
import com.audiocountdown.domain.Track;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api")
public class TimerController {
    private final TimerService timerService;
    private final TrackStorage trackStorage;
    private final TimerEventPublisher eventPublisher;

    public TimerController(TimerService timerService, TrackStorage trackStorage, TimerEventPublisher eventPublisher) {
        this.timerService = timerService;
        this.trackStorage = trackStorage;
        this.eventPublisher = eventPublisher;
    }

    @GetMapping("/state")
    public TimerSnapshot state() { return timerService.snapshot(); }

    @PostMapping("/timer/start")
    public TimerSnapshot start(@Valid @RequestBody TimerStartRequest request) {
        if (trackStorage.find(request.trackId()) == null) throw new IllegalArgumentException("Select a valid audio track.");
        return timerService.start(request.minimumMinutes(), request.maximumMinutes(), request.trackId());
    }

    @PostMapping("/timer/pause") public TimerSnapshot pause() { return timerService.pause(); }
    @PostMapping("/timer/resume") public TimerSnapshot resume() { return timerService.resume(); }
    @PostMapping("/timer/reset") public TimerSnapshot reset() { return timerService.reset(); }
    @GetMapping(value = "/timer/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter events() { return eventPublisher.subscribe(); }

    @GetMapping("/tracks") public List<Track> tracks() { return trackStorage.findAll(); }

    @PostMapping(value = "/tracks", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Track upload(@RequestPart("file") MultipartFile file) throws IOException { return trackStorage.save(file); }

    @PatchMapping("/tracks/{id}")
    public Track rename(@PathVariable String id, @Valid @RequestBody RenameTrackRequest request) throws IOException {
        return trackStorage.rename(id, request.fileName());
    }

    @GetMapping("/tracks/{id}/content")
    public ResponseEntity<InputStreamResource> content(@PathVariable String id) throws IOException {
        Track track = trackStorage.find(id);
        if (track == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(track.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + track.fileName().replace("\"", "") + "\"")
                .body(new InputStreamResource(trackStorage.open(id)));
    }

    public record TimerStartRequest(
            @Min(1) @Max(1440) int minimumMinutes,
            @Min(1) @Max(1440) int maximumMinutes,
            String trackId) { }

    public record RenameTrackRequest(@NotBlank @Size(max = 200) String fileName) { }

}
