package com.audiocountdown.application;

import java.io.InputStream;
import java.util.Objects;

public record TrackUpload(String fileName, long size, InputStream content) {
    public TrackUpload {
        Objects.requireNonNull(content, "content");
    }
}
