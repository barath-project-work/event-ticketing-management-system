package com.ticketing.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ticketing.model.Event;
import com.ticketing.model.InventoryPool;
import com.ticketing.model.Seat;
import com.ticketing.model.enums.EventStatus;
import com.ticketing.model.enums.SeatStatus;
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

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("EventController Web Tests")
class EventControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private EventRepository eventRepository;

    @Autowired
    private SeatRepository seatRepository;

    @Autowired
    private InventoryPoolRepository inventoryPoolRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private Event perSeatEvent;
    private Event aggregatedEvent;

    @BeforeEach
    void setUp() {
        inventoryPoolRepository.deleteAll();
        seatRepository.deleteAll();
        eventRepository.deleteAll();

        perSeatEvent = eventRepository.save(Event.builder()
            .name("Hamilton - Broadway")
            .description("The hit musical")
            .venue("Richard Rodgers Theatre")
            .eventDate(LocalDateTime.now().plusDays(45))
            .status(EventStatus.ACTIVE)
            .inventoryStrategy("PER_SEAT")
            .holdDurationSeconds(180)
            .build());

        seatRepository.save(Seat.builder()
            .event(perSeatEvent)
            .label("A1")
            .section("Orchestra")
            .rowName("A")
            .seatNumber(1)
            .tier("VIP")
            .price(new BigDecimal("299.00"))
            .status(SeatStatus.AVAILABLE)
            .build());

        aggregatedEvent = eventRepository.save(Event.builder()
            .name("Summer Festival")
            .description("Outdoor festival")
            .venue("Central Park")
            .eventDate(LocalDateTime.now().plusDays(60))
            .status(EventStatus.ACTIVE)
            .inventoryStrategy("AGGREGATED")
            .holdDurationSeconds(180)
            .build());

        inventoryPoolRepository.save(InventoryPool.builder()
            .event(aggregatedEvent)
            .tier("VIP")
            .totalQuantity(500)
            .availableQuantity(500)
            .price(new BigDecimal("450.00"))
            .build());
    }

    @Test
    @DisplayName("GET /api/events should return 200 with all events")
    void shouldReturnAllEvents() throws Exception {
        mockMvc.perform(get("/api/events")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(2)))
            .andExpect(jsonPath("$[0].name", is("Hamilton - Broadway")))
            .andExpect(jsonPath("$[1].name", is("Summer Festival")));
    }

    @Test
    @DisplayName("GET /api/events?status=ACTIVE should filter by status")
    void shouldFilterByStatus() throws Exception {
        mockMvc.perform(get("/api/events")
                .param("status", "ACTIVE")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(2)));
    }

    @Test
    @DisplayName("GET /api/events?status=DRAFT should return empty")
    void shouldFilterDraftEvents() throws Exception {
        mockMvc.perform(get("/api/events")
                .param("status", "DRAFT")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    @DisplayName("GET /api/events/{id} should return full event details")
    void shouldReturnEventDetails() throws Exception {
        mockMvc.perform(get("/api/events/{id}", perSeatEvent.getId())
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name", is("Hamilton - Broadway")))
            .andExpect(jsonPath("$.venue", is("Richard Rodgers Theatre")))
            .andExpect(jsonPath("$.totalSeats", is(1)))
            .andExpect(jsonPath("$.availableSeats", is(1)))
            .andExpect(jsonPath("$.inventoryStrategy", is("PER_SEAT")))
            .andExpect(jsonPath("$.tiers", hasSize(1)))
            .andExpect(jsonPath("$.tiers[0].tier", is("VIP")));
    }

    @Test
    @DisplayName("GET /api/events/{id} should return aggregated details with pools")
    void shouldReturnAggregatedDetails() throws Exception {
        mockMvc.perform(get("/api/events/{id}", aggregatedEvent.getId())
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name", is("Summer Festival")))
            .andExpect(jsonPath("$.inventoryStrategy", is("AGGREGATED")))
            .andExpect(jsonPath("$.totalSeats", is(500)))
            .andExpect(jsonPath("$.availableSeats", is(500)))
            .andExpect(jsonPath("$.tiers", hasSize(1)))
            .andExpect(jsonPath("$.tiers[0].totalQuantity", is(500)));
    }

    @Test
    @DisplayName("GET /api/events/{id} should return 400 for non-existent event")
    void shouldReturn400ForNonExistentEvent() throws Exception {
        mockMvc.perform(get("/api/events/{id}", 999L)
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("GET /api/events/{id}/seats should return seat list")
    void shouldReturnSeats() throws Exception {
        mockMvc.perform(get("/api/events/{id}/seats", perSeatEvent.getId())
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].label", is("A1")))
            .andExpect(jsonPath("$[0].tier", is("VIP")));
    }

    @Test
    @DisplayName("GET /api/events/{id}/seats with tier filter should filter seats")
    void shouldFilterSeatsByTier() throws Exception {
        mockMvc.perform(get("/api/events/{id}/seats", perSeatEvent.getId())
                .param("tier", "VIP")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    @DisplayName("GET /api/events/{id}/seats should return 400 for aggregated events")
    void shouldReturn400ForAggregatedSeats() throws Exception {
        mockMvc.perform(get("/api/events/{id}/seats", aggregatedEvent.getId())
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("GET /api/events/{id} should show held seat counts")
    void shouldShowHeldSeatCounts() throws Exception {
        // Hold a seat by setting it as HELD (simulating a reservation)
        Seat seat = seatRepository.findByEventIdAndStatus(
            perSeatEvent.getId(), SeatStatus.AVAILABLE).getFirst();
        seat.setStatus(SeatStatus.HELD);
        seatRepository.save(seat);

        mockMvc.perform(get("/api/events/{id}", perSeatEvent.getId())
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.availableSeats", is(0)))
            .andExpect(jsonPath("$.heldSeats", is(1)));
    }
}
