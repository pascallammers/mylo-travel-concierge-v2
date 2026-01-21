'use client';

import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChatInterface } from '@/components/chat-interface';
import { InstallPrompt } from '@/components/InstallPrompt';
import { useSession } from '@/lib/auth-client';

const Home = () => {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    // Client-side auth guard: redirect to sign-in if no session
    if (!isPending && !session) {
      console.log('No session found, redirecting to sign-in');
      router.push('/sign-in');
    }
  }, [session, isPending, router]);

  // Show loading state while checking authentication
  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-foreground"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render chat interface if not authenticated
  if (!session) {
    return null;
  }

  return (
    <>
      <Suspense fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-foreground"></div>
            <p className="text-sm text-muted-foreground">Loading chat...</p>
          </div>
        </div>
      }>
        <ChatInterface />
      </Suspense>
      <Suspense fallback={null}>
        <InstallPrompt />
      </Suspense>
    </>
  );
};

export default Home;
