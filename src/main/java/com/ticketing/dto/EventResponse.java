package com.ticketing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Full event detail response including available seat/tier breakdown.
 * Used by: GET /api/events/{id}
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EventResponse {

    private Long id;
    private String name;
    private String description;
    private String venue;
    private LocalDateTime eventDate;
    private String status;
    private String inventoryStrategy;
    private Integer holdDurationSeconds;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // Aggregated inventory overview
    private Integer totalSeats;
    private Integer availableSeats;
    private Integer heldSeats;
    private Integer reservedSeats;

    // Tier breakdown (for both PER_SEAT and AGGREGATED)
    private List<TierInfo> tiers;

    /**
     * Information about a specific ticket tier within an event.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class TierInfo {
        private String tier;
        private BigDecimal price;
        private Integer totalQuantity;
        private Integer availableQuantity;
        private Integer heldQuantity;
        private Integer reservedQuantity;
    }
}
