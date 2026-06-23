package com.ticketing.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * CORS configuration allowing cross-origin requests from the React dev server.
 * <p>
 * When running the React dev server on port 5173, this config allows
 * cross-origin requests from the frontend to the backend API.
 * In production (single jar), CORS is not needed as both are served from the same origin.
 */
@Configuration
public class CorsConfig {

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/api/**")
                    .allowedOriginPatterns("*")
                    .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                    .allowedHeaders("*")
                    .allowCredentials(true);

                registry.addMapping("/actuator/**")
                    .allowedOriginPatterns("*")
                    .allowedMethods("GET")
                    .allowedHeaders("*");
            }
        };
    }
}
