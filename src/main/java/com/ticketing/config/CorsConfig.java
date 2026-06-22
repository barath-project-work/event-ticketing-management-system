package com.ticketing.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * CORS configuration for development mode.
 * <p>
 * When running the React dev server on port 5173, this config allows
 * cross-origin requests from the frontend to the backend API.
 * In production (single jar), CORS is not needed as both are served from the same origin.
 */
@Configuration
@Profile("dev")
public class CorsConfig {

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/api/**")
                    .allowedOrigins("http://localhost:5173")
                    .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                    .allowedHeaders("*")
                    .allowCredentials(true);

                registry.addMapping("/actuator/**")
                    .allowedOrigins("http://localhost:5173")
                    .allowedMethods("GET")
                    .allowedHeaders("*");
            }
        };
    }
}
