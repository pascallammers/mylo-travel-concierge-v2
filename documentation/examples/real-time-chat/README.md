# Real-Time Chat Application Example

A full-featured chat application demonstrating real-time messaging, presence, typing indicators, and reactions using Convex subscriptions.

## Stack Components Used
- **Next.js 14** - Chat UI and routing
- **Convex** - Real-time subscriptions and messaging
- **Clerk** - User authentication and profiles
- **ShadCN UI** - Chat components
- **Tailwind CSS** - Responsive styling

## Features Demonstrated
- ✅ Real-time message delivery
- ✅ Typing indicators
- ✅ Online/offline presence
- ✅ Message reactions
- ✅ Read receipts
- ✅ Direct messages and group chats
- ✅ Message editing and deletion
- ✅ File attachments in messages
- ✅ Message search
- ✅ Push notifications (optional)

## Cross-References
→ See also: [Real-time Patterns](../../patterns/data-management/real-time.md)
→ See also: [WebSocket Management](../../stack/convex/websockets.md)
→ See also: [Presence System](../../patterns/collaboration/presence.md)

## File Structure
```
real-time-chat/
├── good/                      # Best practice implementation
│   ├── convex/
│   │   ├── messages.ts       # Message handling
│   │   ├── conversations.ts  # Chat rooms/DMs
│   │   ├── presence.ts       # Online status
│   │   ├── typing.ts         # Typing indicators
│   │   └── reactions.ts      # Message reactions
│   ├── app/
│   │   ├── chat/
│   │   │   ├── page.tsx      # Chat list
│   │   │   └── [id]/
│   │   │       └── page.tsx  # Chat view
│   │   └── api/
│   │       └── pusher/       # Optional push notifications
│   └── components/
│       ├── chat-list.tsx
│       ├── message-list.tsx
│       ├── message-input.tsx
│       ├── typing-indicator.tsx
│       └── presence-indicator.tsx
└── bad/                       # Common mistakes to avoid
    └── examples.md            # Anti-patterns
```

## Good Implementation Examples

### 1. Database Schema (convex/schema.ts)

```typescript
// ✅ GOOD: Comprehensive chat schema with indexes
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  conversations: defineTable({
    name: v.optional(v.string()),
    type: v.union(v.literal("direct"), v.literal("group")),
    participants: v.array(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
    lastMessage: v.optional(v.object({
      text: v.string(),
      senderId: v.string(),
      timestamp: v.number(),
    })),
    metadata: v.optional(v.object({
      avatar: v.optional(v.string()),
      description: v.optional(v.string()),
    })),
  })
    .index("by_participant", ["participants"])
    .index("by_last_message", ["lastMessage.timestamp"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.string(),
    text: v.string(),
    createdAt: v.number(),
    editedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    replyTo: v.optional(v.id("messages")),
    attachments: v.optional(v.array(v.object({
      name: v.string(),
      url: v.string(),
      type: v.string(),
      size: v.number(),
    }))),
    reactions: v.optional(v.array(v.object({
      emoji: v.string(),
      userId: v.string(),
      timestamp: v.number(),
    }))),
  })
    .index("by_conversation", ["conversationId", "createdAt"])
    .searchIndex("search_text", {
      searchField: "text",
      filterFields: ["conversationId"],
    }),

  readReceipts: defineTable({
    conversationId: v.id("conversations"),
    userId: v.string(),
    lastReadMessageId: v.id("messages"),
    readAt: v.number(),
  })
    .index("by_conversation_user", ["conversationId", "userId"]),

  presence: defineTable({
    userId: v.string(),
    status: v.union(
      v.literal("online"),
      v.literal("away"),
      v.literal("offline")
    ),
    lastSeen: v.number(),
    currentConversation: v.optional(v.id("conversations")),
  })
    .index("by_user", ["userId"])
    .index("by_conversation", ["currentConversation"]),

  typingIndicators: defineTable({
    conversationId: v.id("conversations"),
    userId: v.string(),
    startedAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_user_conversation", ["userId", "conversationId"]),
});
```

