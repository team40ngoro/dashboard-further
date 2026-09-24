# PRD Dashboard Laporan Pengendalian Produk Food Division

**Versi:** 0.2  
**Tanggal:** 24 September 2026  
**Status:** Rancangan untuk validasi proses dan data

Dokumen ini mendefinisikan aplikasi pusat yang menerima form LPP Excel dari cabang, menyimpan sebagian data angka yang dibutuhkan, lalu menyajikannya sebagai grafik lintas cabang. Rancangan mengacu pada template `LPP FP REV 2(3).xlsx` dengan sheet `DEPAN` dan `BELAKANG`. Template yang tersedia masih kosong; pemetaan sel dan definisi metrik harus diperiksa pada contoh file yang telah diisi sebelum implementasi impor final.

## 1. Tujuan dan ukuran keberhasilan

Pengguna pusat dapat memantau tren berat dan parameter aktual proses per cabang, produk, line, serta periode tanpa membuka setiap berkas Excel. Cabang cukup mengunggah laporan yang sudah digunakan dalam proses kerja.

| Ukuran keberhasilan MVP | Target penerimaan |
| --- | --- |
| Kelengkapan impor | Semua file sesuai versi template dan memiliki identitas wajib diproses; file lain ditolak dengan alasan jelas. |
| Akurasi angka | Angka pada pratinjau dan grafik cocok dengan sel sumber pada sampel uji yang disetujui pemilik proses. |
| Isolasi cabang | Akun cabang hanya dapat melihat serta mengelola data cabangnya; akun pusat dapat melihat agregat yang diizinkan. |
| Berkas sementara | Berkas dihapus sesudah penyimpanan berhasil; berkas impor gagal dibersihkan sesuai kebijakan retensi sementara. |

## 2. Pengguna dan hak akses

| Peran | Kebutuhan | Cakupan |
| --- | --- | --- |
| Pengunggah cabang | Unggah Excel, lihat pratinjau, status impor, dan koreksi laporan milik cabang. | Cabang yang ditetapkan pada akun. |
| Pembaca cabang | Lihat grafik serta data ringkas. | Cabang yang ditetapkan pada akun. |
| Analis pusat | Lihat dashboard gabungan dan filter lintas cabang. | Seluruh cabang yang diberikan akses. |
| Admin pusat | Kelola akun, cabang, versi template, dan koreksi impor. | Seluruh cabang; setiap koreksi tercatat. |

Cabang sumber selalu berasal dari akun pengunggah, bukan nama cabang yang tertulis di file. Semua pembacaan, ekspor ringkasan, dan pembaruan data menerapkan pembatasan cabang pada server.

## 3. Cakupan MVP

- Login, pengelolaan cabang dan akun dengan hak akses di atas.
- Unggah satu workbook `.xlsx` untuk satu laporan batch; pemeriksaan versi template, isi wajib, dan batas ukuran file.
- Pratinjau data hasil ekstraksi sebelum konfirmasi; simpan data terpilih dan tampilkan hasil atau kesalahan impor.
- Dashboard berfilter tanggal, cabang, produk, line, dan parameter mesin; tabel angka ringkas untuk memeriksa grafik.
- Pencatatan identitas impor, pengunggah, waktu impor teknis, status, dan versi pemetaan tanpa menyimpan dokumen asli.

**Di luar MVP:** Input ulang seluruh form sebagai formulir web, data operator dan petugas, jam kerja serta downtime, produktivitas per jam, integrasi mesin otomatis, pembacaan PDF atau foto, laporan QC lengkap, dan sistem notifikasi.

## 4. Data yang disimpan

