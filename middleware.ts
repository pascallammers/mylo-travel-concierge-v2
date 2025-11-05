import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

const authRoutes = ['/sign-in', '/reset-password'];
const publicRoutes = ['/terms', '/privacy-policy'];

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

  // Redirect /settings to /#settings to open settings dialog (only if authenticated)
  if (pathname === '/settings') {
    if (!sessionCookie) {
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }
    return NextResponse.redirect(new URL('/#settings', request.url));
  }

  // If user is authenticated but trying to access auth routes, redirect to home
  if (sessionCookie && authRoutes.some((route) => pathname.startsWith(route))) {
    console.log('Redirecting authenticated user to home');
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If user is NOT authenticated and trying to access protected routes, redirect to sign-in
  // All routes except auth routes and public routes are protected
  if (!sessionCookie && !authRoutes.some((route) => pathname.startsWith(route))) {
    console.log('Redirecting unauthenticated user to sign-in');
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
