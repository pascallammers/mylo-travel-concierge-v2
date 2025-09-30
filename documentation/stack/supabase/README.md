# 🗄️ Supabase Documentation (Optional Stack)

## Overview
Supabase provides a PostgreSQL database with real-time subscriptions, authentication, and storage. Use when you need SQL features or have existing PostgreSQL data.

## Quick Links
- 🔄 [When to Use Supabase](#when-to-use)
- 🆚 [Convex vs Supabase](./convex-comparison.md)
- 🔗 [Integration with Next.js](./nextjs-integration.md)
- 🔄 [Migration Guide](./migration-guide.md)
- 📚 [Examples](./examples/)

## When to Use Supabase

### Choose Supabase When You Need:

```typescript
// ✅ Complex SQL queries with joins
const { data } = await supabase
  .from('posts')
  .select(`
    *,
    author:users(name, email),
    comments(
      *,
      user:users(name)
    )
  `)
  .eq('published', true)
  .order('created_at', { ascending: false });

// ✅ PostgreSQL-specific features
// - Full-text search
// - PostGIS for geospatial
// - Database functions and triggers
// - Row-level security (RLS)

// ✅ Existing PostgreSQL database
// - Migrating from another PostgreSQL service
// - Need to maintain SQL schema compatibility
```

### Choose Convex When You Need:

```typescript
// ✅ Simple real-time updates
const messages = useQuery(api.messages.list);

// ✅ Type-safe database operations
// ✅ Built-in file storage
// ✅ Simpler setup and maintenance
```

## Setup

### 1. Installation

```bash
npm install @supabase/supabase-js @supabase/ssr
```

### 2. Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... # Server only
```

### 3. Create Supabase Client

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// lib/supabase/server.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createServerSupabaseClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );
}
```

## Database Schema

### ✅ GOOD: Type-Safe Schema with TypeScript

```sql
-- Create tables with proper constraints
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create function for updated_at
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();
```

### Generate TypeScript Types

```bash
npx supabase gen types typescript --project-id xxxxxxxxxxxxxxxxxxxx > lib/supabase/types.ts
```

```typescript
// Use generated types
import { Database } from "@/lib/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type InsertProfile = Database["public"]["Tables"]["profiles"]["Insert"];
type UpdateProfile = Database["public"]["Tables"]["profiles"]["Update"];
```

## Authentication with Clerk

When using Clerk as primary auth, sync users to Supabase:

### ✅ GOOD: Sync Clerk Users to Supabase

```typescript
// app/api/webhooks/clerk/route.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // Use service key for admin access
);

export async function POST(req: Request) {
  // ... Clerk webhook verification ...

  if (eventType === "user.created") {
    const { id, email_addresses, first_name, last_name } = evt.data;

    // Create user in Supabase
    const { error } = await supabase
      .from("profiles")
      .insert({
        id: id, // Use Clerk ID as primary key
        email: email_addresses[0]?.email_address,
        full_name: `${first_name} ${last_name}`.trim(),
      });

    if (error) {
      console.error("Supabase sync error:", error);
    }
  }

  return new Response("", { status: 200 });
}
```

## Data Fetching Patterns

### 1. Server Components

```typescript
// ✅ GOOD: Server-side data fetching
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function PostsPage() {
  const supabase = createServerSupabaseClient();

  const { data: posts, error } = await supabase
    .from("posts")
    .select("*")
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching posts:", error);
    return <div>Error loading posts</div>;
  }

  return (
    <div>
      {posts?.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.content}</p>
        </article>
      ))}
    </div>
  );
}
```

### 2. Client Components with Real-time

```typescript
// ✅ GOOD: Real-time subscriptions
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export function RealtimeMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const supabase = createClient();

  useEffect(() => {
    // Initial fetch
    async function fetchMessages() {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true });

      if (data) setMessages(data);
    }

    fetchMessages();

    // Real-time subscription
    const channel = supabase
      .channel("messages")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setMessages(prev => [...prev, payload.new as Message]);
          }
          if (payload.eventType === "UPDATE") {
            setMessages(prev =>
              prev.map(msg =>
                msg.id === payload.new.id ? payload.new as Message : msg
              )
            );
          }
          if (payload.eventType === "DELETE") {
            setMessages(prev =>
              prev.filter(msg => msg.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  return (
    <div>
      {messages.map(message => (
        <div key={message.id}>{message.content}</div>
      ))}
    </div>
  );
}
```

### 3. Server Actions

```typescript
// ✅ GOOD: Server actions with Supabase
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createPost(formData: FormData) {
  const supabase = createServerSupabaseClient();

  const title = formData.get("title") as string;
  const content = formData.get("content") as string;

  const { data, error } = await supabase
    .from("posts")
    .insert({
      title,
      content,
      author_id: "current-user-id", // Get from auth
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/posts");
  return data;
}
```

## Storage

### File Upload Pattern

```typescript
// ✅ GOOD: File upload with progress
"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

export function FileUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const supabase = createClient();

  async function handleUpload(file: File) {
    setUploading(true);

    const fileName = `${Date.now()}-${file.name}`;
    const filePath = `uploads/${fileName}`;

    const { data, error } = await supabase.storage
      .from("files")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        onUploadProgress: (progress) => {
          setProgress((progress.loaded / progress.total) * 100);
        },
      });

    if (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload file");
    } else {
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("files")
        .getPublicUrl(filePath);

      // Save file reference to database
      await supabase.from("uploads").insert({
        file_path: filePath,
        public_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
      });

      toast.success("File uploaded successfully");
    }

    setUploading(false);
    setProgress(0);
  }

  return (
    <div>
      <input
        type="file"
        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        disabled={uploading}
      />
      {uploading && (
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
```

## Advanced Patterns

### 1. Database Functions

```sql
-- Create a function for full-text search
CREATE OR REPLACE FUNCTION search_posts(search_term TEXT)
RETURNS SETOF posts AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM posts
  WHERE
    to_tsvector('english', title || ' ' || content) @@
    plainto_tsquery('english', search_term)
  ORDER BY
    ts_rank(to_tsvector('english', title || ' ' || content),
    plainto_tsquery('english', search_term)) DESC;
END;
$$ LANGUAGE plpgsql;
```

```typescript
// Use the function
const { data } = await supabase
  .rpc("search_posts", { search_term: "typescript" });
```

### 2. Row Level Security

```sql
-- Complex RLS policy
CREATE POLICY "Users can manage own team's data"
  ON projects
  USING (
    auth.uid() IN (
      SELECT user_id
      FROM team_members
      WHERE team_id = projects.team_id
    )
  );
```

### 3. Edge Functions

```typescript
// supabase/functions/send-email/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const { email, subject, content } = await req.json();

  // Send email using Resend, SendGrid, etc.
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "noreply@example.com",
      to: email,
      subject,
      html: content,
    }),
  });

  return new Response(
    JSON.stringify({ success: response.ok }),
    { headers: { "Content-Type": "application/json" } }
  );
});
```

## Migration Strategy

### Moving from Convex to Supabase

```typescript
// 1. Export data from Convex
const allUsers = await ctx.db.query("users").collect();
const allPosts = await ctx.db.query("posts").collect();

// 2. Transform and import to Supabase
for (const user of allUsers) {
  await supabase.from("users").insert({
    id: user._id,
    // Map fields
  });
}

// 3. Update queries gradually
// Before: Convex
const posts = useQuery(api.posts.list);

// After: Supabase
const { data: posts } = await supabase
  .from("posts")
  .select("*");
```

## Best Practices

### ✅ DO's
1. **Use RLS** for security
2. **Generate TypeScript types** for type safety
3. **Handle errors** gracefully
4. **Use database functions** for complex logic
5. **Optimize queries** with indexes

### ❌ DON'Ts
1. **Don't expose** service keys to client
2. **Don't bypass RLS** without reason
3. **Don't use** Supabase auth if using Clerk
4. **Don't mix** Convex and Supabase unnecessarily
5. **Don't ignore** connection limits

## When NOT to Use Supabase

- ❌ When Convex meets all your needs
- ❌ For simple CRUD without SQL requirements
- ❌ When you want simpler type safety (Convex is better)
- ❌ If you don't need PostgreSQL features

## Debugging

### Common Issues

**Connection refused:**
- Check environment variables
- Verify project status in Supabase dashboard

**RLS blocking queries:**
- Check policies in Supabase dashboard
- Use service key for admin operations

**Type errors:**
- Regenerate types after schema changes
- Check for nullable fields

## Related Documentation
- 🔗 [Convex Comparison](./convex-comparison.md)
- 🔗 [Database Patterns](../../patterns/data-management/)
- 🔗 [Migration Guide](./migration-guide.md)

---

*Supabase is powerful when you need PostgreSQL features. For most applications, Convex provides a simpler, more integrated developer experience.*