package com.ticketing.service;

import com.ticketing.config.WebSocketConfig;
import com.ticketing.dto.*;
import com.ticketing.exception.SeatNotAvailableException;
import com.ticketing.model.*;
import com.ticketing.model.enums.EventStatus;
import com.ticketing.model.enums.ReservationStatus;
import com.ticketing.model.enums.SeatStatus;
import com.ticketing.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReservationService {

    private final EventRepository eventRepository;
    private final SeatRepository seatRepository;
    private final InventoryPoolRepository inventoryPoolRepository;
    private final ReservationRepository reservationRepository;
    private final AuditLogRepository auditLogRepository;
    private final TokenAuthService tokenAuthService;
    private final WaitingQueueService waitingQueueService;
    private final WebSocketConfig.SeatAvailabilityHandler seatAvailabilityHandler;

    // ---------------------------------------------------------------------------
    // SINGLE HOLD
    // ---------------------------------------------------------------------------

    @Retryable(
        retryFor = ObjectOptimisticLockingFailureException.class,
        maxAttempts = 4,
        backoff = @Backoff(delay = 50, multiplier = 2.0, maxDelay = 500)
    )
    @Transactional
    @CacheEvict(value = {"events", "eventDetails", "seats"}, allEntries = true)
    public ReservationResponse holdSeat(HoldSeatRequest request) {
        User user = tokenAuthService.authenticate(request.getToken());
        Event event = eventRepository.findById(request.getEventId())
            .orElseThrow(() -> new IllegalArgumentException("Event not found: " + request.getEventId()));

        if (event.getStatus() != EventStatus.ACTIVE) {
            throw new IllegalStateException("Event is not active for reservations");
        }

        Reservation reservation;
        try {
            if ("PER_SEAT".equalsIgnoreCase(event.getInventoryStrategy())) {
                reservation = holdPerSeat(event, user, request);
            } else if ("AGGREGATED".equalsIgnoreCase(event.getInventoryStrategy())) {
                reservation = holdAggregated(event, user, request);
            } else {
                throw new IllegalArgumentException("Unknown inventory strategy: " + event.getInventoryStrategy());
            }
        } catch (SeatNotAvailableException e) {
            // Add to waiting queue when inventory is exhausted
            int waitingPosition = waitingQueueService.enqueue(
                request.getEventId(),
                request.getTier() != null ? request.getTier() : "default",
                request.getToken(),
                request.getQuantity() != null ? request.getQuantity() : 1);
            log.info("Inventory exhausted for event {}. Added to waiting queue at position {}",
                request.getEventId(), waitingPosition);
            throw e;
        }

        auditLogRepository.save(AuditLog.builder()
            .eventId(event.getId())
            .reservationId(reservation.getId())
            .userId(user.getId())
            .action("HOLD")
            .details(String.format(
                "{\"strategy\":\"%s\",\"seatId\":%s,\"tier\":\"%s\",\"quantity\":%s,\"expiresAt\":\"%s\"}",
                event.getInventoryStrategy(),
                reservation.getSeat() != null ? reservation.getSeat().getId() : "null",
                reservation.getInventoryPool() != null ? reservation.getInventoryPool().getTier() : "null",
                reservation.getQuantity() != null ? reservation.getQuantity() : "null",
                reservation.getExpiresAt()))
            .build());

        // Broadcast availability update via WebSocket
        try {
            seatAvailabilityHandler.broadcastAvailability(event.getId());
        } catch (Exception e) {
            log.warn("Failed to broadcast WebSocket update: {}", e.getMessage());
        }

        return toResponse(reservation);
    }

    // ---------------------------------------------------------------------------
    // BULK HOLD
    // ---------------------------------------------------------------------------

    /**
     * Hold multiple seats/tickets in a single transaction.
     * Either ALL entries succeed or NONE do (atomic).
     */
    @Retryable(
        retryFor = ObjectOptimisticLockingFailureException.class,
        maxAttempts = 4,
        backoff = @Backoff(delay = 50, multiplier = 2.0, maxDelay = 500)
    )
    @Transactional
    @CacheEvict(value = {"events", "eventDetails", "seats"}, allEntries = true)
    public List<ReservationResponse> bulkHold(BulkHoldRequest request) {
        User user = tokenAuthService.authenticate(request.getToken());
        Event event = eventRepository.findById(request.getEventId())
            .orElseThrow(() -> new IllegalArgumentException("Event not found: " + request.getEventId()));

        if (event.getStatus() != EventStatus.ACTIVE) {
            throw new IllegalStateException("Event is not active for reservations");
        }

        List<Reservation> reservations = new ArrayList<>();
        List<ReservationResponse> responses = new ArrayList<>();

        for (BulkHoldRequest.HoldEntry entry : request.getEntries()) {
            HoldSeatRequest singleRequest = HoldSeatRequest.builder()
                .eventId(request.getEventId())
                .seatId(entry.getSeatId())
                .tier(entry.getTier())
                .quantity(entry.getQuantity())
                .token(request.getToken())
                .build();

            Reservation reservation;
            if ("PER_SEAT".equalsIgnoreCase(event.getInventoryStrategy())) {
                reservation = holdPerSeat(event, user, singleRequest);
            } else {
                reservation = holdAggregated(event, user, singleRequest);
            }
            reservations.add(reservation);
            responses.add(toResponse(reservation));
        }

        // Single audit log for the batch
        auditLogRepository.save(AuditLog.builder()
            .eventId(event.getId())
            .userId(user.getId())
            .action("BULK_HOLD")
            .details(String.format(
                "{\"count\":%d,\"reservationIds\":[%s]}",
                reservations.size(),
                reservations.stream().map(r -> String.valueOf(r.getId())).collect(Collectors.joining(","))))
            .build());

        // Broadcast availability update
        try {
            seatAvailabilityHandler.broadcastAvailability(event.getId());
        } catch (Exception e) {
            log.warn("Failed to broadcast WebSocket update: {}", e.getMessage());
        }

        log.info("Bulk hold: {} reservations created for event {}", reservations.size(), event.getId());
        return responses;
    }

    // ---------------------------------------------------------------------------
    // CONFIRM RESERVATION
    // ---------------------------------------------------------------------------

    @Transactional
    @CacheEvict(value = {"events", "eventDetails", "seats"}, allEntries = true)
    public ReservationResponse confirmReservation(Long reservationId, String token) {
        User user = tokenAuthService.authenticate(token);

        Reservation reservation = reservationRepository.findWithDetailsById(reservationId)
            .orElseThrow(() -> new IllegalArgumentException("Reservation not found: " + reservationId));

        if (!reservation.getUser().getId().equals(user.getId())) {
            throw new IllegalArgumentException("Reservation does not belong to this user");
        }

        if (reservation.getStatus() != ReservationStatus.HELD) {
            throw new IllegalStateException(
                "Reservation cannot be confirmed. Current status: " + reservation.getStatus());
        }

        if (reservation.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new SeatNotAvailableException("Reservation has expired");
        }

        reservation.setStatus(ReservationStatus.CONFIRMED);
        reservation.setConfirmedAt(LocalDateTime.now());
        reservationRepository.save(reservation);

        if (reservation.getSeat() != null) {
            reservation.getSeat().setStatus(SeatStatus.RESERVED);
            seatRepository.save(reservation.getSeat());
        }

        auditLogRepository.save(AuditLog.builder()
            .eventId(reservation.getEvent().getId())
            .reservationId(reservation.getId())
            .userId(user.getId())
            .action("CONFIRM")
            .details(String.format(
                "{\"seatId\":%s,\"quantity\":%s,\"confirmedAt\":\"%s\"}",
                reservation.getSeat() != null ? reservation.getSeat().getId() : "null",
                reservation.getQuantity() != null ? reservation.getQuantity() : "null",
                reservation.getConfirmedAt()))
            .build());

        // Notify waiting queue (inventory decreased)
        try {
            seatAvailabilityHandler.broadcastAvailability(reservation.getEvent().getId());
        } catch (Exception e) {
            log.warn("Failed to broadcast WebSocket update: {}", e.getMessage());
        }

        return toResponse(reservation);
    }

    // ---------------------------------------------------------------------------
    // CANCEL RESERVATION
    // ---------------------------------------------------------------------------

    @Transactional
    @CacheEvict(value = {"events", "eventDetails", "seats"}, allEntries = true)
    public ReservationResponse cancelReservation(Long reservationId, String token) {
        User user = tokenAuthService.authenticate(token);

        Reservation reservation = reservationRepository.findWithDetailsById(reservationId)
            .orElseThrow(() -> new IllegalArgumentException("Reservation not found: " + reservationId));

        if (!reservation.getUser().getId().equals(user.getId())) {
            throw new IllegalArgumentException("Reservation does not belong to this user");
        }

        if (reservation.getStatus() == ReservationStatus.CANCELLED) {
            throw new IllegalStateException("Reservation is already cancelled");
        }

        if (reservation.getStatus() == ReservationStatus.EXPIRED) {
            throw new IllegalStateException("Reservation has already expired");
        }

        if (reservation.getStatus() == ReservationStatus.CONFIRMED) {
            throw new IllegalStateException("Confirmed reservations cannot be cancelled through this endpoint. Use /refund instead.");
        }

        releaseInventory(reservation);
        reservation.setStatus(ReservationStatus.CANCELLED);
        reservationRepository.save(reservation);

        auditLogRepository.save(AuditLog.builder()
            .eventId(reservation.getEvent().getId())
            .reservationId(reservation.getId())
            .userId(user.getId())
            .action("CANCEL")
            .details(String.format(
                "{\"status\":\"%s\",\"seatId\":%s,\"quantity\":%s}",
                reservation.getStatus(),
                reservation.getSeat() != null ? reservation.getSeat().getId() : "null",
                reservation.getQuantity() != null ? reservation.getQuantity() : "null"))
            .build());

        // Broadcast availability update
        try {
            seatAvailabilityHandler.broadcastAvailability(reservation.getEvent().getId());
        } catch (Exception e) {
            log.warn("Failed to broadcast WebSocket update: {}", e.getMessage());
        }

        return toResponse(reservation);
    }

    // ---------------------------------------------------------------------------
    // REFUND FLOW (Phase 8)
    // ---------------------------------------------------------------------------

    /**
     * Refund a CONFIRMED reservation — releases the seat/inventory back to the pool.
     * <p>
     * Architecture Rationale: Confirmed reservations cannot be cancelled through the
     * regular cancel endpoint because that would allow users to bypass payment confirmation
     * checks. The refund endpoint is a separate flow that explicitly handles the reversal
     * of a completed transaction, with full audit trail.
     */
    @Transactional
    @CacheEvict(value = {"events", "eventDetails", "seats"}, allEntries = true)
    public ReservationResponse refundReservation(Long reservationId, String token) {
        User user = tokenAuthService.authenticate(token);

        Reservation reservation = reservationRepository.findWithDetailsById(reservationId)
            .orElseThrow(() -> new IllegalArgumentException("Reservation not found: " + reservationId));

        if (!reservation.getUser().getId().equals(user.getId())) {
            throw new IllegalArgumentException("Reservation does not belong to this user");
        }

        if (reservation.getStatus() != ReservationStatus.CONFIRMED) {
            throw new IllegalStateException(
                "Only CONFIRMED reservations can be refunded. Current status: " + reservation.getStatus());
        }

        releaseInventory(reservation);
        reservation.setStatus(ReservationStatus.CANCELLED);
        reservationRepository.save(reservation);

        auditLogRepository.save(AuditLog.builder()
            .eventId(reservation.getEvent().getId())
            .reservationId(reservation.getId())
            .userId(user.getId())
            .action("REFUND")
            .details(String.format(
                "{\"seatId\":%s,\"quantity\":%s,\"refundedAt\":\"%s\"}",
                reservation.getSeat() != null ? reservation.getSeat().getId() : "null",
                reservation.getQuantity() != null ? reservation.getQuantity() : "null",
                LocalDateTime.now()))
            .build());

        log.info("Refund processed: reservationId={}, eventId={}", reservationId, reservation.getEvent().getId());

        // Broadcast availability update
        try {
            seatAvailabilityHandler.broadcastAvailability(reservation.getEvent().getId());
        } catch (Exception e) {
            log.warn("Failed to broadcast WebSocket update: {}", e.getMessage());
        }

        return toResponse(reservation);
    }

    // ---------------------------------------------------------------------------
    // TWO-STAGE HOLD EXTENSION (Phase 8)
    // ---------------------------------------------------------------------------

    /**
     * Extend the hold on a reservation by the event's configured hold duration.
     * <p>
     * Two-stage Hold Flow:
     * 1. Initial hold: 180s (default) — user has this time to request an extension
     * 2. Extended hold: additional 180s — granted when user initiates payment auth
     * <p>
     * This prevents users from losing their cart during the payment flow while still
     * releasing inventory for users who abandon the checkout process.
     */
    @Transactional
    public ReservationResponse extendHold(Long reservationId, String token) {
        User user = tokenAuthService.authenticate(token);

        Reservation reservation = reservationRepository.findWithDetailsById(reservationId)
            .orElseThrow(() -> new IllegalArgumentException("Reservation not found: " + reservationId));

        if (!reservation.getUser().getId().equals(user.getId())) {
            throw new IllegalArgumentException("Reservation does not belong to this user");
        }

        if (reservation.getStatus() != ReservationStatus.HELD) {
            throw new IllegalStateException(
                "Only HELD reservations can be extended. Current status: " + reservation.getStatus());
        }

        if (reservation.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new SeatNotAvailableException("Reservation has already expired and cannot be extended");
        }

        // Extend by the event's configured hold duration
        int extendSeconds = reservation.getEvent().getHoldDurationSeconds();
        LocalDateTime newExpiry = reservation.getExpiresAt().plusSeconds(extendSeconds);
        reservation.setExpiresAt(newExpiry);
        reservationRepository.save(reservation);

        auditLogRepository.save(AuditLog.builder()
            .eventId(reservation.getEvent().getId())
            .reservationId(reservation.getId())
            .userId(user.getId())
            .action("EXTEND_HOLD")
            .details(String.format(
                "{\"previousExpiry\":\"%s\",\"newExpiry\":\"%s\"}",
                reservation.getExpiresAt().minusSeconds(extendSeconds), newExpiry))
            .build());

        log.info("Hold extended: reservationId={}, newExpiry={}", reservationId, newExpiry);
        return toResponse(reservation);
    }

    // ---------------------------------------------------------------------------
    // GET RESERVATION
    // ---------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public ReservationResponse getReservation(Long reservationId, String token) {
        User user = tokenAuthService.authenticate(token);

        Reservation reservation = reservationRepository.findWithDetailsById(reservationId)
            .orElseThrow(() -> new IllegalArgumentException("Reservation not found: " + reservationId));

        if (!reservation.getUser().getId().equals(user.getId())) {
            throw new IllegalArgumentException("Reservation does not belong to this user");
        }

        return toResponse(reservation);
    }

    // ---------------------------------------------------------------------------
    // WAITING QUEUE INFO
    // ---------------------------------------------------------------------------

    public int getWaitingQueuePosition(Long eventId, String tier, String token) {
        return waitingQueueService.getPosition(eventId, tier, token);
    }

    // ---------------------------------------------------------------------------
    // PRIVATE HELPERS
    // ---------------------------------------------------------------------------

    private Reservation holdPerSeat(Event event, User user, HoldSeatRequest request) {
        if (request.getSeatId() == null) {
            throw new IllegalArgumentException("Seat ID is required for per-seat events");
        }

        Seat seat = seatRepository.findById(request.getSeatId())
            .orElseThrow(() -> new IllegalArgumentException("Seat not found: " + request.getSeatId()));

        if (!seat.getEvent().getId().equals(event.getId())) {
            throw new IllegalArgumentException("Seat does not belong to the specified event");
        }

        if (seat.getStatus() != SeatStatus.AVAILABLE) {
            throw new SeatNotAvailableException(
                "Seat " + seat.getLabel() + " is not available (status: " + seat.getStatus() + ")");
        }

        seat.setStatus(SeatStatus.HELD);
        seatRepository.save(seat);

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expiresAt = now.plusSeconds(event.getHoldDurationSeconds());

        Reservation reservation = Reservation.builder()
            .user(user)
            .event(event)
            .seat(seat)
            .status(ReservationStatus.HELD)
            .heldAt(now)
            .expiresAt(expiresAt)
            .idempotencyKey(UUID.randomUUID().toString())
            .build();

        return reservationRepository.save(reservation);
    }

    private Reservation holdAggregated(Event event, User user, HoldSeatRequest request) {
        if (request.getTier() == null || request.getTier().isBlank()) {
            throw new IllegalArgumentException("Ticket tier is required for aggregated events");
        }

        int quantity = request.getQuantity() != null ? request.getQuantity() : 1;
        if (quantity <= 0) {
            throw new IllegalArgumentException("Quantity must be positive");
        }

        InventoryPool pool = inventoryPoolRepository.findByEventIdAndTier(event.getId(), request.getTier())
            .orElseThrow(() -> new IllegalArgumentException(
                "No inventory pool found for tier '" + request.getTier() + "'"));

        if (pool.getAvailableQuantity() < quantity) {
            throw new SeatNotAvailableException(
                "Not enough tickets available for tier '" + request.getTier()
                    + "'. Requested: " + quantity + ", Available: " + pool.getAvailableQuantity());
        }

        pool.setAvailableQuantity(pool.getAvailableQuantity() - quantity);
        inventoryPoolRepository.save(pool);

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expiresAt = now.plusSeconds(event.getHoldDurationSeconds());

        Reservation reservation = Reservation.builder()
            .user(user)
            .event(event)
            .inventoryPool(pool)
            .quantity(quantity)
            .status(ReservationStatus.HELD)
            .heldAt(now)
            .expiresAt(expiresAt)
            .idempotencyKey(UUID.randomUUID().toString())
            .build();

        return reservationRepository.save(reservation);
    }

    private void releaseInventory(Reservation reservation) {
        if (reservation.getSeat() != null) {
            Seat seat = reservation.getSeat();
            seat.setStatus(SeatStatus.AVAILABLE);
            seatRepository.save(seat);
        }
        if (reservation.getInventoryPool() != null) {
            InventoryPool pool = reservation.getInventoryPool();
            int quantity = reservation.getQuantity() != null ? reservation.getQuantity() : 1;
            pool.setAvailableQuantity(pool.getAvailableQuantity() + quantity);
            inventoryPoolRepository.save(pool);
        }
    }

    private ReservationResponse toResponse(Reservation reservation) {
        ReservationResponse.ReservationResponseBuilder builder = ReservationResponse.builder()
            .id(reservation.getId())
            .eventId(reservation.getEvent().getId())
            .eventName(reservation.getEvent().getName())
            .venue(reservation.getEvent().getVenue())
            .eventDate(reservation.getEvent().getEventDate())
            .userId(reservation.getUser().getId())
            .userEmail(reservation.getUser().getEmail())
            .status(reservation.getStatus().name())
            .heldAt(reservation.getHeldAt())
            .expiresAt(reservation.getExpiresAt())
            .confirmedAt(reservation.getConfirmedAt())
            .extendable(reservation.getStatus() == ReservationStatus.HELD
                && reservation.getExpiresAt().isAfter(LocalDateTime.now()));

        if (reservation.getSeat() != null) {
            Seat seat = reservation.getSeat();
            builder.seatId(seat.getId())
                .seatLabel(seat.getLabel())
                .section(seat.getSection())
                .rowName(seat.getRowName())
                .seatNumber(seat.getSeatNumber())
                .tier(seat.getTier())
                .price(seat.getPrice());
        }

        if (reservation.getInventoryPool() != null) {
            builder.tier(reservation.getInventoryPool().getTier())
                .price(reservation.getInventoryPool().getPrice())
                .quantity(reservation.getQuantity());
        }

        return builder.build();
    }
}
