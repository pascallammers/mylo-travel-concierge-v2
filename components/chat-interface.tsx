'use client';
/* eslint-disable @next/next/no-img-element */

// CSS imports
import 'katex/dist/katex.min.css';

// React and React-related imports
import React, { memo, useCallback, useEffect, useMemo, useRef, useReducer, useState } from 'react';

// Third-party library imports
import { useChat } from '@ai-sdk/react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Crown02Icon } from '@hugeicons/core-free-icons';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { parseAsString, useQueryState } from 'nuqs';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

// Internal app imports
import { suggestQuestions, updateChatVisibility } from '@/app/actions';

// Component imports
import { ChatDialogs } from '@/components/chat-dialogs';
import Messages from '@/components/messages';
import { Navbar } from '@/components/navbar';

import { Button } from '@/components/ui/button';
import FormComponent from '@/components/ui/form-component';

// Hook imports
import { useAutoResume } from '@/hooks/use-auto-resume';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useUsageData } from '@/hooks/use-usage-data';
import { useUser } from '@/contexts/user-context';
import { useOptimizedScroll } from '@/hooks/use-optimized-scroll';

// Utility and type imports
import { ChatSDKError } from '@/lib/errors';
import { cn, SearchGroupId, invalidateChatsCache } from '@/lib/utils';
import { DEFAULT_MODEL, requiresProSubscription } from '@/ai/providers';
import { ConnectorProvider } from '@/lib/connectors';

// State management imports
import { chatReducer, createInitialState } from '@/components/chat-state';
import { useDataStream } from './data-stream-provider';
import { DefaultChatTransport } from 'ai';
import { ChatMessage } from '@/lib/types';

interface ChatInterfaceProps {
  initialChatId?: string;
  initialMessages?: any[];
  initialVisibility?: 'public' | 'private';
  isOwner?: boolean;
}

const settingsTabValues = new Set(['profile', 'usage', 'subscription', 'loyalty', 'memories']);

