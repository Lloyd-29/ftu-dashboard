# FTU Engineering System

Aplikasi internal untuk **PT Filosofi Teknik Utama** (engineering, inspection, consulting). Ini **bukan ERP keuangan**. Aplikasi hanya ditujukan untuk jaringan kantor/LAN; jangan dipublikasikan ke internet. Semua data dalam demo harus fiktif.

## Status dan baseline

- `main`: versi dashboard demo 21 Oktober 2026 (`demo-2026-10-21`). Jangan digeser sebelum ada persetujuan.
- `feature/engineering-system`: M1 akses/proyek, M2 tugas/verifikasi, M3 dokumen/review, M4 finishing.
- M1–M3 telah diverifikasi di Windows kantor sebelum M4. Jalankan regresi setelah memasang M4.
- Gunakan tag `m1-ok`, `m2-ok`, `m3-ok` untuk referensi. Tag `m4-ok` hanya dibuat setelah lulus pengujian.

## Teknologi

Laravel 13 + Sanctum (session/cookie + CSRF), PHP-FPM 8.4, MySQL 8 `utf8mb4`, Nginx 1.28, React 19 + TypeScript + Vite, Docker Compose. Zona waktu `Asia/Jakarta`, UI `id-ID`. Frontend build menggunakan font lokal tanpa CDN.

## Akses dan peran

| Peran | Hak akses utama |
|---|---|
| `admin` | Akses teknis, akun, seluruh proyek, review |
| `coordinator` | Pengelolaan proyek, tugas, verifikasi, dokumen, akun |
| `director` | Proyek dan review, riwayat; tanpa manajemen akun |
| `engineer` | Proyek/tugas sendiri, laporan lapangan dan dokumen sesuai penugasan |
| `viewer` | Hanya slideshow TV |

Tidak ada registrasi mandiri. Pengguna login dengan `username`, bukan email. Password sementara dibuat via `users:import` dan harus diganti saat login pertama. Hindari menyimpan password di file/log/chat. Pembatasan dilakukan di Laravel Policy/authorization, bukan hanya menu frontend.

## Kebutuhan lokal

- Docker Desktop pada Windows dengan Compose V2
- Node 22 melalui container (jika Node tidak tersedia di Windows)
- File `.env` proyek dan `backend/.env` lokal yang sudah disiapkan (tidak di-commit)
- Port repo default `127.0.0.1:8080:80`; konfigurasi LAN lokal tidak boleh dikirim ke repo
- `compose.override.yaml` berisi named volume `ftu_uploads` untuk berkas privat

**Penting:** M4 tidak mengandung migrasi database baru. Jangan jalankan `migrate:fresh`, `db:wipe`, `docker compose down -v`, atau impor ulang akun hanya untuk menguji tampilan.

## Menjalankan dan memeriksa

Jalankan dari root repo di PowerShell:

```powershell
docker compose config --quiet
docker compose up -d
docker compose ps
curl.exe -s -o NUL -w "%{http_code}" http://127.0.0.1:8080/api/health
```

Untuk build frontend dengan Node container:

```powershell
docker run --rm -v "${PWD}\frontend:/app" -w /app node:22-alpine sh -lc 'npm ci && npm run build'
```

Apabila DNS Docker bermasalah (contohnya `EAI_AGAIN`), periksa koneksi terlebih dahulu. Override DNS sementara hanya bila diperlukan dan disetujui pengelola jaringan. Jangan menyimpan perubahan DNS global yang belum diuji.

Untuk regresi backend (SQLite in-memory, tanpa menyentuh data MySQL demo):

```powershell
docker compose exec -T -e APP_ENV=testing -e DB_CONNECTION=sqlite -e DB_DATABASE=:memory: app php artisan test
```

## Halaman

- `/dashboard`: slideshow TV tanpa menu; empat slide otomatis, pembaruan berkala, `?lite=1` mengurangi animasi
- `/proyek`: proyek, progres, status, assignment, risiko, temuan, catatan dan peringatan
- `/tugas`: tugas saya / semua tugas menurut role
- `/verifikasi`: verifikasi lapangan dan review coordinator
- `/dokumen`: PDF privat, revisi, review dan status menunggu review
- `/riwayat`: baca aktivitas (admin, coordinator, director)
- `/akun`: daftar, reset password, deaktivasi (admin, coordinator)

## Penyimpanan dokumen

PDF hanya melalui rute terautentikasi, validasi tipe/isi file, maksimum 15 MB. Berkas privat disimpan pada volume `ftu_uploads` dan **tidak** boleh dipasang ke Nginx sebagai direktori publik. Sebelum mengubah konfigurasi volume, cek `docker compose config` dan rencanakan migrasi berkas/backup. Backup wajib mencakup database **dan** isi volume PDF; uji restore pada tahap deployment setelah 2 November.

## Mengelola akun

Akun baru dibuat memakai CSV dengan kolom `name,username,role,engineer_id,initials`. Untuk impor akun kantor, `engineer_id` adalah ID dari database target (cek lewat admin/CLI); impor menolak ID yang tidak valid. Jangan gunakan `--reset-existing` tanpa rencana rotasi password dan persetujuan.

`backend/database/demo-users.csv` **khusus template untuk `UserSeeder`**: dua kolom `engineer_id` berisi nama engineer stabil dan akan diresolusikan oleh `UserSeeder` ke ID saat seed. Template ini **bukan** file CSV langsung untuk `users:import`.

M4 memperbaiki `UserSeeder` agar gagal eksplisit saat impor gagal. Seeder tidak mengubah password akun yang sudah ada. Jangan jalankan ulang seluruh `DatabaseSeeder` untuk perbaikan tanggal demo.

## Penyegaran tanggal demo 2 November

`demo:prepare-presentation` adalah perintah **preview saja** secara default dan tidak mengubah data:

```powershell
docker compose exec -T app php artisan demo:prepare-presentation
```

Setelah memverifikasi delapan proyek fiktif, mengambil backup SQL terbaru dan mendapat persetujuan, jalankan pada **30 Oktober–2 November 2026**:

```powershell
docker compose exec -T app php artisan demo:prepare-presentation --apply
```

Hanya proyek dengan kode yang terdaftar dan nama klien berakhiran ` Demo` yang diperbarui pada tanggal milestone; versi proyek dan activity log ikut naik. Perintah tidak mereset tugas, dokumen, akun atau password. Ini untuk demonstrasi, **bukan data pekerjaan nyata**.

## Perubahan, pengujian dan keamanan

Jalankan `git status` dan `git diff --cached --check` sebelum commit. Jangan stage `.env`, `compose.yaml` lokal, `backend/AGENTS.md`, `backend/CLAUDE.md`, `vendor`, `node_modules`, `frontend/dist`, upload, dump SQL, atau PDF klien. `main` hanya di-merge atas perintah eksplisit. Dokumentasi demo dan rehearsal tersedia pada `docs/DEMO-2026-11-02.md`.

Masih menunggu keputusan supervisor mengenai kepemilikan kode, kebijakan penggunaan AI, serta retensi dokumen; jangan menaruh data klien asli di alat AI atau repository sebelum ada izin. Server Windows 11 belum dipastikan spesifikasi/izin Docker; tahap deployment, backup terjadwal dan restore test setelah presentasi.
