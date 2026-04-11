"use client";

import { useSession } from "next-auth/react";
import SignInScreen from "@/components/SignInScreen";
import CalendarApp from "@/components/CalendarApp";

export default function Home() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center text-gcal-subtext">
        Loading…
      </div>
    );
  }

  if (!session) {
    return <SignInScreen />;
  }

  return <CalendarApp />;
}
