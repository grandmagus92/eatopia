# ☕ Eatopia

Aplikasi Point of Sale (POS) modern untuk kedai kopi dan F&B. Eatopia membantu mencatat transaksi, mengelola menu, dan memantau penjualan lewat dashboard yang ringan dan responsif.

## ✨ Fitur

- 🧾 Pencatatan transaksi penjualan (kasir)
- 📋 Pengelolaan menu dan produk
- 📊 Dashboard dan grafik penjualan
- 📁 Ekspor / impor data ke Excel (`.xlsx`)
- ☁️ Penyimpanan data real-time dengan Supabase
- 📱 Tampilan responsif untuk desktop dan tablet

## 🛠️ Teknologi

| Kategori | Teknologi |
| --- | --- |
| Framework | [Next.js](https://nextjs.org/) 16 (App Router) |
| UI | React 19, [Tailwind CSS](https://tailwindcss.com/) 4, [Lucide React](https://lucide.dev/) |
| Backend & Database | [Supabase](https://supabase.com/) |
| Grafik | [Recharts](https://recharts.org/) |
| Utilitas | date-fns, SheetJS (xlsx) |
| Bahasa | TypeScript |

## 🚀 Memulai

### Prasyarat

- [Node.js](https://nodejs.org/) 20.9 atau lebih baru
- npm (atau yarn / pnpm)
- Akun dan project [Supabase](https://supabase.com/)

### Instalasi

1. Clone repository

   ```bash
   git clone https://github.com/grandmagus92/eatopia.git
   cd eatopia
   ```

2. Install dependensi

   ```bash
   npm install
   ```

3. Buat file `.env.local` di root project dan isi dengan kredensial Supabase

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

4. Jalankan server development

   ```bash
   npm run dev
   ```

5. Buka [http://localhost:3000](http://localhost:3000) di browser.

## 📜 Script yang Tersedia

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Menjalankan server development |
| `npm run build` | Membuat build production |
| `npm run start` | Menjalankan hasil build production |
| `npm run lint` | Mengecek kode dengan ESLint |

## 📁 Struktur Project

```
eatopia/
├── app/            # Halaman dan routing (Next.js App Router)
├── components/     # Komponen UI
├── lib/            # Helper dan konfigurasi (misalnya klien Supabase)
├── public/         # Aset statis
└── package.json
```

## ☁️ Deployment

Cara termudah adalah deploy ke [Vercel](https://vercel.com/). Jangan lupa menambahkan environment variable `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` di pengaturan project.

## 🤝 Kontribusi

1. Fork repository ini
2. Buat branch baru: `git checkout -b fitur/nama-fitur`
3. Commit perubahan: `git commit -m "Tambah fitur X"`
4. Push ke branch: `git push origin fitur/nama-fitur`
5. Buka Pull Request

## 👤 Author

**grandmagus92** — [GitHub](https://github.com/grandmagus92)
