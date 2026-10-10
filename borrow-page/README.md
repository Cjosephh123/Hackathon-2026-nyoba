# Borrow page

The uploaded mock has been split into React and CSS modules and integrated into the main
authenticated app. The active implementation is in:

- `../login-page/src/features/borrow/BorrowPage.jsx`
- `../login-page/src/features/borrow/BorrowPage.css`
- `../login-page/src/features/borrow/BorrowBookDetailPage.jsx`
- `../login-page/src/features/borrow/BorrowBookDetailPage.css`
- `../login-page/src/features/borrow/components/BorrowBookCard.jsx`
- `../login-page/src/features/borrow/components/BorrowBookCard.css`
- `../login-page/src/features/borrow/services/borrowService.js`

It uses the existing authenticated app layout and sidebar; it does not render a second sidebar.
The catalog is at `/borrow`, and clicking a title opens `/borrow/:bookId`. Run the app from
`../login-page` with `npm run dev`.

## Supabase setup

Apply the auth and core migrations in `../../supabase/migrations/`, then apply
`../home-page/sql/migration_home_page.sql`, then
`../../supabase/migrations/20261010000003_borrow_catalog.sql`, then
`../../supabase/migrations/20261010000004_borrow_checkout.sql`. The home-page migration creates
the `reservations` table reused by the borrow page. These borrow migrations add catalog search,
detail lookup, duplicate active-waitlist protection, and a transactional checkout that locks an
available physical copy, updates its status, and creates a loan together.

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `../login-page/.env` and restart Vite.
The page searches the `books`, `categories`, `copies`, `view_history`, and `reservations` data
through the `get_borrow_catalog` and `get_borrow_book_detail` RPCs. Joining a waitlist inserts
the signed-in member's own pending reservation; borrowing calls `borrow_book`, which creates
a seven-day loan. The loan is the source of truth for the future collection page: query the
signed-in user's loans with `returned_at IS NULL`, joining `copies` and `books` for title details.
No separate collection table is needed for borrowed items; the `loans` row already records the
member, copy, checkout time, and due date. The UI only shows the success notice after the
database transaction succeeds. If there are no available print copies, the list offers a
waitlist request instead.

No external layout URL was included with the upload. The page therefore reuses the existing
sidebar and layout from the integrated app.
