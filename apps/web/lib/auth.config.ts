import type { NextAuthConfig } from "next-auth";

/**
 * Auth config shared between middleware (Edge runtime) and server (Node runtime).
 * MUST NOT import any Node.js modules (pg, crypto, bcrypt, drizzle).
 */
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isProtected =
        nextUrl.pathname.startsWith("/student") ||
        nextUrl.pathname.startsWith("/teacher");

      if (isProtected && !isLoggedIn) {
        return false; // Redirect to signIn page
      }
      return true;
    },
  },
  providers: [], // Providers are added in auth.ts (Node runtime only)
  trustHost: true,
};
