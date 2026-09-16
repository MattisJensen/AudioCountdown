package com.audiocountdown.core;

import java.time.Instant;

public record TimerSnapshot(
        TimerStatus status,
        Integer startingMinutes,
        Integer displayedMinutesLeft,
        Instant completesAt,
        Long pausedSecondsLeft,
        String selectedTrackId) { }
