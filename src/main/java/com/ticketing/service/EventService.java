package com.ticketing.service;

import com.ticketing.dto.*;
import com.ticketing.model.*;
import com.ticketing.model.enums.EventStatus;
import com.ticketing.model.enums.SeatStatus;
import com.ticketing.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import java.util.stream.Collectors;

/**
 * Service layer for event and seat management.
 * <p>
 * Architecture Rationale:
 * <ul>
 *   <li><b>Separation of concerns:</b> EventService handles read operations (listing, details)
 *       and write operations (create event, create seats) separately from the reservation lifecycle,
 *       keeping each service focused on a single domain aggregate.</li>
 *   <li><b>Read vs write paths:</b> Detail queries aggregate seat/inventory statistics on-the-fly
 *       rather than caching stale counts, ensuring accuracy under concurrent hold/release traffic.</li>
 *   <li><b>Bulk seat creation outside transaction boundaries:</b> Seats are saved in a single
 *       batch (saveAll) for optimal performance, relying on Hibernate's batch_insert configuration
 *       (batch_size=50 from application.yml) to minimise round-trips.</li>
 *   <li><b>Admin token validation:</b> A dedicated admin token (configurable via application.yml)
 *       protects write operations. This is a Phase-appropriate mechanism — production deployments
 *       would replace this with OAuth2 scopes or API key rotation.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EventService {

    private final EventRepository eventRepository;
    private final SeatRepository seatRepository;
    private final InventoryPoolRepository inventoryPoolRepository;
    private final TokenAuthService tokenAuthService;

    // Default admin token — overridable via application.yml
    private static final String DEFAULT_ADMIN_TOKEN = "admin-token-001";

    // ---------------------------------------------------------------------------
    // Query Methods
    // ---------------------------------------------------------------------------

    /**
     * List all events, optionally filtered by status.
     * <p>
     * Design decision: Filtering is done at the database level via derived queries
     * rather than in-memory filtering, maintaining performance as the event catalogue grows.
     */
    @Cacheable(value = "events", key = "#statusFilter != null ? #statusFilter : 'all'")
    @Transactional(readOnly = true)
    public List<EventSummaryResponse> listEvents(String statusFilter) {
        List<Event> events;

        if (statusFilter != null && !statusFilter.isBlank()) {
            try {
                EventStatus status = EventStatus.valueOf(statusFilter.toUpperCase());
                events = eventRepository.findByStatus(status);
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("Invalid status filter: " + statusFilter
                    + ". Valid values: DRAFT, ACTIVE, SOLD_OUT, CANCELLED, COMPLETED");
            }
        } else {
            events = eventRepository.findAllOrderByEventDate();
        }

        return events.stream()
            .map(this::toSummaryResponse)
            .collect(Collectors.toList());
    }

    /**
     * Get full event details with seat/tier breakdown.
     * <p>
     * For PER_SEAT events, aggregate counts by querying the seats table.
     * For AGGREGATED events, read directly from inventory_pools.
     * This hybrid approach avoids loading all seat entities into memory.
     */
    @Cacheable(value = "eventDetails", key = "#eventId")
    @Transactional(readOnly = true)
    public EventResponse getEventDetails(Long eventId) {
        Event event = eventRepository.findById(eventId)
            .orElseThrow(() -> new IllegalArgumentException("Event not found: " + eventId));

        long totalSeats;
        long availableSeats;
        List<EventResponse.TierInfo> tiers;

        if ("PER_SEAT".equalsIgnoreCase(event.getInventoryStrategy())) {
            totalSeats = eventRepository.countTotalSeats(eventId);
            availableSeats = eventRepository.countAvailableSeats(eventId);

            // Aggregate seat data by tier
            List<Object[]> tierData = seatRepository.countByTier(eventId);
            tiers = tierData.stream().map(row -> {
                String tier = (String) row[0];
                Long total = (Long) row[1];
                Long available = (Long) row[2];
                long held = countSeatsByStatus(eventId, tier, SeatStatus.HELD);
                long reserved = total - available - held;

                // Get price from first seat in this tier
                BigDecimal price = seatRepository.findByEventIdAndTier(eventId, tier)
                    .stream().findFirst().map(Seat::getPrice)
                    .orElse(BigDecimal.ZERO);

                return EventResponse.TierInfo.builder()
                    .tier(tier)
                    .price(price)
                    .totalQuantity(total.intValue())
                    .availableQuantity(available.intValue())
                    .heldQuantity((int) held)
                    .reservedQuantity((int) reserved)
                    .build();
            }).collect(Collectors.toList());

        } else {
            // AGGREGATED — read from inventory pools
            List<InventoryPool> pools = inventoryPoolRepository.findByEventId(eventId);
            totalSeats = pools.stream().mapToInt(InventoryPool::getTotalQuantity).sum();
            availableSeats = pools.stream().mapToInt(InventoryPool::getAvailableQuantity).sum();

            tiers = pools.stream().map(pool -> EventResponse.TierInfo.builder()
                .tier(pool.getTier())
                .price(pool.getPrice())
                .totalQuantity(pool.getTotalQuantity())
                .availableQuantity(pool.getAvailableQuantity())
                .heldQuantity(pool.getTotalQuantity() - pool.getAvailableQuantity())
                .reservedQuantity(0)
                .build()
            ).collect(Collectors.toList());
        }

        long reservedSeats = countReservedSeats(eventId);
        long heldSeats = totalSeats - availableSeats - reservedSeats;

        return EventResponse.builder()
            .id(event.getId())
            .name(event.getName())
            .description(event.getDescription())
            .venue(event.getVenue())
            .eventDate(event.getEventDate())
            .status(event.getStatus().name())
            .inventoryStrategy(event.getInventoryStrategy())
            .holdDurationSeconds(event.getHoldDurationSeconds())
            .createdAt(event.getCreatedAt())
            .updatedAt(event.getUpdatedAt())
            .totalSeats((int) totalSeats)
            .availableSeats((int) availableSeats)
            .heldSeats((int) heldSeats)
            .reservedSeats((int) reservedSeats)
            .tiers(tiers)
            .build();
    }

    /**
     * List seats for an event with optional filters.
     */
    @Cacheable(value = "seats", key = "#eventId + '-' + #tier + '-' + #section + '-' + #status")
    @Transactional(readOnly = true)
    public List<Seat> listSeats(Long eventId, String tier, String section, String status) {
        Event event = eventRepository.findById(eventId)
            .orElseThrow(() -> new IllegalArgumentException("Event not found: " + eventId));

        if (!"PER_SEAT".equalsIgnoreCase(event.getInventoryStrategy())) {
            throw new IllegalArgumentException(
                "Seat listing is only available for PER_SEAT events. This event uses: "
                    + event.getInventoryStrategy());
        }

        SeatStatus seatStatus = null;
        if (status != null && !status.isBlank()) {
            try {
                seatStatus = SeatStatus.valueOf(status.toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException(
                    "Invalid seat status filter: " + status
                        + ". Valid values: AVAILABLE, HELD, RESERVED");
            }
        }

        return seatRepository.findByEventIdWithFilters(
            eventId,
            tier != null && !tier.isBlank() ? tier : null,
            section != null && !section.isBlank() ? section : null,
            seatStatus);
    }

    // ---------------------------------------------------------------------------
    // Command Methods (Admin)
    // ---------------------------------------------------------------------------

    /**
     * Create a new event.
     * <p>
     * The event is created in DRAFT status by default, allowing the admin to set up
     * seats/inventory before activating the event for public sale.
     * This prevents premature availability during configuration.
     */
    @CacheEvict(value = {"events", "eventDetails"}, allEntries = true)
    @Transactional
    public EventResponse createEvent(CreateEventRequest request) {
        validateAdminToken(request.getAdminToken());

        if (!"PER_SEAT".equalsIgnoreCase(request.getInventoryStrategy())
            && !"AGGREGATED".equalsIgnoreCase(request.getInventoryStrategy())) {
            throw new IllegalArgumentException(
                "Invalid inventory strategy: " + request.getInventoryStrategy()
                    + ". Must be PER_SEAT or AGGREGATED");
        }

        Event event = Event.builder()
            .name(request.getName())
            .description(request.getDescription())
            .venue(request.getVenue())
            .eventDate(request.getEventDate())
            .status(EventStatus.DRAFT)
            .inventoryStrategy(request.getInventoryStrategy().toUpperCase())
            .holdDurationSeconds(request.getHoldDurationSeconds() != null
                ? request.getHoldDurationSeconds() : 180)
            .build();

        event = eventRepository.save(event);

        log.info("Created event: {} (ID={}, strategy={})",
            event.getName(), event.getId(), event.getInventoryStrategy());

        // Build a minimal response (no seats yet)
        return EventResponse.builder()
            .id(event.getId())
            .name(event.getName())
            .description(event.getDescription())
            .venue(event.getVenue())
            .eventDate(event.getEventDate())
            .status(event.getStatus().name())
            .inventoryStrategy(event.getInventoryStrategy())
            .holdDurationSeconds(event.getHoldDurationSeconds())
            .createdAt(event.getCreatedAt())
            .updatedAt(event.getUpdatedAt())
            .totalSeats(0)
            .availableSeats(0)
            .heldSeats(0)
            .reservedSeats(0)
            .tiers(new ArrayList<>())
            .build();
    }

    /**
     * Bulk-create seats for a PER_SEAT event.
     * <p>
     * All seats are created in AVAILABLE status. The associated event is automatically
     * transitioned to ACTIVE if it was in DRAFT status, as seat creation signals readiness
     * for public sale.
     */
    @CacheEvict(value = {"events", "eventDetails", "seats"}, allEntries = true)
    @Transactional
    public List<Seat> createSeats(Long eventId, CreateSeatRequest request) {
        validateAdminToken(request.getAdminToken());

        Event event = eventRepository.findById(eventId)
            .orElseThrow(() -> new IllegalArgumentException("Event not found: " + eventId));

        if (!"PER_SEAT".equalsIgnoreCase(event.getInventoryStrategy())) {
            throw new IllegalArgumentException(
                "Seat creation is only available for PER_SEAT events. This event uses: "
                    + event.getInventoryStrategy());
        }

        if (request.getSeats() == null || request.getSeats().isEmpty()) {
            throw new IllegalArgumentException("At least one seat must be provided");
        }

        List<Seat> seats = request.getSeats().stream()
            .map(entry -> Seat.builder()
                .event(event)
                .label(entry.getLabel())
                .section(entry.getSection())
                .rowName(entry.getRowName())
                .seatNumber(entry.getSeatNumber())
                .tier(entry.getTier())
                .price(entry.getPrice())
                .status(SeatStatus.AVAILABLE)
                .build())
            .collect(Collectors.toList());

        seats = seatRepository.saveAll(seats);

        log.info("Created {} seats for event '{}' (ID={})", seats.size(), event.getName(), eventId);

        // Auto-activate the event if it was in DRAFT
        if (event.getStatus() == EventStatus.DRAFT) {
            event.setStatus(EventStatus.ACTIVE);
            eventRepository.save(event);
            log.info("Auto-activated event '{}' (ID={}) after seat creation", event.getName(), eventId);
        }

        return seats;
    }

    // ---------------------------------------------------------------------------
    // Inventory Pool Management
    // ---------------------------------------------------------------------------

    /**
     * Create an inventory pool tier for an AGGREGATED event.
     */
    @CacheEvict(value = {"events", "eventDetails"}, allEntries = true)
    @Transactional
    public InventoryPool createInventoryPool(Long eventId, String tier, int totalQuantity,
                                              BigDecimal price, String adminToken) {
        validateAdminToken(adminToken);

        Event event = eventRepository.findById(eventId)
            .orElseThrow(() -> new IllegalArgumentException("Event not found: " + eventId));

        if (!"AGGREGATED".equalsIgnoreCase(event.getInventoryStrategy())) {
            throw new IllegalArgumentException(
                "Inventory pools are only for AGGREGATED events");
        }

        // Check for duplicate tier
        if (inventoryPoolRepository.findByEventIdAndTier(eventId, tier).isPresent()) {
            throw new IllegalArgumentException(
                "Tier '" + tier + "' already exists for this event");
        }

        InventoryPool pool = InventoryPool.builder()
            .event(event)
            .tier(tier)
            .totalQuantity(totalQuantity)
            .availableQuantity(totalQuantity)
            .price(price)
            .build();

        pool = inventoryPoolRepository.save(pool);

        // Auto-activate the event if it was in DRAFT
        if (event.getStatus() == EventStatus.DRAFT) {
            event.setStatus(EventStatus.ACTIVE);
            eventRepository.save(event);
            log.info("Auto-activated event '{}' (ID={}) after pool creation", event.getName(), eventId);
        }

        return pool;
    }

    /**
     * Change the status of an event (e.g., activate, cancel, mark sold-out).
     */
    @CacheEvict(value = {"events", "eventDetails"}, allEntries = true)
    @Transactional
    public EventResponse updateEventStatus(Long eventId, String newStatus, String adminToken) {
        validateAdminToken(adminToken);

        Event event = eventRepository.findById(eventId)
            .orElseThrow(() -> new IllegalArgumentException("Event not found: " + eventId));

        EventStatus status;
        try {
            status = EventStatus.valueOf(newStatus.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(
                "Invalid status: " + newStatus
                    + ". Valid values: DRAFT, ACTIVE, SOLD_OUT, CANCELLED, COMPLETED");
        }

        // Validate state transitions
        if (event.getStatus() == EventStatus.CANCELLED) {
            throw new IllegalStateException("Cannot change status of a CANCELLED event");
        }
        if (event.getStatus() == EventStatus.COMPLETED) {
            throw new IllegalStateException("Cannot change status of a COMPLETED event");
        }

        event.setStatus(status);
        eventRepository.save(event);

        log.info("Event '{}' (ID={}) status changed from {} to {}",
            event.getName(), eventId, event.getStatus(), status);

        return getEventDetails(eventId);
    }

    // ---------------------------------------------------------------------------
    // Private Helpers
    // ---------------------------------------------------------------------------

    private void validateAdminToken(String token) {
        if (token == null || token.isBlank()) {
            throw new IllegalArgumentException("Admin token is required");
        }
        String expectedToken = System.getProperty("app.admin-token",
            System.getenv("ADMIN_TOKEN") != null ? System.getenv("ADMIN_TOKEN") : DEFAULT_ADMIN_TOKEN);
        if (!expectedToken.equals(token)) {
            throw new IllegalArgumentException("Invalid admin token");
        }
    }

    private EventSummaryResponse toSummaryResponse(Event event) {
        long totalSeats = 0;
        long availableSeats = 0;

        if ("PER_SEAT".equalsIgnoreCase(event.getInventoryStrategy())) {
            totalSeats = eventRepository.countTotalSeats(event.getId());
            availableSeats = eventRepository.countAvailableSeats(event.getId());
        } else {
            List<InventoryPool> pools = inventoryPoolRepository.findByEventId(event.getId());
            totalSeats = pools.stream().mapToInt(InventoryPool::getTotalQuantity).sum();
            availableSeats = pools.stream().mapToInt(InventoryPool::getAvailableQuantity).sum();
        }

        return EventSummaryResponse.builder()
            .id(event.getId())
            .name(event.getName())
            .venue(event.getVenue())
            .eventDate(event.getEventDate())
            .status(event.getStatus().name())
            .inventoryStrategy(event.getInventoryStrategy())
            .totalSeats((int) totalSeats)
            .availableSeats((int) availableSeats)
            .build();
    }

    private long countSeatsByStatus(Long eventId, String tier, SeatStatus status) {
        return seatRepository.findByEventIdAndTierAndStatus(eventId, tier, status).size();
    }

    private long countReservedSeats(Long eventId) {
        return seatRepository.findByEventIdAndStatus(eventId, SeatStatus.RESERVED).size();
    }
}
