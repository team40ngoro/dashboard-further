# Technical Design Specification: Dashboard Laporan Pengendalian Produk (LPP) Food Division

**Status:** Approved for Implementation  
**Date:** 2026-09-24  
**Target:** MVP Production Control Dashboard  

---

## 1. Overview & System Goals

Sistem ini adalah aplikasi web monolitik berbasis **Node.js, Express 5, EJS, MySQL, ExcelJS, dan Chart.js** untuk mengumpulkan data laporan pengendalian produk (`LPP FP REV 2`) dari cabang Charoen Pokphand Food Division, mengekstrak data produksi dan parameter mesin secara presisi, lalu memvisualisasikan data tren lintas cabang secara aman dan terisolasi.

### Ukuran Keberhasilan
1. **Isolasi Cabang (Branch Isolation):** Pengguna cabang hanya dapat melihat dan mengunggah data cabangnya sendiri. Analis dan Admin Pusat dapat melihat data lintas cabang.
2. **Validasi & Ekstraksi Akurat:** Membaca Sheet `DEPAN` dan `BELAKANG` dari template Excel `LPP FP REV 2`, memvalidasi identitas batch (Nama Produk, Kode Produk, Tanggal, Line, No Batch), mendeteksi duplikasi, dan mengekstrak metrik bahan baku, aktual mesin, reject, dan output produk.
3. **Penyimpanan Transaksional Atomik:** Pratinjau sebelum simpan; penyimpanan data batch menggunakan transaksi database utuh (ACID).
4. **Pembersihan Berkas:** Berkas Excel sementara langsung dihapus setelah ekstraksi/penyimpanan selesai.
5. **Visualisasi Interaktif:** Filter periode, cabang, lini produksi, produk, dan parameter mesin terhubung secara real-time ke grafik tren dan tabel angka sinkron.

---

## 2. Arsitektur Aplikasi & Struktur Folder

```
further-dashboard/
├── .env.example
├── .gitignore
├── package.json
├── server.js                     # Entrypoint aplikasi Express
├── config/
│   ├── database.js               # MySQL2 Connection Pool & Healthcheck
│   ├── auth.js                   # Session & RBAC Middleware
│   └── constants.js              # Definisi role, mesin, satuan
├── database/
│   ├── schema.sql                # DDL Migration skema MySQL
│   ├── seed.sql                  # Data inisial cabang & user awal
│   └── migrate.js                # Auto-runner skema migrasi & seeder
├── middleware/
│   ├── authMiddleware.js         # Autentikasi sesi & otorisasi RBAC
│   ├── branchIsolation.js        # Enforcement filter branch_id di server
│   └── uploadMiddleware.js       # Konfigurasi Multer & cleanup file
├── services/
│   ├── excelParser.js            # Parser ExcelJS untuk LPP FP REV 2
│   ├── validationService.js      # Validator format sel, tipe data & rentang
│   └── dashboardService.js       # Query agregasi metrik, grafik, dan ringkasan
├── controllers/
│   ├── authController.js         # Login, logout, profile
│   ├── uploadController.js       # Upload excel, preview, save batch, cancel
│   ├── dashboardController.js    # Render dashboard & API metrics JSON
│   ├── batchController.js        # Daftar batch, detail, edit/koreksi, audit log
│   └── branchAdminController.js  # Manajemen cabang & pengguna (Admin)
├── routes/
│   ├── authRoutes.js
│   ├── uploadRoutes.js
│   ├── dashboardRoutes.js
│   ├── batchRoutes.js
│   └── adminRoutes.js
├── public/
│   ├── css/
│   │   └── style.css             # Desain premium, modern, responsif
│   └── js/
│       ├── dashboard.js          # Controller grafik Chart.js & filter interaktif
│       └── uploadPreview.js      # Interaktivitas konfirmasi impor & validasi
├── views/
│   ├── layouts/
│   │   ├── header.ejs
│   │   ├── footer.ejs
│   │   └── navbar.ejs
│   ├── auth/
│   │   └── login.ejs
│   ├── dashboard/
│   │   └── index.ejs
│   ├── upload/
│   │   ├── form.ejs
│   │   └── preview.ejs
│   ├── batches/
│   │   ├── list.ejs
│   │   └── detail.ejs
│   └── admin/
│       ├── branches.ejs
│       └── users.ejs
└── tests/
    ├── parser.test.js            # Unit test ekstraksi Excel
    ├── validation.test.js        # Test aturan validasi
    └── rbac.test.js              # Test isolasi cabang
```

