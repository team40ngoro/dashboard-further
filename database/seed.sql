-- Initial Seed Data for LPP Food Division Dashboard

-- Branches
INSERT INTO branches (id, code, name, city) VALUES
(1, 'CKD-01', 'CPI Food Cikande', 'Serang'),
(2, 'SMG-01', 'CPI Food Semarang', 'Semarang'),
(3, 'SBY-01', 'CPI Food Surabaya', 'Surabaya'),
(4, 'MDN-01', 'CPI Food Medan', 'Medan')
ON DUPLICATE KEY UPDATE name=VALUES(name), city=VALUES(city);

-- Default Users (Password: password123)
-- Hash generated with bcryptjs rounds=10: $2a$10$3euP6D5tEaVz1Z1rI7/21e0xXp6b5bKjJ3pU9L1fM6wX4nZ1b6hC6
INSERT INTO users (id, branch_id, username, password_hash, full_name, role, is_active) VALUES
(1, NULL, 'admin.pusat', '$2a$10$3euP6D5tEaVz1Z1rI7/21e0xXp6b5bKjJ3pU9L1fM6wX4nZ1b6hC6', 'Administrator Pusat', 'admin_pusat', TRUE),
(2, NULL, 'analis.pusat', '$2a$10$3euP6D5tEaVz1Z1rI7/21e0xXp6b5bKjJ3pU9L1fM6wX4nZ1b6hC6', 'Quality & Production Analyst', 'analis_pusat', TRUE),
(3, 1, 'uploader.cikande', '$2a$10$3euP6D5tEaVz1Z1rI7/21e0xXp6b5bKjJ3pU9L1fM6wX4nZ1b6hC6', 'Operator LPP Cikande', 'pengunggah_cabang', TRUE),
(4, 1, 'viewer.cikande', '$2a$10$3euP6D5tEaVz1Z1rI7/21e0xXp6b5bKjJ3pU9L1fM6wX4nZ1b6hC6', 'Supervisor Cikande', 'pembaca_cabang', TRUE),
(5, 2, 'uploader.semarang', '$2a$10$3euP6D5tEaVz1Z1rI7/21e0xXp6b5bKjJ3pU9L1fM6wX4nZ1b6hC6', 'Operator LPP Semarang', 'pengunggah_cabang', TRUE),
(6, 3, 'uploader.surabaya', '$2a$10$3euP6D5tEaVz1Z1rI7/21e0xXp6b5bKjJ3pU9L1fM6wX4nZ1b6hC6', 'Operator LPP Surabaya', 'pengunggah_cabang', TRUE)
ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), role=VALUES(role);
