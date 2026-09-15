package com.audiocountdown.application;

import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArraySet;

@Component
public class TimerEventPublisher {
    private final Set<SseEmitter> clients = new CopyOnWriteArraySet<>();

    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(0L);
        clients.add(emitter);
        emitter.onCompletion(() -> clients.remove(emitter));
        emitter.onTimeout(() -> clients.remove(emitter));
        emitter.onError(error -> clients.remove(emitter));
        try {
            emitter.send(SseEmitter.event().name("connected").data("ready"));
        } catch (IOException error) {
            clients.remove(emitter);
        }
        return emitter;
    }

    public void publishCompletion(String trackId) {
        clients.forEach(emitter -> {
            try {
                emitter.send(SseEmitter.event().name("play-track").data(trackId == null ? "" : trackId));
            } catch (IOException error) {
                clients.remove(emitter);
            }
        });
    }
}
