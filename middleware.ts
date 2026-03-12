import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';
import { routing } from './i18n/routing';

const handleI18nRouting = createMiddleware(routing);

const authRoutes = ['/sign-in', '/reset-password'];
const publicRoutes = ['/terms', '/privacy-policy', '/subscription-expired', '/pricing'];
const adminRoutes = ['/admin'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow all API routes including webhooks and auth
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Skip i18n routing for admin routes (they live outside [locale])
  if (pathname.startsWith('/admin')) {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }
    return NextResponse.next();
  }

  // Run next-intl middleware first to handle locale routing
  const response = handleI18nRouting(request);

  // Extract the pathname without locale prefix for auth checks
  const pathnameWithoutLocale = pathname.replace(/^\/(de|en)/, '') || '/';

  // Allow public routes
  if (publicRoutes.some((route) => pathnameWithoutLocale.startsWith(route))) {
    return response;
  }

  // Allow /new routes
  if (pathnameWithoutLocale.startsWith('/new')) {
    return response;
  }

  const sessionCookie = getSessionCookie(request);

  // For admin routes, just check if user is authenticated
  if (adminRoutes.some((route) => pathnameWithoutLocale.startsWith(route))) {
    if (!sessionCookie) {
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }
  }

  // Redirect /settings to /#settings to open settings dialog
  if (pathnameWithoutLocale === '/settings') {
    if (!sessionCookie) {
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }
    return NextResponse.redirect(new URL('/#settings', request.url));
  }

  // If user is NOT authenticated and trying to access protected routes, redirect to sign-in
  if (!sessionCookie && !authRoutes.some((route) => pathnameWithoutLocale.startsWith(route))) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
