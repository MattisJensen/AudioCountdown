package com.audiocountdown.presentation.web;

final class InvalidRangeException extends RuntimeException {
    private final long fileSize;

    InvalidRangeException(long fileSize) {
        super("The requested audio range is not available.");
        this.fileSize = fileSize;
    }

    long fileSize() { return fileSize; }
}
