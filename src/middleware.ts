import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Routes publiques (accessibles sans login). Tout le reste exige une session.
 *
 * - "/"            page de démo design system + landing
 * - "/sign-in/*"   Clerk hosted sign-in
 * - "/sign-up/*"   Clerk hosted sign-up
 * - "/api/webhooks/*" futur (Clerk webhooks en V1)
 */
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals + static assets, mais inclut les API.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
