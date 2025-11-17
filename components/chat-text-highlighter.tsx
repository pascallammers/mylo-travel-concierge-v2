'use client';

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { BookmarkPlus, Loader2 } from 'lucide-react';

interface ChatTextHighlighterProps {
  children: React.ReactNode;
  onHighlight?: (text: string) => void;
  onAddToMemory?: (text: string) => void | Promise<void>;
  className?: string;
  removeHighlightOnClick?: boolean;
}

interface PopupPosition {
  x: number;
  y: number;
  text: string;
}

export const ChatTextHighlighter: React.FC<ChatTextHighlighterProps> = ({
  children,
  onHighlight,
  onAddToMemory,
  className,
}) => {
  const [popup, setPopup] = useState<PopupPosition | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log('Text copied:', text);
    } catch (err) {
      console.error('Copy failed:', err);
      // Fallback method
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        console.log('Fallback copy succeeded');
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  }, []);

  const handleQuote = useCallback(
    (text: string) => {
      if (onHighlight) {
        onHighlight(text);
      }
    },
    [onHighlight],
  );

  const closePopup = useCallback(() => {
    setPopup(null);
    setIsSaving(false);
    window.getSelection()?.removeAllRanges();
  }, []);

  const handleAddToMemory = useCallback(async () => {
    if (!popup || !onAddToMemory || isSaving) return;
    
    setIsSaving(true);
    try {
      await Promise.resolve(onAddToMemory(popup.text));
      closePopup();
    } catch (error) {
      console.error('Failed to add to memory:', error);
      setIsSaving(false);
    }
  }, [popup, onAddToMemory, isSaving, closePopup]);

  const handlePointerUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setPopup(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const text = selection.toString().trim();

    if (!text || text.length < 2) {
      setPopup(null);
      return;
    }

    if (containerRef.current && !containerRef.current.contains(range.commonAncestorContainer)) {
      setPopup(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();

    if (containerRect) {
      setPopup({
        x: rect.left + rect.width / 2 - containerRect.left,
        y: rect.top - containerRect.top - 8,
        text,
      });
    }
  }, []);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as Node;
    if (popupRef.current && popupRef.current.contains(target)) {
      return;
    }
    setPopup(null);
  }, []);

  useEffect(() => {
    const handleScrollOrResize = () => setPopup(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPopup(null);
      }
      // Cmd/Ctrl + M to save to memory
      if ((e.metaKey || e.ctrlKey) && e.key === 'm' && popup && onAddToMemory && !isSaving) {
        e.preventDefault();
        handleAddToMemory();
      }
    };
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [popup, onAddToMemory, isSaving, handleAddToMemory]);

  return (
    <div 
      ref={containerRef}
      className={cn('relative', className)} 
      onPointerUp={handlePointerUp}
      onPointerDown={handlePointerDown}
    >
      {children}
      
      {popup && (
        <div 
          ref={popupRef}
          className="selection-popup absolute z-50 bg-background border border-border rounded-md shadow-lg p-1.5 pointer-events-auto"
          style={{
            left: popup.x,
            top: popup.y,
            transform: 'translateX(-50%) translateY(-100%)'
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex gap-1">
            <button
              onClick={async () => {
                await handleCopy(popup.text);
                closePopup();
              }}
              className="px-2 py-1 text-xs font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
            >
              Copy
            </button>
            
            <button
              onClick={() => {
                handleQuote(popup.text);
                closePopup();
              }}
              className="px-2 py-1 text-xs font-medium bg-secondary text-secondary-foreground rounded hover:bg-secondary/90 transition-colors"
            >
              Quote
            </button>
            
            {onAddToMemory && (
              <button
                onClick={handleAddToMemory}
                disabled={isSaving}
                className="px-2 py-1 text-xs font-medium bg-accent text-accent-foreground rounded hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                aria-label="Save to memory"
              >
                {isSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <BookmarkPlus className="h-3 w-3" />
                    <span className="hidden sm:inline">Save</span>
                  </>
                )}
              </button>
            )}
            
            <button
              onClick={closePopup}
              className="px-1.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatTextHighlighter;
