import { NextRequest, NextResponse } from 'next/server';
import { GeminiFileManager } from '@/lib/gemini-file-manager';

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const name = searchParams.get('name');

        if (!name) {
            return NextResponse.json(
                { error: 'File name is required' },
                { status: 400 }
            );
        }

        await GeminiFileManager.deleteFile(name);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete file error:', error);
        return NextResponse.json(
            { error: 'Failed to delete file' },
            { status: 500 }
        );
    }
}
