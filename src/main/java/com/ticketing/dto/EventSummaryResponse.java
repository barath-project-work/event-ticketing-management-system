package com.ticketing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

/**
 * Lightweight event summary for list views.
 * Used by: GET /api/events (list)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EventSummaryResponse {

    private Long id;
    private String name;
    private String venue;
    private LocalDateTime eventDate;
    private String status;
    private String inventoryStrategy;
    private Integer availableSeats;
    private Integer totalSeats;
}
