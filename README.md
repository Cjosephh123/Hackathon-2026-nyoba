[readme_file.md](https://github.com/user-attachments/files/33272778/readme_file.md)
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

## 🎯 Project Overview

The **PENS Digital Library Platform** addresses the challenge of managing both physical and digital academic repositories efficiently. Built with a responsive, single-page application (SPA) architecture, it offers real-time catalog search, automated borrowing/return processing, role-based access control (RBAC), and administrative reporting.

---

## ✨ Key Features

### 👨‍🎓 Student / Borrower Features
* **Smart Catalog Search:** Multi-attribute filtering (title, author, ISBN, category, availability).
* **Digital Preview & Reading:** Direct access to PDF/e-Book summaries and research publications.
* **Borrowing & Reservation:** One-click reservation system with automated due-date calculation.
* **User Dashboard:** Active loans history, overdue alerts, and personalized reading recommendations.

### 🛡️ Admin & Staff Features
* **Inventory Management:** Full CRUD operations for books, thesis archives, and digital journals.
* **Circulation Control:** Streamlined checkout, check-in, and fine assessment workflow.
* **Analytics Dashboard:** Real-time metrics on circulation frequency, popular categories, and active users.

---

## 🔄 System Architecture & Workflow

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

---

## 📑 Evaluation Cheat Sheet for the Jury

When evaluating this platform, we recommend testing the following paths:

1. **Catalog Search & Filtering:** Try typing keywords (e.g., *"Database"*, *"Artificial Intelligence"*) into the search bar and filter by category simultaneously. Note the instant memoized rendering.
2. **Borrowing Logic Test:** Click on an available book, view its details, and click **Borrow**. Observe state changes in your profile dashboard.
3. **Role Switching / View Toggle:** Switch between **Student View** and **Admin Dashboard** to inspect how the interface adapts to different user roles.
4. **Responsive Layout:** Resize the browser or switch to mobile view to test UI responsiveness.

---

*Developed for the PENS Academic Community.*
