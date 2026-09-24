'use client';

import { useCallback, useEffect, useState } from 'react';

const settingsTabValues = new Set(['profile', 'usage', 'subscription', 'loyalty', 'memories']);

/**
 * Keep the chat settings state and URL callbacks available in both header modes.
 * @returns Controlled dialog state and an opener for a specific settings tab.
 */
export function useChatSettings() {
  // Settings dialog state management with URL hash support
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<string>('profile');

  // Function to open settings with a specific tab
  const handleOpenSettings = useCallback((tab: string = 'profile') => {
    setSettingsInitialTab(tab);
    setSettingsOpen(true);
  }, [setSettingsInitialTab, setSettingsOpen]);

  // URL hash detection for settings dialog
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#settings') {
        const tabParam = new URLSearchParams(window.location.search).get('tab');
        if (tabParam && settingsTabValues.has(tabParam)) {
          handleOpenSettings(tabParam);
        } else {
          setSettingsOpen(true);
        }
      }
    };

    // Check initial hash
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [handleOpenSettings]);

  // Update URL hash when settings dialog opens/closes
  useEffect(() => {
    if (settingsOpen) {
      // Only update hash if it's not already #settings to prevent infinite loops
      if (window.location.hash !== '#settings') {
        window.history.pushState(null, '', '#settings');
      }
    } else {
      // Remove hash if settings is closed and hash is #settings
      if (window.location.hash === '#settings') {
        // Use replaceState to avoid adding to browser history
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  }, [settingsOpen]);
  return { settingsOpen, setSettingsOpen, settingsInitialTab, handleOpenSettings };
}
