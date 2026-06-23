package com.ticketing.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;

import java.time.Duration;

/**
 * Cache configuration for event and seat listing endpoints.
 * <p>
 * Architecture Rationale:
 * <ul>
 *   <li><b>Two-tier strategy:</b> Redis for production (distributed cache across instances),
 *       Caffeine for local development and testing (zero infrastructure dependency).</li>
 *   <li><b>Short TTL (60s):</b> Event/seat availability changes constantly during flash sales.
 *       A 60-second TTL ensures data is reasonably current while reducing DB load for repeated
 *       listing requests (e.g., multiple users browsing the same event page).</li>
 *   <li><b>@Cacheable annotations:</b> Applied at the service layer (EventService) so that
 *       cached and non-cached callers both benefit. The cache is invalidated automatically
 *       by Redis TTL — no manual eviction needed for reads.</li>
 *   <li><b>Null values not cached:</b> Prevents caching of "event not found" responses,
 *       which would mask transient DB issues.</li>
 * </ul>
 */
@Configuration
@EnableCaching
public class CacheConfig {

    public static final String EVENTS_CACHE = "events";
    public static final String EVENT_DETAILS_CACHE = "eventDetails";
    public static final String SEATS_CACHE = "seats";

    /**
     * Redis-backed cache manager (production profile).
     * Uses GenericJackson2JsonRedisSerializer for human-readable cache entries.
     */
    @Bean
    @Primary
    @Profile("!test")
    @ConditionalOnProperty(name = "spring.cache.type", havingValue = "redis", matchIfMissing = true)
    public RedisCacheManager redisCacheManager(RedisConnectionFactory connectionFactory,
                                                 ObjectMapper objectMapper) {
        objectMapper = objectMapper.copy()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

        var jsonSerializer = new GenericJackson2JsonRedisSerializer(objectMapper);

        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofSeconds(60))
            .disableCachingNullValues()
            .serializeValuesWith(
                RedisSerializationContext.SerializationPair.fromSerializer(jsonSerializer));

        RedisCacheConfiguration config30 = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofSeconds(30))
            .disableCachingNullValues()
            .serializeValuesWith(
                RedisSerializationContext.SerializationPair.fromSerializer(jsonSerializer));

        RedisCacheConfiguration config60 = config30.entryTtl(Duration.ofSeconds(60));

        return RedisCacheManager.builder(connectionFactory)
            .cacheDefaults(config)
            .withCacheConfiguration(EVENTS_CACHE, config30)
            .withCacheConfiguration(EVENT_DETAILS_CACHE, config60)
            .withCacheConfiguration(SEATS_CACHE, config30)
            .build();
    }

    /**
     * Caffeine fallback cache manager (test/profile without Redis).
     * Provides in-process caching without Redis dependency.
     */
    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnProperty(name = "spring.cache.type", havingValue = "caffeine")
    public CacheManager caffeineCacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager(EVENTS_CACHE, EVENT_DETAILS_CACHE, SEATS_CACHE);
        cacheManager.setCaffeine(Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofSeconds(60))
            .maximumSize(500)
            .recordStats());
        cacheManager.setAllowNullValues(false);
        return cacheManager;
    }
}
