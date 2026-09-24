'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { SettingsDialog } from '@/components/settings-dialog';
import { useUser } from '@/contexts/user-context';
import { useLocalStorage } from '@/hooks/use-local-storage';

interface ShellSettings {
  open: (tab?: string) => void;
}

const ShellSettingsContext = createContext<ShellSettings | null>(null);

/**
 * Keep the shared settings dialog mounted independently of navigation sheets.
 * @param props - Shell navigation and page content that can open settings.
 * @returns Children and one controlled settings dialog.
 */
export function ShellSettingsProvider({ children }: { children: ReactNode }) {
  const { user, subscriptionData, isProUser, isLoading } = useUser();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState('profile');
  const [isCustomInstructionsEnabled, setIsCustomInstructionsEnabled] = useLocalStorage(
    'scira-custom-instructions-enabled',
    true,
  );
  const open = useCallback((tab = 'profile') => {
    setSettingsInitialTab(tab);
    setSettingsOpen(true);
  }, []);
  const settings = useMemo(() => ({ open }), [open]);
  const handleOpenChange = (isOpen: boolean) => {
    setSettingsOpen(isOpen);
    if (!isOpen) setSettingsInitialTab('profile');
  };

  return (
    <ShellSettingsContext.Provider value={settings}>
      {children}
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={handleOpenChange}
        user={user ?? null}
        subscriptionData={subscriptionData}
        isProUser={isProUser}
        isProStatusLoading={isLoading}
        isCustomInstructionsEnabled={isCustomInstructionsEnabled}
        setIsCustomInstructionsEnabled={setIsCustomInstructionsEnabled}
        initialTab={settingsInitialTab}
      />
    </ShellSettingsContext.Provider>
  );
}

/**
 * Read the shared settings opener inside the platform shell.
 * @param - No arguments; the enclosing provider supplies the opener.
 * @returns An opener that defaults to the profile tab.
 */
export function useShellSettings(): ShellSettings {
  const settings = useContext(ShellSettingsContext);
  if (!settings) throw new Error('useShellSettings must be used within ShellSettingsProvider');
  return settings;
}