const ChatInterface = memo(
  ({
    initialChatId,
    initialMessages,
    initialVisibility = 'private',
    isOwner = true,
  }: ChatInterfaceProps): React.JSX.Element => {
    const router = useRouter();
    const [query] = useQueryState('query', parseAsString.withDefault(''));
    const [q] = useQueryState('q', parseAsString.withDefault(''));
    const [input, setInput] = useState<string>('');

    // Fixed GPT-5 model - no user selection
    const selectedModel = DEFAULT_MODEL;
    const setSelectedModel = (_model: string) => {}; // Dummy setter for compatibility
    
    // Fixed to 'web' search mode - no user selection
    const selectedGroup: SearchGroupId = 'web';
    const setSelectedGroup = () => {}; // Dummy setter for compatibility
    const [selectedConnectors, setSelectedConnectors] = useState<ConnectorProvider[]>([]);
    const [isCustomInstructionsEnabled, setIsCustomInstructionsEnabled] = useLocalStorage(
      'scira-custom-instructions-enabled',
      true,
    );

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
    }, []);

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

    // Get persisted values for dialog states
    const [persistedHasShownUpgradeDialog, setPersitedHasShownUpgradeDialog] = useLocalStorage(
      'scira-upgrade-prompt-shown',
      false,
    );

    const searchProvider = 'exa';

    // Use reducer for complex state management
    const [chatState, dispatch] = useReducer(
      chatReducer,
      createInitialState(
        initialVisibility,
        persistedHasShownUpgradeDialog,
      ),
    );

    const {
      user,
      subscriptionData,
      isProUser: isUserPro,
      isLoading: proStatusLoading,
      shouldCheckLimits: shouldCheckUserLimits,
      shouldBypassLimitsForModel,
    } = useUser();

    const { setDataStream } = useDataStream();

    const initialState = useMemo(
      () => ({
        query: query || q,
      }),
      [query, q],
    );

    const lastSubmittedQueryRef = useRef(initialState.query);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null!);
    const initializedRef = useRef(false);

    // Use optimized scroll hook
    const { scrollToBottom, markManualScroll, resetManualScroll } = useOptimizedScroll(bottomRef);

    // Listen for manual scroll (wheel and touch)
    useEffect(() => {
      const handleManualScroll = () => markManualScroll();
      window.addEventListener('wheel', handleManualScroll);
      window.addEventListener('touchmove', handleManualScroll);
      return () => {
        window.removeEventListener('wheel', handleManualScroll);
        window.removeEventListener('touchmove', handleManualScroll);
      };
    }, [markManualScroll]);

    // Use clean React Query hooks for all data fetching
    const { data: usageData, refetch: refetchUsage } = useUsageData(user || null);

    // Generate a consistent ID for new chats
    const chatId = useMemo(() => initialChatId ?? uuidv4(), []);

    // Only Pro users can access the chat - redirect non-Pro users to sign-in
    const isLimitBlocked = !proStatusLoading && (!user || !isUserPro);
    
    // Redirect non-Pro users to sign-in page
    useEffect(() => {
      if (!proStatusLoading && (!user || !isUserPro)) {
        router.push('/sign-in');
      }
    }, [proStatusLoading, user, isUserPro, router]);

    // Model is fixed to GPT-5 - no auto-switching needed



    type VisibilityType = 'public' | 'private';

    // Create refs to store current values to avoid closure issues
    const selectedModelRef = useRef(selectedModel);
    const selectedGroupRef = useRef(selectedGroup);
    const isCustomInstructionsEnabledRef = useRef(isCustomInstructionsEnabled);
    const searchProviderRef = useRef(searchProvider);
    const selectedConnectorsRef = useRef(selectedConnectors);

    // Update refs whenever state changes - this ensures we always have current values
    selectedModelRef.current = selectedModel;
    selectedGroupRef.current = selectedGroup;
    isCustomInstructionsEnabledRef.current = isCustomInstructionsEnabled;
    selectedConnectorsRef.current = selectedConnectors;

    const { messages, sendMessage, setMessages, regenerate, stop, status, error, resumeStream } = useChat<ChatMessage>({
      id: chatId,
      transport: new DefaultChatTransport({
        api: '/api/search',
        prepareSendMessagesRequest({ messages, body }) {
          // Use ref values to get current state
          return {
            body: {
              id: chatId,
              messages,
              model: selectedModelRef.current,
              group: selectedGroupRef.current,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              isCustomInstructionsEnabled: isCustomInstructionsEnabledRef.current,
              searchProvider: searchProviderRef.current,
              selectedConnectors: selectedConnectorsRef.current,
              ...(initialChatId ? { chat_id: initialChatId } : {}),
              ...body,
            },
          };
        },
      }),
      experimental_throttle: 100,
      onData: (dataPart) => {
        setDataStream((ds) => (ds ? [...ds, dataPart] : []));
      },
      onFinish: async ({ message }) => {
        // Refresh usage data after message completion for authenticated users
        if (user) {
          refetchUsage();
        }

        // Check if this is the first message completion and user is not Pro
        const isFirstMessage = messages.length <= 1;

        // Show upgrade dialog after first message if user is not Pro and hasn't seen it before
        if (isFirstMessage && !isUserPro && !proStatusLoading && !chatState.hasShownUpgradeDialog && user) {
          setTimeout(() => {
            dispatch({ type: 'SET_SHOW_UPGRADE_DIALOG', payload: true });
            dispatch({ type: 'SET_HAS_SHOWN_UPGRADE_DIALOG', payload: true });
            setPersitedHasShownUpgradeDialog(true);
          }, 1000);
        }

        // Only generate suggested questions if authenticated user or private chat
        if (message.parts && message.role === 'assistant' && (user || chatState.selectedVisibilityType === 'private')) {
          const lastPart = message.parts[message.parts.length - 1];
          const lastPartText = lastPart && lastPart.type === 'text' ? lastPart.text : '';
          const newHistory = [
            { role: 'user', content: lastSubmittedQueryRef.current },
            { role: 'assistant', content: lastPartText },
          ];
          const { questions } = await suggestQuestions(newHistory);
          dispatch({ type: 'SET_SUGGESTED_QUESTIONS', payload: questions });
        }
      },
      onError: (error) => {
        // Don't show toast for ChatSDK errors as they will be handled by the enhanced error display
        if (error instanceof ChatSDKError) {
          // Only show toast for certain error types that need immediate attention
          if (error.type === 'offline' || error.surface === 'stream') {
            toast.error('Connection Error', {
              description: error.message,
            });
          }
        } else {
          console.error('Chat error:', error.cause, error.message);
          toast.error('An error occurred.', {
            description: `Oops! An error occurred while processing your request. ${error.cause || error.message}`,
          });
        }
      },
      messages: initialMessages || [],
    });

    // Handle text highlighting and quoting
    const handleHighlight = useCallback(
      (text: string) => {
        const quotedText = `> ${text.replace(/\n/g, '\n> ')}\n\n`;
        setInput((prev: string) => prev + quotedText);

        // Focus the input after adding the quote
        setTimeout(() => {
          const inputElement = document.querySelector('textarea[placeholder*="Ask"]') as HTMLTextAreaElement;
          if (inputElement) {
            inputElement.focus();
            // Move cursor to end
            inputElement.setSelectionRange(inputElement.value.length, inputElement.value.length);
          }
        }, 100);
      },
      [setInput],
    );

    useAutoResume({
      autoResume: true,
      initialMessages: initialMessages || [],
      resumeStream,
      setMessages,
    });

    useEffect(() => {
      if (user && status === 'streaming' && messages.length > 0) {
        invalidateChatsCache();
      }
    }, [user, status, router, chatId, initialChatId, messages.length]);

    useEffect(() => {
      if (!initializedRef.current && initialState.query && !messages.length && !initialChatId) {
        initializedRef.current = true;
        sendMessage({
          parts: [{ type: 'text', text: initialState.query }],
          role: 'user',
        });
      }
    }, [initialState.query, sendMessage, setInput, messages.length, initialChatId]);

    // Generate suggested questions when opening a chat directly
    useEffect(() => {
      const generateSuggestionsForInitialMessages = async () => {
        // Only generate if we have initial messages, no suggested questions yet,
        // user is authenticated or chat is private, and status is not streaming
        if (
          initialMessages &&
          initialMessages.length >= 2 &&
          !chatState.suggestedQuestions.length &&
          (user || chatState.selectedVisibilityType === 'private') &&
          status === 'ready'
        ) {
          const lastUserMessage = initialMessages.filter((m) => m.role === 'user').pop();
          const lastAssistantMessage = initialMessages.filter((m) => m.role === 'assistant').pop();

          if (lastUserMessage && lastAssistantMessage) {
            // Extract content from parts similar to onFinish callback
            const getUserContent = (message: typeof lastUserMessage) => {
              if (message.parts && message.parts.length > 0) {
                const lastPart = message.parts[message.parts.length - 1];
                return lastPart.type === 'text' ? lastPart.text : '';
              }
              return message.content || '';
            };

            const getAssistantContent = (message: typeof lastAssistantMessage) => {
              if (message.parts && message.parts.length > 0) {
                const lastPart = message.parts[message.parts.length - 1];
                return lastPart.type === 'text' ? lastPart.text : '';
              }
              return message.content || '';
            };

            const newHistory = [
              { role: 'user', content: getUserContent(lastUserMessage) },
              { role: 'assistant', content: getAssistantContent(lastAssistantMessage) },
            ];
            try {
              const { questions } = await suggestQuestions(newHistory);
              dispatch({ type: 'SET_SUGGESTED_QUESTIONS', payload: questions });
            } catch (error) {
              console.error('Error generating suggested questions:', error);
            }
          }
        }
      };

      generateSuggestionsForInitialMessages();
    }, [initialMessages, chatState.suggestedQuestions.length, status, user, chatState.selectedVisibilityType]);

    // Reset suggested questions when status changes to streaming
    useEffect(() => {
      if (status === 'streaming') {
        // Clear suggested questions when a new message is being streamed
        dispatch({ type: 'RESET_SUGGESTED_QUESTIONS' });
      }
    }, [status]);

    const lastUserMessageIndex = useMemo(() => {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          return i;
        }
      }
      return -1;
    }, [messages]);

    useEffect(() => {
      // Reset manual scroll when streaming starts
      if (status === 'streaming') {
        resetManualScroll();
        scrollToBottom();
      }
    }, [status, resetManualScroll, scrollToBottom]);

    // Auto-scroll during streaming when messages change
    useEffect(() => {
      if (status === 'streaming') {
        scrollToBottom();
      }
    }, [messages, status, scrollToBottom]);

    // Dialog management state - track command dialog state in chat state
    useEffect(() => {
      dispatch({
        type: 'SET_ANY_DIALOG_OPEN',
        payload:
          chatState.commandDialogOpen ||
          chatState.showUpgradeDialog,
      });
    }, [
      chatState.commandDialogOpen,
      chatState.showUpgradeDialog,
    ]);

    // Keyboard shortcut for command dialog
    useEffect(() => {
      const down = (e: KeyboardEvent) => {
        if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          dispatch({ type: 'SET_COMMAND_DIALOG_OPEN', payload: !chatState.commandDialogOpen });
        }
      };

      document.addEventListener('keydown', down);
      return () => document.removeEventListener('keydown', down);
    }, [chatState.commandDialogOpen]);

    // Define the model change handler
    const handleModelChange = useCallback(
      (model: string) => {
        setSelectedModel(model);
      },
      [setSelectedModel],
    );

    const resetSuggestedQuestions = useCallback(() => {
      dispatch({ type: 'RESET_SUGGESTED_QUESTIONS' });
    }, []);

    // Handle visibility change
    const handleVisibilityChange = useCallback(
      async (visibility: VisibilityType) => {
        if (!chatId) {
          return;
        }

        try {
          const result = await updateChatVisibility(chatId, visibility);

          if (result && result.success) {
            dispatch({ type: 'SET_VISIBILITY_TYPE', payload: visibility });
            toast.success(`Chat is now ${visibility}`);
            invalidateChatsCache();
          } else {
            toast.error('Failed to update chat visibility');
          }
        } catch {
          toast.error('Failed to update chat visibility');
        }
      },
      [chatId],
    );

    return (
      <div className="flex flex-col font-sans! items-center h-screen bg-background text-foreground transition-all duration-500 w-full overflow-x-hidden !scrollbar-thin !scrollbar-thumb-muted-foreground dark:!scrollbar-thumb-muted-foreground !scrollbar-track-transparent hover:!scrollbar-thumb-foreground dark:!hover:scrollbar-thumb-foreground">
        <Navbar
          isDialogOpen={chatState.anyDialogOpen}
          chatId={initialChatId || (messages.length > 0 ? chatId : null)}
          selectedVisibilityType={chatState.selectedVisibilityType}
          onVisibilityChange={handleVisibilityChange}
          status={status}
          user={user || null}
          isOwner={isOwner}
          subscriptionData={subscriptionData}
          isProUser={isUserPro}
          isProStatusLoading={proStatusLoading}
          isCustomInstructionsEnabled={isCustomInstructionsEnabled}
          setIsCustomInstructionsEnabled={setIsCustomInstructionsEnabled}
          settingsOpen={settingsOpen}
          setSettingsOpen={setSettingsOpen}
          settingsInitialTab={settingsInitialTab}
          onOpenSettingsWithTab={handleOpenSettings}
        />

        {/* Chat Dialogs Component */}
        <ChatDialogs
          commandDialogOpen={chatState.commandDialogOpen}
          setCommandDialogOpen={(open) => dispatch({ type: 'SET_COMMAND_DIALOG_OPEN', payload: open })}
          showUpgradeDialog={chatState.showUpgradeDialog}
          setShowUpgradeDialog={(open) => dispatch({ type: 'SET_SHOW_UPGRADE_DIALOG', payload: open })}
          hasShownUpgradeDialog={chatState.hasShownUpgradeDialog}
          setHasShownUpgradeDialog={(value) => {
            dispatch({ type: 'SET_HAS_SHOWN_UPGRADE_DIALOG', payload: value });
            setPersitedHasShownUpgradeDialog(value);
          }}
          user={user}
          setAnyDialogOpen={(open) => dispatch({ type: 'SET_ANY_DIALOG_OPEN', payload: open })}
        />

        <div
          className={`w-full p-2 sm:p-4 relative ${
            status === 'ready' && messages.length === 0
              ? 'flex-1 !flex !flex-col !items-center !justify-center' // Center everything when no messages
              : '!mt-20 sm:!mt-16 flex !flex-col' // Add top margin when showing messages
          }`}
        >
          {/* Static background gradient around center area for no messages state */}
          {/* {status === 'ready' && messages.length === 0 && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] pointer-events-none dark:hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-secondary/25 via-primary/20 to-accent/25 rounded-full blur-3xl" />
              <div className="absolute inset-0 bg-gradient-to-tl from-accent/20 via-transparent to-secondary/25 rounded-full blur-2xl" />
            </div>
          )} */}
          <div className={`w-full max-w-[95%] sm:max-w-2xl space-y-6 p-0 mx-auto transition-all duration-300`}>
            {status === 'ready' && messages.length === 0 && (
              <div className="text-center m-0 mb-2">
                <div className="inline-flex items-center gap-3">
                  <Image
                    src="/mylo-logo.png"
                    alt="MYLO - Dein Travel-Concierge"
                    width={280}
                    height={75}
                    priority
                    className="dark:invert-0"
                  />
                  {isUserPro && (
                    <h1 className="text-2xl font-baumans! leading-4 inline-block !px-3 !pt-1 !pb-2.5 rounded-xl shadow-sm !m-0 !mt-2 bg-gradient-to-br from-secondary/25 via-primary/20 to-accent/25 text-foreground ring-1 ring-ring/35 ring-offset-1 ring-offset-background dark:bg-gradient-to-br dark:from-primary dark:via-secondary dark:to-primary dark:text-foreground">
                      pro
                    </h1>
                  )}
                </div>
              </div>
            )}



            {/* Use the Messages component */}
            {messages.length > 0 && (
              <Messages
                messages={messages as ChatMessage[]}
                lastUserMessageIndex={lastUserMessageIndex}
                input={input}
                setInput={setInput}
                setMessages={(messages) => {
                  setMessages(messages as ChatMessage[]);
                }}
                sendMessage={sendMessage}
                regenerate={regenerate}
                suggestedQuestions={chatState.suggestedQuestions}
                setSuggestedQuestions={(questions) => dispatch({ type: 'SET_SUGGESTED_QUESTIONS', payload: questions })}
                status={status}
                error={error ?? null}
                user={user}
                selectedVisibilityType={chatState.selectedVisibilityType}
                chatId={initialChatId || (messages.length > 0 ? chatId : undefined)}
                onVisibilityChange={handleVisibilityChange}
                initialMessages={initialMessages}
                isOwner={isOwner}
                onHighlight={handleHighlight}
              />
            )}

            <div ref={bottomRef} />
          </div>

          {/* Single Form Component with dynamic positioning */}
          {((user && isOwner) || !initialChatId || (!user && chatState.selectedVisibilityType === 'private')) &&
            !isLimitBlocked && (
              <div
                className={cn(
                  'transition-all duration-500',
                  messages.length === 0 && !chatState.hasSubmitted
                    ? 'relative w-full max-w-2xl mx-auto'
                    : 'fixed bottom-0 z-20 !pb-6 mt-1 px-4 sm:px-2 p-0 left-0 right-0 md:left-[var(--sidebar-width)] md:group-data-[collapsible=icon]:left-[var(--sidebar-width-icon)]',
                )}
              >
                <FormComponent
                  chatId={chatId}
                  user={user!}
                  subscriptionData={subscriptionData}
                  input={input}
                  setInput={setInput}
                  inputRef={inputRef}
                  stop={stop}
                  messages={messages as ChatMessage[]}
                  sendMessage={sendMessage}
                  selectedModel={selectedModel}
                  setSelectedModel={handleModelChange}
                  resetSuggestedQuestions={resetSuggestedQuestions}
                  lastSubmittedQueryRef={lastSubmittedQueryRef}
                  selectedGroup={selectedGroup}
                  setSelectedGroup={setSelectedGroup}
                  showExperimentalModels={messages.length === 0}
                  status={status}
                  setHasSubmitted={(hasSubmitted) => {
                    const newValue =
                      typeof hasSubmitted === 'function' ? hasSubmitted(chatState.hasSubmitted) : hasSubmitted;
                    dispatch({ type: 'SET_HAS_SUBMITTED', payload: newValue });
                  }}
                  isLimitBlocked={isLimitBlocked}
                  onOpenSettings={handleOpenSettings}
                  selectedConnectors={selectedConnectors}
                  setSelectedConnectors={setSelectedConnectors}
                />
              </div>
            )}

          {/* Form backdrop overlay - hides content below form when in submitted mode */}
          {((user && isOwner) || !initialChatId || (!user && chatState.selectedVisibilityType === 'private')) &&
            !isLimitBlocked &&
            (messages.length > 0 || chatState.hasSubmitted) && (
              <div
                className="fixed left-0 right-0 md:left-[var(--sidebar-width)] md:group-data-[collapsible=icon]:left-[var(--sidebar-width-icon)] z-10 bg-gradient-to-t from-background via-background/95 to-background/80 backdrop-blur-sm pointer-events-none"
                style={{
                  bottom: 0,
                  height: '120px',
                }}
              />
            )}


        </div>
      </div>
    );
  },
);

// Add a display name for the memoized component for better debugging
ChatInterface.displayName = 'ChatInterface';

export { ChatInterface };
