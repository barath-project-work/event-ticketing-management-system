package com.ticketing.integration;

import com.ticketing.config.TestcontainersConfig;
import com.ticketing.dto.HoldSeatRequest;
import com.ticketing.dto.ReservationResponse;
import com.ticketing.exception.SeatNotAvailableException;
import com.ticketing.model.*;
import com.ticketing.model.enums.EventStatus;
import com.ticketing.model.enums.ReservationStatus;
import com.ticketing.model.enums.SeatStatus;
import com.ticketing.repository.*;
import com.ticketing.service.ReservationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.ContextConfiguration;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("integration-test")
@Testcontainers
@ContextConfiguration(classes = TestcontainersConfig.class)
class ReservationFlowIntegrationTest {

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

    @Autowired
    private AuditLogRepository auditLogRepository;

    private Event perSeatEvent;
    private Event aggregatedEvent;
    private User user;
    private Seat seat1;
    private Seat seat2;
    private Seat seat3;

    @BeforeEach
    void setUp() {
        auditLogRepository.deleteAll();
        reservationRepository.deleteAll();
        seatRepository.deleteAll();
        inventoryPoolRepository.deleteAll();
        eventRepository.deleteAll();
        userRepository.deleteAll();

        user = userRepository.save(User.builder()
            .email("integration@test.com")
            .name("Integration Test User")
            .token("integration-token-999")
            .build());

        perSeatEvent = eventRepository.save(Event.builder()
            .name("Integration Concert")
            .venue("Integration Arena")
            .eventDate(LocalDateTime.now().plusDays(30))
            .status(EventStatus.ACTIVE)
            .inventoryStrategy("PER_SEAT")
            .holdDurationSeconds(180)
            .build());

        seat1 = seatRepository.save(Seat.builder()
            .event(perSeatEvent).label("A1").section("Orchestra").rowName("A").seatNumber(1)
            .tier("VIP").price(new BigDecimal("250.00")).status(SeatStatus.AVAILABLE).build());

        seat2 = seatRepository.save(Seat.builder()
            .event(perSeatEvent).label("A2").section("Orchestra").rowName("A").seatNumber(2)
            .tier("VIP").price(new BigDecimal("250.00")).status(SeatStatus.AVAILABLE).build());

        seat3 = seatRepository.save(Seat.builder()
            .event(perSeatEvent).label("B1").section("Mezzanine").rowName("B").seatNumber(1)
            .tier("Standard").price(new BigDecimal("120.00")).status(SeatStatus.AVAILABLE).build());

        aggregatedEvent = eventRepository.save(Event.builder()
            .name("Integration Festival").venue("Integration Park")
            .eventDate(LocalDateTime.now().plusDays(60)).status(EventStatus.ACTIVE)
            .inventoryStrategy("AGGREGATED").holdDurationSeconds(180).build());

        inventoryPoolRepository.save(InventoryPool.builder()
            .event(aggregatedEvent).tier("General Admission")
            .totalQuantity(500).availableQuantity(500).price(new BigDecimal("75.00")).build());
    }

    @Test
    void shouldCompleteFullPerSeatLifecycle() {
        HoldSeatRequest holdRequest = HoldSeatRequest.builder()
            .eventId(perSeatEvent.getId()).seatId(seat1.getId()).token("integration-token-999").build();

        ReservationResponse held = reservationService.holdSeat(holdRequest);
        assertNotNull(held);
        assertEquals("HELD", held.getStatus());
        assertEquals(seat1.getId(), held.getSeatId());
        assertNotNull(held.getExpiresAt());

        Seat dbSeat = seatRepository.findById(seat1.getId()).orElseThrow();
        assertEquals(SeatStatus.HELD, dbSeat.getStatus());
        assertEquals(1, auditLogRepository.count());

        ReservationResponse confirmed = reservationService.confirmReservation(held.getId(), "integration-token-999");
        assertEquals("CONFIRMED", confirmed.getStatus());

        Seat reservedSeat = seatRepository.findById(seat1.getId()).orElseThrow();
        assertEquals(SeatStatus.RESERVED, reservedSeat.getStatus());

        Reservation dbReservation = reservationRepository.findById(held.getId()).orElseThrow();
        assertEquals(ReservationStatus.CONFIRMED, dbReservation.getStatus());
        assertEquals(2, auditLogRepository.count());
    }