| Kelompok | Contoh pada template | Aturan MVP |
| --- | --- | --- |
| Identitas | `DEPAN`, baris 4–5: nama/kode produk, tanggal produksi, line, nomor batch. | Wajib. Cabang dari akun; nomor batch harus unik dalam cakupan identitas yang disepakati. |
| Berat bahan | `DEPAN`, kolom D pada baris bahan baku, batter, predust dan breader. | Simpan item serta kg yang terisi; baris Total, Penggunaan dan Sisa diperlakukan terpisah agar tidak terhitung ganda. |
| Aktual mesin | `DEPAN`, kolom F dan O: suhu adonan, speed, pressure, suhu aktual fryer, TPM, dan parameter terpilih. | Simpan mesin, parameter, nilai, satuan, dan tipe aktual. Simpan hanya yang disetujui pusat; sel kosong tetap `null`. |
| Rijek | `DEPAN`, kolom F–G baris 53–59: jenis rijek untuk cooking dan packing. | Simpan kg dan kategori secara terpisah; total hasil hitung diverifikasi terhadap total pada form. |
| Output dan berat packing | `BELAKANG`: berat per bag/boks dan JUMLAH PRODUK. | Masuk MVP jika pemilik proses mengonfirmasi definisi output yang konsisten di semua cabang. |

Nilai setelan mesin dan nilai aktual tidak digabung. Satuan setiap parameter perlu daftar baku; grafik tidak boleh mencampur kg, °C, RPM, atau satuan lain pada satu seri numerik.

## 5. Alur impor dan aturan data

1. Cabang login dan memilih Excel. Aplikasi membatasi tipe serta ukuran file, lalu menyimpannya sementara di area privat.
2. Sistem memastikan sheet `DEPAN` dan `BELAKANG` serta label penanda versi template tersedia, lalu membaca hanya sel yang dipetakan.
3. Sistem memvalidasi identitas wajib, angka, satuan, rentang yang disepakati, dan duplikasi batch. Pratinjau menunjukkan nilai, data kosong, dan kesalahan; belum ada perubahan pada data dashboard.
4. Pengguna mengonfirmasi. Data batch dan rinciannya disimpan dalam satu transaksi; jika gagal, transaksi dibatalkan seluruhnya.
5. Sistem menampilkan ringkasan impor dan menghapus file sementara setelah transaksi berhasil. Kegagalan maupun unggahan yang ditinggalkan dibersihkan lewat jadwal otomatis.

Unggah ulang file yang sama tidak boleh menggandakan batch. Perubahan angka pada batch yang sudah ada memerlukan tindakan koreksi eksplisit oleh peran berwenang; catat siapa, kapan, dan apa yang diganti. Simpan hash berkas atau identitas impor untuk mendeteksi duplikasi tanpa menyimpan Excel.

## 6. Dashboard dan rumus

| Tampilan | Definisi awal | Filter |
| --- | --- | --- |
| Berat bahan | Total kg dari item bahan yang dipilih; baris subtotal pada form tidak dijumlahkan lagi. | Periode, cabang, produk, line, kategori bahan. |
| Output produksi | Total kg produk dari sumber output yang ditetapkan satu kali per batch. | Periode, cabang, produk, line. |
| Rijek | Total kg cooking dan packing per jenis; rasio hanya bila penyebut disetujui. | Periode, cabang, produk, line, tahap rijek. |
| Aktual mesin | Tren nilai aktual satu parameter dan satuan pada satu waktu; tampilkan jumlah observasi. | Periode, cabang, produk, line, mesin, parameter. |

Dashboard menampilkan jumlah batch yang termasuk dalam setiap agregat. Nilai kosong tidak diubah menjadi nol. Jika rasio rijek disetujui sebagai `rijek kg / (output baik kg + rijek kg)`, hitung dari jumlah pembilang dan penyebut dalam filter yang sama, bukan rata-rata persentase per batch. Tanpa jam kerja, metrik produktivitas per jam tidak tersedia.

## 7. Kebutuhan fungsional dan kriteria penerimaan

