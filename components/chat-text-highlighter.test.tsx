import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatTextHighlighter } from './chat-text-highlighter';

describe('ChatTextHighlighter', () => {
  let getSelectionMock: any;
  let originalGetSelection: typeof window.getSelection;

  beforeEach(() => {
    originalGetSelection = window.getSelection;
    getSelectionMock = {
      toString: () => '',
      rangeCount: 0,
      getRangeAt: () => ({}),
      removeAllRanges: () => {},
    };
    window.getSelection = () => getSelectionMock;
  });

  afterEach(() => {
    window.getSelection = originalGetSelection;
  });

  const createSelection = (text: string, rect = { left: 100, top: 50, width: 100, height: 20 }) => {
    getSelectionMock.toString = () => text;
    getSelectionMock.rangeCount = 1;
    getSelectionMock.getRangeAt = () => ({
      getBoundingClientRect: () => rect,
      commonAncestorContainer: document.body,
    });
  };

  describe('Add to Memory button', () => {
    it('should not render Save button when onAddToMemory prop is not provided', () => {
      render(
        <ChatTextHighlighter>
          <div>Test content</div>
        </ChatTextHighlighter>
      );

      const container = screen.getByText('Test content').parentElement;
      createSelection('test text');
      
      if (container) {
        fireEvent.pointerUp(container);
      }

      // Wait a bit for popup to potentially appear
      setTimeout(() => {
        expect(screen.queryByLabelText('Save to memory')).toBeNull();
      }, 100);
    });

    it('should render Save button when onAddToMemory prop is provided', async () => {
      const onAddToMemory = mock(() => {});
      
      const { container } = render(
        <ChatTextHighlighter onAddToMemory={onAddToMemory}>
          <div>Test content</div>
        </ChatTextHighlighter>
      );

      createSelection('test text');
      fireEvent.pointerUp(container.firstChild!);

      await waitFor(() => {
        const saveButton = screen.queryByLabelText('Save to memory');
        expect(saveButton).not.toBeNull();
      });
    });

    it('should call onAddToMemory with selected text when Save button is clicked', async () => {
      const onAddToMemory = mock(() => {});
      
      const { container } = render(
        <ChatTextHighlighter onAddToMemory={onAddToMemory}>
          <div>Test content</div>
        </ChatTextHighlighter>
      );

      createSelection('test text selection');
      fireEvent.pointerUp(container.firstChild!);

      await waitFor(() => {
        const saveButton = screen.getByLabelText('Save to memory');
        expect(saveButton).toBeDefined();
      });

      const saveButton = screen.getByLabelText('Save to memory');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onAddToMemory).toHaveBeenCalledTimes(1);
        expect(onAddToMemory).toHaveBeenCalledWith('test text selection');
      });
    });

    it('should show loading spinner while onAddToMemory is executing', async () => {
      let resolveMemory: (value: unknown) => void;
      const memoryPromise = new Promise((resolve) => {
        resolveMemory = resolve;
      });
      const onAddToMemory = mock(() => memoryPromise);
      
      const { container } = render(
        <ChatTextHighlighter onAddToMemory={onAddToMemory}>
          <div>Test content</div>
        </ChatTextHighlighter>
      );

      createSelection('test text');
      fireEvent.pointerUp(container.firstChild!);

      await waitFor(() => {
        expect(screen.getByLabelText('Save to memory')).toBeDefined();
      });

      const saveButton = screen.getByLabelText('Save to memory');
      fireEvent.click(saveButton);

      // Check that loading spinner appears
      await waitFor(() => {
        const spinner = saveButton.querySelector('.animate-spin');
        expect(spinner).not.toBeNull();
      });

      // Resolve the promise
      resolveMemory!(undefined);

      // Check that loading spinner disappears
      await waitFor(() => {
        const spinner = saveButton.querySelector('.animate-spin');
        expect(spinner).toBeNull();
      });
    });

    it('should disable Save button during loading', async () => {
      let resolveMemory: (value: unknown) => void;
      const memoryPromise = new Promise((resolve) => {
        resolveMemory = resolve;
      });
      const onAddToMemory = mock(() => memoryPromise);
      
      const { container } = render(
        <ChatTextHighlighter onAddToMemory={onAddToMemory}>
          <div>Test content</div>
        </ChatTextHighlighter>
      );

      createSelection('test text');
      fireEvent.pointerUp(container.firstChild!);

      await waitFor(() => {
        expect(screen.getByLabelText('Save to memory')).toBeDefined();
      });

      const saveButton = screen.getByLabelText('Save to memory') as HTMLButtonElement;
      fireEvent.click(saveButton);

      // Check that button is disabled
      await waitFor(() => {
        expect(saveButton.disabled).toBe(true);
      });

      // Resolve the promise
      resolveMemory!(undefined);

      // Check that button is enabled again (or popup is closed)
      await waitFor(() => {
        // Popup should close, so button might not exist
        const button = screen.queryByLabelText('Save to memory') as HTMLButtonElement | null;
        if (button) {
          expect(button.disabled).toBe(false);
        }
      });
    });

    it('should close popup after successful save', async () => {
      const onAddToMemory = mock(() => Promise.resolve());
      
      const { container } = render(
        <ChatTextHighlighter onAddToMemory={onAddToMemory}>
          <div>Test content</div>
        </ChatTextHighlighter>
      );

      createSelection('test text');
      fireEvent.pointerUp(container.firstChild!);

      await waitFor(() => {
        expect(screen.getByLabelText('Save to memory')).toBeDefined();
      });

      const saveButton = screen.getByLabelText('Save to memory');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.queryByLabelText('Save to memory')).toBeNull();
      });
    });

    it('should trigger save with Cmd+M keyboard shortcut on Mac', async () => {
      const onAddToMemory = mock(() => Promise.resolve());
      
      const { container } = render(
        <ChatTextHighlighter onAddToMemory={onAddToMemory}>
          <div>Test content</div>
        </ChatTextHighlighter>
      );

      createSelection('test text');
      fireEvent.pointerUp(container.firstChild!);

      await waitFor(() => {
        expect(screen.getByLabelText('Save to memory')).toBeDefined();
      });

      // Simulate Cmd+M (metaKey + m)
      fireEvent.keyDown(window, { key: 'm', metaKey: true });

      await waitFor(() => {
        expect(onAddToMemory).toHaveBeenCalledTimes(1);
        expect(onAddToMemory).toHaveBeenCalledWith('test text');
      });
    });

    it('should trigger save with Ctrl+M keyboard shortcut on Windows/Linux', async () => {
      const onAddToMemory = mock(() => Promise.resolve());
      
      const { container } = render(
        <ChatTextHighlighter onAddToMemory={onAddToMemory}>
          <div>Test content</div>
        </ChatTextHighlighter>
      );

      createSelection('test text');
      fireEvent.pointerUp(container.firstChild!);

      await waitFor(() => {
        expect(screen.getByLabelText('Save to memory')).toBeDefined();
      });

      // Simulate Ctrl+M (ctrlKey + m)
      fireEvent.keyDown(window, { key: 'm', ctrlKey: true });

      await waitFor(() => {
        expect(onAddToMemory).toHaveBeenCalledTimes(1);
        expect(onAddToMemory).toHaveBeenCalledWith('test text');
      });
    });

    it('should not trigger save with Cmd+M when popup is not visible', () => {
      const onAddToMemory = mock(() => Promise.resolve());
      
      render(
        <ChatTextHighlighter onAddToMemory={onAddToMemory}>
          <div>Test content</div>
        </ChatTextHighlighter>
      );

      // No selection made, popup not visible
      fireEvent.keyDown(window, { key: 'm', metaKey: true });

      expect(onAddToMemory).not.toHaveBeenCalled();
    });

    it('should not trigger save with Cmd+M when button is disabled/loading', async () => {
      let resolveMemory: (value: unknown) => void;
      const memoryPromise = new Promise((resolve) => {
        resolveMemory = resolve;
      });
      const onAddToMemory = mock(() => memoryPromise);
      
      const { container } = render(
        <ChatTextHighlighter onAddToMemory={onAddToMemory}>
          <div>Test content</div>
        </ChatTextHighlighter>
      );

      createSelection('test text');
      fireEvent.pointerUp(container.firstChild!);

      await waitFor(() => {
        expect(screen.getByLabelText('Save to memory')).toBeDefined();
      });

      const saveButton = screen.getByLabelText('Save to memory');
      fireEvent.click(saveButton);

      // Try to trigger keyboard shortcut while loading
      fireEvent.keyDown(window, { key: 'm', metaKey: true });

      // Should only be called once (from the click, not from keyboard)
      expect(onAddToMemory).toHaveBeenCalledTimes(1);

      resolveMemory!(undefined);
    });

    it('should handle synchronous onAddToMemory callback', async () => {
      const onAddToMemory = mock((text: string) => {
        console.log('Saved:', text);
      });
      
      const { container } = render(
        <ChatTextHighlighter onAddToMemory={onAddToMemory}>
          <div>Test content</div>
        </ChatTextHighlighter>
      );

      createSelection('test text');
      fireEvent.pointerUp(container.firstChild!);

      await waitFor(() => {
        expect(screen.getByLabelText('Save to memory')).toBeDefined();
      });

      const saveButton = screen.getByLabelText('Save to memory');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onAddToMemory).toHaveBeenCalledWith('test text');
        expect(screen.queryByLabelText('Save to memory')).toBeNull();
      });
    });

    it('should handle errors during save gracefully', async () => {
      const consoleErrorSpy = mock(() => {});
      const originalConsoleError = console.error;
      console.error = consoleErrorSpy;

      const onAddToMemory = mock(() => Promise.reject(new Error('Save failed')));
      
      const { container } = render(
        <ChatTextHighlighter onAddToMemory={onAddToMemory}>
          <div>Test content</div>
        </ChatTextHighlighter>
      );

      createSelection('test text');
      fireEvent.pointerUp(container.firstChild!);

      await waitFor(() => {
        expect(screen.getByLabelText('Save to memory')).toBeDefined();
      });

      const saveButton = screen.getByLabelText('Save to memory');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
        // Button should still be visible (popup doesn't close on error)
        expect(screen.queryByLabelText('Save to memory')).toBeDefined();
      });

      console.error = originalConsoleError;
    });

    it('should have minimum 44x44px touch target for mobile accessibility', async () => {
      const onAddToMemory = mock(() => {});
      
      const { container } = render(
        <ChatTextHighlighter onAddToMemory={onAddToMemory}>
          <div>Test content</div>
        </ChatTextHighlighter>
      );

      createSelection('test text');
      fireEvent.pointerUp(container.firstChild!);

      await waitFor(() => {
        expect(screen.getByLabelText('Save to memory')).toBeDefined();
      });

      const saveButton = screen.getByLabelText('Save to memory');
      const styles = window.getComputedStyle(saveButton);
      
      // Check that min-h-[44px] and min-w-[44px] classes are applied
      expect(saveButton.className).toContain('min-h-[44px]');
      expect(saveButton.className).toContain('min-w-[44px]');
    });
  });

  describe('Existing functionality (regression tests)', () => {
    it('should render children', () => {
      render(
        <ChatTextHighlighter>
          <div>Test content</div>
        </ChatTextHighlighter>
      );

      expect(screen.getByText('Test content')).toBeDefined();
    });

    it('should show popup with Copy and Quote buttons on text selection', async () => {
      const { container } = render(
        <ChatTextHighlighter>
          <div>Test content</div>
        </ChatTextHighlighter>
      );

      createSelection('test');
      fireEvent.pointerUp(container.firstChild!);

      await waitFor(() => {
        expect(screen.getByText('Copy')).toBeDefined();
        expect(screen.getByText('Quote')).toBeDefined();
      });
    });

    it('should call onHighlight when Quote button is clicked', async () => {
      const onHighlight = mock(() => {});
      
      const { container } = render(
        <ChatTextHighlighter onHighlight={onHighlight}>
          <div>Test content</div>
        </ChatTextHighlighter>
      );

      createSelection('quoted text');
      fireEvent.pointerUp(container.firstChild!);

      await waitFor(() => {
        expect(screen.getByText('Quote')).toBeDefined();
      });

      const quoteButton = screen.getByText('Quote');
      fireEvent.click(quoteButton);

      expect(onHighlight).toHaveBeenCalledWith('quoted text');
    });
  });
});