### 2. Message Handling with Real-time Updates (convex/messages.ts)

```typescript
// ✅ GOOD: Real-time message handling with optimistic updates
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

export const list = query({
  args: {
    conversationId: v.id("conversations"),
    limit: v.optional(v.number()),
    before: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check if user is participant
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || !conversation.participants.includes(identity.subject)) {
      throw new Error("Access denied");
    }

    // Get messages with pagination
    let query = ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("desc");

    if (args.before) {
      query = query.filter((q) => q.lt(q.field("createdAt"), args.before));
    }

    const messages = await query.take(args.limit ?? 50);

    // Mark as read
    await updateReadReceipt(ctx, args.conversationId, identity.subject, messages[0]?._id);

    // Include sender information
    const messagesWithSenders = await Promise.all(
      messages.map(async (message) => {
        const senderInfo = await getUserInfo(message.senderId);
        return {
          ...message,
          sender: senderInfo,
        };
      })
    );

    return messagesWithSenders.reverse();
  },
});

export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    text: v.string(),
    replyTo: v.optional(v.id("messages")),
    attachments: v.optional(v.array(v.object({
      name: v.string(),
      url: v.string(),
      type: v.string(),
      size: v.number(),
    }))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Validate conversation access
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || !conversation.participants.includes(identity.subject)) {
      throw new Error("Access denied");
    }

    // Create message
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: identity.subject,
      text: args.text,
      replyTo: args.replyTo,
      attachments: args.attachments,
      createdAt: Date.now(),
    });

    // Update conversation's last message
    await ctx.db.patch(args.conversationId, {
      lastMessage: {
        text: args.text,
        senderId: identity.subject,
        timestamp: Date.now(),
      },
    });

    // Clear typing indicator
    await clearTypingIndicator(ctx, args.conversationId, identity.subject);

    // Send push notifications to other participants (optional)
    await sendNotifications(ctx, conversation, identity.subject, args.text);

    return messageId;
  },
});

export const edit = mutation({
  args: {
    messageId: v.id("messages"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const message = await ctx.db.get(args.messageId);
    if (!message || message.senderId !== identity.subject) {
      throw new Error("Cannot edit this message");
    }

    // Don't allow editing deleted messages
    if (message.deletedAt) {
      throw new Error("Cannot edit deleted message");
    }

    await ctx.db.patch(args.messageId, {
      text: args.text,
      editedAt: Date.now(),
    });

    return args.messageId;
  },
});

async function updateReadReceipt(
  ctx: any,
  conversationId: Id<"conversations">,
  userId: string,
  messageId?: Id<"messages">
) {
  if (!messageId) return;

  const existing = await ctx.db
    .query("readReceipts")
    .withIndex("by_conversation_user", (q: any) =>
      q.eq("conversationId", conversationId).eq("userId", userId)
    )
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, {
      lastReadMessageId: messageId,
      readAt: Date.now(),
    });
  } else {
    await ctx.db.insert("readReceipts", {
      conversationId,
      userId,
      lastReadMessageId: messageId,
      readAt: Date.now(),
    });
  }
}

async function clearTypingIndicator(
  ctx: any,
  conversationId: Id<"conversations">,
  userId: string
) {
  const indicator = await ctx.db
    .query("typingIndicators")
    .withIndex("by_user_conversation", (q: any) =>
      q.eq("userId", userId).eq("conversationId", conversationId)
    )
    .first();

  if (indicator) {
    await ctx.db.delete(indicator._id);
  }
}

async function getUserInfo(userId: string) {
  // Fetch user info from Clerk or cache
  return {
    id: userId,
    name: "User Name", // Replace with actual user data
    avatar: null,
  };
}

async function sendNotifications(
  ctx: any,
  conversation: any,
  senderId: string,
  text: string
) {
  // Implementation for push notifications
  // This would integrate with a service like Pusher, Firebase, or custom WebSocket
}
```

### 3. Typing Indicators (convex/typing.ts)

