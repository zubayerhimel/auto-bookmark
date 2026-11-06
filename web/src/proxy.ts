import { clerkMiddleware } from "@clerk/nextjs/server";

// Lets Clerk read the session on every request. Each page, route handler and server action
// checks auth for itself (see lib/session.ts).
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
