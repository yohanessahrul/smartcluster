# Smart Cluster - Next.js + shadcn/ui

Prototype frontend berbasis PRD Smart Cluster menggunakan:

- Next.js App Router
- Next.js Route Handlers API (`app/api/*`)
- PostgreSQL (bisa langsung ke Supabase PostgreSQL)
- Supabase Storage (upload bukti pembayaran IPL)
- Tailwind CSS
- shadcn/ui components
- Palette warna custom (tetap memakai tone hijau-teal + amber)
- PWA ready (manifest + service worker + offline page)
- Google OAuth + session cookie internal

## Menjalankan

```bash
npm install
cp .env.example .env.local
npm run dev
```

Inisialisasi database PostgreSQL:

```bash
psql "$DATABASE_URL" -f backend/schema.sql
psql "$DATABASE_URL" -f backend/seed.sql
```

## Integrasi Supabase (Database + Storage)

1. Buat project di Supabase (Free Tier).
2. Isi `.env.local`:
   - `DATABASE_URL` atau `SUPABASE_DB_URL` ke PostgreSQL Supabase (pooler).
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_STORAGE_BUCKET` (default: `payment-proofs`)
3. Jalankan schema ke DB Supabase:

```bash
psql "$DATABASE_URL" -f backend/schema.sql
```

Catatan:
- Upload bukti pembayaran IPL sudah otomatis ke Supabase Storage lewat endpoint `POST /api/storage/payment-proof`.
- Bucket akan dicoba dibuat otomatis saat upload pertama jika belum ada.

## Auto Redeploy Vercel (master)

Workflow CI/CD otomatis tersedia di:

- `.github/workflows/vercel-redeploy-master.yml`
- `scripts/redeploy-vercel.sh`

Trigger:

- setiap `push` ke branch `master`
- manual via `workflow_dispatch`

GitHub repository secrets yang wajib diset:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Service:

- Frontend + Backend API: `http://localhost:3000`

Route dashboard:

- `http://localhost:3000/login`
- `http://localhost:3000/dashboard`
- `http://localhost:3000/dashboard/admin`
- `http://localhost:3000/dashboard/admin/users`
- `http://localhost:3000/dashboard/admin/houses`
- `http://localhost:3000/dashboard/admin/bills`
- `http://localhost:3000/dashboard/admin/transactions`
- `http://localhost:3000/dashboard/warga`
- `http://localhost:3000/dashboard/warga/profile`
- `http://localhost:3000/dashboard/warga/tagihan`
- `http://localhost:3000/dashboard/warga/riwayat`
- `http://localhost:3000/dashboard/warga/laporan`

## Struktur

- `app/page.tsx` - halaman landing
- `app/api/*` - Next.js backend API (CRUD + generate IPL + pay QRIS)
- `backend/schema.sql` - schema PostgreSQL
- `backend/seed.sql` - data awal
- `app/dashboard/*` - route selector role + dashboard role-based
- `app/offline/page.tsx` - fallback halaman saat offline
- `app/pwa/icon-192/route.tsx` - icon PWA 192x192
- `app/pwa/icon-512/route.tsx` - icon PWA 512x512
- `app/globals.css` - token warna dan styling global
- `components/ui/*` - komponen shadcn yang dipakai
- `components/dashboard-sidebar.tsx` - menu dashboard admin
- `components/warga-sidebar.tsx` - menu dashboard warga
- `components/admin-access-guard.tsx` - guard role admin
- `components/warga-access-guard.tsx` - guard login + relasi house untuk warga
- `components/pwa-register.tsx` - registrasi service worker
- `components/login-form.tsx` - form login Google OAuth
- `app/api/auth/google/start/route.ts` - memulai OAuth Google
- `app/api/auth/google/callback/route.ts` - callback OAuth + validasi user table
- `app/api/auth/session/route.ts` - endpoint baca sesi login aktif
- `app/api/auth/logout/route.ts` - endpoint logout
- `lib/auth-client.ts` - auth client session + resolver role dan house by email
- `lib/api-client.ts` - client fetch ke backend Next.js API
- `lib/server/db.ts` - koneksi PostgreSQL untuk Next.js API
- `lib/server/smart-api.ts` - business logic backend (migrasi dari Express)
- `lib/server/supabase.ts` - helper Supabase Storage (upload bukti pembayaran)
- `lib/mock-data.ts` - type model + data fallback
- `lib/utils.ts` - helper `cn`
- `public/manifest.webmanifest` - konfigurasi PWA
- `public/sw.js` - service worker cache/offline