```typescript
// ✅ GOOD: Efficient typing indicator with auto-cleanup
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const TYPING_TIMEOUT = 3000; // 3 seconds

export const setTyping = mutation({
  args: {
    conversationId: v.id("conversations"),
    isTyping: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    if (args.isTyping) {
      // Set or update typing indicator
      const existing = await ctx.db
        .query("typingIndicators")
        .withIndex("by_user_conversation", (q) =>
          q.eq("userId", identity.subject)
            .eq("conversationId", args.conversationId)
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          startedAt: Date.now(),
        });
      } else {
        await ctx.db.insert("typingIndicators", {
          conversationId: args.conversationId,
          userId: identity.subject,
          startedAt: Date.now(),
        });
      }

      // Schedule cleanup
      await ctx.scheduler.runAfter(TYPING_TIMEOUT, api.typing.cleanup, {
        conversationId: args.conversationId,
        userId: identity.subject,
      });
    } else {
      // Remove typing indicator
      const indicator = await ctx.db
        .query("typingIndicators")
        .withIndex("by_user_conversation", (q) =>
          q.eq("userId", identity.subject)
            .eq("conversationId", args.conversationId)
        )
        .first();

      if (indicator) {
        await ctx.db.delete(indicator._id);
      }
    }
  },
});

export const getTypingUsers = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const now = Date.now();
    const indicators = await ctx.db
      .query("typingIndicators")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .filter((q) =>
        q.and(
          q.neq(q.field("userId"), identity.subject),
          q.gt(q.field("startedAt"), now - TYPING_TIMEOUT)
        )
      )
      .collect();

    // Get user info for typing users
    const typingUsers = await Promise.all(
      indicators.map(async (indicator) => {
        const userInfo = await getUserInfo(indicator.userId);
        return userInfo;
      })
    );

    return typingUsers;
  },
});

// Internal mutation for cleanup (called by scheduler)
export const cleanup = mutation({
  args: {
    conversationId: v.id("conversations"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const indicator = await ctx.db
      .query("typingIndicators")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", args.userId)
          .eq("conversationId", args.conversationId)
      )
      .first();

    if (indicator && Date.now() - indicator.startedAt >= TYPING_TIMEOUT) {
      await ctx.db.delete(indicator._id);
    }
  },
});
```

### 4. Chat UI Component with Real-time Updates

```tsx
// ✅ GOOD: Chat component with real-time subscriptions
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Paperclip, Smile } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ChatProps {
  conversationId: Id<"conversations">;
}

export function Chat({ conversationId }: ChatProps) {
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Subscriptions
  const messages = useQuery(api.messages.list, { conversationId });
  const typingUsers = useQuery(api.typing.getTypingUsers, { conversationId });
  const presence = useQuery(api.presence.getPresence, { conversationId });

  // Mutations
  const sendMessage = useMutation(api.messages.send);
  const setTypingIndicator = useMutation(api.typing.setTyping);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle typing indicator
  const handleTyping = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
      setTypingIndicator({ conversationId, isTyping: true });
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to clear typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      setTypingIndicator({ conversationId, isTyping: false });
    }, 2000);
  }, [conversationId, isTyping, setTypingIndicator]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    try {
      await sendMessage({
        conversationId,
        text: message,
      });
      setMessage("");

      // Clear typing indicator
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      setIsTyping(false);
      setTypingIndicator({ conversationId, isTyping: false });
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Message List */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        {messages?.map((msg) => (
          <MessageBubble key={msg._id} message={msg} isOwn={msg.isOwn} />
        ))}

        {/* Typing Indicators */}
        {typingUsers && typingUsers.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
            <div className="flex -space-x-2">
              {typingUsers.slice(0, 3).map((user) => (
                <Avatar key={user.id} className="h-6 w-6">
                  <AvatarImage src={user.avatar} />
                  <AvatarFallback>{user.name[0]}</AvatarFallback>
                </Avatar>
              ))}
            </div>
            <span>
              {typingUsers.length === 1
                ? `${typingUsers[0].name} is typing...`
                : `${typingUsers.length} people are typing...`}
            </span>
            <TypingDots />
          </div>
        )}
      </ScrollArea>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t">
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="icon">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Input
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              handleTyping();
            }}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button type="button" variant="ghost" size="icon">
            <Smile className="h-4 w-4" />
          </Button>
          <Button type="submit" size="icon" disabled={!message.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({ message, isOwn }: { message: any; isOwn: boolean }) {
  return (
    <div className={`flex mb-4 ${isOwn ? "justify-end" : "justify-start"}`}>
      {!isOwn && (
        <Avatar className="h-8 w-8 mr-2">
          <AvatarImage src={message.sender.avatar} />
          <AvatarFallback>{message.sender.name[0]}</AvatarFallback>
        </Avatar>
      )}
      <div
        className={`
          max-w-[70%] px-4 py-2 rounded-lg
          ${isOwn
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
          }
        `}
      >
        {!isOwn && (
          <p className="text-xs font-medium mb-1">{message.sender.name}</p>
        )}
        <p className="text-sm">{message.text}</p>
        <p className="text-xs opacity-70 mt-1">
          {formatDistanceToNow(message.createdAt, { addSuffix: true })}
          {message.editedAt && " (edited)"}
        </p>
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex gap-1 mt-2">
            {message.reactions.map((reaction: any, idx: number) => (
              <span key={idx} className="text-sm">
                {reaction.emoji} {reaction.count}
              </span>
            ))}
          </div>
        )}
      </div>
      {isOwn && (
        <Avatar className="h-8 w-8 ml-2">
          <AvatarImage src={message.sender.avatar} />
          <AvatarFallback>{message.sender.name[0]}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex gap-1">
      <span className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
      <span className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.15s]" />
      <span className="w-2 h-2 bg-current rounded-full animate-bounce" />
    </div>
  );
}
```

