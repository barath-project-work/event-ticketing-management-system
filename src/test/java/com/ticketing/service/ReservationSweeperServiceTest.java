package com.ticketing.service;

import com.ticketing.model.*;
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
class ReservationSweeperServiceTest {

    @Autowired
    private ReservationSweeperService sweeperService;

    @Autowired
    private ReservationRepository reservationRepository;

    @Autowired
    private SeatRepository seatRepository;

    @Autowired
    private InventoryPoolRepository inventoryPoolRepository;

    @Autowired
    private EventRepository eventRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    private Event event;
    private User user;

    @BeforeEach
    void setUp() {
        event = eventRepository.save(Event.builder()
            .name("Test Event")
            .venue("Test Venue")
            .eventDate(LocalDateTime.now().plusDays(30))
            .status(com.ticketing.model.enums.EventStatus.ACTIVE)
            .inventoryStrategy("PER_SEAT")
            .holdDurationSeconds(180)
            .build());

        user = userRepository.save(User.builder()
            .email("test@example.com")
            .name("Test User")
            .token("test-token-123")
            .build());
    }

    @Test
    void shouldExpireStalePerSeatReservation() {
        // Create an available seat
        Seat seat = seatRepository.save(Seat.builder()
            .event(event)
            .label("A1")
            .section("Orchestra")
            .rowName("A")
            .seatNumber(1)
            .tier("VIP")
            .price(new BigDecimal("150.00"))
            .status(SeatStatus.HELD)
            .build());

        // Create a stale held reservation (expired 5 minutes ago)
        Reservation reservation = reservationRepository.save(Reservation.builder()
            .user(user)
            .event(event)
            .seat(seat)
            .status(ReservationStatus.HELD)
            .heldAt(LocalDateTime.now().minusMinutes(10))
            .expiresAt(LocalDateTime.now().minusMinutes(5))
            .build());

        // Run the sweeper
        sweeperService.expireStaleHolds();

        // Verify reservation is expired
        Reservation expired = reservationRepository.findById(reservation.getId()).orElseThrow();
        assertEquals(ReservationStatus.EXPIRED, expired.getStatus());

        // Verify seat is available again
        Seat releasedSeat = seatRepository.findById(seat.getId()).orElseThrow();
        assertEquals(SeatStatus.AVAILABLE, releasedSeat.getStatus());

        // Verify audit log was created
        assertEquals(1, auditLogRepository.count());
    }

    @Test
    void shouldExpireStaleAggregatedReservation() {
        // Create a new event with aggregated strategy
        Event gaEvent = eventRepository.save(Event.builder()
            .name("GA Festival")
            .venue("Main Stage")
            .eventDate(LocalDateTime.now().plusDays(30))
            .status(com.ticketing.model.enums.EventStatus.ACTIVE)
            .inventoryStrategy("AGGREGATED")
            .holdDurationSeconds(180)
            .build());

        // Create an inventory pool with some availability
        InventoryPool pool = inventoryPoolRepository.save(InventoryPool.builder()
            .event(gaEvent)
            .tier("General Admission")
            .totalQuantity(100)
            .availableQuantity(95)
            .price(new BigDecimal("50.00"))
            .build());

        // Create a stale held reservation for 2 tickets
        Reservation reservation = reservationRepository.save(Reservation.builder()
            .user(user)
            .event(gaEvent)
            .inventoryPool(pool)
            .quantity(2)
            .status(ReservationStatus.HELD)
            .heldAt(LocalDateTime.now().minusMinutes(10))
            .expiresAt(LocalDateTime.now().minusMinutes(5))
            .build());

        // Run the sweeper
        sweeperService.expireStaleHolds();

        // Verify reservation is expired
        Reservation expired = reservationRepository.findById(reservation.getId()).orElseThrow();
        assertEquals(ReservationStatus.EXPIRED, expired.getStatus());

        // Verify inventory was released (95 + 2 = 97)
        InventoryPool releasedPool = inventoryPoolRepository.findById(pool.getId()).orElseThrow();
        assertEquals(97, releasedPool.getAvailableQuantity());

        // Verify audit log was created
        assertEquals(1, auditLogRepository.count());
    }

    @Test
    void shouldNotExpireActiveHolds() {
        // Create a seat
        Seat seat = seatRepository.save(Seat.builder()
            .event(event)
            .label("B2")
            .tier("Standard")
            .price(new BigDecimal("75.00"))
            .status(SeatStatus.HELD)
            .build());

        // Create a reservation that hasn't expired yet
        reservationRepository.save(Reservation.builder()
            .user(user)
            .event(event)
            .seat(seat)
            .status(ReservationStatus.HELD)
            .heldAt(LocalDateTime.now())
            .expiresAt(LocalDateTime.now().plusMinutes(3))
            .build());

        // Run the sweeper
        sweeperService.expireStaleHolds();

        // Verify seat is still HELD (not released)
        Seat stillHeld = seatRepository.findById(seat.getId()).orElseThrow();
        assertEquals(SeatStatus.HELD, stillHeld.getStatus());

        // Verify no audit log was created
        assertEquals(0, auditLogRepository.count());
    }

    @Test
    void shouldHandleEmptyStaleReservations() {
        // Run sweeper with no stale holds
        sweeperService.expireStaleHolds();

        // Verify no audit logs created
        assertEquals(0, auditLogRepository.count());
    }
}
