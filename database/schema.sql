-- Schema Definition for LPP Food Division Dashboard (MySQL)

CREATE TABLE IF NOT EXISTS branches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  city VARCHAR(100),
  access_code VARCHAR(50) NOT NULL DEFAULT '1234',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  role ENUM('admin_pusat', 'analis_pusat', 'pengunggah_cabang', 'pembaca_cabang') NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS production_batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  file_hash VARCHAR(64) NOT NULL,
  product_code VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  production_date DATE NOT NULL,
  line VARCHAR(50) NOT NULL,
  batch_number VARCHAR(100) NOT NULL,
  work_hours DECIMAL(5,2) NULL,
  meat_percentage DECIMAL(5,2) NULL,
  form_reject_percentage DECIMAL(5,2) NULL,
  total_material_kg DECIMAL(12,2) DEFAULT 0.00,
  output_good_kg DECIMAL(12,2) DEFAULT 0.00,
  total_reject_kg DECIMAL(12,2) DEFAULT 0.00,
  calculated_reject_pct DECIMAL(5,2) DEFAULT 0.00,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_branch_batch (branch_id, production_date, batch_number, line),
  INDEX idx_filter (branch_id, production_date, product_code, line),
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS batch_materials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id INT NOT NULL,
  category ENUM('bahan_baku', 'marinade_tsp', 'lain_lain', 'batter', 'predust_breader') NOT NULL,
  item_name VARCHAR(150) NOT NULL,
  batch_code VARCHAR(100) NULL,
  temperature_c DECIMAL(5,2) NULL,
  weight_kg DECIMAL(10,2) NOT NULL,
  INDEX idx_batch_mat (batch_id, category),
  FOREIGN KEY (batch_id) REFERENCES production_batches(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS batch_machine_metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id INT NOT NULL,
  machine_name VARCHAR(100) NOT NULL,
  parameter_name VARCHAR(100) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  metric_type ENUM('actual', 'setting') DEFAULT 'actual',
  value_numeric DECIMAL(10,2) NULL,
  value_text VARCHAR(100) NULL,
  INDEX idx_machine_param (machine_name, parameter_name),
  FOREIGN KEY (batch_id) REFERENCES production_batches(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS batch_rejects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id INT NOT NULL,
  stage ENUM('cooking', 'packing') NOT NULL,
  reject_type VARCHAR(100) NOT NULL,
  weight_kg DECIMAL(10,2) NOT NULL,
  INDEX idx_batch_reject (batch_id, stage),
  FOREIGN KEY (batch_id) REFERENCES production_batches(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS batch_outputs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id INT NOT NULL,
  pallet_no VARCHAR(50) NULL,
  box_count INT NULL,
  weight_kg DECIMAL(10,2) NOT NULL,
  bstb_no VARCHAR(100) NULL,
  FOREIGN KEY (batch_id) REFERENCES production_batches(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id INT NULL,
  user_id INT NULL,
  action VARCHAR(50) NOT NULL,
  details TEXT NOT NULL,
  ip_address VARCHAR(45) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
