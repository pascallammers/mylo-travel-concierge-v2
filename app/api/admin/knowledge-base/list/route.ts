import { NextResponse } from 'next/server';
import { GeminiFileManager } from '@/lib/gemini-file-manager';

export async function GET() {
    try {
        const files = await GeminiFileManager.listFiles();
        return NextResponse.json({ files });
    } catch (error) {
        console.error('List files error:', error);
        return NextResponse.json(
            { error: 'Failed to list files' },
            { status: 500 }
        );
    }
}
