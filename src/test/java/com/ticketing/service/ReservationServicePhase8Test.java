package com.ticketing.service;

import com.ticketing.dto.BulkHoldRequest;
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
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ReservationServicePhase8Test {

    @Autowired
    private ReservationService reservationService;

    @Autowired
    private WaitingQueueService waitingQueueService;

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
    private Seat seat1;
    private Seat seat2;

    @BeforeEach
    void setUp() {
        user = userRepository.save(User.builder()
            .email("phase8@test.com")
            .name("Phase 8 Buyer")
            .token("phase8-token-789")
            .build());

        perSeatEvent = eventRepository.save(Event.builder()
            .name("Phase 8 Event")
            .venue("Test Venue")
            .eventDate(LocalDateTime.now().plusDays(30))
            .status(EventStatus.ACTIVE)
            .inventoryStrategy("PER_SEAT")
            .holdDurationSeconds(180)
            .build());

        seat1 = seatRepository.save(Seat.builder()
            .event(perSeatEvent)
            .label("B1")
            .section("Balcony")
            .rowName("B")
            .seatNumber(1)
            .tier("Standard")
            .price(new BigDecimal("100.00"))
            .status(SeatStatus.AVAILABLE)
            .build());

        seat2 = seatRepository.save(Seat.builder()
            .event(perSeatEvent)
            .label("B2")
            .section("Balcony")
            .rowName("B")
            .seatNumber(2)
            .tier("Standard")
            .price(new BigDecimal("100.00"))
            .status(SeatStatus.AVAILABLE)
            .build());

        aggregatedEvent = eventRepository.save(Event.builder()
            .name("Festival Phase 8")
            .venue("Outdoor")
            .eventDate(LocalDateTime.now().plusDays(60))
            .status(EventStatus.ACTIVE)
            .inventoryStrategy("AGGREGATED")
            .holdDurationSeconds(180)
            .build());

        inventoryPoolRepository.save(InventoryPool.builder()
            .event(aggregatedEvent)
            .tier("GA")
            .totalQuantity(100)
            .availableQuantity(50)
            .price(new BigDecimal("80.00"))
            .build());
    }

    // ---------------------------------------------------------------------------
    // BULK HOLD TESTS
    // ---------------------------------------------------------------------------

    @Test
    void shouldBulkHoldMultipleSeats() {
        BulkHoldRequest request = BulkHoldRequest.builder()
            .eventId(perSeatEvent.getId())
            .token("phase8-token-789")
            .entries(List.of(
                BulkHoldRequest.HoldEntry.builder().seatId(seat1.getId()).build(),
                BulkHoldRequest.HoldEntry.builder().seatId(seat2.getId()).build()
            ))
            .build();

        List<ReservationResponse> responses = reservationService.bulkHold(request);

        assertEquals(2, responses.size());
        assertTrue(responses.stream().allMatch(r -> "HELD".equals(r.getStatus())));

        // Verify both seats are now HELD
        assertEquals(SeatStatus.HELD, seatRepository.findById(seat1.getId()).orElseThrow().getStatus());
        assertEquals(SeatStatus.HELD, seatRepository.findById(seat2.getId()).orElseThrow().getStatus());
    }

    @Test
    void shouldBulkHoldAggregatedTickets() {
        BulkHoldRequest request = BulkHoldRequest.builder()
            .eventId(aggregatedEvent.getId())
            .token("phase8-token-789")
            .entries(List.of(
                BulkHoldRequest.HoldEntry.builder().tier("GA").quantity(2).build(),
                BulkHoldRequest.HoldEntry.builder().tier("GA").quantity(3).build()
            ))
            .build();

        List<ReservationResponse> responses = reservationService.bulkHold(request);

        assertEquals(2, responses.size());
        assertTrue(responses.stream().allMatch(r -> "HELD".equals(r.getStatus())));

        // Verify inventory decreased by 5 total
        InventoryPool pool = inventoryPoolRepository
            .findByEventIdAndTier(aggregatedEvent.getId(), "GA").orElseThrow();
        assertEquals(45, pool.getAvailableQuantity()); // 50 - 5
    }

    @Test
    void shouldRejectBulkHoldWithInvalidToken() {
        BulkHoldRequest request = BulkHoldRequest.builder()
            .eventId(perSeatEvent.getId())
            .token("invalid-token")
            .entries(List.of(
                BulkHoldRequest.HoldEntry.builder().seatId(seat1.getId()).build()
            ))
            .build();

        assertThrows(IllegalArgumentException.class, () -> reservationService.bulkHold(request));
    }

    @Test
    void shouldRejectBulkHoldForNonExistentEvent() {
        BulkHoldRequest request = BulkHoldRequest.builder()
            .eventId(99999L)
            .token("phase8-token-789")
            .entries(List.of(
                BulkHoldRequest.HoldEntry.builder().seatId(1L).build()
            ))
            .build();

        assertThrows(IllegalArgumentException.class, () -> reservationService.bulkHold(request));
    }

    // ---------------------------------------------------------------------------
    // REFUND TESTS
    // ---------------------------------------------------------------------------

    @Test
    void shouldRefundConfirmedReservation() {
        // Create and confirm a reservation
        HoldSeatRequest holdRequest = HoldSeatRequest.builder()
            .eventId(perSeatEvent.getId())
            .seatId(seat1.getId())
            .token("phase8-token-789")
            .build();

        ReservationResponse held = reservationService.holdSeat(holdRequest);
        ReservationResponse confirmed = reservationService.confirmReservation(held.getId(), "phase8-token-789");
        assertEquals("CONFIRMED", confirmed.getStatus());

        // Now refund it
        ReservationResponse refunded = reservationService.refundReservation(confirmed.getId(), "phase8-token-789");
        assertEquals("CANCELLED", refunded.getStatus());

        // Verify seat is AVAILABLE again
        assertEquals(SeatStatus.AVAILABLE, seatRepository.findById(seat1.getId()).orElseThrow().getStatus());
    }

    @Test
    void shouldRejectRefundForNonConfirmedReservation() {
        HoldSeatRequest holdRequest = HoldSeatRequest.builder()
            .eventId(perSeatEvent.getId())
            .seatId(seat1.getId())
            .token("phase8-token-789")
            .build();

        ReservationResponse held = reservationService.holdSeat(holdRequest);

        assertThrows(IllegalStateException.class,
            () -> reservationService.refundReservation(held.getId(), "phase8-token-789"));
    }

    @Test
    void shouldRejectRefundForWrongUser() {
        HoldSeatRequest holdRequest = HoldSeatRequest.builder()
            .eventId(perSeatEvent.getId())
            .seatId(seat1.getId())
            .token("phase8-token-789")
            .build();

        ReservationResponse held = reservationService.holdSeat(holdRequest);
        ReservationResponse confirmed = reservationService.confirmReservation(held.getId(), "phase8-token-789");

        assertThrows(IllegalArgumentException.class,
            () -> reservationService.refundReservation(confirmed.getId(), "wrong-user-token"));
    }

    @Test
    void shouldRejectRefundForNonExistentReservation() {
        assertThrows(IllegalArgumentException.class,
            () -> reservationService.refundReservation(99999L, "phase8-token-789"));
    }

    // ---------------------------------------------------------------------------
    // EXTEND HOLD TESTS
    // ---------------------------------------------------------------------------

    @Test
    void shouldExtendHoldOnActiveReservation() {
        HoldSeatRequest holdRequest = HoldSeatRequest.builder()
            .eventId(perSeatEvent.getId())
            .seatId(seat1.getId())
            .token("phase8-token-789")
            .build();

        ReservationResponse held = reservationService.holdSeat(holdRequest);
        LocalDateTime originalExpiry = held.getExpiresAt();

        // Wait a tiny bit to ensure time difference
        ReservationResponse extended = reservationService.extendHold(held.getId(), "phase8-token-789");

        assertEquals("HELD", extended.getStatus());
        assertTrue(extended.getExpiresAt().isAfter(originalExpiry),
            "Extended expiry should be after original expiry");
    }

    @Test
    void shouldRejectExtendOnConfirmedReservation() {
        HoldSeatRequest holdRequest = HoldSeatRequest.builder()
            .eventId(perSeatEvent.getId())
            .seatId(seat1.getId())
            .token("phase8-token-789")
            .build();

        ReservationResponse held = reservationService.holdSeat(holdRequest);
        ReservationResponse confirmed = reservationService.confirmReservation(held.getId(), "phase8-token-789");

        assertThrows(IllegalStateException.class,
            () -> reservationService.extendHold(confirmed.getId(), "phase8-token-789"));
    }

    @Test
    void shouldRejectExtendForWrongUser() {
        HoldSeatRequest holdRequest = HoldSeatRequest.builder()
            .eventId(perSeatEvent.getId())
            .seatId(seat1.getId())
            .token("phase8-token-789")
            .build();

        ReservationResponse held = reservationService.holdSeat(holdRequest);

        assertThrows(IllegalArgumentException.class,
            () -> reservationService.extendHold(held.getId(), "wrong-user-token"));
    }

    // ---------------------------------------------------------------------------
    // CONFIRMED CANCEL ROUTING TEST
    // ---------------------------------------------------------------------------

    @Test
    void shouldRejectCancelForConfirmedReservation() {
        HoldSeatRequest holdRequest = HoldSeatRequest.builder()
            .eventId(perSeatEvent.getId())
            .seatId(seat1.getId())
            .token("phase8-token-789")
            .build();

        ReservationResponse held = reservationService.holdSeat(holdRequest);
        ReservationResponse confirmed = reservationService.confirmReservation(held.getId(), "phase8-token-789");
        assertEquals("CONFIRMED", confirmed.getStatus());

        IllegalStateException ex = assertThrows(IllegalStateException.class,
            () -> reservationService.cancelReservation(confirmed.getId(), "phase8-token-789"));
        assertTrue(ex.getMessage().contains("refund"),
            "Should direct user to use /refund endpoint instead");
    }

    // ---------------------------------------------------------------------------
    // WAITING QUEUE TESTS
    // ---------------------------------------------------------------------------

    @Test
    void shouldReturnWaitingQueuePosition() {
        // Enqueue directly via waiting queue service
        int position = waitingQueueService.enqueue(
            perSeatEvent.getId(), "Standard", "phase8-token-789", 1);
        assertEquals(1, position, "First enqueued should be at position 1");

        int retrievedPosition = reservationService.getWaitingQueuePosition(
            perSeatEvent.getId(), "Standard", "phase8-token-789");
        assertTrue(retrievedPosition >= 1, "Waiting queue position should be positive");
    }

    @Test
    void shouldHandleMultipleWaitingQueueEntries() {
        int pos1 = waitingQueueService.enqueue(perSeatEvent.getId(), "VIP", "token-alpha", 1);
        int pos2 = waitingQueueService.enqueue(perSeatEvent.getId(), "VIP", "token-beta", 2);

        assertEquals(1, pos1);
        assertEquals(2, pos2);
        assertTrue(pos2 > pos1, "Second enqueue should have higher position");
    }

    @Test
    void shouldReturnCorrectPositionInQueue() {
        waitingQueueService.enqueue(perSeatEvent.getId(), "GA", "token-one", 1);
        waitingQueueService.enqueue(perSeatEvent.getId(), "GA", "token-two", 1);
        waitingQueueService.enqueue(perSeatEvent.getId(), "GA", "token-three", 1);

        assertEquals(2, waitingQueueService.getPosition(perSeatEvent.getId(), "GA", "token-two"),
            "Second entry should be at position 2");
        assertEquals(3, waitingQueueService.getPosition(perSeatEvent.getId(), "GA", "token-three"),
            "Third entry should be at position 3");
    }

    @Test
    void shouldReturnMinusOneForNonExistentToken() {
        int position = waitingQueueService.getPosition(perSeatEvent.getId(), "GA", "non-existent");
        assertEquals(-1, position, "Non-existent token should return -1");
    }
}
