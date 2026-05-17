"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    await signIn("google", { callbackUrl: "/" });
  };

  return (
    <div className="min-h-screen bg-[#020b18] flex items-center justify-center">
      <div className="w-full max-w-sm px-6">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-12 justify-center">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-[#020b18] font-bold text-lg">
            F
          </div>
          <div>
            <div className="text-lg font-bold text-slate-100 leading-tight" style={{ fontFamily: "var(--font-dm-serif)" }}>
              Folio
            </div>
            <div className="text-xs text-slate-500">AI Work Assistant</div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-8">
          <h1
            className="text-2xl font-bold text-slate-100 mb-2 leading-tight"
            style={{ fontFamily: "var(--font-dm-serif)" }}
          >
            Your inbox, under control.
          </h1>
          <p className="text-sm text-slate-500 mb-8 leading-relaxed">
            Connect your Google account to get signal-only briefings, smart task extraction, and an AI assistant that knows your work — whether you get 10 emails or 500.
          </p>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 font-semibold text-sm py-3 px-4 rounded-xl hover:bg-gray-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="animate-pulse-slow">Connecting…</span>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </>
            )}
          </button>

          <p className="text-xs text-slate-600 mt-6 text-center leading-relaxed">
            Read-only access to Gmail, Calendar, and Drive.
            Your data stays encrypted and private — never shared or sold.
          </p>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          {[
            { icon: "✉️", label: "Email intelligence" },
            { icon: "📅", label: "Meeting prep" },
            { icon: "🧠", label: "Memory & context" },
          ].map((f) => (
            <div key={f.label} className="text-center">
              <div className="text-lg mb-1">{f.icon}</div>
              <div className="text-xs text-slate-600">{f.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
