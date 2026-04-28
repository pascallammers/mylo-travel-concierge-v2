import type { TextStreamPart, ToolSet } from 'ai';

class MarkdownJoiner {
  private buffer = '';
  private isBuffering = false;

  processText(text: string): string {
    let output = '';

    for (const char of text) {
      if (!this.isBuffering) {
        // Check if we should start buffering
        if (char === '[' || char === '*') {
          this.buffer = char;
          this.isBuffering = true;
        } else {
          // Pass through character directly
          output += char;
        }
      } else {
        this.buffer += char;

        // Check for complete markdown elements or false positives
        if (this.isCompleteLink() || this.isCompleteBold()) {
          // Complete markdown element - flush buffer as is
          output += this.buffer;
          this.clearBuffer();
        } else if (this.isFalsePositive(char)) {
          // False positive - flush buffer as raw text
          output += this.buffer;
          this.clearBuffer();
        }
      }
    }

    return output;
  }

  private isCompleteLink(): boolean {
    // Match [text](url) pattern
    const linkPattern = /^\[.*?\]\(.*?\)$/;
    return linkPattern.test(this.buffer);
  }

  private isCompleteBold(): boolean {
    // Match **text** pattern
    const boldPattern = /^\*\*.*?\*\*$/;
    return boldPattern.test(this.buffer);
  }

  private isFalsePositive(char: string): boolean {
    // For links: if we see [ followed by something other than valid link syntax
    if (this.buffer.startsWith('[')) {
      // If we hit a newline or another [ without completing the link, it's false positive
      return char === '\n' || (char === '[' && this.buffer.length > 1);
    }

    // For bold: if we see * or ** followed by whitespace or newline
    if (this.buffer.startsWith('*')) {
      // Single * followed by whitespace is likely a list item
      if (this.buffer.length === 1 && /\s/.test(char)) {
        return true;
      }
      // If we hit newline without completing bold, it's false positive
      return char === '\n';
    }

    return false;
  }

  private clearBuffer(): void {
    this.buffer = '';
    this.isBuffering = false;
  }

  flush(): string {
    const remaining = this.buffer;
    this.clearBuffer();
    return remaining;
  }
}

export const markdownJoinerTransform =
  <TOOLS extends ToolSet>() =>
  () => {
    const joiner = new MarkdownJoiner();
    let lastTextId: string | undefined;
    let lastProviderMetadata: TextStreamPart<TOOLS> extends { providerMetadata?: infer P } ? P : never;

    const flushBufferAs = (
      controller: TransformStreamDefaultController<TextStreamPart<TOOLS>>,
    ) => {
      const remaining = joiner.flush();
      // Only emit if we have an id to attach. Without an id, AI SDK's
      // toUIMessageStream maps the chunk to UIMessageChunk with id=undefined,
      // and the downstream consumer crashes on activeTextParts[undefined].text.
      if (remaining && lastTextId) {
        controller.enqueue({
          type: 'text-delta',
          id: lastTextId,
          text: remaining,
          ...(lastProviderMetadata ? { providerMetadata: lastProviderMetadata } : {}),
        } as TextStreamPart<TOOLS>);
      }
    };

    return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      transform(chunk, controller) {
        if (chunk.type === 'text-delta') {
          lastTextId = chunk.id;
          lastProviderMetadata = chunk.providerMetadata as typeof lastProviderMetadata;
          const processedText = joiner.processText(chunk.text);
          if (processedText) {
            controller.enqueue({
              ...chunk,
              text: processedText,
            });
          }
        } else if (chunk.type === 'text-end') {
          // Flush any pending buffer BEFORE forwarding text-end. Once text-end
          // is processed downstream, the active text part is deleted and any
          // later text-delta with the same id will fail.
          flushBufferAs(controller);
          lastTextId = undefined;
          lastProviderMetadata = undefined as typeof lastProviderMetadata;
          controller.enqueue(chunk);
        } else {
          controller.enqueue(chunk);
        }
      },
      flush(controller) {
        // Stream ended without text-end (e.g. abort). Use the last seen id
        // if available, otherwise drop the buffer rather than emit an
        // id-less chunk that would crash the downstream consumer.
        flushBufferAs(controller);
      },
    });
  };
