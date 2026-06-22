package com.ticketing.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ticketing.dto.HoldSeatRequest;
import com.ticketing.model.*;
import com.ticketing.model.enums.EventStatus;
import com.ticketing.model.enums.SeatStatus;
import com.ticketing.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ReservationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private EventRepository eventRepository;

    @Autowired
    private SeatRepository seatRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ReservationRepository reservationRepository;

    private Event event;
    private Seat seat;
    private User user;

    @BeforeEach
    void setUp() {
        user = userRepository.save(User.builder()
            .email("controller@test.com")
            .name("Controller Test")
            .token("controller-token-789")
            .build());

        event = eventRepository.save(Event.builder()
            .name("Test Concert")
            .venue("Stadium")
            .eventDate(LocalDateTime.now().plusDays(30))
            .status(EventStatus.ACTIVE)
            .inventoryStrategy("PER_SEAT")
            .holdDurationSeconds(180)
            .build());

        seat = seatRepository.save(Seat.builder()
            .event(event)
            .label("B10")
            .section("Floor")
            .tier("Standard")
            .price(new BigDecimal("100.00"))
            .status(SeatStatus.AVAILABLE)
            .build());
    }

    @Test
    void shouldReturn201OnHold() throws Exception {
        HoldSeatRequest request = HoldSeatRequest.builder()
            .eventId(event.getId())
            .seatId(seat.getId())
            .token("controller-token-789")
            .build();

        mockMvc.perform(post("/api/reservations/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("HELD"))
            .andExpect(jsonPath("$.seatId").value(seat.getId()))
            .andExpect(jsonPath("$.eventName").value("Test Concert"))
            .andExpect(jsonPath("$.expiresAt").isNotEmpty());
    }

    @Test
    void shouldReturn200OnConfirm() throws Exception {
        // First hold
        HoldSeatRequest holdRequest = HoldSeatRequest.builder()
            .eventId(event.getId())
            .seatId(seat.getId())
            .token("controller-token-789")
            .build();

        String holdJson = mockMvc.perform(post("/api/reservations/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(holdRequest)))
            .andReturn().getResponse().getContentAsString();

        Long reservationId = objectMapper.readTree(holdJson).get("id").asLong();

        // Then confirm
        String confirmBody = "{\"token\":\"controller-token-789\"}";

        mockMvc.perform(post("/api/reservations/{id}/confirm", reservationId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(confirmBody))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CONFIRMED"));
    }

    @Test
    void shouldReturn200OnCancel() throws Exception {
        HoldSeatRequest holdRequest = HoldSeatRequest.builder()
            .eventId(event.getId())
            .seatId(seat.getId())
            .token("controller-token-789")
            .build();

        String holdJson = mockMvc.perform(post("/api/reservations/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(holdRequest)))
            .andReturn().getResponse().getContentAsString();

        Long reservationId = objectMapper.readTree(holdJson).get("id").asLong();

        String cancelBody = "{\"token\":\"controller-token-789\"}";

        mockMvc.perform(post("/api/reservations/{id}/cancel", reservationId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(cancelBody))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CANCELLED"));
    }

    @Test
    void shouldReturn409OnStaleHoldConfirm() throws Exception {
        // Create an already-expired reservation directly
        Reservation expired = reservationRepository.save(Reservation.builder()
            .user(user)
            .event(event)
            .seat(seat)
            .status(com.ticketing.model.enums.ReservationStatus.HELD)
            .heldAt(LocalDateTime.now().minusMinutes(10))
            .expiresAt(LocalDateTime.now().minusMinutes(1))
            .build());

        String confirmBody = "{\"token\":\"controller-token-789\"}";

        mockMvc.perform(post("/api/reservations/{id}/confirm", expired.getId())
                .contentType(MediaType.APPLICATION_JSON)
                .content(confirmBody))
            .andExpect(status().isConflict());
    }

    @Test
    void shouldReturn400OnMissingFields() throws Exception {
        String invalidBody = "{}";

        mockMvc.perform(post("/api/reservations/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(invalidBody))
            .andExpect(status().isBadRequest());
    }
}
