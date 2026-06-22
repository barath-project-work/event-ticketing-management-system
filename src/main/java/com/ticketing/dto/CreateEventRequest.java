package com.ticketing.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

/**
 * Request to create a new event.
 * Used by: POST /api/admin/events
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateEventRequest {

    @NotBlank(message = "Event name is required")
    private String name;

    private String description;

    @NotBlank(message = "Venue is required")
    private String venue;

    @NotNull(message = "Event date is required")
    private LocalDateTime eventDate;

    @NotBlank(message = "Inventory strategy is required (PER_SEAT or AGGREGATED)")
    private String inventoryStrategy;

    @Builder.Default
    private Integer holdDurationSeconds = 180;

    @NotBlank(message = "Admin token is required")
    private String adminToken;
}