---

## 3. Skema Basis Data (MySQL)

### 3.1. Tabel `branches`
- `id` INT AUTO_INCREMENT PRIMARY KEY
- `code` VARCHAR(50) UNIQUE NOT NULL (Contoh: `CKP-01`, `SMG-01`, `SBY-01`)
- `name` VARCHAR(150) NOT NULL
- `city` VARCHAR(100)
- `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### 3.2. Tabel `users`
- `id` INT AUTO_INCREMENT PRIMARY KEY
- `branch_id` INT NULL (NULL untuk Admin/Analis Pusat)
- `username` VARCHAR(100) UNIQUE NOT NULL
- `password_hash` VARCHAR(255) NOT NULL
- `full_name` VARCHAR(150) NOT NULL
- `role` ENUM('admin_pusat', 'analis_pusat', 'pengunggah_cabang', 'pembaca_cabang') NOT NULL
- `is_active` BOOLEAN DEFAULT TRUE
- `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL

### 3.3. Tabel `production_batches`
- `id` INT AUTO_INCREMENT PRIMARY KEY
- `branch_id` INT NOT NULL
- `file_hash` VARCHAR(64) NOT NULL (SHA-256 untuk deteksi duplikasi)
- `product_code` VARCHAR(100) NOT NULL
- `product_name` VARCHAR(255) NOT NULL
- `production_date` DATE NOT NULL
- `line` VARCHAR(50) NOT NULL
- `batch_number` VARCHAR(100) NOT NULL
- `work_hours` DECIMAL(5,2) NULL
- `meat_percentage` DECIMAL(5,2) NULL
- `total_material_kg` DECIMAL(12,2) DEFAULT 0.00
- `output_good_kg` DECIMAL(12,2) DEFAULT 0.00
- `total_reject_kg` DECIMAL(12,2) DEFAULT 0.00
- `reject_percentage` DECIMAL(5,2) DEFAULT 0.00
- `created_by` INT NOT NULL
- `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
- UNIQUE KEY `uk_branch_batch` (`branch_id`, `production_date`, `batch_number`, `line`),
- INDEX `idx_filter` (`branch_id`, `production_date`, `product_code`, `line`),
- FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`),
- FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)

### 3.4. Tabel `batch_materials`
- `id` INT AUTO_INCREMENT PRIMARY KEY
- `batch_id` INT NOT NULL
- `category` ENUM('bahan_baku', 'marinade_tsp', 'lain_lain', 'batter', 'predust_breader') NOT NULL
- `item_name` VARCHAR(150) NOT NULL
- `batch_code` VARCHAR(100) NULL
- `temperature_c` DECIMAL(5,2) NULL
- `weight_kg` DECIMAL(10,2) NOT NULL
- FOREIGN KEY (`batch_id`) REFERENCES `production_batches`(`id`) ON DELETE CASCADE

### 3.5. Tabel `batch_machine_metrics` (Pola EAV)
- `id` INT AUTO_INCREMENT PRIMARY KEY
- `batch_id` INT NOT NULL
- `machine_name` VARCHAR(100) NOT NULL (Misal: `Bowl Cutter`, `Fryer`, `Mixer Preparation`, `Tumbler`, `HLT`)
- `parameter_name` VARCHAR(100) NOT NULL (Misal: `Suhu Aktual`, `Speed`, `Preasure`, `TPM Minyak`, `Viscositas`)
- `unit` VARCHAR(20) NOT NULL (Misal: `°C`, `RPM`, `Bar`, `Detik`, `%`)
- `metric_type` ENUM('actual', 'setting') DEFAULT 'actual'
- `value_numeric` DECIMAL(10,2) NULL
- `value_text` VARCHAR(100) NULL
- INDEX `idx_machine_param` (`machine_name`, `parameter_name`),
- FOREIGN KEY (`batch_id`) REFERENCES `production_batches`(`id`) ON DELETE CASCADE

