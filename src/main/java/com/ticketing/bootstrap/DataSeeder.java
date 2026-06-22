package com.ticketing.bootstrap;

import com.ticketing.model.*;
import com.ticketing.model.enums.EventStatus;
import com.ticketing.model.enums.SeatStatus;
import com.ticketing.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Component
@Profile("dev")
@RequiredArgsConstructor
@Slf4j
public class DataSeeder implements CommandLineRunner {

    private final EventRepository eventRepository;
    private final SeatRepository seatRepository;
    private final InventoryPoolRepository inventoryPoolRepository;
    private final UserRepository userRepository;

    @Override
    public void run(String... args) {
        if (userRepository.count() > 0) {
            log.info("Data already seeded, skipping...");
            return;
        }

        log.info("Seeding development data...");

        // Create users
        User alice = userRepository.save(User.builder()
            .email("alice@example.com")
            .name("Alice Johnson")
            .token("alice-token-001")
            .build());

        User bob = userRepository.save(User.builder()
            .email("bob@example.com")
            .name("Bob Smith")
            .token("bob-token-002")
            .build());

        log.info("Created users: {} (token: {}), {} (token: {})",
            alice.getEmail(), alice.getToken(), bob.getEmail(), bob.getToken());

        // Create per-seat event
        Event broadwayShow = eventRepository.save(Event.builder()
            .name("Hamilton - Broadway")
            .description("The hit musical at the Richard Rodgers Theatre")
            .venue("Richard Rodgers Theatre")
            .eventDate(LocalDateTime.now().plusDays(45))
            .status(EventStatus.ACTIVE)
            .inventoryStrategy("PER_SEAT")
            .holdDurationSeconds(180)
            .build());

        // Create seats for Broadway show
        List<Seat> broadwaySeats = new ArrayList<>();
        String[] tiers = {"Orchestra", "Mezzanine", "Balcony"};
        BigDecimal[] prices = {new BigDecimal("299.00"), new BigDecimal("199.00"), new BigDecimal("99.00")};

        for (int t = 0; t < tiers.length; t++) {
            for (int row = 1; row <= 5; row++) {
                for (int seatNum = 1; seatNum <= 10; seatNum++) {
                    char rowChar = (char) ('A' + row - 1);
                    broadwaySeats.add(Seat.builder()
                        .event(broadwayShow)
                        .label(rowChar + String.valueOf(seatNum))
                        .section(tiers[t])
                        .rowName(String.valueOf(rowChar))
                        .seatNumber(seatNum)
                        .tier(tiers[t])
                        .price(prices[t])
                        .status(SeatStatus.AVAILABLE)
                        .build());
                }
            }
        }
        seatRepository.saveAll(broadwaySeats);
        log.info("Created event '{}' with {} seats", broadwayShow.getName(), broadwaySeats.size());

        // Create aggregated event
        Event musicFestival = eventRepository.save(Event.builder()
            .name("Summer Music Festival 2026")
            .description("3-day outdoor music festival with top artists")
            .venue("Central Park")
            .eventDate(LocalDateTime.now().plusDays(60))
            .status(EventStatus.ACTIVE)
            .inventoryStrategy("AGGREGATED")
            .holdDurationSeconds(180)
            .build());

        // Create inventory pools for festival
        inventoryPoolRepository.save(InventoryPool.builder()
            .event(musicFestival)
            .tier("VIP")
            .totalQuantity(500)
            .availableQuantity(500)
            .price(new BigDecimal("450.00"))
            .build());

        inventoryPoolRepository.save(InventoryPool.builder()
            .event(musicFestival)
            .tier("General Admission")
            .totalQuantity(5000)
            .availableQuantity(5000)
            .price(new BigDecimal("150.00"))
            .build());

        inventoryPoolRepository.save(InventoryPool.builder()
            .event(musicFestival)
            .tier("Student")
            .totalQuantity(200)
            .availableQuantity(200)
            .price(new BigDecimal("75.00"))
            .build());

        log.info("Created event '{}' with 3 ticket tiers", musicFestival.getName());

        // Create a draft event (not on sale yet)
        eventRepository.save(Event.builder()
            .name("Upcoming Comedy Night")
            .description("Stand-up comedy showcase")
            .venue("Comedy Club")
            .eventDate(LocalDateTime.now().plusDays(90))
            .status(EventStatus.DRAFT)
            .inventoryStrategy("PER_SEAT")
            .holdDurationSeconds(180)
            .build());

        log.info("Seeding complete! Use tokens 'alice-token-001' or 'bob-token-002' for API testing");
    }
}
