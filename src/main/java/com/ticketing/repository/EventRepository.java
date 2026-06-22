package com.ticketing.repository;

import com.ticketing.model.Event;
import com.ticketing.model.enums.EventStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EventRepository extends JpaRepository<Event, Long> {

    List<Event> findByStatus(EventStatus status);

    @Query("SELECT e FROM Event e ORDER BY e.eventDate ASC")
    List<Event> findAllOrderByEventDate();

    @Query("SELECT COUNT(s) FROM Seat s WHERE s.event.id = :eventId AND s.status = 'AVAILABLE'")
    long countAvailableSeats(@Param("eventId") Long eventId);

    @Query("SELECT COUNT(s) FROM Seat s WHERE s.event.id = :eventId")
    long countTotalSeats(@Param("eventId") Long eventId);
}
