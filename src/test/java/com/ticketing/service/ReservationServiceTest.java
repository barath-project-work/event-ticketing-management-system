package com.ticketing.service;

import com.ticketing.dto.HoldSeatRequest;
import com.ticketing.dto.ReservationResponse;
import com.ticketing.exception.SeatNotAvailableException;
import com.ticketing.model.*;
import com.ticketing.model.enums.EventStatus;
import com.ticketing.model.enums.ReservationStatus;
import com.ticketing.model.enums.SeatStatus;
import com.ticketing.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ReservationServiceTest {

    @Autowired
    private ReservationService reservationService;

    @Autowired
    private EventRepository eventRepository;

    @Autowired
    private SeatRepository seatRepository;

    @Autowired
    private InventoryPoolRepository inventoryPoolRepository;

    @Autowired
    private ReservationRepository reservationRepository;

    @Autowired
    private UserRepository userRepository;

    private Event perSeatEvent;
    private Event aggregatedEvent;
    private User user;
    private Seat availableSeat;

    @BeforeEach
    void setUp() {
        user = userRepository.save(User.builder()
            .email("buyer@test.com")
            .name("Test Buyer")
            .token("buyer-token-456")
            .build());

        perSeatEvent = eventRepository.save(Event.builder()
            .name("Broadway Show")
            .venue("Grand Theater")
            .eventDate(LocalDateTime.now().plusDays(30))
            .status(EventStatus.ACTIVE)
            .inventoryStrategy("PER_SEAT")
            .holdDurationSeconds(180)
            .build());

        availableSeat = seatRepository.save(Seat.builder()
            .event(perSeatEvent)
            .label("A1")
            .section("Orchestra")
            .rowName("A")
            .seatNumber(1)
            .tier("VIP")
            .price(new BigDecimal("200.00"))
            .status(SeatStatus.AVAILABLE)
            .build());

        aggregatedEvent = eventRepository.save(Event.builder()
            .name("Music Festival")
            .venue("Outdoor Arena")
            .eventDate(LocalDateTime.now().plusDays(60))
            .status(EventStatus.ACTIVE)
            .inventoryStrategy("AGGREGATED")
            .holdDurationSeconds(180)
            .build());

        inventoryPoolRepository.save(InventoryPool.builder()
            .event(aggregatedEvent)
            .tier("General Admission")
            .totalQuantity(1000)
            .availableQuantity(500)
            .price(new BigDecimal("80.00"))
            .build());
    }

    @Test
    void shouldHoldPerSeatSuccessfully() {
        HoldSeatRequest request = HoldSeatRequest.builder()
            .eventId(perSeatEvent.getId())
            .seatId(availableSeat.getId())
            .token("buyer-token-456")
            .build();

        ReservationResponse response = reservationService.holdSeat(request);

        assertNotNull(response);
        assertEquals("HELD", response.getStatus());
        assertEquals(availableSeat.getId(), response.getSeatId());
        assertNotNull(response.getExpiresAt());

        // Verify seat is now HELD
        Seat heldSeat = seatRepository.findById(availableSeat.getId()).orElseThrow();
        assertEquals(SeatStatus.HELD, heldSeat.getStatus());
    }

    @Test
    void shouldThrowWhenSeatNotAvailable() {
        Seat heldSeat = seatRepository.save(Seat.builder()
            .event(perSeatEvent)
            .label("A2")
            .section("Orchestra")
            .tier("VIP")
            .price(new BigDecimal("200.00"))
            .status(SeatStatus.HELD)
            .build());

        HoldSeatRequest request = HoldSeatRequest.builder()
            .eventId(perSeatEvent.getId())
            .seatId(heldSeat.getId())
            .token("buyer-token-456")
            .build();

        assertThrows(SeatNotAvailableException.class, () -> reservationService.holdSeat(request));
    }

    @Test
    void shouldHoldAggregatedSuccessfully() {
        HoldSeatRequest request = HoldSeatRequest.builder()
            .eventId(aggregatedEvent.getId())
            .tier("General Admission")
            .quantity(3)
            .token("buyer-token-456")
            .build();

        ReservationResponse response = reservationService.holdSeat(request);

        assertNotNull(response);
        assertEquals("HELD", response.getStatus());
        assertEquals("General Admission", response.getTier());
        assertEquals(3, response.getQuantity());

        // Verify inventory decreased
        InventoryPool pool = inventoryPoolRepository
            .findByEventIdAndTier(aggregatedEvent.getId(), "General Admission").orElseThrow();
        assertEquals(497, pool.getAvailableQuantity()); // 500 - 3
    }

    @Test
    void shouldConfirmReservation() {
        HoldSeatRequest holdRequest = HoldSeatRequest.builder()
            .eventId(perSeatEvent.getId())
            .seatId(availableSeat.getId())
            .token("buyer-token-456")
            .build();

        ReservationResponse held = reservationService.holdSeat(holdRequest);
        ReservationResponse confirmed = reservationService.confirmReservation(held.getId(), "buyer-token-456");

        assertEquals("CONFIRMED", confirmed.getStatus());
        assertNotNull(confirmed.getHeldAt());

        Seat reservedSeat = seatRepository.findById(availableSeat.getId()).orElseThrow();
        assertEquals(SeatStatus.RESERVED, reservedSeat.getStatus());
    }

    @Test
    void shouldCancelReservation() {
        HoldSeatRequest holdRequest = HoldSeatRequest.builder()
            .eventId(perSeatEvent.getId())
            .seatId(availableSeat.getId())
            .token("buyer-token-456")
            .build();

        ReservationResponse held = reservationService.holdSeat(holdRequest);
        ReservationResponse cancelled = reservationService.cancelReservation(held.getId(), "buyer-token-456");

        assertEquals("CANCELLED", cancelled.getStatus());

        Seat releasedSeat = seatRepository.findById(availableSeat.getId()).orElseThrow();
        assertEquals(SeatStatus.AVAILABLE, releasedSeat.getStatus());
    }

    @Test
    void shouldRejectInvalidToken() {
        HoldSeatRequest request = HoldSeatRequest.builder()
            .eventId(perSeatEvent.getId())
            .seatId(availableSeat.getId())
            .token("invalid-token")
            .build();

        assertThrows(IllegalArgumentException.class, () -> reservationService.holdSeat(request));
    }

    @Test
    void shouldRejectExpiredReservationConfirmation() {
        // Create an already-expired reservation
        Reservation expiredReservation = reservationRepository.save(Reservation.builder()
            .user(user)
            .event(perSeatEvent)
            .seat(availableSeat)
            .status(ReservationStatus.HELD)
            .heldAt(LocalDateTime.now().minusMinutes(10))
            .expiresAt(LocalDateTime.now().minusMinutes(1))
            .build());

        assertThrows(SeatNotAvailableException.class,
            () -> reservationService.confirmReservation(expiredReservation.getId(), "buyer-token-456"));
    }
}
