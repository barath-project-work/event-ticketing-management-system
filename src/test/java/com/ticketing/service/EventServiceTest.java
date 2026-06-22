package com.ticketing.service;

import com.ticketing.dto.CreateEventRequest;
import com.ticketing.dto.CreateSeatRequest;
import com.ticketing.dto.EventResponse;
import com.ticketing.dto.EventSummaryResponse;
import com.ticketing.model.*;
import com.ticketing.model.enums.EventStatus;
import com.ticketing.model.enums.SeatStatus;
import com.ticketing.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@DisplayName("EventService Unit Tests")
class EventServiceTest {

    @Autowired
    private EventService eventService;

    @Autowired
    private EventRepository eventRepository;

    @Autowired
    private SeatRepository seatRepository;

    @Autowired
    private InventoryPoolRepository inventoryPoolRepository;

    @Autowired
    private UserRepository userRepository;

    private Event perSeatEvent;
    private Event aggregatedEvent;

    @BeforeEach
    void setUp() {
        // Clean all tables
        inventoryPoolRepository.deleteAll();
        seatRepository.deleteAll();
        eventRepository.deleteAll();
        userRepository.deleteAll();

        // Create a PER_SEAT event with seats
        perSeatEvent = eventRepository.save(Event.builder()
            .name("Test Broadway Show")
            .description("A test show")
            .venue("Test Theater")
            .eventDate(LocalDateTime.now().plusDays(30))
            .status(EventStatus.ACTIVE)
            .inventoryStrategy("PER_SEAT")
            .holdDurationSeconds(180)
            .build());

        // Create some seats
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

        seatRepository.save(Seat.builder()
            .event(perSeatEvent)
            .label("A2")
            .section("Orchestra")
            .rowName("A")
            .seatNumber(2)
            .tier("VIP")
            .price(new BigDecimal("299.00"))
            .status(SeatStatus.AVAILABLE)
            .build());

        seatRepository.save(Seat.builder()
            .event(perSeatEvent)
            .label("B1")
            .section("Mezzanine")
            .rowName("B")
            .seatNumber(1)
            .tier("Standard")
            .price(new BigDecimal("199.00"))
            .status(SeatStatus.AVAILABLE)
            .build());

        // Create an AGGREGATED event with pools
        aggregatedEvent = eventRepository.save(Event.builder()
            .name("Test Festival")
            .description("A test festival")
            .venue("Test Park")
            .eventDate(LocalDateTime.now().plusDays(60))
            .status(EventStatus.ACTIVE)
            .inventoryStrategy("AGGREGATED")
            .holdDurationSeconds(180)
            .build());

        inventoryPoolRepository.save(InventoryPool.builder()
            .event(aggregatedEvent)
            .tier("VIP")
            .totalQuantity(100)
            .availableQuantity(100)
            .price(new BigDecimal("450.00"))
            .build());

        inventoryPoolRepository.save(InventoryPool.builder()
            .event(aggregatedEvent)
            .tier("GA")
            .totalQuantity(500)
            .availableQuantity(500)
            .price(new BigDecimal("150.00"))
            .build());
    }

    // -----------------------------------------------------------------------
    // List Events Tests
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("Should list all events when no filter is provided")
    void shouldListAllEvents() {
        List<EventSummaryResponse> events = eventService.listEvents(null);
        assertEquals(2, events.size(),
            "Should return both events when no filter is applied");
    }

    @Test
    @DisplayName("Should filter events by status")
    void shouldFilterEventsByStatus() {
        List<EventSummaryResponse> events = eventService.listEvents("ACTIVE");
        assertEquals(2, events.size(),
            "Both events are ACTIVE, should match");

        // Create a draft event
        eventRepository.save(Event.builder()
            .name("Draft Event")
            .description("Not yet on sale")
            .venue("Test Venue")
            .eventDate(LocalDateTime.now().plusDays(90))
            .status(EventStatus.DRAFT)
            .inventoryStrategy("PER_SEAT")
            .holdDurationSeconds(180)
            .build());

        events = eventService.listEvents("DRAFT");
        assertEquals(1, events.size(),
            "Should return only the draft event");
        assertEquals("Draft Event", events.getFirst().getName());
    }

    @Test
    @DisplayName("Should throw on invalid status filter")
    void shouldThrowOnInvalidStatusFilter() {
        assertThrows(IllegalArgumentException.class,
            () -> eventService.listEvents("INVALID_STATUS"),
            "Invalid status should throw IllegalArgumentException");
    }

