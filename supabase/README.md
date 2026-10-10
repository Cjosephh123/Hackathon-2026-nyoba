# Supabase authentication setup

This setup provides the backend pieces used by the login and signup screens:

- Supabase Auth accounts with email and password.
- A `public.profiles` row for every new account.
- A case-insensitive unique username and an `is_username_available` RPC.
- A `member` role assigned by the database; signup metadata cannot choose a role.
- Row-level security that lets signed-in users read only their own profile.

## Create and configure the project

1. Create a Supabase project.
2. In **SQL Editor**, run [`migrations/20261010000000_auth_profiles.sql`](./migrations/20261010000000_auth_profiles.sql) to create profiles and auth helpers.
3. Run [`migrations/20261010000001_library_core.sql`](./migrations/20261010000001_library_core.sql) to create the core library tables used by the homepage.
4. In **Authentication → Providers**, enable Email. The frontend validates passwords at six or more characters; configure Supabase to accept that minimum.
5. In **Authentication → URL Configuration**, set the Site URL to the frontend origin and add its `/login` redirect URL to the allowed redirect URLs. For local Vite development, the default origin is `http://localhost:5173`, with `http://localhost:5173/login` as the redirect URL.
6. Copy `Frontend/login-page/.env.example` to `Frontend/login-page/.env` and set the project URL and anon/public key:

   ```dotenv
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
   ```

   Use the anon/public key, never the `service_role` key. `.env` files are ignored by Git. Restart Vite after changing them.

Use `Frontend/login-page` for login, signup, home, borrow, repository, and uploads; they share one Supabase client, browser session, and sidebar. Run the dev server from that folder. `Frontend/signup-page` is an older standalone copy and is not used by the integrated routes.

## Add the uploaded home page

The home page is mounted at `/` and the borrow page at `/borrow` in `Frontend/login-page`, both behind the same Supabase login session. Signing out returns to `/login`.

The uploaded home page's `Frontend/home-page/sql/migration_home_page.sql` adds `reservations`, `site_visits`, and reporting functions. Run that file in **Supabase → SQL Editor** after the two migrations above. Then run [`migrations/20261010000003_borrow_catalog.sql`](./migrations/20261010000003_borrow_catalog.sql) and [`migrations/20261010000004_borrow_checkout.sql`](./migrations/20261010000004_borrow_checkout.sql) to enable catalog search, detail lookup, and waitlist support. Apply the later numbered migrations in order to enable staff-approved checkout, member returns, and digital catalog files. Borrowed titles are recorded in `loans`, which the collection page can query; no separate collection table is needed.

Run [`migrations/20261010000005_ai_assistant.sql`](./migrations/20261010000005_ai_assistant.sql) to add private AI conversation and message history. Then run [`migrations/20261010000006_ai_catalog_context.sql`](./migrations/20261010000006_ai_catalog_context.sql) to provide the assistant and Repository with book-added dates and copy availability metadata.

Run [`migrations/20261010000007_journal_submissions.sql`](./migrations/20261010000007_journal_submissions.sql) to add the private journal-submission storage bucket, member/staff policies, and staff approval RPC. Only staff/admin profiles can view the queue or approve/reject. An approved journal's metadata is inserted into `books`.

Run [`migrations/20261010000008_due_date_reminders.sql`](./migrations/20261010000008_due_date_reminders.sql), then [`migrations/20261010000009_approved_journal_access.sql`](./migrations/20261010000009_approved_journal_access.sql). The first adds idempotent due-reminder tracking. The backend sends one reminder within 48 hours and another within 24 hours of an active loan's due time; returned loans are skipped. The second allows signed-in users to read approved journal files while pending/rejected files remain private.

Run [`migrations/20261010000010_submission_email_notifications.sql`](./migrations/20261010000010_submission_email_notifications.sql) to queue automatic Gmail notifications when staff approve or reject a submission, and [`migrations/20261010000011_staff_loan_management.sql`](./migrations/20261010000011_staff_loan_management.sql) for staff dashboard stats, active loans, and transactional check-in.

Run [`migrations/20261010000012_repository_search_context.sql`](./migrations/20261010000012_repository_search_context.sql) to enable server-side title/author/category search in the Repository while including catalog dates and availability.

Run [`migrations/20261010000013_staff_catalog_entry.sql`](./migrations/20261010000013_staff_catalog_entry.sql) to enable staff to add book/journal metadata and physical copy barcodes atomically from **Manage catalog**. New categories are created as part of the same transaction. This registers catalog metadata and physical inventory; it does not upload digital book files.

Staff/admin navigation shows Home, Repository, Staff dashboard, Manage catalog, and AI Assistant. Member-only Borrow and TA Upload links are hidden for staff and those routes check the role as well.