### 3.6. Tabel `batch_rejects`
- `id` INT AUTO_INCREMENT PRIMARY KEY
- `batch_id` INT NOT NULL
- `stage` ENUM('cooking', 'packing') NOT NULL
- `reject_type` VARCHAR(100) NOT NULL (Misal: `Rusak`, `Jatuh ke lantai`, `Kulit`, `Serpihan`, `Serbuk`, `Gosong`, `Sampel QC`)
- `weight_kg` DECIMAL(10,2) NOT NULL
- FOREIGN KEY (`batch_id`) REFERENCES `production_batches`(`id`) ON DELETE CASCADE

### 3.7. Tabel `batch_outputs` (Rincian Packing / Sheet Belakang)
- `id` INT AUTO_INCREMENT PRIMARY KEY
- `batch_id` INT NOT NULL
- `pallet_no` VARCHAR(50) NULL
- `box_count` INT NULL
- `weight_kg` DECIMAL(10,2) NOT NULL
- `bstb_no` VARCHAR(100) NULL
- FOREIGN KEY (`batch_id`) REFERENCES `production_batches`(`id`) ON DELETE CASCADE

### 3.8. Tabel `audit_logs`
- `id` INT AUTO_INCREMENT PRIMARY KEY
- `batch_id` INT NULL
- `user_id` INT NOT NULL
- `action` VARCHAR(50) NOT NULL (Contoh: `IMPORT_BATCH`, `UPDATE_BATCH`, `DELETE_BATCH`)
- `details` TEXT NOT NULL
- `ip_address` VARCHAR(45) NULL
- `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)

---

## 4. Pemetaan Sel Template Excel (`LPP FP REV 2`)

### Sheet: `DEPAN`
1. **Identitas Batch:**
   - Nama Produk: `C4`
   - Kode Produk: `C5`
   - Tgl. Produksi: `E4`
   - Waktu Kerja (jam): `E5`
   - Line: `G4`
   - No. Batch: `G5`
   - % Total Meat: `K4`
   - % Rijek (form): `M4`
2. **Bahan Baku (Tabel Kiri):**
   - Baris 8–12 (SBB/Dp BL/BB, Skin, Emulsi, Terigu, SAP): Kolom C (Kode batch), Kolom D (Suhu °C), Kolom E (Berat kg)
   - Marinade/TSP: Baris 17–20 (Air, Suhu Air, Sayuran)
   - Lain-lain: Baris 24
   - Batter & Predust: Baris 28–35 (Batter, Air, Predust & Breader)
3. **Parameter Mesin (Tabel Tengah & Kanan):**
   - Suhu Ruang Meatprep: `G8`, Suhu Ruang Chillroom: `G9`
   - Bowl Cutter: Speed (`G11`), Suhu emulsi (`G12`)
   - Grinder: Ukuran Saringan (`G14`), Hasil (`G15`)
   - Mixer Preparation: Suhu Air (`G17`), Lama Pengadukan (`G18`), Filter (`G19`), Viscositas (`G20`), Salinitas (`G21`)
   - Mixer Unimix/Inotec: Suhu Adonan (`G23`)
   - Preparasi Fla: Suhu Fla after cooling (`G25`)
   - Tumbler: Drum Speed (`G28`), Total Lama Waktu (`G29`)
   - Revo / Forming / Rheon: Suhu Adonan (`G35`), Pressure (`G36`), Speed (`G37`)
   - Fryer: Suhu Seting (`M15`), Suhu Aktual (`M16`), Lama Pemasakan (`M17`), TPM Minyak (`M18`)
   - HLT: Suhu Awal Daging (`M20`), Suhu Infeed (`M21`), Suhu OutFeed (`M22`)
   - Suhu Pusat (CT): `M27`
4. **Rijek:**
   - Baris 41–47: Kolom C (Jenis: Rusak, Jatuh ke lantai, Kulit, Serpihan, Serbuk, Gosong, Sampel QC), Kolom D (Cooking kg), Kolom E (Packing kg)

### Sheet: `BELAKANG`
1. **Suhu & Ruang:**
   - Suhu Ruang Packing: `C4`, Suhu Ruang IQF: `C5`, Speed conveyor: `C6`, Suhu Pusat: `C7`
2. **Jumlah Produk (Output):**
   - Baris 20–25: Kolom G (Palet), Kolom H (Boks), Kolom I (Kg), Kolom J (No. BSTB)
   - Total Kg Output: Baris `Total` Kolom I

---

## 5. Alur Validasi & Impor

1. **Upload & Pre-check:**
   - MIME type `.xlsx`, max size 10MB.
   - Periksa hash berkas untuk mendeteksi file yang sudah pernah diimpor pada cabang yang sama.
2. **Parsing & Structural Validation:**
   - Verifikasi eksistensi sheet `DEPAN` dan `BELAKANG`.
   - Verifikasi sel identitas wajib (`Nama Produk`, `Tgl. Produksi`, `Line`, `No. Batch`).
   - Normalisasi format tanggal (DD/MM/YYYY atau serial Excel).
   - Validasi angka non-negatif pada berat dan parameter mesin.
3. **Session Preview:**
   - Data hasil parsing disimpan sementara dalam sesi pengguna (Memory / Cache).
   - Pengguna melihat ringkasan identitas, total bahan, parameter mesin, total rijek, dan output di UI pratinjau.
4. **Atomic Commit:**
   - Saat pengguna menekan "Konfirmasi Simpan", seluruh relasi batch disimpan dalam `BEGIN TRANSACTION` $\rightarrow$ `COMMIT`.
   - File temporary di server dihapus menggunakan `fs.unlink`.
   - Audit log dibuat otomatis.

---

## 6. Fitur Dashboard & Visualisasi

1. **KPI Cards:**
   - Total Batch Diproses
   - Total Output Baik (Kg)
   - Total Bahan Baku Digunakan (Kg)
   - Rasio Rijek Global (`Total Rijek Kg / (Output Baik Kg + Total Rijek Kg) * 100%`)
2. **Grafik Tren & Visualisasi (Chart.js):**
   - **Grafik 1 (Output & Bahan Baku):** Tren Bar/Line harian/mingguan kg output vs berat bahan per cabang/lini.
   - **Grafik 2 (Komposisi Rijek):** Donut & Stacked Bar rijek per jenis (Cooking vs Packing).
   - **Grafik 3 (Parameter Kualitas & Mesin):** Line chart parameter aktual mesin (contoh: Suhu Fryer Aktual, Suhu Pusat CT, TPM Minyak, Speed) dengan filter parameter dinamis.
3. **Tabel Ringkas (Data Table):**
   - Menampilkan daftar batch dan angka aktual yang menyusun grafik dengan tombol drill-down ke detail batch.
4. **Filter Interaktif:**
   - Rentang Tanggal (Date From - Date To)
   - Cabang (Dropdown, disabled untuk akun cabang, multi-select untuk pusat)
   - Produk (Dropdown)
   - Line (Line 1, 2, 3, dst.)
   - Parameter Mesin (Dropdown dinamis)

---

## 7. Rencana Pengujian (Testing Strategy)

1. **Unit Test Excel Parser (`tests/parser.test.js`):**
   - Pengujian pembacaan file Excel valid dan file cacat (sheet hilang, sel kosong, format tanggal tidak standar).
2. **Integration Test Transaksi & Validasi (`tests/validation.test.js`):**
   - Test rollback bila terjadi kegagalan insert.
   - Test pencegahan duplikasi batch number di cabang dan tanggal yang sama.
3. **RBAC & Isolation Test (`tests/rbac.test.js`):**
   - Memastikan request data oleh akun `Cabang A` tidak pernah mereturn data `Cabang B`.
   - Memastikan akun `Pusat` dapat mengakses agregasi seluruh cabang.

---

## 8. Persetujuan & Langkah Selanjutnya
Setelah spesifikasi ini disetujui, langkah berikutnya adalah memanggil skill `writing-plans` untuk menyusun rencana implementasi bertahap (TDD & sub-komponen).