    // -----------------------------------------------------------------------
    // Event Details Tests
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("Should return per-seat event details with tier breakdown")
    void shouldReturnPerSeatEventDetails() {
        EventResponse response = eventService.getEventDetails(perSeatEvent.getId());

        assertNotNull(response);
        assertEquals("Test Broadway Show", response.getName());
        assertEquals("Test Theater", response.getVenue());
        assertEquals(3, response.getTotalSeats(),
            "Should have 3 total seats");
        assertEquals(3, response.getAvailableSeats(),
            "All seats should be available");

        assertNotNull(response.getTiers());
        assertFalse(response.getTiers().isEmpty(),
            "Should have tier breakdown");

        // Should have 2 tiers
        assertEquals(2, response.getTiers().size());
    }

    @Test
    @DisplayName("Should return aggregated event details with pool breakdown")
    void shouldReturnAggregatedEventDetails() {
        EventResponse response = eventService.getEventDetails(aggregatedEvent.getId());

        assertNotNull(response);
        assertEquals("Test Festival", response.getName());
        assertEquals("Test Park", response.getVenue());
        assertEquals(600, response.getTotalSeats(),
            "100 VIP + 500 GA = 600 total");
        assertEquals(600, response.getAvailableSeats(),
            "All tickets should be available");

        assertNotNull(response.getTiers());
        assertEquals(2, response.getTiers().size(),
            "Should have VIP and GA tiers");
    }

    @Test
    @DisplayName("Should throw on non-existent event")
    void shouldThrowOnNonExistentEvent() {
        assertThrows(IllegalArgumentException.class,
            () -> eventService.getEventDetails(999L),
            "Looking up a non-existent event should throw");
    }

    // -----------------------------------------------------------------------
    // List Seats Tests
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("Should list all seats for an event")
    void shouldListAllSeats() {
        List<Seat> seats = eventService.listSeats(perSeatEvent.getId(), null, null, null);
        assertEquals(3, seats.size(),
            "Should return all 3 seats");
    }

    @Test
    @DisplayName("Should filter seats by tier")
    void shouldFilterSeatsByTier() {
        List<Seat> seats = eventService.listSeats(perSeatEvent.getId(), "VIP", null, null);
        assertEquals(2, seats.size(),
            "Should return only VIP seats");
    }

    @Test
    @DisplayName("Should throw when listing seats for aggregated event")
    void shouldThrowWhenListingSeatsForAggregated() {
        assertThrows(IllegalArgumentException.class,
            () -> eventService.listSeats(aggregatedEvent.getId(), null, null, null),
            "Aggregated events should not support seat listing");
    }

    // -----------------------------------------------------------------------
    // Create Event Tests
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("Should create a new event in DRAFT status")
    void shouldCreateNewEvent() {
        CreateEventRequest request = CreateEventRequest.builder()
            .name("New Event")
            .description("A brand new event")
            .venue("New Venue")
            .eventDate(LocalDateTime.now().plusDays(45))
            .inventoryStrategy("PER_SEAT")
            .holdDurationSeconds(300)
            .adminToken("admin-token-001")
            .build();

        EventResponse response = eventService.createEvent(request);

        assertNotNull(response);
        assertNotNull(response.getId());
        assertEquals("New Event", response.getName());
        assertEquals("DRAFT", response.getStatus(),
            "New events should start in DRAFT status");
        assertEquals(300, response.getHoldDurationSeconds());
    }

    @Test
    @DisplayName("Should reject event creation with invalid admin token")
    void shouldRejectInvalidAdminToken() {
        CreateEventRequest request = CreateEventRequest.builder()
            .name("Unauthorized Event")
            .venue("Secret Venue")
            .eventDate(LocalDateTime.now().plusDays(30))
            .inventoryStrategy("PER_SEAT")
            .adminToken("wrong-token")
            .build();

        assertThrows(IllegalArgumentException.class,
            () -> eventService.createEvent(request),
            "Invalid admin token should be rejected");
    }

    @Test
    @DisplayName("Should reject event with invalid inventory strategy")
    void shouldRejectInvalidStrategy() {
        CreateEventRequest request = CreateEventRequest.builder()
            .name("Bad Event")
            .venue("Venue")
            .eventDate(LocalDateTime.now().plusDays(30))
            .inventoryStrategy("HYBRID")
            .adminToken("admin-token-001")
            .build();

        assertThrows(IllegalArgumentException.class,
            () -> eventService.createEvent(request),
            "Invalid inventory strategy should be rejected");
    }

