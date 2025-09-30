# File Sharing Application Example

A secure file sharing platform demonstrating file upload, storage, sharing, and access control using Convex storage.

## Stack Components Used
- **Next.js 14** - File upload UI and routing
- **Convex Storage** - Secure file storage and URL generation
- **Clerk** - User authentication and sharing permissions
- **ShadCN UI** - Upload components and file browsers
- **React Dropzone** - Drag-and-drop file uploads

## Features Demonstrated
- ✅ Secure file uploads with size/type validation
- ✅ Temporary download URLs generation
- ✅ File sharing with other users
- ✅ Access control and permissions
- ✅ File metadata and search
- ✅ Batch operations
- ✅ Upload progress tracking

## Cross-References
→ See also: [File Upload Patterns](../../patterns/data-management/file-uploads.md)
→ See also: [Storage Configuration](../../stack/convex/storage.md)
→ See also: [Access Control Patterns](../../patterns/authentication/access-control.md)

## File Structure
```
file-sharing/
├── good/                     # Best practice implementation
│   ├── convex/
│   │   ├── files.ts         # File management functions
│   │   ├── sharing.ts       # Sharing logic
│   │   └── storage.ts       # Storage utilities
│   ├── app/
│   │   ├── files/
│   │   │   ├── page.tsx     # File browser
│   │   │   └── [id]/
│   │   │       └── page.tsx # File details
│   │   └── shared/
│   │       └── page.tsx     # Shared files view
│   └── components/
│       ├── file-uploader.tsx
│       ├── file-browser.tsx
│       └── share-dialog.tsx
└── bad/                      # Common mistakes to avoid
    └── examples.md           # Anti-patterns
```

## Good Implementation Examples

### 1. Database Schema for Files (convex/schema.ts)

```typescript
// ✅ GOOD: Comprehensive file metadata schema
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  files: defineTable({
    name: v.string(),
    storageId: v.id("_storage"),
    type: v.string(),
    size: v.number(),
    ownerId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    parentFolder: v.optional(v.id("folders")),
    isPublic: v.boolean(),
    metadata: v.optional(v.object({
      width: v.optional(v.number()),
      height: v.optional(v.number()),
      duration: v.optional(v.number()),
    })),
  })
    .index("by_owner", ["ownerId"])
    .index("by_folder", ["ownerId", "parentFolder"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["ownerId"],
    }),

  shares: defineTable({
    fileId: v.id("files"),
    sharedBy: v.string(),
    sharedWith: v.string(),
    permission: v.union(v.literal("view"), v.literal("edit")),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_recipient", ["sharedWith"])
    .index("by_file", ["fileId"]),

  folders: defineTable({
    name: v.string(),
    ownerId: v.string(),
    parentId: v.optional(v.id("folders")),
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerId", "parentId"]),
});
```

### 2. File Upload Handler (convex/files.ts)

```typescript
// ✅ GOOD: Secure file upload with validation
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/pdf",
  "text/plain",
  "application/zip",
];

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Generate a temporary upload URL
    return await ctx.storage.generateUploadUrl();
  },
});

export const createFile = mutation({
  args: {
    name: v.string(),
    storageId: v.id("_storage"),
    type: v.string(),
    size: v.number(),
    parentFolder: v.optional(v.id("folders")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Validate file
    if (args.size > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
    }

    if (!ALLOWED_TYPES.includes(args.type)) {
      throw new Error(`File type ${args.type} is not allowed`);
    }

    // Check storage quota (example)
    const userFiles = await ctx.db
      .query("files")
      .withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
      .collect();

    const totalSize = userFiles.reduce((sum, file) => sum + file.size, 0);
    const QUOTA = 1024 * 1024 * 1024; // 1GB

    if (totalSize + args.size > QUOTA) {
      throw new Error("Storage quota exceeded");
    }

    // Create file record
    const fileId = await ctx.db.insert("files", {
      name: args.name,
      storageId: args.storageId,
      type: args.type,
      size: args.size,
      ownerId: identity.subject,
      parentFolder: args.parentFolder,
      isPublic: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return fileId;
  },
});

export const getDownloadUrl = query({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const file = await ctx.db.get(args.fileId);
    if (!file) {
      throw new Error("File not found");
    }

    // Check permissions
    const hasAccess =
      file.ownerId === identity.subject ||
      file.isPublic ||
      await checkSharedAccess(ctx, args.fileId, identity.subject);

    if (!hasAccess) {
      throw new Error("Access denied");
    }

    // Generate temporary download URL (expires in 1 hour)
    const url = await ctx.storage.getUrl(file.storageId);
    return url;
  },
});

async function checkSharedAccess(ctx: any, fileId: any, userId: string) {
  const share = await ctx.db
    .query("shares")
    .withIndex("by_file", (q: any) => q.eq("fileId", fileId))
    .filter((q: any) => q.eq(q.field("sharedWith"), userId))
    .first();

  if (!share) return false;

  // Check if share has expired
  if (share.expiresAt && share.expiresAt < Date.now()) {
    return false;
  }

  return true;
}
```