| ID | Kebutuhan | Kriteria penerimaan |
| --- | --- | --- |
| FR01 | Isolasi akses cabang | Akun cabang tidak dapat melihat batch cabang lain lewat halaman, URL langsung, maupun permintaan data grafik. |
| FR02 | Validasi unggahan | Template yang salah, tanggal atau batch kosong, nilai angka tidak sah, dan duplikat ditolak dengan penjelasan yang menunjuk field terkait. |
| FR03 | Pratinjau dan simpan | Pratinjau menunjukkan angka sumber yang dipilih; pembatalan tidak membuat batch. Kegagalan simpan tidak membuat data parsial. |
| FR04 | Koreksi impor | Akun berwenang dapat mengganti data batch secara eksplisit dan audit perubahan tersimpan; tidak membuat salinan batch. |
| FR05 | Grafik dan filter | Filter cabang, produk, line, dan periode menghasilkan angka yang sama dengan tabel ringkasan dan perhitungan sampel manual. |
| FR06 | Penghapusan file | Unggahan berhasil hilang dari penyimpanan sementara; unggahan gagal atau terbengkalai dibersihkan sesuai jadwal. |

## 8. Kebutuhan teknis

Aplikasi monolitik menggunakan Node.js LTS, Express 5, EJS untuk halaman server, MySQL dengan `mysql2` untuk akses data, Chart.js untuk grafik, ExcelJS untuk membaca `.xlsx`, dan Multer untuk menerima unggahan. Login memakai sesi berbasis cookie dengan penyimpanan sesi di database. Tidak diperlukan React, ORM, Redis, atau layanan API terpisah pada MVP. Impor dijalankan langsung bila ukuran dan waktu proses sampel masih nyaman; proses latar belakang baru ditambahkan bila pengukuran nyata menunjukkan kebutuhan.

Indeks database mengikuti filter cabang, tanggal produksi, produk, line, serta identitas unik batch. Pengukuran mesin disimpan sebagai baris per parameter agar daftar mesin dapat berkembang tanpa menambah kolom setiap kali. Validasi file dan angka berjalan di server. Batasi ukuran unggahan pada Multer dan reverse proxy sesuai sampel nyata. Simpan file sementara pada disk privat, hapus sesuai alur impor, dan hindari mencatat isinya di log. Gunakan HTTPS, cookie sesi yang aman, perlindungan CSRF pada form, backup database, serta audit koreksi. Waktu impor teknis boleh disimpan untuk jejak perubahan meskipun waktu kerja produksi tidak diambil.

## 9. Asumsi, keputusan terbuka, dan risiko

| Hal yang perlu diputuskan | Dampak pada rancangan |
| --- | --- |
| Contoh Excel terisi dari beberapa cabang. | Memastikan posisi sel, format angka/tanggal, kemungkinan variasi template, serta satu file benar-benar mewakili satu batch. |
| Daftar final parameter aktual dan satuan. | Menentukan field yang diimpor dan seri grafik yang dapat dibandingkan. |
| Definisi kg output baik, rijek, dan persentase rijek. | Mencegah rasio berbeda antar cabang atau penghitungan ganda. |
| Hak akses pembaca pusat dan proses koreksi. | Menentukan siapa dapat melihat cabang lain dan siapa dapat memperbaiki angka. |
| Perlukah angka packing di MVP. | Memutuskan apakah sheet `BELAKANG` perlu diekstrak selain untuk validasi template. |

Rilis awal harus diuji dengan minimal satu file terisi dari tiap variasi template yang ditemukan. Bandingkan hasil ekstraksi dengan pembacaan manual sampel, termasuk nilai kosong, angka desimal, batch ganda, file salah versi, dan file dengan total tidak cocok.

## 10. Urutan pengerjaan

1. Tetapkan pemilik metrik, parameter aktual, dan contoh file terisi.
2. Bangun impor, validasi, pratinjau, dan isolasi cabang.
3. Tambahkan grafik serta uji silang angka.
4. Uji coba dua cabang dengan variasi file nyata sebelum diterapkan ke seluruh Food Division.

**Sumber internal:** `LPP FP REV 2.xlsx` dan versi PDF yang menyertainya, diperiksa 24 September 2026. Template sumber kosong; koordinat sel dalam PRD adalah petunjuk pemetaan awal, bukan spesifikasi ekstraksi final.
