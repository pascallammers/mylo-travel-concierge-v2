import { NextRequest, NextResponse } from 'next/server';
import { GeminiFileManager } from '@/lib/gemini-file-manager';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import os from 'os';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Create a temporary file
        // Use /tmp for temporary storage
        const tempDir = '/tmp';
        const tempFilePath = join(tempDir, file.name);

        await writeFile(tempFilePath, buffer);

        try {
            const uploadResponse = await GeminiFileManager.uploadFile(
                tempFilePath,
                file.name,
                file.type
            );

            return NextResponse.json({ success: true, file: uploadResponse });
        } finally {
            // Clean up temp file
            await unlink(tempFilePath).catch(console.error);
        }
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json(
            { error: 'Failed to upload file' },
            { status: 500 }
        );
    }
}