### 3. File Upload Component

```tsx
// ✅ GOOD: File uploader with progress tracking and validation
"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface UploadFile {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
}

export function FileUploader({
  onUploadComplete,
  folderId
}: {
  onUploadComplete?: () => void;
  folderId?: string;
}) {
  const [files, setFiles] = useState<Map<string, UploadFile>>(new Map());
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const createFile = useMutation(api.files.createFile);
  const { toast } = useToast();

  const uploadFile = async (file: File) => {
    const fileId = crypto.randomUUID();

    // Add to upload queue
    setFiles((prev) => new Map(prev).set(fileId, {
      file,
      progress: 0,
      status: "pending",
    }));

    try {
      // Update status to uploading
      setFiles((prev) => {
        const updated = new Map(prev);
        const current = updated.get(fileId)!;
        updated.set(fileId, { ...current, status: "uploading" });
        return updated;
      });

      // Get upload URL
      const uploadUrl = await generateUploadUrl();

      // Upload file with progress tracking
      const xhr = new XMLHttpRequest();

      await new Promise<void>((resolve, reject) => {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setFiles((prev) => {
              const updated = new Map(prev);
              const current = updated.get(fileId)!;
              updated.set(fileId, { ...current, progress });
              return updated;
            });
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => reject(new Error("Upload failed"));

        xhr.open("POST", uploadUrl);
        xhr.send(file);
      });

      // Extract storage ID from response
      const { storageId } = JSON.parse(xhr.responseText);

      // Create file record in database
      await createFile({
        name: file.name,
        storageId,
        type: file.type,
        size: file.size,
        parentFolder: folderId,
      });

      // Update status to success
      setFiles((prev) => {
        const updated = new Map(prev);
        const current = updated.get(fileId)!;
        updated.set(fileId, { ...current, status: "success", progress: 100 });
        return updated;
      });

      toast({
        title: "Upload complete",
        description: `${file.name} uploaded successfully`,
      });

      onUploadComplete?.();
    } catch (error) {
      // Update status to error
      setFiles((prev) => {
        const updated = new Map(prev);
        const current = updated.get(fileId)!;
        updated.set(fileId, {
          ...current,
          status: "error",
          error: error instanceof Error ? error.message : "Upload failed",
        });
        return updated;
      });

      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      acceptedFiles.forEach(uploadFile);
    },
    [folderId]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 100 * 1024 * 1024, // 100MB
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif"],
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
      "application/zip": [".zip"],
    },
  });

  const removeFile = (fileId: string) => {
    setFiles((prev) => {
      const updated = new Map(prev);
      updated.delete(fileId);
      return updated;
    });
  };

  return (
    <div className="space-y-4">
      <Card
        {...getRootProps()}
        className={`
          border-2 border-dashed p-8 text-center cursor-pointer
          transition-colors hover:border-primary/50
          ${isDragActive ? "border-primary bg-primary/5" : ""}
        `}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium">
          {isDragActive ? "Drop files here" : "Drag & drop files here"}
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          or click to select files (max 100MB)
        </p>
        <Button variant="secondary" className="mt-4">
          Browse Files
        </Button>
      </Card>

      {files.size > 0 && (
        <Card className="p-4">
          <h3 className="font-medium mb-4">Uploads</h3>
          <div className="space-y-3">
            {Array.from(files.entries()).map(([id, upload]) => (
              <div key={id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {upload.status === "success" && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    {upload.status === "error" && (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm truncate max-w-[200px]">
                      {upload.file.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({(upload.file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {upload.status === "uploading" && (
                  <Progress value={upload.progress} className="h-2" />
                )}
                {upload.error && (
                  <p className="text-xs text-red-500">{upload.error}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
```

### 4. File Sharing Dialog

