package com.audiocountdown.adapter.in.web;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler({IllegalArgumentException.class, org.springframework.web.bind.MethodArgumentNotValidException.class})
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> badRequest(Exception error) {
        return Map.of("message", error.getMessage() == null ? "Invalid request." : error.getMessage());
    }
}
