package com.ticketing.controller;

import com.ticketing.dto.CreateEventRequest;
import com.ticketing.dto.CreateSeatRequest;
import com.ticketing.dto.EventResponse;
import com.ticketing.model.InventoryPool;
import com.ticketing.model.Seat;
import com.ticketing.service.EventService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

/**
 * Admin API for managing events, seats, and inventory pools.
 * <p>
 * Architecture Rationale:
 * <ul>
 *   <li><b>Dedicated admin namespace:</b> All admin operations are grouped under /api/admin/
 *       to clearly separate privileged operations from public browsing/reservation endpoints.
 *       This allows different security policies (rate limits, IP whitelisting, audit logging)
 *       to be applied at the path level in future phases.</li>
 *   <li><b>Token-based admin auth:</b> Admin operations use a configurable admin token
 *       (default: "admin-token-001") passed in the request body. This Phase-appropriate
 *       mechanism avoids cookie/session state while remaining simple to integrate into
 *       load-testing and CI pipelines.</li>
 *   <li><b>Bulk seat creation:</b> Seats are accepted as a batch array, letting clients
 *       define entire venue layouts in a single request. This avoids N+1 API calls when
 *       setting up a theatre with hundreds of seats.</li>
 *   <li><b>Auto-activation:</b> Creating seats or inventory pools on a DRAFT event
 *       automatically transitions it to ACTIVE, reducing manual steps during event setup.</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final EventService eventService;

    /**
     * Create a new event in DRAFT status.
     * <p>
     * After creation, use the seats or inventory-pools endpoints to configure
     * inventory, then use the status endpoint to activate the event.
     */
    @PostMapping("/events")
    public ResponseEntity<EventResponse> createEvent(@Valid @RequestBody CreateEventRequest request) {
        EventResponse response = eventService.createEvent(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Bulk-create seats for a PER_SEAT event.
     * <p>
     * Automatically activates the event if it was in DRAFT status.
     */
    @PostMapping("/events/{id}/seats")
    public ResponseEntity<List<Seat>> createSeats(
            @PathVariable Long id,
            @Valid @RequestBody CreateSeatRequest request) {
        List<Seat> seats = eventService.createSeats(id, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(seats);
    }

    /**
     * Create an inventory pool tier for an AGGREGATED event.
     * <p>
     * Automatically activates the event if it was in DRAFT status.
     */
    @PostMapping("/events/{id}/pools")
    public ResponseEntity<InventoryPool> createInventoryPool(
            @PathVariable Long id,
            @RequestParam String tier,
            @RequestParam int totalQuantity,
            @RequestParam BigDecimal price,
            @RequestParam String adminToken) {
        InventoryPool pool = eventService.createInventoryPool(
            id, tier, totalQuantity, price, adminToken);
        return ResponseEntity.status(HttpStatus.CREATED).body(pool);
    }

    /**
     * Update the status of an event.
     * <p>
     * Example actions: activate a draft, cancel an active event, mark as sold-out.
     */
    @PutMapping("/events/{id}/status")
    public ResponseEntity<EventResponse> updateEventStatus(
            @PathVariable Long id,
            @RequestParam String status,
            @RequestParam String adminToken) {
        EventResponse response = eventService.updateEventStatus(id, status, adminToken);
        return ResponseEntity.ok(response);
    }
}