```tsx
// ✅ GOOD: Secure file sharing with permissions
"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";

export function ShareDialog({
  fileId,
  fileName,
  open,
  onOpenChange
}: {
  fileId: Id<"files">;
  fileName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<"view" | "edit">("view");
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [isPublic, setIsPublic] = useState(false);

  const shareFile = useMutation(api.sharing.shareFile);
  const updateFileVisibility = useMutation(api.files.updateVisibility);
  const getShareLink = useQuery(api.sharing.getShareLink, { fileId });
  const { toast } = useToast();

  const handleShare = async () => {
    try {
      if (isPublic) {
        await updateFileVisibility({
          fileId,
          isPublic: true,
        });
        toast({
          title: "File made public",
          description: "Anyone with the link can now access this file",
        });
      } else if (email) {
        await shareFile({
          fileId,
          sharedWith: email,
          permission,
          expiresIn: expiresIn ? expiresIn * 24 * 60 * 60 * 1000 : undefined,
        });
        toast({
          title: "File shared",
          description: `${fileName} has been shared with ${email}`,
        });
      }

      setEmail("");
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Sharing failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const copyShareLink = () => {
    if (getShareLink) {
      navigator.clipboard.writeText(getShareLink);
      toast({
        title: "Link copied",
        description: "Share link has been copied to clipboard",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share {fileName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="public">Make file public</Label>
            <Switch
              id="public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
          </div>

          {!isPublic && (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">Share with email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="permission">Permission</Label>
                <Select value={permission} onValueChange={(v: any) => setPermission(v)}>
                  <SelectTrigger id="permission">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">View only</SelectItem>
                    <SelectItem value="edit">Can edit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expires">Expires in (days)</Label>
                <Input
                  id="expires"
                  type="number"
                  placeholder="Never"
                  value={expiresIn || ""}
                  onChange={(e) => setExpiresIn(e.target.value ? parseInt(e.target.value) : null)}
                />
              </div>
            </>
          )}

          {getShareLink && (
            <div className="space-y-2">
              <Label>Share link</Label>
              <div className="flex gap-2">
                <Input value={getShareLink} readOnly />
                <Button variant="outline" onClick={copyShareLink}>
                  Copy
                </Button>
              </div>
            </div>
          )}

          <Button onClick={handleShare} className="w-full">
            Share File
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

## Bad Implementation Examples

### ❌ BAD: No file validation

```typescript
// Missing size, type validation and security checks
export const uploadFile = mutation({
  args: { data: v.any() }, // Never use v.any()
  handler: async (ctx, args) => {
    // No authentication check
    // No file size validation
    // No file type validation
    return await ctx.storage.store(args.data);
  },
});
```

### ❌ BAD: Exposing permanent storage URLs

```typescript
// Never expose permanent storage URLs
export const getFile = query({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.fileId);
    // BAD: This URL never expires and can be shared indefinitely
    return await ctx.storage.getUrl(file.storageId);
  },
});
```

### ❌ BAD: No upload progress tracking

```tsx
// Poor UX with no progress feedback
function FileUpload() {
  const handleUpload = async (file: File) => {
    // No progress tracking
    const response = await fetch("/upload", {
      method: "POST",
      body: file,
    });
    // User has no idea about upload progress
  };
}
```

### ❌ BAD: Insecure sharing without permissions

```typescript
// No permission checks or expiration
export const shareFile = mutation({
  args: {
    fileId: v.id("files"),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // No check if user owns the file
    // No permission levels
    // No expiration
    await ctx.db.insert("shares", {
      fileId: args.fileId,
      sharedWith: args.email,
    });
  },
});
```

## Security Checklist

- ✅ File size limits enforced
- ✅ File type validation
- ✅ Virus scanning for uploads (optional)
- ✅ Temporary URLs with expiration
- ✅ Access control on all operations
- ✅ Rate limiting on uploads
- ✅ Storage quota management

## Performance Optimizations

1. Use chunked uploads for large files
2. Implement resumable uploads
3. Generate thumbnails for images
4. Use CDN for file serving
5. Implement client-side compression

## Testing Considerations

1. Test file size limits
2. Test concurrent uploads
3. Test sharing permissions
4. Test URL expiration
5. Test storage quota enforcement

## Related Documentation

→ [Convex Storage Guide](../../stack/convex/storage.md)
→ [File Upload Patterns](../../patterns/data-management/file-uploads.md)
→ [Authentication Guide](../../patterns/authentication/)
→ [Access Control Patterns](../../patterns/authentication/access-control.md)