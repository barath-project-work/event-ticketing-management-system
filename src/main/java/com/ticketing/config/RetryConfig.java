package com.ticketing.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.retry.annotation.EnableRetry;

@Configuration
@EnableRetry
@ConfigurationProperties(prefix = "retry")
@Getter
@Setter
public class RetryConfig {

    private int maxAttempts = 4;

    private long initialDelayMs = 50;

    private double multiplier = 2.0;

    private long maxDelayMs = 500;
}
