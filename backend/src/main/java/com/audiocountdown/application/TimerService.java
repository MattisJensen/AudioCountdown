package com.audiocountdown.application;

import com.audiocountdown.core.TimerSnapshot;
import com.audiocountdown.core.TimerStatus;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ThreadLocalRandom;

public class TimerService implements AutoCloseable {
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    private final TimerCompletionPublisher completionPublisher;
    private TimerStatus status = TimerStatus.IDLE;
    private int minimumMinutes = 15;
    private int maximumMinutes = 80;
    private int startingMinutes;
    private Instant completesAt;
    private long pausedSecondsLeft;
    private String selectedTrackId;
    private ScheduledFuture<?> scheduledCompletion;

    public TimerService(TimerCompletionPublisher completionPublisher) {
        this.completionPublisher = completionPublisher;
    }

    public synchronized TimerSnapshot start(int minimum, int maximum, String trackId) {
        if (minimum < 1 || maximum < minimum) {
            throw new IllegalArgumentException("The range must contain positive whole minutes, with minimum <= maximum.");
        }
        minimumMinutes = minimum;
        maximumMinutes = maximum;
        selectedTrackId = trackId;
        startingMinutes = ThreadLocalRandom.current().nextInt(minimum, maximum + 1);
        pausedSecondsLeft = startingMinutes * 60L;
        status = TimerStatus.RUNNING;
        completesAt = Instant.now().plusSeconds(pausedSecondsLeft);
        scheduleCompletion(pausedSecondsLeft);
        return snapshot();
    }

    public synchronized TimerSnapshot pause() {
        if (status != TimerStatus.RUNNING) return snapshot();
        pausedSecondsLeft = Math.max(0, Duration.between(Instant.now(), completesAt).getSeconds());
        cancelSchedule();
        status = TimerStatus.PAUSED;
        completesAt = null;
        return snapshot();
    }

    public synchronized TimerSnapshot resume() {
        if (status != TimerStatus.PAUSED) return snapshot();
        status = TimerStatus.RUNNING;
        completesAt = Instant.now().plusSeconds(pausedSecondsLeft);
        scheduleCompletion(pausedSecondsLeft);
        return snapshot();
    }

    public synchronized TimerSnapshot reset() {
        cancelSchedule();
        status = TimerStatus.IDLE;
        startingMinutes = 0;
        completesAt = null;
        pausedSecondsLeft = 0;
        return snapshot();
    }

    public synchronized void clearTrackIfSelected(String trackId) {
        if (java.util.Objects.equals(selectedTrackId, trackId)) selectedTrackId = null;
    }

    public synchronized TimerSnapshot selectTrack(String trackId) {
        selectedTrackId = trackId;
        return snapshot();
    }

    public synchronized TimerSnapshot snapshot() {
        long secondsLeft = status == TimerStatus.RUNNING
                ? Math.max(0, Duration.between(Instant.now(), completesAt).getSeconds())
                : pausedSecondsLeft;
        Integer displayed = status == TimerStatus.IDLE ? null : displayedMinutes(secondsLeft);
        return new TimerSnapshot(status, status == TimerStatus.IDLE ? null : startingMinutes, displayed,
                completesAt, status == TimerStatus.PAUSED ? pausedSecondsLeft : null, selectedTrackId);
    }

    @Override
    public void close() {
        scheduler.shutdownNow();
    }

    private int displayedMinutes(long secondsLeft) {
        if (secondsLeft >= startingMinutes * 60L - 60L) return startingMinutes;
        return Math.max(0, (int) (Math.ceil(secondsLeft / 60.0 / 5.0) * 5));
    }

    private void scheduleCompletion(long seconds) {
        cancelSchedule();
        scheduledCompletion = scheduler.schedule(this::complete, Math.max(1, seconds), java.util.concurrent.TimeUnit.SECONDS);
    }

    private void complete() {
        String track;
        synchronized (this) {
            if (status != TimerStatus.RUNNING) return;
            track = selectedTrackId;
            startingMinutes = ThreadLocalRandom.current().nextInt(minimumMinutes, maximumMinutes + 1);
            pausedSecondsLeft = startingMinutes * 60L;
            completesAt = Instant.now().plusSeconds(pausedSecondsLeft);
            scheduleCompletion(pausedSecondsLeft);
        }
        completionPublisher.publish(track);
    }

    private void cancelSchedule() {
        if (scheduledCompletion != null) scheduledCompletion.cancel(false);
    }
}
