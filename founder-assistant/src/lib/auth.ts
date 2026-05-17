import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/encryption";
import type { Provider } from "@prisma/client";

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/drive.readonly",
          ].join(" "),
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ account, user }) {
      if (account?.provider === "google" && account.access_token && user.id) {
        try {
          const tokens = {
            accessToken: account.access_token,
            refreshToken: account.refresh_token ?? "",
            expiresAt: account.expires_at ? account.expires_at * 1000 : Date.now() + 3600_000,
          };

          for (const provider of ["GMAIL", "GOOGLE_CALENDAR", "GOOGLE_DRIVE"] as Provider[]) {
            await db.oAuthConnection.upsert({
              where: { userId_provider: { userId: user.id, provider } },
              update: {
                encryptedTokens: encrypt(JSON.stringify(tokens)),
                scope: account.scope ?? null,
                lastRefreshedAt: new Date(),
                isActive: true,
              },
              create: {
                userId: user.id,
                provider,
                providerAccountId: account.providerAccountId,
                encryptedTokens: encrypt(JSON.stringify(tokens)),
                scope: account.scope ?? null,
              },
            });
          }

          await db.auditLog.create({
            data: {
              userId: user.id,
              action: "AUTH_LOGIN",
              detail: "Google OAuth login",
              meta: { provider: "google" },
            },
          });
        } catch (err) {
          console.error("[auth] signIn callback error:", err);
        }
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },

    async session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});