    @Test
    void shouldCompleteFullAggregatedLifecycle() {
        HoldSeatRequest holdRequest = HoldSeatRequest.builder()
            .eventId(aggregatedEvent.getId()).tier("General Admission").quantity(3)
            .token("integration-token-999").build();

        ReservationResponse held = reservationService.holdSeat(holdRequest);
        assertNotNull(held);
        assertEquals("HELD", held.getStatus());
        assertEquals(3, held.getQuantity());

        InventoryPool pool = inventoryPoolRepository
            .findByEventIdAndTier(aggregatedEvent.getId(), "General Admission").orElseThrow();
        assertEquals(497, pool.getAvailableQuantity());

        ReservationResponse cancelled = reservationService.cancelReservation(held.getId(), "integration-token-999");
        assertEquals("CANCELLED", cancelled.getStatus());

        InventoryPool releasedPool = inventoryPoolRepository
            .findByEventIdAndTier(aggregatedEvent.getId(), "General Admission").orElseThrow();
        assertEquals(500, releasedPool.getAvailableQuantity());
    }

    @Test
    void shouldHandleMultipleUsersHoldingDifferentSeats() {
        User user2 = userRepository.save(User.builder()
            .email("user2@test.com").name("User Two").token("user2-token-111").build());

        HoldSeatRequest req1 = HoldSeatRequest.builder()
            .eventId(perSeatEvent.getId()).seatId(seat1.getId()).token("integration-token-999").build();
        reservationService.holdSeat(req1);

        HoldSeatRequest req2 = HoldSeatRequest.builder()
            .eventId(perSeatEvent.getId()).seatId(seat2.getId()).token("user2-token-111").build();
        reservationService.holdSeat(req2);

        HoldSeatRequest req3 = HoldSeatRequest.builder()
            .eventId(perSeatEvent.getId()).seatId(seat1.getId()).token("user2-token-111").build();
        assertThrows(SeatNotAvailableException.class, () -> reservationService.holdSeat(req3));

        assertEquals(SeatStatus.HELD, seatRepository.findById(seat1.getId()).orElseThrow().getStatus());
        assertEquals(SeatStatus.HELD, seatRepository.findById(seat2.getId()).orElseThrow().getStatus());
        assertEquals(SeatStatus.AVAILABLE, seatRepository.findById(seat3.getId()).orElseThrow().getStatus());
    }

    @Test
    void shouldRejectConfirmationOfExpiredReservation() {
        Reservation expiredReservation = reservationRepository.save(Reservation.builder()
            .user(user).event(perSeatEvent).seat(seat1).status(ReservationStatus.HELD)
            .heldAt(LocalDateTime.now().minusMinutes(10))
            .expiresAt(LocalDateTime.now().minusMinutes(1)).build());

        assertThrows(SeatNotAvailableException.class,
            () -> reservationService.confirmReservation(expiredReservation.getId(), "integration-token-999"));
    }

    @Test
    void shouldReturnReservationDetails() {
        HoldSeatRequest holdRequest = HoldSeatRequest.builder()
            .eventId(perSeatEvent.getId()).seatId(seat1.getId()).token("integration-token-999").build();

        ReservationResponse held = reservationService.holdSeat(holdRequest);
        ReservationResponse details = reservationService.getReservation(held.getId(), "integration-token-999");

        assertNotNull(details);
        assertEquals(held.getId(), details.getId());
        assertEquals("Integration Concert", details.getEventName());
        assertEquals("Integration Arena", details.getVenue());
        assertEquals("A1", details.getSeatLabel());
        assertEquals("VIP", details.getTier());
        assertEquals(0, new BigDecimal("250.00").compareTo(details.getPrice()));
    }

    @Test
    void shouldHandleInventoryExhaustion() {
        InventoryPool lowPool = inventoryPoolRepository.save(InventoryPool.builder()
            .event(aggregatedEvent).tier("Last Chance")
            .totalQuantity(1).availableQuantity(1).price(new BigDecimal("50.00")).build());

        HoldSeatRequest holdRequest = HoldSeatRequest.builder()
            .eventId(aggregatedEvent.getId()).tier("Last Chance").quantity(1)
            .token("integration-token-999").build();
        reservationService.holdSeat(holdRequest);

        HoldSeatRequest failRequest = HoldSeatRequest.builder()
            .eventId(aggregatedEvent.getId()).tier("Last Chance").quantity(1)
            .token("integration-token-999").build();
        assertThrows(SeatNotAvailableException.class, () -> reservationService.holdSeat(failRequest));
    }
}
