export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: ["/student/:path*", "/teacher/:path*"],
};
