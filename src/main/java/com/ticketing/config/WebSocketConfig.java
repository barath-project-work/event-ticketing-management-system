package com.ticketing.config;

import com.ticketing.model.enums.SeatStatus;
import com.ticketing.repository.SeatRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

/**
 * WebSocket configuration for real-time seat availability updates.
 * <p>
 * Architecture Rationale:
 * <ul>
 *   <li><b>TextWebSocketHandler:</b> Uses Spring's raw WebSocket support (no STOMP/SockJS)
 *       for minimal overhead. Each message is a JSON string containing seat availability
 *       updates for the subscribed event.</li>
 *   <li><b>Per-event subscriptions:</b> Clients connect to /ws/seat-availability/{eventId}
 *       and receive availability updates whenever a hold/confirm/cancel occurs on that event.</li>
 *   <li><b>Handler as @Component:</b> The handler is a Spring-managed bean so it can be
 *       injected into ReservationService for broadcasting updates on state changes.</li>
 * </ul>
 */
@Configuration
@EnableWebSocket
@Profile("!test & !integration-test")
@RequiredArgsConstructor
@Slf4j
public class WebSocketConfig implements WebSocketConfigurer {

    private final SeatAvailabilityHandler seatAvailabilityHandler;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(seatAvailabilityHandler, "/ws/seat-availability/{eventId}")
            .setAllowedOrigins("*");
    }

    /**
     * WebSocket handler that streams seat availability for a specific event.
     * Registered as a Spring @Component so it can be injected into services.
     */
    @Component
    public static class SeatAvailabilityHandler extends TextWebSocketHandler {

        private final SeatRepository seatRepository;
        private final Map<Long, Set<WebSocketSession>> eventSessions = new ConcurrentHashMap<>();

        public SeatAvailabilityHandler(SeatRepository seatRepository) {
            this.seatRepository = seatRepository;
        }

        @Override
        public void afterConnectionEstablished(WebSocketSession session) {
            Long eventId = extractEventId(session.getUri().getPath());
            if (eventId != null) {
                eventSessions.computeIfAbsent(eventId, k -> new CopyOnWriteArraySet<>()).add(session);
                log.info("WebSocket connected: eventId={}, session={}", eventId, session.getId());
                sendAvailability(session, eventId);
            }
        }

        @Override
        public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
            eventSessions.forEach((eventId, sessions) -> sessions.remove(session));
            log.debug("WebSocket disconnected: session={}", session.getId());
        }

        /**
         * Broadcast seat availability to all clients watching an event.
         * Called by ReservationService after hold/confirm/cancel operations.
         */
        public void broadcastAvailability(Long eventId) {
            Set<WebSocketSession> sessions = eventSessions.get(eventId);
            if (sessions == null || sessions.isEmpty()) return;

            String availabilityJson = buildAvailabilityJson(eventId);
            TextMessage message = new TextMessage(availabilityJson);

            for (WebSocketSession session : sessions) {
                if (session.isOpen()) {
                    try {
                        session.sendMessage(message);
                    } catch (IOException e) {
                        log.warn("Failed to send WebSocket message to session {}: {}", session.getId(), e.getMessage());
                    }
                }
            }
        }

        private void sendAvailability(WebSocketSession session, Long eventId) {
            try {
                session.sendMessage(new TextMessage(buildAvailabilityJson(eventId)));
            } catch (IOException e) {
                log.warn("Failed to send initial availability: {}", e.getMessage());
            }
        }

        private String buildAvailabilityJson(Long eventId) {
            long available = seatRepository.findByEventIdAndStatus(eventId, SeatStatus.AVAILABLE).size();
            long held = seatRepository.findByEventIdAndStatus(eventId, SeatStatus.HELD).size();
            long reserved = seatRepository.findByEventIdAndStatus(eventId, SeatStatus.RESERVED).size();

            return String.format(
                "{\"eventId\":%d,\"available\":%d,\"held\":%d,\"reserved\":%d,\"total\":%d}",
                eventId, available, held, reserved, available + held + reserved);
        }

        private Long extractEventId(String path) {
            try {
                if (path == null || path.isBlank()) return null;
                String[] parts = path.split("/");
                if (parts.length < 2) return null;
                return Long.parseLong(parts[parts.length - 1]);
            } catch (NumberFormatException e) {
                return null;
            }
        }
    }
}
