package com.ticketing.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Request DTO for bulk holding multiple seats or tickets.
 * Used by: POST /api/reservations/hold/bulk
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BulkHoldRequest {

    @NotNull(message = "Event ID is required")
    private Long eventId;

    @NotEmpty(message = "At least one seat/tier entry is required")
    private List<HoldEntry> entries;

    @NotNull(message = "API token is required")
    private String token;

    /**
     * A single entry in the bulk hold request.
     * For PER_SEAT: provide seatId.
     * For AGGREGATED: provide tier and quantity.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class HoldEntry {
        private Long seatId;
        private String tier;
        @Builder.Default
        private Integer quantity = 1;
    }
}
