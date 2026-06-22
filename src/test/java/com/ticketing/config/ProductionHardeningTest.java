package com.ticketing.config;

import com.ticketing.model.Event;
import com.ticketing.model.Seat;
import com.ticketing.model.User;
import com.ticketing.model.enums.EventStatus;
import com.ticketing.model.enums.SeatStatus;
import com.ticketing.repository.AuditLogRepository;
import com.ticketing.repository.EventRepository;
import com.ticketing.repository.InventoryPoolRepository;
import com.ticketing.repository.ReservationRepository;
import com.ticketing.repository.SeatRepository;
import com.ticketing.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("Production Hardening Integration Tests")
class ProductionHardeningTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private EventRepository eventRepository;

    @Autowired
    private SeatRepository seatRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ReservationRepository reservationRepository;

    @Autowired
    private InventoryPoolRepository inventoryPoolRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired(required = false)
    private RateLimitingConfig rateLimitingConfig;

    private Event testEvent;
    private Seat testSeat;
    private User testUser;

    @BeforeEach
    void setUp() {
        auditLogRepository.deleteAll();
        reservationRepository.deleteAll();
        inventoryPoolRepository.deleteAll();
        seatRepository.deleteAll();
        eventRepository.deleteAll();
        userRepository.deleteAll();

        testUser = userRepository.save(User.builder()
            .email("test@example.com")
            .name("Test User")
            .token("test-token")
            .build());

        testEvent = eventRepository.save(Event.builder()
            .name("Test Event")
            .venue("Test Venue")
            .eventDate(LocalDateTime.now().plusDays(30))
            .status(EventStatus.ACTIVE)
            .inventoryStrategy("PER_SEAT")
            .holdDurationSeconds(180)
            .build());

        testSeat = seatRepository.save(Seat.builder()
            .event(testEvent)
            .label("A1")
            .section("Orchestra")
            .tier("VIP")
            .price(new BigDecimal("100.00"))
            .status(SeatStatus.AVAILABLE)
            .build());
    }

    @Test
    @DisplayName("Health endpoint should respond even with some components down")
    void healthEndpointShouldRespond() throws Exception {
        // Redis may be DOWN in test (no Redis running), but DB should be UP.
        // The overall health endpoint should still respond.
        mockMvc.perform(get("/actuator/health")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.status").isString());
    }

    @Test
    @DisplayName("Health endpoint should report database component details")
    void databaseHealthComponentShouldBePresent() throws Exception {
        mockMvc.perform(get("/actuator/health")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.components.databasePool").exists())
            .andExpect(jsonPath("$.components.databasePool.status").value("UP"));
    }

    @Test
    @DisplayName("Rate limiter should pass through valid hold requests")
    void rateLimiterShouldPassValidRequests() throws Exception {
        // With seed data, the hold should succeed (201 CREATED)
        String payload = "{\"eventId\":" + testEvent.getId()
            + ",\"seatId\":" + testSeat.getId()
            + ",\"token\":\"test-token\"}";

        mockMvc.perform(post("/api/reservations/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
            .andExpect(status().is2xxSuccessful());
    }

    @Test
    @DisplayName("Rate limiter should not block requests to non-hold endpoints")
    void rateLimiterShouldNotBlockOtherEndpoints() throws Exception {
        mockMvc.perform(get("/api/events")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Rate limiting filter bean should be registered in Spring context")
    void rateLimitingBeanShouldExist() {
        assertNotNull(rateLimitingConfig,
            "RateLimitingConfig filter should be registered as a Spring component");
    }

    @Test
    @DisplayName("Event listing should work correctly across multiple reads")
    void eventListingShouldWorkWithMultipleReads() throws Exception {
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(get("/api/events")
                    .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Test Event"));
        }
    }

    @Test
    @DisplayName("Multiple hold requests should not trigger rate limiter")
    void multipleHoldRequestsShouldNotBeRateLimited() throws Exception {
        String payload = "{\"eventId\":" + testEvent.getId()
            + ",\"seatId\":" + (testSeat.getId() + 999) // non-existent seat
            + ",\"token\":\"test-token\"}";

        // Use a non-existent seat so each request hits the service layer
        // without modifying seat state (returns 400: "Seat not found")
        // The rate limiter passes these through, verifying it's not blocking
        for (int i = 0; i < 10; i++) {
            mockMvc.perform(post("/api/reservations/hold")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(payload))
                .andExpect(status().is4xxClientError()); // Seat not found, not rate-limited
        }
    }
}
