# Home page only

The library Home page as a self-contained feature. It does **not** use the login/signup pages,
the auth context, or any of the earlier file tree.

## 1. Copy into your project

Copy these into your Vite + React project's `src/`:

```
src/features/home/      <- the page (required)
src/optional-layout/    <- sidebar + layout (only if you don't have your own)
```

Install what the page needs (skip any you already have):

```bash
npm install react-router-dom @supabase/supabase-js
```

Optional font (the design uses Ubuntu). Add to your `index.html` `<head>`:

```html
<link href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500;700&display=swap" rel="stylesheet" />
```

## 2. Connect your database

Open `src/features/home/supabase.js`. It is the only file that creates or imports a Supabase client.

- Default: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your `.env`.
- Or reuse your existing client: replace the file's contents with
  `export { supabase } from '../../lib/supabaseClient.js';` (use your own path).

## 3. Show the page

```jsx
import HomePage from './features/home/HomePage.jsx';
import VisitTracker from './features/home/tracking/VisitTracker.jsx';

<VisitTracker />                       {/* mount once; feeds "Digital access" */}
<Route path="/" element={<HomePage />} />
```

`HomePage` accepts optional props so the links match your routes:
`searchPath`, `booksPath`, `journalsPath`. See `example/App.example.jsx`.

The page needs to sit inside `<BrowserRouter>` (it uses `Link` and `useNavigate`).

## 4. Database

`sql/migration_home_page.sql` creates the home-page additions (`reservations`, `site_visits`,
and the two data RPCs). It expects the auth and core library migrations in the repository's
`supabase/migrations/` folder. Apply those first, then run this SQL file, and then
`sql/seed_demo_data.sql` after at least one account exists. The borrow page also needs
`supabase/migrations/20261010000003_borrow_catalog.sql` after this migration.

### If your database has different tables

Only two backend calls exist, both in `src/features/home/services/`.
Rewrite the two SQL functions on top of your own tables, keeping this output:

**`get_popular_titles(p_type 'book'|'journal', p_limit int, p_tz text)`** returns rows with:

| column | meaning |
|---|---|
| `book_id` | unique id (React key) |
| `title`, `authors` (text[]), `description`, `category`, `publication_year`, `frequency`, `cover_url` | shown on the row |
| `popularity` | sort order (books: borrows + reservations this month) |
| `available_copies` | > 0 shows "Available / On shelf" |
| `pending_reservations` | > 0 (and none available) shows "Reserved / Waitlist" |
| `next_due_at` | earliest due date; within 3 days shows "Due soon" |
| `has_digital` | journals: true shows "Digital / Read online" |

**`get_library_activity(p_day date, p_tz text)`** returns one JSON object with:
`checkouts_today`, `checkouts_yesterday`, `returns_today`, `returns_on_time`,
`waitlist_today`, `waitlist_ready`, `visitors_today`, `page_views_today`.

Digital access counts rows in `site_visits` (one per page view, with an anonymous `visitor_id`).
If you already track visitors elsewhere, change the last two lines of the activity function
and you can drop `VisitTracker` and `analyticsService.js`.

## 5. Styling

All colours are CSS variables at the top of `src/features/home/HomePage.css`
(`--home-accent`, ...). They are prefixed with `home-` and scoped to `.home-page`,
so they cannot clash with your own styles.
