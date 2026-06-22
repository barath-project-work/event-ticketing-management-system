package com.ticketing.model;

import com.ticketing.model.enums.SeatStatus;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Table(name = "seats", indexes = {
    @Index(name = "idx_seat_event_status", columnList = "event_id, status"),
    @Index(name = "idx_seat_event_tier", columnList = "event_id, tier")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Seat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id", nullable = false)
    @JsonIgnore
    private Event event;

    @Column(nullable = false)
    private String label;

    private String section;

    @Column(name = "row_name")
    private String rowName;

    @Column(name = "seat_number")
    private Integer seatNumber;

    @Column(nullable = false)
    private String tier;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SeatStatus status;

    @Version
    private Long version;
}
