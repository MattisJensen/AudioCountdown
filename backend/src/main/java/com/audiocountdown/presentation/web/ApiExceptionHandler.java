package com.audiocountdown.presentation.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.Map;
import java.util.NoSuchElementException;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler({IllegalArgumentException.class, org.springframework.web.bind.MethodArgumentNotValidException.class})
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> badRequest(Exception error) {
        return Map.of("message", error.getMessage() == null ? "Invalid request." : error.getMessage());
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    @ResponseStatus(HttpStatus.PAYLOAD_TOO_LARGE)
    public Map<String, String> uploadTooLarge() {
        return Map.of("message", "The audio file is too large. The maximum size is 20 MB.");
    }

    @ExceptionHandler(NoSuchElementException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public Map<String, String> notFound(NoSuchElementException error) {
        return Map.of("message", error.getMessage());
    }

    @ExceptionHandler(TrackInUseException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public Map<String, String> trackInUse(TrackInUseException error) {
        return Map.of("message", error.getMessage());
    }

    @ExceptionHandler(InvalidRangeException.class)
    public ResponseEntity<Map<String, String>> invalidRange(InvalidRangeException error) {
        return ResponseEntity.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                .header(HttpHeaders.CONTENT_RANGE, "bytes */" + error.fileSize())
                .body(Map.of("message", error.getMessage()));
    }

}
