package com.audiocountdown.application;

import com.audiocountdown.core.TimerStatus;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TimerServiceTest {
    private final TimerService service = new TimerService(trackId -> { });

    @Test
    void startsWithAnInclusiveWholeMinuteInTheRequestedRange() {
        var snapshot = service.start(15, 15, "track");

        assertThat(snapshot.status()).isEqualTo(TimerStatus.RUNNING);
        assertThat(snapshot.startingMinutes()).isEqualTo(15);
        assertThat(snapshot.displayedMinutesLeft()).isEqualTo(15);
    }

    @Test
    void pauseAndResumePreserveTheRemainingCountdown() {
        service.start(15, 15, "track");

        var paused = service.pause();
        var resumed = service.resume();

        assertThat(paused.status()).isEqualTo(TimerStatus.PAUSED);
        assertThat(paused.pausedSecondsLeft()).isBetween(899L, 900L);
        assertThat(resumed.status()).isEqualTo(TimerStatus.RUNNING);
        assertThat(resumed.completesAt()).isNotNull();
    }

    @Test
    void rejectsAnInvalidRange() {
        assertThatThrownBy(() -> service.start(80, 15, "track"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void clearsADeletedSelectedTrackWhileIdle() {
        service.start(15, 15, "deleted-track");
        service.reset();

        service.clearTrackIfSelected("deleted-track");

        assertThat(service.snapshot().selectedTrackId()).isNull();
    }

    @Test
    void changesTheTrackWithoutRestartingTheCountdown() {
        var started = service.start(15, 15, "first-track");

        var updated = service.selectTrack("next-track");

        assertThat(updated.status()).isEqualTo(TimerStatus.RUNNING);
        assertThat(updated.startingMinutes()).isEqualTo(started.startingMinutes());
        assertThat(updated.completesAt()).isEqualTo(started.completesAt());
        assertThat(updated.selectedTrackId()).isEqualTo("next-track");
    }
}
