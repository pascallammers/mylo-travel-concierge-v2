import { getUser } from '@/lib/auth-utils';
import { NextRequest, NextResponse } from 'next/server';
import { buildXaiRealtimeSessionConfig, createXaiRealtimeClientSecret } from '@/lib/xai/voice';

/**
 * Handle an authenticated request before invoking paid voice services.
 * @param request - The incoming voice request.
 * @returns Voice output, or 401 when no session is present.
 */
export async function POST(request: NextRequest) {
  if (!(await getUser())) return Response.json({ error: 'Unauthorized' }, { status: 401 });

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