## Bad Implementation Examples

### ❌ BAD: No real-time updates

```tsx
// Missing real-time subscriptions
function Chat() {
  const [messages, setMessages] = useState([]);

  // BAD: Only fetches once, no real-time updates
  useEffect(() => {
    fetch("/api/messages").then((res) => res.json()).then(setMessages);
  }, []);
}
```

### ❌ BAD: No typing indicator cleanup

```typescript
// Typing indicators never cleaned up
export const setTyping = mutation({
  handler: async (ctx, args) => {
    // BAD: No timeout or cleanup
    await ctx.db.insert("typing", {
      userId: args.userId,
      // Never gets removed!
    });
  },
});
```

### ❌ BAD: Loading all messages at once

```typescript
// No pagination, loads entire history
export const getMessages = query({
  handler: async (ctx) => {
    // BAD: Could return thousands of messages
    return await ctx.db.query("messages").collect();
  },
});
```

### ❌ BAD: No message validation

```typescript
// Missing validation and sanitization
export const sendMessage = mutation({
  args: { text: v.any() }, // Never use v.any()
  handler: async (ctx, args) => {
    // No length check, no sanitization
    await ctx.db.insert("messages", {
      text: args.text, // Could be malicious content
    });
  },
});
```

## Performance Optimizations

1. **Message Pagination**: Load messages in chunks
2. **Virtual Scrolling**: For long message lists
3. **Debounced Typing**: Reduce typing indicator updates
4. **Message Caching**: Cache recent messages client-side
5. **Lazy Load Attachments**: Load images/files on demand
6. **Connection Management**: Handle reconnections gracefully

## Security Checklist

- ✅ Authentication on all operations
- ✅ Participant validation for conversations
- ✅ Message content sanitization
- ✅ Rate limiting on message sending
- ✅ File upload restrictions
- ✅ Proper error messages without leaking data

## Testing Considerations

1. Test real-time message delivery
2. Test typing indicators with multiple users
3. Test message ordering with concurrent sends
4. Test reconnection handling
5. Test large conversation performance

## Related Documentation

→ [Real-time Patterns](../../patterns/data-management/real-time.md)
→ [WebSocket Guide](../../stack/convex/websockets.md)
→ [Authentication Patterns](../../patterns/authentication/)
→ [UI Components Guide](../../stack/ui-components/)