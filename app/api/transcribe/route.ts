import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { transcribeAudioWithFallback } from '@/lib/xai/voice';

export async function POST(request: NextRequest) {
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