Run [`migrations/20261010000014_staff_approved_borrow_requests.sql`](./migrations/20261010000014_staff_approved_borrow_requests.sql) to enable staff-reviewed checkout. A member's request stays pending while the physical copy remains available. Staff approval atomically marks a copy borrowed, creates its seven-day loan, and approves the request. Rejection leaves inventory available; a copy only becomes unavailable after approval. The migration also adds each member's pending request state to borrow catalog/detail results and disables the old immediate-checkout RPC.

Run [`migrations/20261010000015_member_loan_returns.sql`](./migrations/20261010000015_member_loan_returns.sql) to add **My loans** at `/my-loans`. Members can request an early return there and bring the physical book to the library desk. The copy remains checked out until staff confirms receipt from the staff dashboard; only then is it marked returned and available again.

Run [`migrations/20261010000016_catalog_ebook_and_covers.sql`](./migrations/20261010000016_catalog_ebook_and_covers.sql) to enable private PDF/EPUB uploads and cover image storage on **Manage catalog**. Staff can upload an image, search exact-title covers in Open Library, and attach an optional e-book file. Signed-in members can open uploaded e-books from the Borrow title details; the file remains private in storage and the temporary download URL expires after five minutes.

To populate the demo cards, create at least one account first, then optionally run `Frontend/home-page/sql/seed_demo_data.sql`.

## Verify the connection

1. Open `/register`, create an account, and confirm the email if email confirmation is enabled.
2. Confirm Supabase created a `profiles` row with that user's ID and the `member` role.
3. Sign in at `/login`. The frontend loads `role` and `full_name` from that user's own profile row.
4. Try registering a second account with the same username using different capitalization; the database's unique index remains authoritative even if simultaneous requests bypass the availability check.

The Repository page includes the local catalog, Open Library book records, and OpenAlex scholarly works explicitly marked open access. External records link to their provider/landing page; open-access metadata does not guarantee that every full text is immediately available.

To authorize staff, create and sign in to the person's account, then set its role from the Supabase SQL Editor as the project owner, for example:

```sql
update public.profiles
set role = 'staff'
where username = 'librarian_username';
```

Do not expose staff roles or a service-role key through the frontend. The repository does not contain a Supabase project URL or public key, so the hosted project must be created and its credentials added locally before auth requests can reach Supabase.

## AI assistant API

The AI assistant page is `/ai-assistant` and calls the FastAPI backend, not the provider directly. Configure `library_backend/.env` from `library_backend/.env.example` with the Supabase URL/public anon key and CBN Hackathon API key. The provider key must remain backend-only; do not add it to a `VITE_` variable. The configured OpenAI-compatible base URL and supported model IDs are listed in `Frontend/aiassist-page/README.md`.

Run `uvicorn app.main:app --reload --port 8000` from `library_backend/`, and run Vite from `Frontend/login-page/`; its `/api` proxy forwards to FastAPI. Uploaded TXT, PDF, and DOCX text is processed in memory, sent to the AI provider, and not saved to Supabase Storage. The database stores only private prompts, assistant answers, model names, and attachment filenames.

## Gmail due-date reminders

The staff/member UI and migrations do not send mail from the browser. Configure the backend reminder runner using `library_backend/.env.example`; the Supabase service-role key and Gmail App Password must stay in the ignored backend `.env`, never in a `VITE_` variable.

1. Enable 2-Step Verification on the Gmail sender account and create a Google **App Password**. Use that sender address and App Password for `GMAIL_SMTP_USERNAME` and `GMAIL_SMTP_APP_PASSWORD`; do not use the regular Gmail password.
2. Add `SUPABASE_SERVICE_ROLE_KEY` from the Supabase project API settings to the backend `.env`. This key bypasses RLS, so keep it only on the trusted backend host.
3. Apply migrations `20261010000008_due_date_reminders.sql` and `20261010000010_submission_email_notifications.sql`, then verify member accounts have valid email addresses in Supabase Auth.
4. From `library_backend`, test with `python -m app.due_reminders`. It only sends when there are active loans due in the next 48 hours; it will not send a fabricated test message.
5. Schedule `python -m app.due_reminders` hourly using Windows Task Scheduler for local use. Set **Start in** to `C:\Hackathon\library_backend`; use your Python executable as the program and `-m app.due_reminders` as the arguments. For production, run the same command from a protected, always-on server scheduler.

The runner records each 48-hour and 24-hour reminder and each submission decision email in Supabase, retries failed/interrupted sends, and skips returned loans. It emails a submission owner after approval/rejection as well as sending due-date reminders. SMTP and database cannot participate in one transaction, so a rare process failure after Gmail accepted a message but before the sent state was saved may result in a duplicate retry. Gmail SMTP quotas and account policies apply.

The staff dashboard at `/admin` is restricted to profiles with the `staff` or `admin` role. It shows library/loan counts, active and overdue loans, supports transactional check-in, and provides the AI-assisted journal review queue. Members submit PDFs/DOCX files at `/ta-upload`; after staff approval, the entry appears in Repository and its private journal file is readable by signed-in users.
