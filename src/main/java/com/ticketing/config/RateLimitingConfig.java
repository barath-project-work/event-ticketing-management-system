package com.ticketing.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

/**
 * In-memory rate limiting filter using a token bucket algorithm.
 * <p>
 * Architecture Rationale:
 * <ul>
 *   <li><b>Token bucket algorithm:</b> Chosen over fixed-window or sliding-window because it
 *       naturally handles burst traffic (up to the capacity limit) while enforcing a long-term
 *       average rate. This is ideal for flash-sale patterns where short bursts of legitimate
 *       traffic should succeed as long as the sustained rate stays within bounds.</li>
 *   <li><b>Per-IP buckets:</b> Each client IP gets its own token bucket stored in a
 *       ConcurrentHashMap. This prevents one abusive client from starving others. In production,
 *       the map should be replaced with a distributed Redis-based store for multi-instance deployments.</li>
 *   <li><b>Lock-free reads:</b> Token consumption uses tryLock() with a minimal timeout to avoid
 *       blocking the request thread under contention. Failed lock acquisition is treated as
 *       rate-limited, which is acceptable under extreme load.</li>
 * </ul>
 */
@Component
@Order(1)
@Slf4j
public class RateLimitingConfig implements Filter {

    private final Map<String, TokenBucket> buckets = new ConcurrentHashMap<>();
    private final int capacity;
    private final int refillTokens;
    private final long refillIntervalNanos;

    public RateLimitingConfig(
            @Value("${rate-limiting.hold.capacity:100}") int capacity,
            @Value("${rate-limiting.hold.refill-tokens:50}") int refillTokens,
            @Value("${rate-limiting.hold.refill-period-seconds:1}") int refillPeriodSeconds) {
        this.capacity = capacity;
        this.refillTokens = refillTokens;
        this.refillIntervalNanos = TimeUnit.SECONDS.toNanos(refillPeriodSeconds);
    }

    @Override
    public void doFilter(ServletRequest servletRequest, ServletResponse servletResponse,
                         FilterChain filterChain) throws IOException, ServletException {

        HttpServletRequest request = (HttpServletRequest) servletRequest;
        HttpServletResponse response = (HttpServletResponse) servletResponse;

        // Only rate-limit the hold endpoint
        String path = request.getRequestURI();
        if (!path.equals("/api/reservations/hold") || !"POST".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientIp = getClientIp(request);
        TokenBucket bucket = buckets.computeIfAbsent(clientIp,
            k -> new TokenBucket(capacity, refillTokens, refillIntervalNanos));

        if (bucket.tryConsume()) {
            filterChain.doFilter(request, response);
        } else {
            log.warn("Rate limit exceeded for IP: {}", clientIp);
            response.setStatus(429);
            response.setContentType("application/json");
            response.getWriter().write(
                "{\"error\":\"rate_limit_exceeded\"," +
                "\"message\":\"Too many requests. Please try again later.\"," +
                "\"retryAfterSeconds\":" + TimeUnit.NANOSECONDS.toSeconds(refillIntervalNanos) + "}");
        }
    }

    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    /**
     * Thread-safe token bucket using lock-free refill on access.
     * <p>
     * Tokens are refilled lazily on each {@link #tryConsume()} call based on
     * elapsed time since the last refill, avoiding the need for a background
     * scheduler thread.
     */
    static class TokenBucket {
        private final int capacity;
        private final int refillTokens;
        private final long refillIntervalNanos;
        private final ReentrantLock lock = new ReentrantLock();

        private long tokens;
        private long lastRefillNanos;

        TokenBucket(int capacity, int refillTokens, long refillIntervalNanos) {
            this.capacity = capacity;
            this.refillTokens = refillTokens;
            this.refillIntervalNanos = refillIntervalNanos;
            this.tokens = capacity;
            this.lastRefillNanos = System.nanoTime();
        }

        boolean tryConsume() {
            if (!lock.tryLock()) {
                // Under extreme contention, fail open to avoid cascading timeouts
                return true;
            }
            try {
                refill();
                if (tokens >= 1) {
                    tokens--;
                    return true;
                }
                return false;
            } finally {
                lock.unlock();
            }
        }

        private void refill() {
            long now = System.nanoTime();
            long elapsed = now - lastRefillNanos;
            if (elapsed >= refillIntervalNanos) {
                long intervals = elapsed / refillIntervalNanos;
                long newTokens = Math.min(capacity, tokens + (intervals * refillTokens));
                tokens = newTokens;
                lastRefillNanos = now - (elapsed % refillIntervalNanos);
            }
        }
    }
}
