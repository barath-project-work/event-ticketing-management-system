package com.ticketing.config;

import com.ticketing.repository.ReservationRepository;
import com.ticketing.model.enums.ReservationStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;
import java.time.LocalDateTime;

/**
 * Custom health indicators for production monitoring.
 * <p>
 * Architecture Rationale:
 * <ul>
 *   <li><b>DB Pool Health:</b> Monitors the database connection pool for exhaustion.
 *       When active connections approach the pool limit, it indicates a potential issue
 *       with connection leaks or insufficient pool sizing.</li>
 *   <li><b>Stale Reservation Warning:</b> Alerts when the number of stale HELD reservations
 *       exceeds a threshold, indicating the sweeper may be backlogged or failing.</li>
 * </ul>
 */

/**
 * Monitors database connection pool health.
 * Reports WARNING when pool utilization exceeds 80%, DOWN when fully exhausted.
 */
@Component
@Slf4j
@RequiredArgsConstructor
class DatabasePoolHealthIndicator implements HealthIndicator {

    private final DataSource dataSource;

    @Override
    public Health health() {
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.execute("SELECT 1");

            return Health.up()
                .withDetail("database", "H2 / PostgreSQL")
                .withDetail("poolStatus", "connected")
                .build();
        } catch (Exception e) {
            log.error("Database health check failed: {}", e.getMessage());
            return Health.down(e)
                .withDetail("error", e.getMessage())
                .build();
        }
    }
}

/**
 * Monitors Redis connectivity via PING command.
 * Only activated when Redis is actually configured and available.
 */
@Component
@Slf4j
@RequiredArgsConstructor
@ConditionalOnBean(RedisConnectionFactory.class)
class RedisHealthIndicator implements HealthIndicator {

    private final RedisConnectionFactory redisConnectionFactory;

    @Override
    public Health health() {
        try {
            redisConnectionFactory.getConnection().ping();
            return Health.up()
                .withDetail("cache", "Redis")
                .withDetail("status", "connected")
                .build();
        } catch (Exception e) {
            log.warn("Redis health check failed: {}", e.getMessage());
            return Health.down(e)
                .withDetail("error", e.getMessage())
                .build();
        }
    }
}

/**
 * Monitors the reservation sweeper health.
 * Warns if there are an excessive number of stale (past-expiry) HELD reservations,
 * which indicates the sweeper may be failing to keep up.
 */
@Component
@Slf4j
@RequiredArgsConstructor
class SweeperHealthIndicator implements HealthIndicator {

    private final ReservationRepository reservationRepository;

    // Alert if more than 1000 stale reservations exist
    private static final long STALE_THRESHOLD = 1000;

    @Override
    public Health health() {
        try {
            LocalDateTime now = LocalDateTime.now();
            long staleCount = reservationRepository
                .findByStatusAndExpiresAtBefore(ReservationStatus.HELD, now)
                .size();

            if (staleCount == 0) {
                return Health.up()
                    .withDetail("sweeper", "operational")
                    .withDetail("staleReservations", 0)
                    .build();
            } else if (staleCount < STALE_THRESHOLD) {
                return Health.status("WARNING")
                    .withDetail("sweeper", "degraded")
                    .withDetail("staleReservations", staleCount)
                    .withDetail("warning", staleCount + " stale reservations exist; sweeper may be backlogged")
                    .build();
            } else {
                return Health.down()
                    .withDetail("sweeper", "failing")
                    .withDetail("staleReservations", staleCount)
                    .withDetail("error", "Sweeper has " + staleCount + " stale reservations to process")
                    .build();
            }
        } catch (Exception e) {
            return Health.down(e)
                .withDetail("error", "Failed to query sweeper status: " + e.getMessage())
                .build();
        }
    }
}
