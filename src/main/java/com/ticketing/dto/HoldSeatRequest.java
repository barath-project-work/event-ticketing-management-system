package com.ticketing.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HoldSeatRequest {

    @NotNull(message = "Event ID is required")
    private Long eventId;

    private Long seatId;

    private String tier;

    private Integer quantity;

    @NotNull(message = "API token is required")
    private String token;
}
