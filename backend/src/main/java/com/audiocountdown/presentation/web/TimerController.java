package com.audiocountdown.presentation.web;

import com.audiocountdown.application.TimerService;
import com.audiocountdown.application.TrackStorage;
import com.audiocountdown.core.TimerSnapshot;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;


@RestController
@RequestMapping("/api")
public class TimerController {
    private final TimerService timerService;
    private final TrackStorage trackStorage;
    private final TimerEventStream eventStream;

    public TimerController(TimerService timerService, TrackStorage trackStorage, TimerEventStream eventStream) {
        this.timerService = timerService;
        this.trackStorage = trackStorage;
        this.eventStream = eventStream;
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

    @PatchMapping("/timer/track")
    public TimerSnapshot selectTrack(@Valid @RequestBody SelectTrackRequest request) {
        if (trackStorage.find(request.trackId()) == null) throw new IllegalArgumentException("Select a valid audio track.");
        return timerService.selectTrack(request.trackId());
    }

    @GetMapping(value = "/timer/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter events() { return eventStream.subscribe(); }

    public record TimerStartRequest(
            @Min(1) @Max(1440) int minimumMinutes,
            @Min(1) @Max(1440) int maximumMinutes,
            String trackId) { }

    public record SelectTrackRequest(@NotBlank String trackId) { }

}
