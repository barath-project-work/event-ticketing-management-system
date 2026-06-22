package com.ticketing.repository;

import com.ticketing.model.Seat;
import com.ticketing.model.enums.SeatStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SeatRepository extends JpaRepository<Seat, Long> {

    List<Seat> findByEventIdAndStatus(Long eventId, SeatStatus status);

    List<Seat> findByEventIdAndTierAndStatus(Long eventId, String tier, SeatStatus status);

    List<Seat> findByEventIdAndTier(Long eventId, String tier);

    @Query("SELECT s FROM Seat s WHERE s.event.id = :eventId " +
           "AND (:tier IS NULL OR s.tier = :tier) " +
           "AND (:section IS NULL OR s.section = :section) " +
           "AND (:status IS NULL OR s.status = :status) " +
           "ORDER BY s.section ASC, s.rowName ASC, s.seatNumber ASC")
    List<Seat> findByEventIdWithFilters(
        @Param("eventId") Long eventId,
        @Param("tier") String tier,
        @Param("section") String section,
        @Param("status") SeatStatus status);

    @Query("SELECT s.tier, COUNT(s), SUM(CASE WHEN s.status = 'AVAILABLE' THEN 1 ELSE 0 END) " +
           "FROM Seat s WHERE s.event.id = :eventId GROUP BY s.tier")
    List<Object[]> countByTier(@Param("eventId") Long eventId);


}
