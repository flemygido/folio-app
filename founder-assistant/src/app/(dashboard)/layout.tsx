import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { NavSidebar } from "@/components/nav-sidebar";
import { TopBar } from "@/components/top-bar";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Redirect new users to onboarding
  const profile = await db.userPersonalityProfile.findUnique({
    where: { userId: session.user.id },
    select: { onboardingComplete: true },
  });
  if (!profile?.onboardingComplete) redirect("/setup");

  const connections = await db.oAuthConnection.findMany({
    where: { userId: session.user.id },
    select: { provider: true, isActive: true, lastRefreshedAt: true, connectedAt: true },
  });

  const connected = {
    gmail: connections.some((c) => c.provider === "GMAIL" && c.isActive),
    calendar: connections.some((c) => c.provider === "GOOGLE_CALENDAR" && c.isActive),
    drive: connections.some((c) => c.provider === "GOOGLE_DRIVE" && c.isActive),
  };

  // Warn if Gmail token hasn't been refreshed in 2+ hours (likely expired/revoked)
  const gmailConn = connections.find((c) => c.provider === "GMAIL");
  const lastActivity = gmailConn?.lastRefreshedAt ?? gmailConn?.connectedAt ?? null;
  const tokenStale = lastActivity
    ? Date.now() - lastActivity.getTime() > 2 * 60 * 60 * 1000
    : false;

  const lastSyncCursor = await db.syncCursor.findUnique({
    where: { userId_provider: { userId: session.user.id, provider: "GMAIL" } },
    select: { updatedAt: true },
  });
  const lastSyncedAt = lastSyncCursor?.updatedAt ?? null;

  return (
    <div className="min-h-screen bg-[#020b18] flex flex-col">
      <TopBar user={session.user} lastSyncedAt={lastSyncedAt} />
      {tokenStale && connected.gmail && (
        <div className="bg-amber-950 border-b border-amber-800 px-6 py-2 flex items-center justify-between text-[12px]">
          <span className="text-amber-300">
            Gmail connection may need a refresh — last token activity was over 2 hours ago.
          </span>
          <a
            href="/api/auth/signin/google"
            className="text-amber-400 font-semibold underline ml-4 hover:text-amber-200"
          >
            Reconnect Gmail
          </a>
        </div>
      )}
      {!connected.gmail && (
        <div className="bg-red-950 border-b border-red-800 px-6 py-2 flex items-center justify-between text-[12px]">
          <span className="text-red-300">Gmail is disconnected. Sync will not work.</span>
          <a
            href="/api/auth/signin/google"
            className="text-red-400 font-semibold underline ml-4 hover:text-red-200"
          >
            Reconnect Gmail
          </a>
        </div>
      )}
      <div className="flex flex-1">
        <NavSidebar connections={connected} />
        <main className="flex-1 overflow-y-auto px-7 py-6 max-w-[860px] animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
