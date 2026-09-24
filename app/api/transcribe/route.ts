import { getUser } from '@/lib/auth-utils';
import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { transcribeAudioWithFallback } from '@/lib/xai/voice';

/**
 * Handle an authenticated request before invoking paid voice services.
 * @param request - The incoming voice request.
 * @returns Voice output, or 401 when no session is present.
 */
export async function POST(request: NextRequest) {
  if (!(await getUser())) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await request.formData();
    const audio = formData.get('audio');

    if (!audio || !(audio instanceof Blob)) {
      return NextResponse.json({ error: 'No audio file found in form data.' }, { status: 400 });
    }

    const text = await transcribeAudioWithFallback({
      audio,
      filename: audio instanceof File ? audio.name : 'recording.webm',
      mediaType: audio.type || 'audio/webm',
    });

    after(() => {
      console.log(`[Transcribe] Completed: ${text.length} chars`);
    });

    return NextResponse.json({ text });
  } catch (error) {
    console.error('Error processing transcription request:', error);
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
  }
}
