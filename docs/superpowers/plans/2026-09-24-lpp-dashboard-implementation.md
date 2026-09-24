# LPP Food Division Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun aplikasi web monolitik Node.js/Express 5 & MySQL untuk mengunggah, mengekstrak secara atomik, mengisolasi data per cabang, dan memvisualisasikan data laporan pengendalian produk Food Division (`LPP FP REV 2`).

**Architecture:** MVC Monolith menggunakan Express 5, EJS templating dengan modern styling (custom CSS & micro-interactions), MySQL2 dengan connection pool dan auto-migration, ExcelJS untuk parser template Excel multi-sheet, Multer untuk file upload sementara dengan cleanup otomatis, dan Chart.js untuk visualisasi tren interaktif.

**Tech Stack:** Node.js LTS, Express 5, EJS, MySQL2, ExcelJS, Multer, Chart.js, bcryptjs, express-session, express-mysql-session, dotenv, node:test / assert.

**Spec:** `docs/superpowers/specs/2026-09-24-lpp-dashboard-design.md`

## Global Constraints
- Node.js version >= 20.x, Express 5.
- MySQL database access via `mysql2/promise` with robust fallback/connection handling.
- Branch data isolation enforced strictly at the database query layer (`branch_id` query constraint for branch accounts).
- Excel upload only accepts `.xlsx`, validates `DEPAN` and `BELAKANG` sheets, checks mandatory batch identity fields, and removes uploaded temp files immediately after processing.
- Machine metrics stored using EAV pattern (`batch_machine_metrics`) for extensibility.
- UI styling must be clean, modern, responsive, and follow enterprise dashboard standards.

---

### Task 1: Project Scaffolding, Dependencies & Database Migration Runner

**Files:**
- Create: `package.json`
- Create: `.env.example`
- Create: `config/database.js`
- Create: `database/schema.sql`
- Create: `database/seed.sql`
- Create: `database/migrate.js`
- Test: `tests/db.test.js`

**Interfaces:**
- Consumes: Environment variables (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `SESSION_SECRET`, `PORT`)
- Produces: `getDbPool()`, `runMigrations()`, `query(sql, params)`, `transaction(callback)`

- [ ] **Step 1: Write database test script**
Write `tests/db.test.js` to verify pool initialization, migration runner, and basic query execution.

- [ ] **Step 2: Run test to verify it fails**
Run: `node --test tests/db.test.js`
Expected: FAIL (missing dependencies and modules)

