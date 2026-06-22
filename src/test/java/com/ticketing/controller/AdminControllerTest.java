package com.ticketing.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ticketing.dto.CreateEventRequest;
import com.ticketing.dto.CreateSeatRequest;
import com.ticketing.model.Event;
import com.ticketing.model.InventoryPool;
import com.ticketing.model.enums.EventStatus;
import com.ticketing.repository.EventRepository;
import com.ticketing.repository.InventoryPoolRepository;
import com.ticketing.repository.SeatRepository;
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
import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("AdminController Web Tests")
class AdminControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private EventRepository eventRepository;

    @Autowired
    private InventoryPoolRepository inventoryPoolRepository;

    @Autowired
    private SeatRepository seatRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private Event perSeatEvent;

    @BeforeEach
    void setUp() {
        seatRepository.deleteAll();
        inventoryPoolRepository.deleteAll();
        eventRepository.deleteAll();

        perSeatEvent = eventRepository.save(Event.builder()
            .name("Test Show")
            .venue("Test Venue")
            .eventDate(LocalDateTime.now().plusDays(30))
            .status(EventStatus.DRAFT)
            .inventoryStrategy("PER_SEAT")
            .holdDurationSeconds(180)
            .build());
    }

    @Test
    @DisplayName("POST /api/admin/events should create event and return 201")
    void shouldCreateEvent() throws Exception {
        CreateEventRequest request = CreateEventRequest.builder()
            .name("New Show")
            .description("A brand new show")
            .venue("Broadway Theater")
            .eventDate(LocalDateTime.now().plusDays(45))
            .inventoryStrategy("PER_SEAT")
            .holdDurationSeconds(300)
            .adminToken("admin-token-001")
            .build();

        mockMvc.perform(post("/api/admin/events")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name", is("New Show")))
            .andExpect(jsonPath("$.status", is("DRAFT")))
            .andExpect(jsonPath("$.inventoryStrategy", is("PER_SEAT")))
            .andExpect(jsonPath("$.holdDurationSeconds", is(300)));
    }

    @Test
    @DisplayName("POST /api/admin/events should return 400 with invalid token")
    void shouldRejectInvalidToken() throws Exception {
        CreateEventRequest request = CreateEventRequest.builder()
            .name("Bad Event")
            .venue("Venue")
            .eventDate(LocalDateTime.now().plusDays(30))
            .inventoryStrategy("PER_SEAT")
            .adminToken("wrong-token")
            .build();

        mockMvc.perform(post("/api/admin/events")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /api/admin/events should return 400 with missing name")
    void shouldRejectMissingName() throws Exception {
        CreateEventRequest request = CreateEventRequest.builder()
            .venue("Venue")
            .eventDate(LocalDateTime.now().plusDays(30))
            .inventoryStrategy("PER_SEAT")
            .adminToken("admin-token-001")
            .build();

        mockMvc.perform(post("/api/admin/events")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /api/admin/events/{id}/seats should create seats and return 201")
    void shouldCreateSeats() throws Exception {
        CreateSeatRequest request = CreateSeatRequest.builder()
            .adminToken("admin-token-001")
            .seats(List.of(
                CreateSeatRequest.SeatEntry.builder()
                    .label("A1")
                    .section("Orchestra")
                    .rowName("A")
                    .seatNumber(1)
                    .tier("VIP")
                    .price(new BigDecimal("299.00"))
                    .build(),
                CreateSeatRequest.SeatEntry.builder()
                    .label("A2")
                    .section("Orchestra")
                    .rowName("A")
                    .seatNumber(2)
                    .tier("VIP")
                    .price(new BigDecimal("299.00"))
                    .build()
            ))
            .build();

        mockMvc.perform(post("/api/admin/events/{id}/seats", perSeatEvent.getId())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$", hasSize(2)))
            .andExpect(jsonPath("$[0].label", is("A1")))
            .andExpect(jsonPath("$[0].status", is("AVAILABLE")))
            .andExpect(jsonPath("$[1].status", is("AVAILABLE")));
    }

    @Test
    @DisplayName("POST /api/admin/events/{id}/pools should create pool and return 201")
    void shouldCreateInventoryPool() throws Exception {
        Event aggregatedEvent = eventRepository.save(Event.builder()
            .name("Festival")
            .venue("Park")
            .eventDate(LocalDateTime.now().plusDays(60))
            .status(EventStatus.DRAFT)
            .inventoryStrategy("AGGREGATED")
            .holdDurationSeconds(180)
            .build());

        mockMvc.perform(post("/api/admin/events/{id}/pools", aggregatedEvent.getId())
                .param("tier", "VIP")
                .param("totalQuantity", "500")
                .param("price", "450.00")
                .param("adminToken", "admin-token-001")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.tier", is("VIP")))
            .andExpect(jsonPath("$.totalQuantity", is(500)))
            .andExpect(jsonPath("$.availableQuantity", is(500)));
    }

    @Test
    @DisplayName("PUT /api/admin/events/{id}/status should update event status")
    void shouldUpdateEventStatus() throws Exception {
        mockMvc.perform(put("/api/admin/events/{id}/status", perSeatEvent.getId())
                .param("status", "CANCELLED")
                .param("adminToken", "admin-token-001")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status", is("CANCELLED")));
    }

    @Test
    @DisplayName("PUT /api/admin/events/{id}/status should reject invalid status")
    void shouldRejectInvalidStatus() throws Exception {
        mockMvc.perform(put("/api/admin/events/{id}/status", perSeatEvent.getId())
                .param("status", "FAKE_STATUS")
                .param("adminToken", "admin-token-001")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isBadRequest());
    }
}
