import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth-utils';
import { createServerVoiceToolRegistry } from '@/lib/xai/voice-tool-registry';
import { executeVoiceToolCall } from '@/lib/xai/voice-tools';

function normalizeToolArgs(value: unknown): Record<string, unknown> {
  if (!value) return {};

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return normalizeToolArgs(parsed);
    } catch {
      return {};
    }
  }

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      toolName?: string;
      args?: unknown;
      chatId?: string;
    };

    if (!body.toolName) {
      return NextResponse.json({ error: 'Missing toolName.' }, { status: 400 });
    }

    const user = await getUser();
    const result = await executeVoiceToolCall(
      {
        toolName: body.toolName,
        args: normalizeToolArgs(body.args),
        context: {
          userId: user?.id,
          chatId: body.chatId,
        },
      },
      createServerVoiceToolRegistry(),
    );

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    console.error('[Voice Tools] Tool execution failed:', error);
    const message = error instanceof Error ? error.message : 'Voice tool execution failed.';

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
