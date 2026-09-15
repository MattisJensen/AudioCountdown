package com.audiocountdown.adapter.in.web;

public class TrackInUseException extends RuntimeException {
    public TrackInUseException() {
        super("Reset the countdown before deleting its selected track.");
    }
}
