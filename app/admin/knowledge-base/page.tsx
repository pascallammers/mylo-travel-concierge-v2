'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Upload, FileText, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface GeminiFile {
    name: string;
    displayName: string;
    mimeType: string;
    sizeBytes: string;
    createTime: string;
    updateTime: string;
    expirationTime: string;
    uri: string;
    state: string;
}

export default function KnowledgeBasePage() {
    const [files, setFiles] = useState<GeminiFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);

    const fetchFiles = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/admin/knowledge-base/list');
            if (!response.ok) throw new Error('Failed to fetch files');
            const data = await response.json();
            setFiles(data.files || []);
        } catch (error) {
            console.error('Error fetching files:', error);
            toast.error('Failed to load files');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchFiles();
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setUploadFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!uploadFile) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', uploadFile);

        try {
            const response = await fetch('/api/admin/knowledge-base/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Upload failed');
            }

            toast.success('File uploaded successfully');
            setUploadFile(null);
            // Reset file input
            const fileInput = document.getElementById('file-upload') as HTMLInputElement;
            if (fileInput) fileInput.value = '';

            fetchFiles();
        } catch (error) {
            console.error('Upload error:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to upload file');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (fileName: string) => {
        if (!confirm('Are you sure you want to delete this file?')) return;

        try {
            const response = await fetch('/api/admin/knowledge-base/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: fileName }),
            });

            if (!response.ok) throw new Error('Delete failed');

            toast.success('File deleted successfully');
            fetchFiles();
        } catch (error) {
            console.error('Delete error:', error);
            toast.error('Failed to delete file');
        }
    };

    const formatBytes = (bytes: string) => {
        const size = parseInt(bytes);
        if (size === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(size) / Math.log(k));
        return parseFloat((size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
                    <p className="text-muted-foreground">
                        Manage documents for the AI Knowledge Base.
                    </p>
                </div>
                <Button onClick={fetchFiles} variant="outline" size="icon">
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Upload Document</CardTitle>
                    <CardDescription>
                        Upload PDF, Text, or Markdown files to be indexed by the AI.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4">
                        <Input
                            id="file-upload"
                            type="file"
                            accept=".pdf,.txt,.md,.csv"
                            onChange={handleFileChange}
                            className="max-w-md"
                        />
                        <Button onClick={handleUpload} disabled={!uploadFile || isUploading}>
                            {isUploading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Uploading...
                                </>
                            ) : (
                                <>
                                    <Upload className="mr-2 h-4 w-4" />
                                    Upload
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Files ({files.length})</CardTitle>
                    <CardDescription>
                        List of active files in the Knowledge Base.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Size</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {files.length === 0 && !isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        No files found. Upload some documents to get started.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                files.map((file) => (
                                    <TableRow key={file.name}>
                                        <TableCell className="font-medium flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-blue-500" />
                                            {file.displayName}
                                        </TableCell>
                                        <TableCell>{file.mimeType}</TableCell>
                                        <TableCell>{formatBytes(file.sizeBytes)}</TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${file.state === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                                                    file.state === 'PROCESSING' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-red-100 text-red-800'
                                                }`}>
                                                {file.state}
                                            </span>
                                        </TableCell>
                                        <TableCell>{new Date(file.createTime).toLocaleDateString()}</TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => handleDelete(file.name)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
