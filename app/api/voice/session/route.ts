import { NextRequest, NextResponse } from 'next/server';
import { buildXaiRealtimeSessionConfig, createXaiRealtimeClientSecret } from '@/lib/xai/voice';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      instructions?: string;
    };

    const clientSecret = await createXaiRealtimeClientSecret();
    const session = buildXaiRealtimeSessionConfig({
      instructions: body.instructions,
    });

    return NextResponse.json({
      ...clientSecret,
      session,
    });
  } catch (error) {
    console.error('[Voice Session] Failed to create xAI realtime session:', error);
    return NextResponse.json(
      {
        error: 'Unable to create voice session.',
      },
      { status: 500 },
    );
  }
}
