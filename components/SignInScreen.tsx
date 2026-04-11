"use client";

import { signIn } from "next-auth/react";

export default function SignInScreen() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="w-full max-w-md rounded-2xl border border-gcal-border bg-white p-10 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <CalendarLogo />
          <div>
            <h1 className="text-xl font-medium text-gcal-text">Calendar</h1>
            <p className="text-xs text-gcal-subtext">with Gemini assistant</p>
          </div>
        </div>

        <h2 className="mb-2 text-2xl font-normal text-gcal-text">
          Sign in to continue
        </h2>
        <p className="mb-8 text-sm text-gcal-subtext">
          Connect your Google account to view your calendar and chat with
          Gemini about your schedule.
        </p>

        <button
          onClick={() => signIn("google")}
          className="flex w-full items-center justify-center gap-3 rounded-full border border-gcal-border bg-white px-4 py-3 text-sm font-medium text-gcal-text transition hover:bg-gray-50"
        >
          <GoogleIcon />
          Sign in with Google
        </button>

        <p className="mt-6 text-[11px] leading-relaxed text-gcal-subtext">
          We request read-only access to your Google Calendar so we can display
          your events and give Gemini the context it needs. You can revoke
          access at any time in your Google Account settings.
        </p>
      </div>
    </div>
  );
}

function CalendarLogo() {
  return (
    <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow ring-1 ring-gcal-border">
      <span className="text-sm font-semibold text-gcal-blue">
        {new Date().getDate()}
      </span>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.6l6.2 5.2C41.3 35.9 44 30.4 44 24c0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
