# ⚡ Optimistic Updates Pattern

## Overview
Implement instant UI updates while syncing with the backend, providing responsive user experiences in Convex + Next.js applications.

## Quick Links
- → [Convex Mutations](../../stack/convex/mutations-queries.md)
- → [React Patterns](../../stack/nextjs-convex/data-fetching.md)
- → [Error Handling](#error-handling)

## Core Pattern

### Basic Optimistic Update

```typescript
// ✅ GOOD: Optimistic update with rollback
"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useOptimistic } from "react";
import { toast } from "sonner";

interface Todo {
  _id: string;
  text: string;
  completed: boolean;
}

export function TodoList() {
  const todos = useQuery(api.todos.list) || [];
  const toggleTodo = useMutation(api.todos.toggle);

  // Optimistic state
  const [optimisticTodos, addOptimisticUpdate] = useOptimistic(
    todos,
    (state: Todo[], updatedTodo: Todo) => {
      return state.map(todo =>
        todo._id === updatedTodo._id ? updatedTodo : todo
      );
    }
  );

  async function handleToggle(todo: Todo) {
    // Optimistically update UI
    const optimisticTodo = { ...todo, completed: !todo.completed };
    addOptimisticUpdate(optimisticTodo);

    try {
      // Sync with backend
      await toggleTodo({
        id: todo._id,
        completed: !todo.completed,
      });
    } catch (error) {
      // Rollback handled automatically by React
      toast.error("Failed to update todo");
    }
  }

  return (
    <ul>
      {optimisticTodos.map(todo => (
        <li key={todo._id}>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => handleToggle(todo)}
            />
            <span className={todo.completed ? "line-through" : ""}>
              {todo.text}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
```

## Advanced Patterns

### 1. Optimistic Creation with Temporary IDs

```typescript
// ✅ GOOD: Handle creation with temporary IDs
"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useOptimistic, useRef } from "react";
import { Id } from "@/convex/_generated/dataModel";

interface Message {
  _id: string | Id<"messages">;
  text: string;
  userId: string;
  createdAt: number;
  _temp?: boolean; // Mark temporary items
}

export function ChatMessages() {
  const messages = useQuery(api.messages.list) || [];
  const sendMessage = useMutation(api.messages.send);
  const tempIdCounter = useRef(0);

  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,
    (state: Message[], newMessage: Message) => {
      // Remove old temp message if exists
      const filtered = state.filter(m => !m._temp);
      return [...filtered, newMessage];
    }
  );

  async function handleSend(text: string) {
    // Create temporary message
    const tempMessage: Message = {
      _id: `temp-${tempIdCounter.current++}`,
      text,
      userId: "current-user", // Get from auth
      createdAt: Date.now(),
      _temp: true,
    };

    // Add to UI immediately
    addOptimisticMessage(tempMessage);

    try {
      // Send to backend
      await sendMessage({ text });
      // Real message will replace temp via subscription
    } catch (error) {
      toast.error("Failed to send message");
      // Temp message will disappear on next render
    }
  }

  return (
    <div>
      {optimisticMessages.map(message => (
        <div
          key={message._id}
          className={message._temp ? "opacity-70" : ""}
        >
          <span className="font-medium">{message.userId}: </span>
          <span>{message.text}</span>
          {message._temp && (
            <span className="text-xs text-muted-foreground ml-2">
              Sending...
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
```

### 2. Optimistic Delete with Undo

```typescript
// ✅ GOOD: Delete with undo option
"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { toast } from "sonner";

interface Item {
  _id: string;
  name: string;
}

export function ItemList() {
  const items = useQuery(api.items.list) || [];
  const deleteItem = useMutation(api.items.delete);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [undoQueue, setUndoQueue] = useState<Map<string, Item>>(new Map());

  async function handleDelete(item: Item) {
    // Mark as deleting
    setDeletingIds(prev => new Set(prev).add(item._id));
    setUndoQueue(prev => new Map(prev).set(item._id, item));

    // Show toast with undo
    const toastId = toast.success("Item deleted", {
      action: {
        label: "Undo",
        onClick: () => handleUndo(item._id),
      },
      duration: 5000,
    });

    // Wait for undo timeout
    setTimeout(async () => {
      if (undoQueue.has(item._id)) {
        try {
          await deleteItem({ id: item._id });
        } catch (error) {
          // Restore on error
          setDeletingIds(prev => {
            const next = new Set(prev);
            next.delete(item._id);
            return next;
          });
          toast.error("Failed to delete item");
        } finally {
          setUndoQueue(prev => {
            const next = new Map(prev);
            next.delete(item._id);
            return next;
          });
        }
      }
    }, 5000);
  }

  function handleUndo(itemId: string) {
    setDeletingIds(prev => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
    setUndoQueue(prev => {
      const next = new Map(prev);
      next.delete(itemId);
      return next;
    });
    toast.dismiss();
  }

  // Filter out items being deleted
  const visibleItems = items.filter(item => !deletingIds.has(item._id));

  return (
    <ul>
      {visibleItems.map(item => (
        <li key={item._id} className="flex justify-between">
          <span>{item.name}</span>
          <button onClick={() => handleDelete(item)}>Delete</button>
        </li>
      ))}
    </ul>
  );
}
```

### 3. Batch Optimistic Updates

```typescript
// ✅ GOOD: Handle multiple updates efficiently
"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useOptimistic, useTransition } from "react";

interface Task {
  _id: string;
  title: string;
  status: "todo" | "in_progress" | "done";
}

export function KanbanBoard() {
  const tasks = useQuery(api.tasks.list) || [];
  const updateTaskStatus = useMutation(api.tasks.updateStatus);
  const [isPending, startTransition] = useTransition();

  const [optimisticTasks, updateOptimisticTask] = useOptimistic(
    tasks,
    (state: Task[], update: { id: string; status: Task["status"] }) => {
      return state.map(task =>
        task._id === update.id
          ? { ...task, status: update.status }
          : task
      );
    }
  );

  function handleDrop(taskId: string, newStatus: Task["status"]) {
    startTransition(() => {
      // Update UI immediately
      updateOptimisticTask({ id: taskId, status: newStatus });

      // Sync with backend
      updateTaskStatus({ id: taskId, status: newStatus }).catch(() => {
        toast.error("Failed to update task");
      });
    });
  }

  const columns = {
    todo: optimisticTasks.filter(t => t.status === "todo"),
    in_progress: optimisticTasks.filter(t => t.status === "in_progress"),
    done: optimisticTasks.filter(t => t.status === "done"),
  };

  return (
    <div className="grid grid-cols-3 gap-4">
      {Object.entries(columns).map(([status, tasks]) => (
        <div
          key={status}
          className={`p-4 ${isPending ? "opacity-70" : ""}`}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            const taskId = e.dataTransfer.getData("taskId");
            handleDrop(taskId, status as Task["status"]);
          }}
        >
          <h3 className="font-bold mb-2">{status}</h3>
          {tasks.map(task => (
            <div
              key={task._id}
              draggable
              onDragStart={e => e.dataTransfer.setData("taskId", task._id)}
              className="p-2 bg-white rounded shadow mb-2 cursor-move"
            >
              {task.title}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

## Error Handling

### Rollback Strategy

```typescript
// ✅ GOOD: Proper error handling with rollback
"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

export function EditableField({ initialValue, onSave }) {
  const [value, setValue] = useState(initialValue);
  const [tempValue, setTempValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    const previousValue = value;

    // Optimistic update
    setValue(tempValue);
    setIsEditing(false);
    setIsSaving(true);

    try {
      await onSave(tempValue);
      // Success - keep the new value
    } catch (error) {
      // Rollback on error
      setValue(previousValue);
      setTempValue(previousValue);
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  }

  if (isEditing) {
    return (
      <input
        value={tempValue}
        onChange={e => setTempValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={e => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") {
            setTempValue(value);
            setIsEditing(false);
          }
        }}
        autoFocus
        disabled={isSaving}
      />
    );
  }

  return (
    <span onClick={() => setIsEditing(true)} className="cursor-pointer">
      {value}
      {isSaving && <Loader className="inline ml-2" />}
    </span>
  );
}
```

## Performance Considerations

### 1. Debounced Updates

```typescript
// ✅ GOOD: Debounce rapid updates
import { useMutation } from "convex/react";
import { useDebouncedCallback } from "use-debounce";

export function AutoSaveEditor() {
  const saveContent = useMutation(api.documents.save);
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const debouncedSave = useDebouncedCallback(
    async (text: string) => {
      setIsSaving(true);
      try {
        await saveContent({ content: text });
        toast.success("Saved");
      } catch (error) {
        toast.error("Failed to save");
      } finally {
        setIsSaving(false);
      }
    },
    1000 // 1 second delay
  );

  function handleChange(newContent: string) {
    setContent(newContent); // Update immediately
    debouncedSave(newContent); // Save after delay
  }

  return (
    <div>
      <textarea
        value={content}
        onChange={e => handleChange(e.target.value)}
      />
      {isSaving && <span>Saving...</span>}
    </div>
  );
}
```

### 2. Batch Operations

```typescript
// ✅ GOOD: Batch multiple operations
const batchUpdate = useMutation(api.items.batchUpdate);

async function handleBulkAction(selectedIds: string[], action: string) {
  // Update UI for all items
  selectedIds.forEach(id => {
    updateOptimisticItem({ id, status: action });
  });

  try {
    // Send single request for all items
    await batchUpdate({ ids: selectedIds, action });
  } catch (error) {
    // Revert all on error
    toast.error("Batch update failed");
  }
}
```

## Best Practices

### ✅ DO's
1. **Show immediate feedback** - Users should see instant results
2. **Handle errors gracefully** - Always have a rollback plan
3. **Indicate loading state** - Show when syncing with backend
4. **Use transitions** - For non-urgent updates
5. **Batch when possible** - Reduce server requests

### ❌ DON'Ts
1. **Don't ignore errors** - Always handle failures
2. **Don't block UI** - Keep interactions responsive
3. **Don't over-optimize** - Not everything needs optimistic updates
4. **Don't forget cleanup** - Clear temporary states
5. **Don't confuse users** - Make states clear

## Testing Optimistic Updates

```typescript
// Test error scenarios
describe("Optimistic Updates", () => {
  it("should rollback on error", async () => {
    // Mock mutation to fail
    const mockMutation = jest.fn().mockRejectedValue(new Error());

    // Trigger optimistic update
    // Assert temporary state
    // Wait for rollback
    // Assert original state restored
  });

  it("should handle race conditions", async () => {
    // Trigger multiple rapid updates
    // Assert final state is correct
  });
});
```

## Related Patterns
- 🔗 [Real-time Updates](./real-time.md)
- 🔗 [Error Handling](../error-handling/README.md)
- 🔗 [Loading States](../ui-patterns/loading-states.md)

---

*Optimistic updates create responsive, modern user experiences. Always balance immediacy with data integrity and clear user feedback.*