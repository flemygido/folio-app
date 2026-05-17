"use client";

import { useSession, signIn } from "next-auth/react";
import dynamic from "next/dynamic";

const WidgetLoader = dynamic(
  () => import("@/components/assistant-widget/widget-loader").then((m) => m.WidgetLoader),
  { ssr: false }
);

export default function OverlayPage() {
  const { data: session, status } = useSession();

  if (status === "loading") return null;

  if (!session) {
    return (
      <div className="fixed bottom-6 right-6 z-[9999]">
        <button
          onClick={() => signIn("google", { callbackUrl: "/overlay" })}
          className="flex items-center gap-2 bg-[#0d1929] border border-slate-700 text-slate-300 text-xs px-4 py-2.5 rounded-full shadow-2xl hover:border-amber-500 hover:text-amber-400 transition-all"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}
        >
          <span className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-[#0a0f1e] font-bold text-[10px]">F</span>
          Sign in to Folio
        </button>
      </div>
    );
  }

  return <WidgetLoader />;
}
