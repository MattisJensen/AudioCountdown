package com.audiocountdown.application;

import com.audiocountdown.core.Track;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;

public interface TrackStorage {
    Track save(TrackUpload upload) throws IOException;
    List<Track> findAll();
    InputStream open(String id, long offset) throws IOException;
    Track find(String id);
    Track rename(String id, String fileName) throws IOException;
    void delete(String id) throws IOException;
}
