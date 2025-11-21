import { NextRequest, NextResponse } from 'next/server';
import { GeminiFileManager } from '@/lib/gemini-file-manager';

async function handleDelete(name: string | null) {
  if (!name) {
    return NextResponse.json({ error: 'File name is required' }, { status: 400 });
  }

  try {
    await GeminiFileManager.deleteFile(name);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete file error:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  return handleDelete(searchParams.get('name'));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    return handleDelete(body?.name ?? null);
  } catch (_err) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
