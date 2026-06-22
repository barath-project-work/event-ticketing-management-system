package com.ticketing.controller;

import com.ticketing.dto.EventResponse;
import com.ticketing.dto.EventSummaryResponse;
import com.ticketing.model.Seat;
import com.ticketing.service.EventService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Public API for browsing events and seats.
 * <p>
 * Architecture Rationale:
 * <ul>
 *   <li><b>Read-only endpoints:</b> This controller exposes only GET operations.
 *       All write operations (create event, create seats) are routed through
 *       {@link AdminController} which requires admin token authentication.</li>
 *   <li><b>Separation by domain:</b> Event/seat browsing is separated from the reservation
 *       lifecycle ({@link ReservationController}) to keep each controller focused on a
 *       single resource aggregate, following RESTful design principles.</li>
 *   <li><b>Query parameter filtering:</b> Status, tier, and section filters use query
 *       parameters rather than path variables, allowing optional composable filters
 *       without requiring URI restructuring.</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class EventController {

    private final EventService eventService;

    /**
     * List all events, optionally filtered by status.
     * <p>
     * Example: GET /api/events?status=ACTIVE
     */
    @GetMapping
    public ResponseEntity<List<EventSummaryResponse>> listEvents(
            @RequestParam(required = false) String status) {
        List<EventSummaryResponse> events = eventService.listEvents(status);
        return ResponseEntity.ok(events);
    }

    /**
     * Get full event details including seat/tier breakdown.
     * <p>
     * Example: GET /api/events/1
     */
    @GetMapping("/{id}")
    public ResponseEntity<EventResponse> getEventDetails(@PathVariable Long id) {
        EventResponse response = eventService.getEventDetails(id);
        return ResponseEntity.ok(response);
    }

    /**
     * List seats for an event with optional filters.
     * <p>
     * Examples:
     *   GET /api/events/1/seats
     *   GET /api/events/1/seats?tier=VIP
     *   GET /api/events/1/seats?status=AVAILABLE
     *   GET /api/events/1/seats?section=Orchestra&status=AVAILABLE
     */
    @GetMapping("/{id}/seats")
    public ResponseEntity<List<Seat>> listSeats(
            @PathVariable Long id,
            @RequestParam(required = false) String tier,
            @RequestParam(required = false) String section,
            @RequestParam(required = false) String status) {
        List<Seat> seats = eventService.listSeats(id, tier, section, status);
        return ResponseEntity.ok(seats);
    }
}
