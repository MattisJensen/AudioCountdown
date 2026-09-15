package com.audiocountdown.application;

import com.audiocountdown.domain.Track;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;

public interface TrackStorage {
    Track save(MultipartFile file) throws IOException;
    List<Track> findAll();
    InputStream open(String id) throws IOException;
    Track find(String id);
    Track rename(String id, String fileName) throws IOException;
    void delete(String id) throws IOException;
}
