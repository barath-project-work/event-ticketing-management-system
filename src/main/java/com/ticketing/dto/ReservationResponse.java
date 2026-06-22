package com.ticketing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReservationResponse {

    private Long id;
    private Long eventId;
    private String eventName;
    private String venue;
    private LocalDateTime eventDate;
    private Long userId;
    private String userEmail;
    private Long seatId;
    private String seatLabel;
    private String section;
    private String rowName;
    private Integer seatNumber;
    private String tier;
    private BigDecimal price;
    private Integer quantity;
    private String status;
    private LocalDateTime heldAt;
    private LocalDateTime expiresAt;
    private LocalDateTime confirmedAt;
    private Boolean extendable;
    private Integer waitingPosition;
}
