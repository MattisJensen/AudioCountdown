package com.audiocountdown.application;

@FunctionalInterface
public interface TimerCompletionPublisher {
    void publish(String trackId);
}
