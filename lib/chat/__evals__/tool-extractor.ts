type GenerateTextLike = {
  toolCalls?: Array<{ toolName: string }>;
};

export function extractFirstToolCall(result: GenerateTextLike): string | null {
  const first = result.toolCalls?.[0];
  return first ? first.toolName : null;
}
