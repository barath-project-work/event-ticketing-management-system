package com.ticketing.repository;

import com.ticketing.model.Reservation;
import com.ticketing.model.enums.ReservationStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.repository.query.Param;

@Repository
public interface ReservationRepository extends JpaRepository<Reservation, Long> {

    @EntityGraph(attributePaths = {"event", "user", "seat", "inventoryPool"})
    Optional<Reservation> findWithDetailsById(Long id);

    Optional<Reservation> findByIdempotencyKey(String idempotencyKey);

    List<Reservation> findByStatusAndExpiresAtBefore(ReservationStatus status, LocalDateTime now);

    @Query("SELECT r FROM Reservation r " +
           "LEFT JOIN FETCH r.seat " +
           "LEFT JOIN FETCH r.inventoryPool " +
           "LEFT JOIN FETCH r.event " +
           "LEFT JOIN FETCH r.user " +
           "WHERE r.status = :status AND r.expiresAt < :now")
    List<Reservation> findExpiredHoldsWithDetails(@Param("status") ReservationStatus status, @Param("now") LocalDateTime now);

    @Modifying
    @Query("UPDATE Reservation r SET r.status = 'CONFIRMED' WHERE r.id = :id AND r.status = 'HELD'")
    int confirmReservation(Long id);

    @Modifying
    @Query("UPDATE Reservation r SET r.status = 'EXPIRED' WHERE r.status = 'HELD' AND r.expiresAt < :now")
    int expireStaleReservations(LocalDateTime now);
}
