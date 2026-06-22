-- ---------------------------------------------------------------------------
-- Flyway Migration V1: Initial Schema
-- ---------------------------------------------------------------------------
-- This migration defines the complete database schema for the Event Ticketing
-- Management System. It is the Flyway-managed equivalent of the JPA/Hibernate
-- ddl-auto configuration.
--
-- Architecture Rationale:
-- - Flyway migrations replace ddl-auto:validate in production, providing
--   version-controlled, auditable schema changes that can be reviewed in code
--   review and rolled back if needed.
-- - Each migration is immutable once applied — never modify a migration that
--   has been run in any environment.
-- - The schema matches the JPA entity definitions exactly to ensure
--   ddl-auto:validate passes after Flyway applies the migration.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- Enums are stored as VARCHAR columns in PostgreSQL
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Users
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id          BIGSERIAL    PRIMARY KEY,
    email       VARCHAR(255) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    token       VARCHAR(255) NOT NULL,
    created_at  TIMESTAMP    NOT NULL,

    CONSTRAINT uk_users_email UNIQUE (email),
    CONSTRAINT uk_users_token UNIQUE (token)
);

-- ---------------------------------------------------------------------------
-- 2. Events
-- ---------------------------------------------------------------------------
CREATE TABLE events (
    id                      BIGSERIAL    PRIMARY KEY,
    name                    VARCHAR(255) NOT NULL,
    description             TEXT,
    venue                   VARCHAR(255) NOT NULL,
    event_date              TIMESTAMP    NOT NULL,
    status                  VARCHAR(255) NOT NULL,
    inventory_strategy      VARCHAR(255) NOT NULL,
    hold_duration_seconds   INTEGER      NOT NULL DEFAULT 180,
    created_at              TIMESTAMP    NOT NULL,
    updated_at              TIMESTAMP    NOT NULL,
    version                 BIGINT
);

-- ---------------------------------------------------------------------------
-- 3. Seats (Per-seat strategy)
-- ---------------------------------------------------------------------------
CREATE TABLE seats (
    id            BIGSERIAL       PRIMARY KEY,
    event_id      BIGINT          NOT NULL,
    label         VARCHAR(255)    NOT NULL,
    section       VARCHAR(255),
    row_name      VARCHAR(255),
    seat_number   INTEGER,
    tier          VARCHAR(255)    NOT NULL,
    price         NUMERIC(10,2)   NOT NULL,
    status        VARCHAR(255)    NOT NULL,
    version       BIGINT,

    CONSTRAINT fk_seats_event FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE INDEX idx_seat_event_status ON seats (event_id, status);
CREATE INDEX idx_seat_event_tier   ON seats (event_id, tier);

-- ---------------------------------------------------------------------------
-- 4. Inventory Pools (Aggregated strategy)
-- ---------------------------------------------------------------------------
CREATE TABLE inventory_pools (
    id                  BIGSERIAL       PRIMARY KEY,
    event_id            BIGINT          NOT NULL,
    tier                VARCHAR(255)    NOT NULL,
    total_quantity      INTEGER         NOT NULL,
    available_quantity  INTEGER         NOT NULL,
    price               NUMERIC(10,2)   NOT NULL,
    version             BIGINT,

    CONSTRAINT fk_inventory_pools_event FOREIGN KEY (event_id) REFERENCES events(id),
    CONSTRAINT uk_inventory_event_tier   UNIQUE (event_id, tier)
);

-- ---------------------------------------------------------------------------
-- 5. Reservations
-- ---------------------------------------------------------------------------
CREATE TABLE reservations (
    id                BIGSERIAL       PRIMARY KEY,
    user_id           BIGINT          NOT NULL,
    event_id          BIGINT          NOT NULL,
    seat_id           BIGINT          UNIQUE,
    inventory_pool_id BIGINT,
    quantity          INTEGER,
    status            VARCHAR(255)    NOT NULL,
    held_at           TIMESTAMP       NOT NULL,
    confirmed_at      TIMESTAMP,
    expires_at        TIMESTAMP       NOT NULL,
    idempotency_key   VARCHAR(255)    UNIQUE,
    created_at        TIMESTAMP       NOT NULL,
    updated_at        TIMESTAMP       NOT NULL,
    version           BIGINT,

    CONSTRAINT fk_reservations_user           FOREIGN KEY (user_id)           REFERENCES users(id),
    CONSTRAINT fk_reservations_event          FOREIGN KEY (event_id)          REFERENCES events(id),
    CONSTRAINT fk_reservations_seat           FOREIGN KEY (seat_id)           REFERENCES seats(id),
    CONSTRAINT fk_reservations_inventory_pool FOREIGN KEY (inventory_pool_id) REFERENCES inventory_pools(id)
);

CREATE INDEX idx_reservation_status_expires  ON reservations (status, expires_at);
CREATE INDEX idx_reservation_user_event      ON reservations (user_id, event_id);

-- ---------------------------------------------------------------------------
-- 6. Audit Logs
-- ---------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id              BIGSERIAL    PRIMARY KEY,
    event_id        BIGINT       NOT NULL,
    reservation_id  BIGINT,
    user_id         BIGINT       NOT NULL,
    action          VARCHAR(255) NOT NULL,
    details         TEXT,
    created_at      TIMESTAMP    NOT NULL
);

CREATE INDEX idx_audit_event_created ON audit_logs (event_id, created_at);
