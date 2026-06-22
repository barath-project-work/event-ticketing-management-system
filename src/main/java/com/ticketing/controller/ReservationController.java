package com.ticketing.controller;

import com.ticketing.dto.BulkHoldRequest;
import com.ticketing.dto.ConfirmRequest;
import com.ticketing.dto.HoldSeatRequest;
import com.ticketing.dto.ReservationResponse;
import com.ticketing.service.ReservationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reservations")
@RequiredArgsConstructor
public class ReservationController {

    private final ReservationService reservationService;

    @PostMapping("/hold")
    public ResponseEntity<ReservationResponse> holdSeat(@Valid @RequestBody HoldSeatRequest request) {
        ReservationResponse response = reservationService.holdSeat(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/hold/bulk")
    public ResponseEntity<List<ReservationResponse>> bulkHold(@Valid @RequestBody BulkHoldRequest request) {
        List<ReservationResponse> responses = reservationService.bulkHold(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(responses);
    }

    @PostMapping("/{id}/confirm")
    public ResponseEntity<ReservationResponse> confirmReservation(
            @PathVariable Long id,
            @Valid @RequestBody ConfirmRequest request) {
        ReservationResponse response = reservationService.confirmReservation(id, request.getToken());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<ReservationResponse> cancelReservation(
            @PathVariable Long id,
            @Valid @RequestBody ConfirmRequest request) {
        ReservationResponse response = reservationService.cancelReservation(id, request.getToken());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/refund")
    public ResponseEntity<ReservationResponse> refundReservation(
            @PathVariable Long id,
            @Valid @RequestBody ConfirmRequest request) {
        ReservationResponse response = reservationService.refundReservation(id, request.getToken());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/extend")
    public ResponseEntity<ReservationResponse> extendHold(
            @PathVariable Long id,
            @Valid @RequestBody ConfirmRequest request) {
        ReservationResponse response = reservationService.extendHold(id, request.getToken());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ReservationResponse> getReservation(
            @PathVariable Long id,
            @RequestParam String token) {
        ReservationResponse response = reservationService.getReservation(id, token);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/waiting-queue")
    public ResponseEntity<Map<String, Object>> getWaitingQueuePosition(
            @RequestParam Long eventId,
            @RequestParam(required = false) String tier,
            @RequestParam String token) {
        int position = reservationService.getWaitingQueuePosition(eventId, tier, token);
        return ResponseEntity.ok(Map.of(
            "eventId", eventId,
            "position", position,
            "inQueue", position > 0
        ));
    }
}
