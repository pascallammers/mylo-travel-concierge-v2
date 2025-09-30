# CRUD Application Example

A complete task management application demonstrating Create, Read, Update, Delete operations using our standard stack.

## Stack Components Used
- **Next.js 14** - App Router for pages and routing
- **Convex** - Database and real-time subscriptions
- **Clerk** - User authentication and management
- **ShadCN UI** - Form components and data tables
- **Tailwind CSS** - Styling

## Features Demonstrated
- ✅ User authentication with protected routes
- ✅ Real-time data synchronization
- ✅ Optimistic UI updates
- ✅ Form validation with react-hook-form + zod
- ✅ Data pagination and filtering
- ✅ Error handling and loading states

## Cross-References
→ See also: [Data Management Patterns](../../patterns/data-management/)
→ See also: [Authentication Patterns](../../patterns/authentication/)
→ See also: [Form Patterns](../../patterns/ui-patterns/forms.md)

## File Structure
```
crud-app/
├── good/                  # Best practice implementation
│   ├── convex/
│   │   ├── tasks.ts      # Database schema and functions
│   │   └── _generated/   # Convex generated files
│   ├── app/
│   │   ├── tasks/
│   │   │   ├── page.tsx  # Task list page
│   │   │   └── [id]/
│   │   │       └── page.tsx  # Task detail page
│   │   └── api/
│   └── components/
│       ├── task-form.tsx
│       ├── task-list.tsx
│       └── task-item.tsx
└── bad/                   # Common mistakes to avoid
    └── examples.md        # Anti-patterns with explanations
```

## Good Implementation Examples

### 1. Database Schema (convex/schema.ts)

```typescript
// ✅ GOOD: Properly typed schema with validation
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("in-progress"),
      v.literal("completed")
    ),
    userId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    priority: v.optional(v.number()),
    dueDate: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["userId", "status"])
    .index("by_created", ["createdAt"]),
});
```

### 2. Convex Functions (convex/tasks.ts)

```typescript
// ✅ GOOD: Type-safe queries with authentication
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    let query = ctx.db
      .query("tasks")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject));

    if (args.status) {
      query = query.filter((q) => q.eq(q.field("status"), args.status));
    }

    const tasks = await query.take(args.limit ?? 50);
    return tasks;
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.optional(v.number()),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const taskId = await ctx.db.insert("tasks", {
      ...args,
      userId: identity.subject,
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return taskId;
  },
});

export const update = mutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("in-progress"),
      v.literal("completed")
    )),
    priority: v.optional(v.number()),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== identity.subject) {
      throw new Error("Task not found or unauthorized");
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });

    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== identity.subject) {
      throw new Error("Task not found or unauthorized");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});
```

### 3. React Component with Optimistic Updates

```tsx
// ✅ GOOD: Task form with validation and optimistic updates
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

const taskSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  description: z.string().max(500).optional(),
  priority: z.number().min(1).max(5).optional(),
  dueDate: z.date().optional(),
});

type TaskFormData = z.infer<typeof taskSchema>;

export function TaskForm({ onSuccess }: { onSuccess?: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createTask = useMutation(api.tasks.create);
  const { toast } = useToast();

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: 3,
    },
  });

  async function onSubmit(data: TaskFormData) {
    setIsSubmitting(true);
    try {
      await createTask({
        title: data.title,
        description: data.description,
        priority: data.priority,
        dueDate: data.dueDate?.getTime(),
      });

      toast({
        title: "Task created",
        description: "Your task has been created successfully.",
      });

      form.reset();
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create task",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Enter task title" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter task description"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Task"}
        </Button>
      </form>
    </Form>
  );
}
```

### 4. Task List with Real-time Updates

```tsx
// ✅ GOOD: Real-time task list with loading states
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit } from "lucide-react";

export function TaskList() {
  const tasks = useQuery(api.tasks.list, { limit: 50 });
  const deleteTask = useMutation(api.tasks.remove);
  const updateTask = useMutation(api.tasks.update);

  if (tasks === undefined) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          No tasks found. Create your first task to get started.
        </CardContent>
      </Card>
    );
  }

  const handleStatusChange = async (
    taskId: Id<"tasks">,
    newStatus: "pending" | "in-progress" | "completed"
  ) => {
    try {
      await updateTask({ id: taskId, status: newStatus });
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  };

  const handleDelete = async (taskId: Id<"tasks">) => {
    if (confirm("Are you sure you want to delete this task?")) {
      try {
        await deleteTask({ id: taskId });
      } catch (error) {
        console.error("Failed to delete task:", error);
      }
    }
  };

  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <Card key={task._id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>{task.title}</CardTitle>
                {task.description && (
                  <CardDescription className="mt-1">
                    {task.description}
                  </CardDescription>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={
                  task.status === "completed" ? "default" :
                  task.status === "in-progress" ? "secondary" : "outline"
                }>
                  {task.status}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(task._id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatusChange(task._id, "pending")}
                disabled={task.status === "pending"}
              >
                Pending
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatusChange(task._id, "in-progress")}
                disabled={task.status === "in-progress"}
              >
                In Progress
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatusChange(task._id, "completed")}
                disabled={task.status === "completed"}
              >
                Completed
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

## Bad Implementation Examples

### ❌ BAD: Direct database access without authentication

```typescript
// Never access database without checking authentication
export const list = query({
  handler: async (ctx) => {
    // Missing authentication check!
    return await ctx.db.query("tasks").collect();
  },
});
```

### ❌ BAD: No error handling in components

```tsx
// Missing error handling and loading states
function TaskList() {
  const tasks = useQuery(api.tasks.list); // Could be undefined

  return (
    <div>
      {tasks.map((task) => ( // Will crash if tasks is undefined
        <div key={task._id}>{task.title}</div>
      ))}
    </div>
  );
}
```

### ❌ BAD: No validation on mutations

```typescript
// Missing input validation
export const create = mutation({
  args: {
    data: v.any(), // Never use v.any()!
  },
  handler: async (ctx, args) => {
    // No validation of args.data structure
    return await ctx.db.insert("tasks", args.data);
  },
});
```

### ❌ BAD: Synchronous operations without optimistic updates

```tsx
// Poor UX with no optimistic updates or loading feedback
function TaskForm() {
  const createTask = useMutation(api.tasks.create);

  const handleSubmit = (e) => {
    e.preventDefault();
    createTask({ title: e.target.title.value }); // No feedback
    e.target.reset();
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="title" />
      <button type="submit">Create</button>
    </form>
  );
}
```

## Testing Considerations

1. **Unit Tests**: Test Convex functions in isolation
2. **Integration Tests**: Test full CRUD flow with authentication
3. **E2E Tests**: Test user interactions with Playwright

## Performance Optimizations

1. Use indexes for frequently queried fields
2. Implement pagination for large datasets
3. Use optimistic updates for better perceived performance
4. Cache query results when appropriate

## Security Checklist

- ✅ All queries check authentication
- ✅ Users can only access their own data
- ✅ Input validation on all mutations
- ✅ Rate limiting on API endpoints
- ✅ Proper error messages (no sensitive data leaks)

## Related Documentation

→ [Convex Database Guide](../../stack/convex/database.md)
→ [Authentication Patterns](../../patterns/authentication/)
→ [Form Validation Guide](../../patterns/ui-patterns/forms.md)
→ [Error Handling Patterns](../../patterns/error-handling/)