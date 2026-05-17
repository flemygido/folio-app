import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
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
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      issuer: "https://login.microsoftonline.com/common/v2.0",
      authorization: {
        params: {
          scope: [
            "openid",
            "profile",
            "email",
            "offline_access",
            "User.Read",
            "Mail.Read",
            "Calendars.Read",
            "Chat.Read",
          ].join(" "),
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ account, user }) {
      if (!account || !user.id) return true;

      try {
        const tokens = {
          accessToken: account.access_token ?? "",
          refreshToken: account.refresh_token ?? "",
          expiresAt: account.expires_at ? account.expires_at * 1000 : Date.now() + 3600_000,
        };
        const encrypted = encrypt(JSON.stringify(tokens));

        if (account.provider === "google") {
          for (const provider of ["GMAIL", "GOOGLE_CALENDAR", "GOOGLE_DRIVE"] as Provider[]) {
            await db.oAuthConnection.upsert({
              where: { userId_provider: { userId: user.id, provider } },
              update: { encryptedTokens: encrypted, scope: account.scope ?? null, lastRefreshedAt: new Date(), isActive: true },
              create: { userId: user.id, provider, providerAccountId: account.providerAccountId, encryptedTokens: encrypted, scope: account.scope ?? null },
            });
          }
        }

        if (account.provider === "microsoft-entra-id") {
          for (const provider of ["OUTLOOK", "MICROSOFT_CALENDAR", "MICROSOFT_TEAMS"] as Provider[]) {
            await db.oAuthConnection.upsert({
              where: { userId_provider: { userId: user.id, provider } },
              update: { encryptedTokens: encrypted, scope: account.scope ?? null, lastRefreshedAt: new Date(), isActive: true },
              create: { userId: user.id, provider, providerAccountId: account.providerAccountId, encryptedTokens: encrypted, scope: account.scope ?? null },
            });
          }
        }

        await db.auditLog.create({
          data: {
            userId: user.id,
            action: "AUTH_LOGIN",
            detail: `${account.provider} OAuth login`,
            meta: { provider: account.provider },
          },
        });
      } catch (err) {
        console.error("[auth] signIn callback error:", err);
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
