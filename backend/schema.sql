-- ============================================================
-- E-Commerce Database Schema (3NF Normalized)
-- MySQL 8.0+ | UTF8MB4 | InnoDB
-- ============================================================

CREATE DATABASE IF NOT EXISTS ecommerce CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ecommerce;

-- ============================================================
-- ROLES
-- ============================================================
CREATE TABLE roles (
    id       TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name     VARCHAR(20)      NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB;

INSERT INTO roles (name) VALUES ('user'), ('admin');

-- ============================================================
-- USERS
-- Password: bcrypt hash (never plaintext)
-- Soft-delete via deleted_at
-- ============================================================
CREATE TABLE users (
    id            BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    email         VARCHAR(255)     NOT NULL,
    password_hash VARCHAR(255)     NOT NULL,          -- bcrypt $2b$12$...
    first_name    VARCHAR(100)     NOT NULL,
    last_name     VARCHAR(100)     NOT NULL,
    role_id       TINYINT UNSIGNED NOT NULL DEFAULT 1,
    is_active     BOOLEAN          NOT NULL DEFAULT TRUE,
    is_verified   BOOLEAN          NOT NULL DEFAULT FALSE,
    created_at    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at    DATETIME                  DEFAULT NULL,           -- soft delete
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),                              -- login index
    KEY idx_users_role (role_id),
    KEY idx_users_deleted_at (deleted_at),
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB;

-- ============================================================
-- REFRESH TOKENS
-- Rotation: each use invalidates the old token
-- ============================================================
CREATE TABLE refresh_tokens (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id       BIGINT UNSIGNED NOT NULL,
    token_hash    VARCHAR(255)    NOT NULL,                         -- SHA-256 of raw token
    expires_at    DATETIME        NOT NULL,
    revoked       BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_rt_token_hash (token_hash),
    KEY idx_rt_user_id (user_id),
    CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- ADDRESSES
-- ============================================================
CREATE TABLE addresses (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id       BIGINT UNSIGNED NOT NULL,
    label         VARCHAR(50)     NOT NULL DEFAULT 'home',          -- home/work/other
    line1         VARCHAR(255)    NOT NULL,
    line2         VARCHAR(255)             DEFAULT NULL,
    city          VARCHAR(100)    NOT NULL,
    state         VARCHAR(100)    NOT NULL,
    postal_code   VARCHAR(20)     NOT NULL,
    country_code  CHAR(2)         NOT NULL,                         -- ISO 3166-1 alpha-2
    is_default    BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_addr_user (user_id),
    CONSTRAINT fk_addr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- CATEGORIES (self-referencing for hierarchy)
-- ============================================================
CREATE TABLE categories (
    id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    parent_id     INT UNSIGNED           DEFAULT NULL,
    name          VARCHAR(100)  NOT NULL,
    slug          VARCHAR(120)  NOT NULL,
    description   TEXT                   DEFAULT NULL,
    is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_cat_slug (slug),
    KEY idx_cat_parent (parent_id),
    CONSTRAINT fk_cat_parent FOREIGN KEY (parent_id) REFERENCES categories(id)
) ENGINE=InnoDB;

-- ============================================================
-- PRODUCTS
-- image_url points to CDN — no binary blobs in DB
-- stock uses SELECT ... FOR UPDATE for pessimistic locking
-- ============================================================
CREATE TABLE products (
    id            BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    category_id   INT UNSIGNED     NOT NULL,
    name          VARCHAR(255)     NOT NULL,
    slug          VARCHAR(280)     NOT NULL,
    description   TEXT                      DEFAULT NULL,
    price         DECIMAL(12, 2)   NOT NULL,                       -- current list price
    stock         INT UNSIGNED     NOT NULL DEFAULT 0,
    image_url     VARCHAR(1000)             DEFAULT NULL,           -- CDN URL
    sku           VARCHAR(100)              DEFAULT NULL,
    is_active     BOOLEAN          NOT NULL DEFAULT TRUE,
    deleted_at    DATETIME                  DEFAULT NULL,           -- soft delete
    created_at    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_prod_slug (slug),
    UNIQUE KEY uq_prod_sku (sku),
    KEY idx_prod_category (category_id),                           -- filter by category
    KEY idx_prod_price (price),                                    -- sort/range queries
    KEY idx_prod_stock (stock),                                    -- stock checks
    KEY idx_prod_deleted (deleted_at),
    FULLTEXT KEY ft_prod_search (name, description),               -- full-text search
    CONSTRAINT fk_prod_category FOREIGN KEY (category_id) REFERENCES categories(id)
) ENGINE=InnoDB;

-- ============================================================
-- CART (one active cart per user)
-- ============================================================
CREATE TABLE carts (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id       BIGINT UNSIGNED NOT NULL,
    created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_cart_user (user_id),                             -- enforce 1 cart/user
    CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE cart_items (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    cart_id       BIGINT UNSIGNED NOT NULL,
    product_id    BIGINT UNSIGNED NOT NULL,
    quantity      INT UNSIGNED    NOT NULL DEFAULT 1,
    added_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_ci_cart_product (cart_id, product_id),           -- no duplicates
    KEY idx_ci_product (product_id),
    CONSTRAINT fk_ci_cart    FOREIGN KEY (cart_id)    REFERENCES carts(id)    ON DELETE CASCADE,
    CONSTRAINT fk_ci_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE orders (
    id              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    user_id         BIGINT UNSIGNED  NOT NULL,
    address_id      BIGINT UNSIGNED  NOT NULL,
    status          ENUM(
                        'pending','confirmed','processing',
                        'shipped','delivered','cancelled','refunded'
                    )                NOT NULL DEFAULT 'pending',
    total_amount    DECIMAL(12, 2)   NOT NULL,
    currency        CHAR(3)          NOT NULL DEFAULT 'USD',
    notes           TEXT                      DEFAULT NULL,
    created_at      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_ord_user   (user_id),                                  -- user's order history
    KEY idx_ord_status (status),
    CONSTRAINT fk_ord_user    FOREIGN KEY (user_id)    REFERENCES users(id),
    CONSTRAINT fk_ord_address FOREIGN KEY (address_id) REFERENCES addresses(id)
) ENGINE=InnoDB;

-- price_at_purchase: snapshot prevents price drift from affecting history
CREATE TABLE order_items (
    id                 BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    order_id           BIGINT UNSIGNED  NOT NULL,
    product_id         BIGINT UNSIGNED  NOT NULL,
    product_name       VARCHAR(255)     NOT NULL,                   -- name snapshot
    price_at_purchase  DECIMAL(12, 2)   NOT NULL,                   -- price snapshot ← CRITICAL
    quantity           INT UNSIGNED     NOT NULL,
    PRIMARY KEY (id),
    KEY idx_oi_order   (order_id),
    KEY idx_oi_product (product_id),
    CONSTRAINT fk_oi_order   FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
    CONSTRAINT fk_oi_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;

-- ============================================================
-- PAYMENTS
-- Never store card numbers, CVV, or raw PAN — NEVER.
-- Only gateway transaction references.
-- ============================================================
CREATE TABLE payments (
    id                 BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    order_id           BIGINT UNSIGNED  NOT NULL,
    gateway            ENUM('stripe','razorpay','paypal') NOT NULL,
    transaction_id     VARCHAR(255)     NOT NULL,                   -- gateway txn ref
    payment_intent_id  VARCHAR(255)              DEFAULT NULL,      -- Stripe PI id
    amount             DECIMAL(12, 2)   NOT NULL,
    currency           CHAR(3)          NOT NULL DEFAULT 'USD',
    status             ENUM('pending','succeeded','failed','refunded') NOT NULL DEFAULT 'pending',
    paid_at            DATETIME                  DEFAULT NULL,
    created_at         DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_pay_transaction (transaction_id),
    KEY idx_pay_order (order_id),
    CONSTRAINT fk_pay_order FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB;

-- ============================================================
-- PRODUCT REVIEWS (bonus — good for search ranking)
-- ============================================================
CREATE TABLE reviews (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    product_id    BIGINT UNSIGNED NOT NULL,
    user_id       BIGINT UNSIGNED NOT NULL,
    rating        TINYINT UNSIGNED NOT NULL,                        -- 1-5
    title         VARCHAR(255)             DEFAULT NULL,
    body          TEXT                     DEFAULT NULL,
    is_verified   BOOLEAN         NOT NULL DEFAULT FALSE,           -- purchased?
    created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_rev_user_product (user_id, product_id),          -- one review/product
    KEY idx_rev_product (product_id),
    CONSTRAINT chk_rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT fk_rev_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT fk_rev_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB;
