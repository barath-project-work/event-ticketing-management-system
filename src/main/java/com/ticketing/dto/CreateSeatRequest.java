package com.ticketing.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.util.List;

/**
 * Request to bulk-create seats for an event.
 * Used by: POST /api/admin/events/{id}/seats
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateSeatRequest {

    @NotNull(message = "Admin token is required")
    private String adminToken;

    @NotNull(message = "Seat list is required")
    private List<SeatEntry> seats;

    /**
     * A single seat entry in the bulk creation request.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SeatEntry {

        @NotBlank(message = "Seat label is required")
        private String label;

        private String section;

        private String rowName;

        private Integer seatNumber;

        @NotBlank(message = "Tier is required")
        private String tier;

        @NotNull(message = "Price is required")
        @Positive(message = "Price must be positive")
        private BigDecimal price;
    }
}