- [ ] **Step 3: Implement package.json, dependencies, config/database.js, schema.sql, seed.sql, and migrate.js**
Initialize `package.json` with Express 5, mysql2, exceljs, multer, ejs, bcryptjs, express-session, dotenv, etc.
Create `config/database.js` with connection pooling, transaction wrapper, and auto-migration invocation.
Create `database/schema.sql` and `database/seed.sql` with tables: `branches`, `users`, `production_batches`, `batch_materials`, `batch_machine_metrics`, `batch_rejects`, `batch_outputs`, `audit_logs`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm install && node --test tests/db.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add package.json config/ database/ tests/db.test.js
git commit -m "feat: project scaffolding, database schema, and migration runner"
```

---

### Task 2: Excel Parser Service for LPP FP REV 2

**Files:**
- Create: `services/excelParser.js`
- Create: `services/sampleExcelGenerator.js`
- Test: `tests/parser.test.js`

**Interfaces:**
- Consumes: Buffer or file path of an uploaded `.xlsx` file
- Produces: `parseLppExcel(filePath)` returning `{ identity, materials, machineMetrics, rejects, outputs, rawDataHash, errors }`

- [ ] **Step 1: Write test for Excel parser**
Write `tests/parser.test.js` covering valid Excel parsing, missing sheet detection, invalid identity extraction, and correct calculation of subtotal/metric items.

- [ ] **Step 2: Run test to verify it fails**
Run: `node --test tests/parser.test.js`
Expected: FAIL (modules not found)

- [ ] **Step 3: Implement sampleExcelGenerator.js and excelParser.js**
Implement `sampleExcelGenerator.js` using `exceljs` to construct mock `.xlsx` matching `LPP FP REV 2` format (DEPAN & BELAKANG).
Implement `services/excelParser.js` to extract header identity (Nama Produk, Kode Produk, Tgl Produksi, Line, No Batch, % Total Meat), Bahan Baku, Parameter Mesin (Bowl cutter, Fryer, HLT, Tumbler, Mixer, dll.), Rijek (Cooking & Packing), dan Output produk.

- [ ] **Step 4: Run test to verify it passes**
Run: `node --test tests/parser.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add services/excelParser.js services/sampleExcelGenerator.js tests/parser.test.js
git commit -m "feat: excel parser service for LPP FP REV 2 template"
```

---

### Task 3: Validation Engine & Import Pipeline

**Files:**
- Create: `services/validationService.js`
- Test: `tests/validation.test.js`

**Interfaces:**
- Consumes: Parsed data object from `excelParser.js` + DB connection to check duplicate batch
- Produces: `validateBatchData(parsedData, branchId)` returning `{ isValid, errors: [], warnings: [], sanitizedData }`

- [ ] **Step 1: Write test for validation engine**
Write `tests/validation.test.js` to test checking mandatory fields, numeric range sanity, date format parsing, and duplicate batch hash/number check.

- [ ] **Step 2: Run test to verify it fails**
Run: `node --test tests/validation.test.js`
Expected: FAIL

- [ ] **Step 3: Implement validationService.js**
Validate required identity fields, non-negative numbers, temperature ranges, date consistency, and duplicate detection per branch.

- [ ] **Step 4: Run test to verify it passes**
Run: `node --test tests/validation.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add services/validationService.js tests/validation.test.js
git commit -m "feat: batch validation and duplicate checking service"
```

---

### Task 4: Authentication, Authorization & Branch Isolation

**Files:**
- Create: `config/auth.js`
- Create: `middleware/authMiddleware.js`
- Create: `middleware/branchIsolation.js`
- Create: `controllers/authController.js`
- Create: `routes/authRoutes.js`
- Create: `views/auth/login.ejs`
- Test: `tests/rbac.test.js`

**Interfaces:**
- Consumes: User credentials & HTTP session
- Produces: `requireAuth`, `requireRole(roles)`, `enforceBranchScope(req, res, next)`, session management

- [ ] **Step 1: Write test for RBAC and branch isolation**
Write `tests/rbac.test.js` verifying that `pengunggah_cabang` and `pembaca_cabang` are strictly confined to their own `branch_id`, while `analis_pusat` and `admin_pusat` have cross-branch access.

- [ ] **Step 2: Run test to verify it fails**
Run: `node --test tests/rbac.test.js`
Expected: FAIL

- [ ] **Step 3: Implement auth middleware, controllers, routes and login view**
Build bcrypt-based credential verification, session setup, RBAC role guard, branch isolation middleware, and responsive login screen.

- [ ] **Step 4: Run test to verify it passes**
Run: `node --test tests/rbac.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add config/auth.js middleware/ controllers/authController.js routes/authRoutes.js views/auth/ tests/rbac.test.js
git commit -m "feat: authentication, rbac and branch isolation middleware"
```

---

### Task 5: Upload, Preview & Atomic Batch Commit

**Files:**
- Create: `middleware/uploadMiddleware.js`
- Create: `controllers/uploadController.js`
- Create: `routes/uploadRoutes.js`
- Create: `views/upload/form.ejs`
- Create: `views/upload/preview.ejs`
- Test: `tests/upload.test.js`

**Interfaces:**
- Consumes: Multipart form data with `.xlsx` file
- Produces: Upload handler, preview renderer with validation badges, atomic DB commit endpoint with cleanup of temporary file

- [ ] **Step 1: Write test for upload and preview lifecycle**
Write `tests/upload.test.js` testing file upload validation, preview session extraction, rollback on DB error, and automatic unlinking of uploaded files.

- [ ] **Step 2: Run test to verify it fails**
Run: `node --test tests/upload.test.js`
Expected: FAIL

- [ ] **Step 3: Implement uploadMiddleware, uploadController, uploadRoutes and views**
Configure Multer storage in `./temp_uploads`, file filter `.xlsx` max 10MB.
Implement preview page displaying Batch info, Material summary, Machine parameters table, Rejects breakdown, and Output products.
Implement `commitBatch` controller executing atomic MySQL transaction inserting into `production_batches`, `batch_materials`, `batch_machine_metrics`, `batch_rejects`, and `batch_outputs`, followed by immediate file unlinking.

- [ ] **Step 4: Run test to verify it passes**
Run: `node --test tests/upload.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add middleware/uploadMiddleware.js controllers/uploadController.js routes/uploadRoutes.js views/upload/ tests/upload.test.js
git commit -m "feat: file upload, interactive preview, and atomic batch commit"
```

---

### Task 6: Batch Management, Drill-down & Correction Audit Log

**Files:**
- Create: `controllers/batchController.js`
- Create: `routes/batchRoutes.js`
- Create: `views/batches/list.ejs`
- Create: `views/batches/detail.ejs`
- Create: `views/batches/edit.ejs`
- Test: `tests/batch.test.js`

**Interfaces:**
- Consumes: Filter query params & batch ID
- Produces: Paginated batch list, full batch detail view with sheet layout representation, batch update with audit trail (`audit_logs`)

- [ ] **Step 1: Write test for batch listing, detail and audit logging**
Write `tests/batch.test.js` verifying branch filtering, batch detail data retrieval, and audit record creation on batch edits.

- [ ] **Step 2: Run test to verify it fails**
Run: `node --test tests/batch.test.js`
Expected: FAIL

- [ ] **Step 3: Implement batch controller, routes and EJS views**
Build filterable batch list (by date, branch, product, line), complete batch inspector matching LPP sheet sections, and authorized correction modal/form that logs who, when, and what values changed.

- [ ] **Step 4: Run test to verify it passes**
Run: `node --test tests/batch.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add controllers/batchController.js routes/batchRoutes.js views/batches/ tests/batch.test.js
git commit -m "feat: batch list, detail inspection, and correction audit logging"
```

---

### Task 7: Dashboard Service, Analytics API & Visualization UI

**Files:**
- Create: `services/dashboardService.js`
- Create: `controllers/dashboardController.js`
- Create: `routes/dashboardRoutes.js`
- Create: `views/dashboard/index.ejs`
- Create: `public/js/dashboard.js`
- Create: `public/css/style.css`
- Test: `tests/dashboard.test.js`

**Interfaces:**
- Consumes: Filter params (`startDate`, `endDate`, `branchId`, `productCode`, `line`, `machineParam`)
- Produces: Aggregate KPIs, time series trends for Output vs Material, Rejects composition, Machine parameters trend, and dynamic API endpoint `/api/dashboard/metrics`

- [ ] **Step 1: Write test for dashboard metrics aggregation**
Write `tests/dashboard.test.js` verifying aggregate calculations: Total Output Kg, Total Material Kg, Rejects Ratio formula (`Total Reject / (Output Good + Total Reject) * 100`), and machine metric groupings.

- [ ] **Step 2: Run test to verify it fails**
Run: `node --test tests/dashboard.test.js`
Expected: FAIL

- [ ] **Step 3: Implement dashboardService, controller, routes, views, style.css, and client-side Chart.js script**
Build high-performance SQL aggregation in `dashboardService.js`.
Create enterprise-grade UI in `views/dashboard/index.ejs` with KPI summary cards, filter toolbar, responsive Chart.js widgets (Bar/Line for Output & Material, Doughnut for Reject Types, Line for Machine Parameters), and synchronized summary data table.
Implement `public/js/dashboard.js` for instant AJAX updates on filter changes.

- [ ] **Step 4: Run test to verify it passes**
Run: `node --test tests/dashboard.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add services/dashboardService.js controllers/dashboardController.js routes/dashboardRoutes.js views/dashboard/ public/ tests/dashboard.test.js
git commit -m "feat: interactive dashboard, analytics service, and charts"
```

---

### Task 8: Branch & User Administration (Admin Pusat)

**Files:**
- Create: `controllers/adminController.js`
- Create: `routes/adminRoutes.js`
- Create: `views/admin/branches.ejs`
- Create: `views/admin/users.ejs`
- Create: `views/layouts/header.ejs`
- Create: `views/layouts/footer.ejs`
- Create: `views/layouts/navbar.ejs`
- Test: `tests/admin.test.js`

**Interfaces:**
- Consumes: Admin HTTP requests for managing branches and user accounts
- Produces: CRUD endpoints for branches and users, unified layout components

- [ ] **Step 1: Write test for admin management**
Write `tests/admin.test.js` testing branch creation/list and user management with password hashing.

- [ ] **Step 2: Run test to verify it fails**
Run: `node --test tests/admin.test.js`
Expected: FAIL

- [ ] **Step 3: Implement admin controller, routes, views and shared navigation layouts**
Build branch manager, user account manager, role assigner, and unified responsive navigation header/sidebar.

- [ ] **Step 4: Run test to verify it passes**
Run: `node --test tests/admin.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add controllers/adminController.js routes/adminRoutes.js views/admin/ views/layouts/ tests/admin.test.js
git commit -m "feat: admin portal for branch and user management"
```

---

### Task 9: Main Application Entrypoint, End-to-End Verification & Demo Data Seeding

**Files:**
- Create: `server.js`
- Create: `scripts/generateSampleBatches.js`
- Test: `tests/e2e.test.js`

**Interfaces:**
- Consumes: Express app configuration, route mounting, error handling
- Produces: Running server on specified port, automatic sample data seeder

- [ ] **Step 1: Write end-to-end integration test**
Write `tests/e2e.test.js` simulating full user flow: Login $\rightarrow$ Upload sample Excel $\rightarrow$ Preview $\rightarrow$ Commit $\rightarrow$ Fetch Dashboard Metrics $\rightarrow$ Verify Branch Isolation.

- [ ] **Step 2: Run test to verify it fails**
Run: `node --test tests/e2e.test.js`
Expected: FAIL

- [ ] **Step 3: Implement server.js, sample data generator script, and error handling**
Assemble Express application in `server.js` with all middlewares, session store, route handlers, 404/500 error pages, and graceful shutdown.
Build `scripts/generateSampleBatches.js` to seed realistic multi-branch LPP data for instant demo and validation.

- [ ] **Step 4: Run full test suite and verify end-to-end flow**
Run: `npm test`
Expected: ALL PASS

- [ ] **Step 5: Commit**
```bash
git add server.js scripts/ tests/e2e.test.js
git commit -m "feat: application entrypoint, full e2e integration, and sample data generator"
```
