package com.ticketing.service;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Iterator;
import java.util.Map;
import java.util.Queue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;

/**
 * In-memory waiting queue for sold-out events/tiers.
 * <p>
 * Architecture Rationale:
 * <ul>
 *   <li><b>In-memory FIFO queue:</b> Uses ConcurrentLinkedQueue for fair ordering.
 *       When inventory is exhausted, users are placed in a queue and automatically
 *       promoted when the sweeper releases seats/tickets.</li>
 *   <li><b>Per-tier queues:</b> Each (eventId, tier) combination has its own queue.
 *       This prevents VIP queue entrants from competing with General Admission entrants.</li>
 *   <li><b>Scheduled promotion:</b> A background task periodically checks if inventory
 *       is available for queued users. In production, this would be replaced by
 *       Redis pub/sub or a dedicated notification service (email/SMS/WebSocket push).</li>
 * </ul>
 */
@Service
@Slf4j
public class WaitingQueueService {

    private final Map<String, Queue<WaitingEntry>> queues = new ConcurrentHashMap<>();

    /**
     * Add a user to the waiting queue for a specific event/tier.
     *
     * @return queue position (1-based)
     */
    public int enqueue(Long eventId, String tier, String token, int quantity) {
        String queueKey = queueKey(eventId, tier);
        Queue<WaitingEntry> queue = queues.computeIfAbsent(queueKey, k -> new ConcurrentLinkedQueue<>());
        WaitingEntry entry = new WaitingEntry(eventId, tier, token, quantity, LocalDateTime.now());
        queue.add(entry);
        int position = queue.size();
        log.info("Added to waiting queue: event={}, tier={}, token={}, position={}", eventId, tier, token, position);
        return position;
    }

    /**
     * Get the current queue position for a token at an event/tier.
     *
     * @return position (1-based), or -1 if not in queue
     */
    public int getPosition(Long eventId, String tier, String token) {
        String queueKey = queueKey(eventId, tier);
        Queue<WaitingEntry> queue = queues.get(queueKey);
        if (queue == null) return -1;

        int position = 1;
        for (WaitingEntry entry : queue) {
            if (entry.token.equals(token)) return position;
            position++;
        }
        return -1;
    }

    /**
     * Remove a user from the waiting queue (e.g., they cancelled their spot).
     */
    public boolean dequeue(Long eventId, String tier, String token) {
        String queueKey = queueKey(eventId, tier);
        Queue<WaitingEntry> queue = queues.get(queueKey);
        if (queue == null) return false;

        synchronized (queue) {
            Iterator<WaitingEntry> iterator = queue.iterator();
            while (iterator.hasNext()) {
                if (iterator.next().token.equals(token)) {
                    iterator.remove();
                    log.info("Removed from waiting queue: event={}, tier={}, token={}", eventId, tier, token);
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Get the next waiting entry for an event/tier.
     * Used by the scheduled promotion task.
     */
    public WaitingEntry poll(Long eventId, String tier) {
        String queueKey = queueKey(eventId, tier);
        Queue<WaitingEntry> queue = queues.get(queueKey);
        if (queue == null) return null;

        WaitingEntry entry = queue.poll();
        if (entry != null) {
            log.info("Promoted from waiting queue: event={}, tier={}, token={}",
                entry.eventId, entry.tier, entry.token);
        }
        return entry;
    }

    /**
     * Check how many people are waiting for a specific event/tier.
     */
    public int waitingCount(Long eventId, String tier) {
        String queueKey = queueKey(eventId, tier);
        Queue<WaitingEntry> queue = queues.get(queueKey);
        return queue != null ? queue.size() : 0;
    }

    private String queueKey(Long eventId, String tier) {
        return eventId + ":" + (tier != null ? tier : "default");
    }

    @Data
    public static class WaitingEntry {
        private final Long eventId;
        private final String tier;
        private final String token;
        private final int quantity;
        private final LocalDateTime enqueuedAt;
    }
}
