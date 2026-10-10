# AI assistant

The uploaded UI has been split into the integrated React feature:

- `../login-page/src/features/ai-assistant/AIAssistantPage.jsx`
- `../login-page/src/features/ai-assistant/AIAssistantPage.css`
- `../login-page/src/features/ai-assistant/components/AssistantMessage.jsx`
- `../login-page/src/features/ai-assistant/components/AssistantMessage.css`
- `../login-page/src/features/ai-assistant/services/assistantService.js`
- `../../library_backend/app/main.py`

The page is available at `/ai-assistant`, requires the existing Supabase sign-in, and uses the
existing sidebar. The API key is only read by the FastAPI backend, never by Vite/browser code.

## Configure the AI API

The CBN Hackathon OpenAI-compatible URL is `https://litellm-hackathon.digdaya.ai/v1`.
Copy `../../library_backend/.env.example` to `../../library_backend/.env` and fill in:

```dotenv
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<your-anon-public-key>
CBN_HACKATHON_BASE_URL=https://litellm-hackathon.digdaya.ai/v1
CBN_HACKATHON_API_KEY=<your-api-key>
FRONTEND_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Keep the API key out of source files and all `VITE_` variables. Install backend requirements
from `library_backend/` and run `uvicorn app.main:app --reload --port 8000`. Run the frontend
with `npm run dev` from `Frontend/login-page`; Vite proxies `/api` requests to the backend.

The backend selects a fixed model and token budget from the verified Supabase profile role:
members use Qwen 3.8 Flash with up to 1,200 response tokens; staff/admin use Qwen 3.7 Plus with
up to 3,000 response tokens. Members have a 4,000-character prompt limit, 20,000-character document
limit, and shorter history/catalog context; staff have an 8,000-character prompt limit and up to
50,000 document characters with more history/catalog context. Users cannot override these settings
from the browser. Image uploads use the Qwen 3.8 Omni Flash vision model for either role.
Supported uploads are UTF-8 TXT, text-based PDF, and DOCX documents, plus JPEG, PNG, and WebP
images, up to 10 MB each. Document text is extracted in memory and truncated to the role-specific limit.
Images are sent as multimodal input. Upload contents are sent to the configured AI provider for
analysis and are not stored in Supabase; the conversation stores
the user's prompt, assistant reply, selected model, and attachment filename only. Scanned PDFs
need OCR first.

## Supabase setup

After the auth, library-core, homepage, and borrow migrations have been applied, run
`../../supabase/migrations/20261010000005_ai_assistant.sql` and
`../../supabase/migrations/20261010000006_ai_catalog_context.sql` in Supabase SQL Editor. They create
`ai_conversations` and `ai_messages`, with row-level security limiting reads and writes to the
signed-in owner's conversations. No uploaded document storage bucket is created.

The assistant consults catalog metadata, including book-added dates and per-format copy availability,
through `get_ai_catalog_context`; it does not invent local holdings. When a catalog book has no cover,
the backend may look up a matching title and author in Open Library and display a matched cover image.
Only the title and first author of a book explicitly named in the user's prompt are sent for that
lookup. For quantitative forecasts, the assistant can render bar or line charts from clearly labeled
estimates and assumptions; it should ask for data when a defensible prediction cannot be made. These
charts are SVG visualizations in the chat, not generated image files. Its server-side instructions
prohibit generating journal articles, theses, assignments, or publishable papers; it can help with
source discovery, explanations, research outlines, and feedback on the user's own writing.
The Repository and TA Upload routes also require
`20261010000007_journal_submissions.sql`, `20261010000009_approved_journal_access.sql`, and
`20261010000012_repository_search_context.sql`. Staff notifications and loan management require
`20261010000008_due_date_reminders.sql`, `20261010000010_submission_email_notifications.sql`, and
`20261010000011_staff_loan_management.sql`. Staff catalog entry and staff-approved borrowing require
`20261010000013_staff_catalog_entry.sql` and
`20261010000014_staff_approved_borrow_requests.sql`; member early-return requests also require
`20261010000015_member_loan_returns.sql`. Manage catalog e-book uploads and cover storage require
`20261010000016_catalog_ebook_and_covers.sql`. Apply migrations in numeric order, then follow the
Gmail runner instructions in `../../supabase/README.md`.

For deployment, configure the same backend environment variables in the hosting provider, add
the production frontend origin to `FRONTEND_ORIGINS`, and configure the hosting/reverse proxy to
route `/api/*` to FastAPI. Never expose the provider key to the browser.
