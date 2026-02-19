import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

const authRoutes = ['/sign-in', '/reset-password'];
const publicRoutes = ['/terms', '/privacy-policy', '/subscription-expired', '/pricing'];
const adminRoutes = ['/admin'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  console.log('Pathname: ', pathname);

  // Allow all API routes including webhooks and auth
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow /new routes
  if (pathname.startsWith('/new')) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);
  
  // Debug logging for production
  console.log('Session cookie present:', !!sessionCookie);
  console.log('Is auth route:', authRoutes.some((route) => pathname.startsWith(route)));
  console.log('Is admin route:', adminRoutes.some((route) => pathname.startsWith(route)));
  console.log('Is public route:', publicRoutes.some((route) => pathname.startsWith(route)));

  // For admin routes, just check if user is authenticated
  // The actual role check will happen in the page component
  if (adminRoutes.some((route) => pathname.startsWith(route))) {
    if (!sessionCookie) {
      console.log('Redirecting unauthenticated user to sign-in from admin route');
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }
    // Let authenticated users through - role check happens in the page
  }

  // Redirect /settings to /#settings to open settings dialog (only if authenticated)
  if (pathname === '/settings') {
    if (!sessionCookie) {
      console.log('Redirecting to sign-in from settings');
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }
    return NextResponse.redirect(new URL('/#settings', request.url));
  }

  // If user is NOT authenticated and trying to access protected routes, redirect to sign-in
  // All routes except auth routes and public routes are protected
  if (!sessionCookie && !authRoutes.some((route) => pathname.startsWith(route))) {
    console.log('Redirecting unauthenticated user to sign-in from:', pathname);
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  // NOTE: Subscription access control is implemented at the component/API level
  // because Better-Auth's session decoding in middleware Edge runtime is complex.
  // Access checks happen in:
  // 1. Page components via getUser() and checkUserAccess()
  // 2. API routes via isCurrentUserAdmin() and checkUserAccess()
  // 3. Client-side via useUser() hooks
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
