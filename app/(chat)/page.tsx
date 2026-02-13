'use client';

import { Suspense } from 'react';
import { ChatInterface } from '@/components/chat-interface';
import { InstallPrompt } from '@/components/InstallPrompt';

const Home = () => {
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