    // -----------------------------------------------------------------------
    // Create Seats Tests
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("Should bulk-create seats and auto-activate draft event")
    void shouldCreateSeatsAndActivateEvent() {
        // Create a draft event first
        CreateEventRequest eventRequest = CreateEventRequest.builder()
            .name("New Show")
            .venue("New Theater")
            .eventDate(LocalDateTime.now().plusDays(30))
            .inventoryStrategy("PER_SEAT")
            .adminToken("admin-token-001")
            .build();

        EventResponse createdEvent = eventService.createEvent(eventRequest);
        assertNotNull(createdEvent.getId());

        // Now create seats
        CreateSeatRequest seatRequest = CreateSeatRequest.builder()
            .adminToken("admin-token-001")
            .seats(List.of(
                CreateSeatRequest.SeatEntry.builder()
                    .label("A1").section("Orch").rowName("A").seatNumber(1)
                    .tier("VIP").price(new BigDecimal("100.00")).build(),
                CreateSeatRequest.SeatEntry.builder()
                    .label("A2").section("Orch").rowName("A").seatNumber(2)
                    .tier("VIP").price(new BigDecimal("100.00")).build()
            ))
            .build();

        List<Seat> seats = eventService.createSeats(createdEvent.getId(), seatRequest);

        assertEquals(2, seats.size());
        assertEquals("A1", seats.get(0).getLabel());

        // Check event was auto-activated
        EventResponse updated = eventService.getEventDetails(createdEvent.getId());
        assertEquals("ACTIVE", updated.getStatus(),
            "Event should be auto-activated after seat creation");
    }

    @Test
    @DisplayName("Should reject seat creation for aggregated events")
    void shouldRejectSeatsForAggregated() {
        CreateSeatRequest request = CreateSeatRequest.builder()
            .adminToken("admin-token-001")
            .seats(List.of(
                CreateSeatRequest.SeatEntry.builder()
                    .label("A1").tier("VIP")
                    .price(new BigDecimal("100.00")).build()
            ))
            .build();

        assertThrows(IllegalArgumentException.class,
            () -> eventService.createSeats(aggregatedEvent.getId(), request),
            "Aggregated events should reject seat creation");
    }

    // -----------------------------------------------------------------------
    // Update Event Status Tests
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("Should update event status")
    void shouldUpdateEventStatus() {
        EventResponse response = eventService.updateEventStatus(
            perSeatEvent.getId(), "SOLD_OUT", "admin-token-001");

        assertEquals("SOLD_OUT", response.getStatus());
    }

    @Test
    @DisplayName("Should reject status update for cancelled event")
    void shouldRejectUpdateOnCancelled() {
        eventService.updateEventStatus(perSeatEvent.getId(), "CANCELLED", "admin-token-001");

        assertThrows(IllegalStateException.class,
            () -> eventService.updateEventStatus(perSeatEvent.getId(), "ACTIVE", "admin-token-001"),
            "Cannot reactivate a cancelled event");
    }

    // -----------------------------------------------------------------------
    // Inventory Pool Tests
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("Should create inventory pool and auto-activate draft event")
    void shouldCreateInventoryPool() {
        // Create a draft aggregated event
        CreateEventRequest request = CreateEventRequest.builder()
            .name("New Festival")
            .venue("New Park")
            .eventDate(LocalDateTime.now().plusDays(60))
            .inventoryStrategy("AGGREGATED")
            .adminToken("admin-token-001")
            .build();

        EventResponse createdEvent = eventService.createEvent(request);

        // Add a pool
        InventoryPool pool = eventService.createInventoryPool(
            createdEvent.getId(), "VIP", 200,
            new BigDecimal("500.00"), "admin-token-001");

        assertNotNull(pool);
        assertEquals("VIP", pool.getTier());
        assertEquals(200, pool.getTotalQuantity());
        assertEquals(200, pool.getAvailableQuantity());

        // Check auto-activation
        EventResponse updated = eventService.getEventDetails(createdEvent.getId());
        assertEquals("ACTIVE", updated.getStatus());
    }

    @Test
    @DisplayName("Should reject duplicate tier")
    void shouldRejectDuplicateTier() {
        assertThrows(IllegalArgumentException.class,
            () -> eventService.createInventoryPool(
                aggregatedEvent.getId(), "VIP", 100,
                new BigDecimal("400.00"), "admin-token-001"),
            "Duplicate tier should be rejected");
    }
}
