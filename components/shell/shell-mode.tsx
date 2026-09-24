'use client';

import { createContext, useContext, type ReactNode } from 'react';

const ShellModeContext = createContext(false);

/**
 * Mark page content as part of the platform shell.
 * @param props - Children rendered inside the shell.
 * @returns Children with shell mode enabled.
 */
export function ShellModeProvider({ children }: { children: ReactNode }) {
  return <ShellModeContext.Provider value={true}>{children}</ShellModeContext.Provider>;
}

/**
 * Read the shell mode without requiring a provider in legacy pages.
 * @returns True inside the shell and false in the legacy chat layout.
 */
export function useInShell(): boolean {
  return useContext(ShellModeContext);
}
