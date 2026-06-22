package com.ticketing.service;

import com.ticketing.model.AuditLog;
import com.ticketing.model.InventoryPool;
import com.ticketing.model.Reservation;
import com.ticketing.model.Seat;
import com.ticketing.model.enums.ReservationStatus;
import com.ticketing.model.enums.SeatStatus;
import com.ticketing.repository.AuditLogRepository;
import com.ticketing.repository.InventoryPoolRepository;
import com.ticketing.repository.ReservationRepository;
import com.ticketing.repository.SeatRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReservationSweeperService {

    private final ReservationRepository reservationRepository;
    private final SeatRepository seatRepository;
    private final InventoryPoolRepository inventoryPoolRepository;
    private final AuditLogRepository auditLogRepository;

    @Scheduled(fixedRateString = "${reservation.sweeper.fixed-rate-ms:30000}")
    @Transactional
    public void expireStaleHolds() {
        LocalDateTime now = LocalDateTime.now();
        List<Reservation> staleReservations = reservationRepository
            .findExpiredHoldsWithDetails(ReservationStatus.HELD, now);

        if (staleReservations.isEmpty()) {
            return;
        }

        log.info("Found {} stale reservation(s) to expire", staleReservations.size());

        int expiredCount = 0;
        for (Reservation reservation : staleReservations) {
            try {
                expireSingleReservation(reservation, now);
                expiredCount++;
            } catch (Exception e) {
                log.error("Failed to expire reservation {}: {}", reservation.getId(), e.getMessage(), e);
            }
        }

        log.info("Expired {}/{} stale reservation(s)", expiredCount, staleReservations.size());
    }

    private void expireSingleReservation(Reservation reservation, LocalDateTime now) {
        // Release per-seat if applicable
        if (reservation.getSeat() != null) {
            Seat seat = reservation.getSeat();
            seat.setStatus(SeatStatus.AVAILABLE);
            seatRepository.save(seat);
        }

        // Release aggregated inventory if applicable
        if (reservation.getInventoryPool() != null) {
            InventoryPool pool = reservation.getInventoryPool();
            int quantity = reservation.getQuantity() != null ? reservation.getQuantity() : 1;
            pool.setAvailableQuantity(pool.getAvailableQuantity() + quantity);
            inventoryPoolRepository.save(pool);
        }

        // Expire the reservation
        reservation.setStatus(ReservationStatus.EXPIRED);
        reservation.setUpdatedAt(now);
        reservationRepository.save(reservation);

        // Record audit log entry
        AuditLog auditLog = AuditLog.builder()
            .eventId(reservation.getEvent().getId())
            .reservationId(reservation.getId())
            .userId(reservation.getUser().getId())
            .action("EXPIRE")
            .details(String.format(
                "{\"heldAt\":\"%s\",\"expiresAt\":\"%s\",\"seatId\":%s,\"poolId\":%s,\"quantity\":%s}",
                reservation.getHeldAt(),
                reservation.getExpiresAt(),
                reservation.getSeat() != null ? reservation.getSeat().getId() : "null",
                reservation.getInventoryPool() != null ? reservation.getInventoryPool().getId() : "null",
                reservation.getQuantity() != null ? reservation.getQuantity() : "null"
            ))
            .build();
        auditLogRepository.save(auditLog);
    }
}
