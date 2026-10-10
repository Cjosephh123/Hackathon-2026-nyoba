# 📚 PENS Digital Library Platform

An integrated, modern digital library management system designed for **Politeknik Elektronika Negeri Surabaya (PENS)**. This platform streamlines academic resource management, digital catalog browsing, book borrowing workflows, and library analytics for students, faculty, and administrators.

---

## 📑 Table of Contents
- [Project Overview](#-project-overview)
- [Key Features](#-key-features)
- [System Architecture & Workflow](#-system-architecture--workflow)
- [Tech Stack](#-tech-stack)
- [Codebase Structure](#-codebase-structure)
- [Core Business Logic & Algorithms](#-core-business-logic--algorithms)
- [Quick Start Guide for Judges](#-quick-start-guide-for-judges)
- [Evaluation Cheat Sheet](#-evaluation-cheat-sheet)

---

---

## 🤖 Fitur Utama: Dual-Engine AI Assistant

Modul AI Assistant dirancang dengan arsitektur dua peran (Siswa & Staf Pustakawan) yang beroperasi secara real-time di atas database katalog dan data log IoT perpustakaan.

### 1. AI Assistant untuk Siswa (Smart Book Consultation & Matching)
* **Konsultasi & Rekomendasi Buku Personal:** Siswa dapat berkonsultasi mengenai topik belajar, tugas akhir, atau minat baca melalui interaksi percakapan alami.
* **Verifikasi Real-Time Database:** Setiap rekomendasi buku di-match secara langsung dengan ketersediaan stok fisik, nomor panggil (call number), dan lokasi rak dalam database perpustakaan.
* **Pencarian Konseptual (Semantic Search):** Siswa dapat mencari buku berdasarkan deskripsi konteks (contoh: *"Saya mau belajar dasar pemrograman Python untuk analisis data"*), dan AI akan mereferensikan buku yang relevan di rak.

---

### 2. AI untuk Staf & Pustakawan (Analytics & Inventory Intelligence)
* **Analisis Penggunaan & Tren Perpustakaan:** Staf dapat berkonsultasi secara interaktif mengenai data statistik perpustakaan (contoh: *"Buku kategori apa yang paling sering dipinjam bulan ini?"* atau *"Berapa rata-rata durasi peminjaman buku IoT?"*).
* **Integrasi IoT NFC Reader Smart Rack:**
  * Setiap rak buku dilengkapi dengan modul NFC Reader untuk mendeteksi pergerakan fisik buku (check-in, check-out, misplacement) secara otomatis tanpa manual scanning.
  * Data deteksi NFC langsung diteruskan ke AI untuk memperbarui status ketersediaan dan log aktivitas secara real-time.
* **Analisis Kekurangan Katalog (Catalog Gap Analysis):**
  * AI menganalisis riwayat pencarian siswa yang tidak membuahkan hasil (unmatched queries), tren peminjaman yang overbooked, serta perbandingan kebutuhan akademis.
  * AI memberikan saran proaktif kepada staf mengenai judul, kriteria, atau subjek buku yang perlu ditambah/dibeli untuk melengkapi koleksi perpustakaan.

---

## 📐 Arsitektur Alur Sistem (AI & NFC Integration)
[ Siswa / Pustakawan ]
│
▼
[ Interface AI Assistant ] ──(Natural Language Query)
│
├──► Mode Siswa ──► RAG Engine ──► Sync DB Perpustakaan ──► Lokasi Rak & Stok
│
└──► Mode Staf  ──► Analytics Engine ┬──► Log Transaksi DB
├──► NFC Smart Rack Stream (IoT)
└──► Unmet Search Query Log (Gap Analysis)

---

## 📊 Alur Kerja Modul Pintar

### Workflow Konsultasi Siswa
1. **Input Query:** Siswa memasukkan pertanyaan atau topik kebutuhan.
2. **Retrieval-Augmented Generation (RAG):** AI melakukan pencarian vektor (Vector Search) pada database katalog perpustakaan.
3. **Filter Ketersediaan:** Sistem memverifikasi status peminjaman buku.
4. **Respon Cerdas:** AI memberikan ringkasan rekomendasi beserta posisi rak dan jumlah eksemplar yang tersedia.

### Workflow Tracking NFC & Analisis Staf
1. **Pergerakan Buku:** Tag NFC pada buku terdeteksi oleh NFC Reader di rak.
2. **Log System Update:** Perubahan status (masuk/keluar rak) tercatat otomatis di database.
3. **Analisis AI:** AI mengolah data log untuk menghasilkan wawasan penggunaan rak, frekuensi baca di tempat, dan rekomendasi pengadaan koleksi baru.

---

## 🛠️ Ringkasan Fitur AI & Fitur Utama Sistem

| Peran Pengguna | Fitur AI / Teknologi | Fungsi Utama |
| :--- | :--- | :--- |
| **Siswa** | AI Consultation & DB Sync | Konsultasi bacaan, rekomendasi relevan, cek stok real-time |
| **Staf** | AI Analytics Copilot | Query statistik penggunaan, tren peminjaman, performa koleksi |
| **Staf** | AI Catalog Gap Detector | Deteksi otomatis topik/katalog yang kurang di perpustakaan |
| **Sistem / Rak**| NFC Reader Array (IoT) | Tracking otomatis posisi & pergerakan keluar-masuk buku |


[readme_file.md](https://github.com/user-attachments/files/33272874/readme_file.md)

### 1. High-Level Data & Interaction Flow

```
+-------------------+      +-----------------------+      +------------------------+
|   Client / User   | ---> |  State Management &   | ---> |  Data Filtering &      |
|   (React UI)      | <--- |  Event Handler Logic  | <--- |  Persistence Layer     |
+-------------------+      +-----------------------+      +------------------------+
         |                             |                              |
  User Interaction              State Updates                   Catalog Data /
(Search, Borrow, Edit)       (Active Tab, Filters)            LocalStorage State
```

### 2. User Borrowing Workflow

```
[ Browse Catalog ] ──> [ Select Book ] ──> [ Check Availability ]
                                                  │
                                   ┌──────────────┴──────────────┐
                                   ▼                             ▼
                            [ Out of Stock ]            [ Available ]
                                   │                             │
                        ( Place on Waitlist )          ( Confirm Borrow Request )
                                                                 │
                                                                 ▼
                                                        [ Issue Due Date ]
                                                                 │
                                                                 ▼
                                                       [ Update Catalog State ]
```

### 3. Book Return & Fine Calculation Flow

```
[ User Returns Book ] ──> [ Compare Return Date vs Due Date ]
                                      │
                       ┌──────────────┴──────────────┐
                       ▼                             ▼
               [ On Time / Early ]               [ Overdue ]
                       │                             │
             ( Clear Active Loan )       ( Calculate Fine Penalty )
                                                     │
                                                     ▼
                                           ( Record Fine in User Account )
```

---

## 🛠 Tech Stack

| Domain | Technology / Library | Purpose |
| :--- | :--- | :--- |
| **Frontend UI** | React.js / JavaScript (ES6+) | Component-based UI rendered within a high-performance SPA structure. |
| **Styling** | Tailwind CSS / Modern CSS | Utility-first, responsive, accessible library theme. |
| **Icons** | Lucide React | Lightweight, consistent iconography. |
| **State Management** | React Hooks (`useState`, `useMemo`, `useEffect`) | Local UI state, search filtering memoization, dynamic reactivity. |

---

## 📁 Codebase Structure

```
├── index.html / App.jsx       # Main application entry point & component tree
├── components/                # Modular UI components
│   ├── Navigation / Navbar    # Dynamic routing & role/view switcher
│   ├── Hero & Banner          # Search bar & platform highlighted content
│   ├── BookCatalog            # Main grid view with search & category filters
│   ├── BookDetailModal        # Detailed view, reading preview & borrow CTA
│   ├── AdminDashboard         # Analytics, inventory table, circulation controls
│   └── UserProfile            # Active loans, reading history, fines summary
└── assets / data              # Mock dataset containing books, categories, and users
```

---
---

## 🚀 Quick Start Guide for Judges

Follow these steps to run and inspect the project locally:

### Prerequisites
* **Node.js** (v16.0.0 or higher)
* **npm** or **yarn** package manager

### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-organization/pens-digital-library.git
   cd pens-digital-library
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open in Browser:**
   Navigate to `http://localhost:5173` (or the URL output in your terminal).
