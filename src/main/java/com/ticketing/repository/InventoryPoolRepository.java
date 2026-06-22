package com.ticketing.repository;

import com.ticketing.model.InventoryPool;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface InventoryPoolRepository extends JpaRepository<InventoryPool, Long> {

    List<InventoryPool> findByEventId(Long eventId);

    Optional<InventoryPool> findByEventIdAndTier(Long eventId, String tier);
}
