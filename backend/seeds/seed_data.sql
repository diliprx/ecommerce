-- ============================================================
-- E-Commerce Seed Data
-- Run: mysql -u root -p ecommerce < backend/seeds/seed_data.sql
-- Password for admin@shopnext.com: admin123 (CHANGE AFTER FIRST LOGIN)
-- ============================================================

USE ecommerce;

-- Ensure roles exist (idempotent)
INSERT IGNORE INTO roles (id, name) VALUES 
(1, 'user'),
(2, 'admin');

-- Seed admin user (admin@shopnext.com / admin123)
-- role_id=2 (admin), bcrypt rounds=12 hash for 'admin123'
INSERT IGNORE INTO users (email, password_hash, first_name, last_name, role_id, is_active, is_verified) VALUES 
('admin@shopnext.com', 
 '$2b$12$X3y4y/70UuwcuIT1iTh37.j2wfaJQvExhVSyOBmRnpro2tNhz240a', 
 'Admin', 
 'ShopNext', 
 2, 
 1, 
 1);

-- Sample categories
INSERT IGNORE INTO categories (id, name, slug, is_active) VALUES 
(1, 'Electronics', 'electronics', 1),
(2, 'Books', 'books', 1),
(3, 'Clothing', 'clothing', 1);

-- Sample products
INSERT IGNORE INTO products (category_id, name, slug, description, price, stock, image_url, sku, is_active) VALUES 
(1, 'iPhone 15 Pro', 'iphone-15-pro', 'Latest flagship smartphone', 999.99, 50, 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&fit=crop', 'IPH15P', 1),
(1, 'MacBook Air M3', 'macbook-air-m3', 'Lightweight laptop with Apple Silicon', 1299.99, 25, 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&fit=crop', 'MBA-M3', 1),
(2, 'Clean Code', 'clean-code', 'Robert C. Martin - Professional software craftsmanship', 49.99, 100, 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&fit=crop', 'CC-001', 1),
(3, 'Nike Air Max', 'nike-air-max', 'Comfortable running shoes', 129.99, 75, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&fit=crop', 'NAM-001', 1);

-- Verify seed data
-- SELECT * FROM users WHERE email = 'admin@shopnext.com';
-- SELECT COUNT(*) FROM products;

