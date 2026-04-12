# WashU-EVENT

A Google Calendar–style web app with a **Gemini** chat assistant panel on
the right. Users sign in with their Google account, their primary calendar
events are rendered in a week view, and a Gemini-powered chat panel has
read-only awareness of the events currently in view.

## Features

- **Google OAuth sign in** via NextAuth.js (with `calendar.readonly` scope).
- **Week view** mimicking the Google Calendar UI: sticky header, mini-month
  sidebar, all-day row, hour grid, current-time indicator, and overlap-safe
  event columns.
- **Local scratch layer** — drag events to move them, drag the bottom edge
  to resize, click to edit title/times, click an empty slot to create a
  new event. Everything is stored in `localStorage` keyed per user.
  **Google Calendar is never written to** — the app reads Google events
  and keeps your edits strictly local, so nothing you do here shows up in
  your real calendar.
- **Gemini chat panel** (`gemini-2.5-flash`) that receives the week's events
  (including your local edits) as context, so you can ask things like
  *"What meetings do I have today?"* or *"Find a 30 minute free slot this week."*
- **Automatic token refresh** for long-running sessions.

## Tech stack

- Next.js 14 (App Router) + React 18 + TypeScript
- Tailwind CSS
- NextAuth.js (Google provider)
- Google Calendar API v3 (REST)
- `@google/generative-ai` for Gemini

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Create Google OAuth credentials

1. Open <https://console.cloud.google.com/apis/credentials>.
2. Create an **OAuth client ID** of type *Web application*.
3. Add the following as an **Authorized redirect URI**:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
   (and your production URL, e.g. `https://your-domain.com/api/auth/callback/google`).
4. Under **OAuth consent screen → Scopes**, add:
   ```
   https://www.googleapis.com/auth/calendar.readonly
   ```
5. Copy the generated **Client ID** and **Client secret**.

### 3. Create a Gemini API key

Get a key at <https://aistudio.google.com/app/apikey>.

### 4. Configure environment variables

Copy `.env.example` to `.env.local` and fill in:

```env
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_GEMINI_API_KEY=...
```

### 5. Run it

```bash
npm run dev
```

Open <http://localhost:3000> and click **Sign in with Google**.

## Deploying

### Vercel (recommended)

1. Push this repo to GitHub.
2. Import the project on <https://vercel.com/new>.
3. Set the environment variables from `.env.example` in the Vercel project
   settings.
4. Set `NEXTAUTH_URL` to your production URL (e.g. `https://washu-event.vercel.app`).
5. In Google Cloud Console, add the production
   `/api/auth/callback/google` URL to the OAuth client's authorized redirect URIs.
6. Deploy.

### Self-hosting

```bash
npm run build
npm run start
```

Run behind a reverse proxy (nginx/Caddy) with HTTPS and make sure
`NEXTAUTH_URL` matches your public URL.

## Project layout

```
app/
  api/
    auth/[...nextauth]/route.ts   NextAuth handler
    calendar/events/route.ts      Fetches events from Google Calendar
    gemini/chat/route.ts          Gemini chat endpoint (context-aware)
  layout.tsx                      Root layout + SessionProvider
  page.tsx                        Landing / calendar app entry
components/
  CalendarApp.tsx                 Top-level layout (sidebar + grid + chat)
  TopBar.tsx                      Top navigation bar
  Sidebar.tsx                     Mini month + calendar list
  WeekView.tsx                    Week grid with event layout
  ChatPanel.tsx                   Gemini chat side panel
  SignInScreen.tsx                Unauthenticated landing page
lib/
  auth.ts                         NextAuth options + token refresh
  dates.ts                        Date helpers
  types.ts                        Shared types
```

## Privacy notes

- The Google Calendar scope used is **read-only** (`calendar.readonly`).
- Calendar events are fetched on demand from the browser and passed to
  the Gemini endpoint as context; nothing is persisted server-side.
- Revoke access any time at <https://myaccount.google.com/permissions>.

