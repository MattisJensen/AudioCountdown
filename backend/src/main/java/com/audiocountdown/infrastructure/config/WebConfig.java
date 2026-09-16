package com.audiocountdown.infrastructure.config;

import com.audiocountdown.application.TimerCompletionPublisher;
import com.audiocountdown.application.TimerService;
import org.springframework.context.annotation.Bean;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Bean(destroyMethod = "close")
    TimerService timerService(TimerCompletionPublisher completionPublisher) {
        return new TimerService(completionPublisher);
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins("http://localhost:3000", "http://localhost:5173")
                .allowedMethods("GET", "POST", "PATCH", "DELETE");
    }
}
