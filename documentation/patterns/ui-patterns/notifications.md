# 🔔 Notifications & Toast Pattern

## Overview
Implement user notifications using Sonner for toasts, push notifications, and in-app notification systems with proper accessibility and user preferences.

## Quick Links
- → [Sonner Toast Library](https://sonner.emilkowal.ski)
- → [ShadCN Toast](https://ui.shadcn.com/docs/components/toast)
- → [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- → [Real-time Notifications](#real-time-notifications)

## Core Pattern

### Basic Toast Implementation

```typescript
// ✅ GOOD: Toast notifications with Sonner
"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export function ToastExamples() {
  const saveData = useMutation(api.items.save);

  // Success toast
  async function handleSave() {
    try {
      await saveData({ name: "Item" });
      toast.success("Item saved successfully", {
        description: "Your changes have been saved.",
        duration: 5000,
      });
    } catch (error) {
      // Error toast
      toast.error("Failed to save item", {
        description: error.message,
        action: {
          label: "Retry",
          onClick: () => handleSave(),
        },
      });
    }
  }

  // Promise toast
  async function handleAsyncAction() {
    toast.promise(
      saveData({ name: "Item" }),
      {
        loading: "Saving item...",
        success: (data) => {
          return `Item ${data.id} has been saved`;
        },
        error: (err) => `Error: ${err.message}`,
      }
    );
  }

  // Custom styled toast
  function showCustomToast() {
    toast("Custom notification", {
      className: "bg-blue-500 text-white",
      icon: <InfoIcon className="h-5 w-5" />,
      position: "bottom-center",
    });
  }

  // Rich content toast
  function showRichToast() {
    toast(
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src="/user.jpg" />
          <AvatarFallback>JD</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">New message from John</p>
          <p className="text-sm text-muted-foreground">
            Hey, are you available for a call?
          </p>
        </div>
      </div>,
      {
        duration: 10000,
        action: {
          label: "Reply",
          onClick: () => console.log("Reply clicked"),
        },
        cancel: {
          label: "Dismiss",
        },
      }
    );
  }

  return (
    <div className="space-y-4">
      <Button onClick={handleSave}>Save (Success)</Button>
      <Button onClick={handleAsyncAction}>Async Action</Button>
      <Button onClick={showCustomToast}>Custom Toast</Button>
      <Button onClick={showRichToast}>Rich Toast</Button>
    </div>
  );
}

// App layout setup
export function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Toaster
          position="top-right"
          expand={true}
          richColors
          closeButton
          toastOptions={{
            duration: 5000,
            style: {
              background: "hsl(var(--background))",
              color: "hsl(var(--foreground))",
              border: "1px solid hsl(var(--border))",
            },
          }}
        />
      </body>
    </html>
  );
}
```

## Advanced Patterns

### 1. In-App Notification Center

```typescript
// ✅ GOOD: Full notification center with persistence
"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Bell, Check, Trash2, Archive } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  createdAt: number;
  actionUrl?: string;
  actionLabel?: string;
}

export function NotificationCenter() {
  const notifications = useQuery(api.notifications.list) || [];
  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);
  const deleteNotification = useMutation(api.notifications.delete);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Group notifications by date
  const groupedNotifications = notifications.reduce((acc, notification) => {
    const date = new Date(notification.createdAt).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(notification);
    return acc;
  }, {} as Record<string, Notification[]>);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsRead()}
            >
              Mark all as read
            </Button>
          )}
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">
              All
            </TabsTrigger>
            <TabsTrigger value="unread" className="flex-1">
              Unread ({unreadCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="m-0">
            <NotificationList
              notifications={notifications}
              onRead={markAsRead}
              onDelete={deleteNotification}
            />
          </TabsContent>

          <TabsContent value="unread" className="m-0">
            <NotificationList
              notifications={notifications.filter(n => !n.read)}
              onRead={markAsRead}
              onDelete={deleteNotification}
            />
          </TabsContent>
        </Tabs>

        <div className="p-3 border-t">
          <Button variant="ghost" className="w-full justify-center" asChild>
            <Link href="/notifications">View all notifications</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NotificationList({
  notifications,
  onRead,
  onDelete,
}: {
  notifications: Notification[];
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (notifications.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No notifications</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="p-2">
        {notifications.map((notification) => (
          <NotificationItem
            key={notification._id}
            notification={notification}
            onRead={onRead}
            onDelete={onDelete}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

function NotificationItem({
  notification,
  onRead,
  onDelete,
}: {
  notification: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const getIcon = () => {
    switch (notification.type) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <InfoIcon className="h-5 w-5 text-blue-500" />;
    }
  };

  return (
    <div
      className={`
        p-3 rounded-lg mb-2 transition-colors cursor-pointer
        ${notification.read ? "opacity-60" : "bg-muted/50"}
        hover:bg-muted
      `}
      onClick={() => !notification.read && onRead(notification._id)}
    >
      <div className="flex gap-3">
        {getIcon()}
        <div className="flex-1">
          <p className="font-medium text-sm">{notification.title}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {notification.message}
          </p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(notification.createdAt)}
            </span>
            <div className="flex gap-1">
              {notification.actionUrl && (
                <Button size="xs" variant="ghost" asChild>
                  <Link href={notification.actionUrl}>
                    {notification.actionLabel || "View"}
                  </Link>
                </Button>
              )}
              <Button
                size="xs"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(notification._id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 2. Push Notifications

```typescript
// ✅ GOOD: Browser push notifications
"use client";

import { useEffect, useState } from "react";

export function PushNotificationManager() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  async function requestPermission() {
    if (!("Notification" in window)) {
      toast.error("This browser does not support notifications");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);

      if (permission === "granted") {
        await subscribeToPush();
        toast.success("Notifications enabled");
      }
    } catch (error) {
      toast.error("Failed to enable notifications");
    }
  }

  async function subscribeToPush() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });

      setSubscription(subscription);

      // Send subscription to server
      await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });
    } catch (error) {
      console.error("Push subscription failed:", error);
    }
  }

  async function unsubscribe() {
    if (subscription) {
      try {
        await subscription.unsubscribe();

        // Remove from server
        await fetch("/api/notifications/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription),
        });

        setSubscription(null);
        toast.success("Notifications disabled");
      } catch (error) {
        toast.error("Failed to unsubscribe");
      }
    }
  }

  // Show native notification
  function showNotification(title: string, options?: NotificationOptions) {
    if (permission === "granted") {
      new Notification(title, {
        icon: "/icon-192.png",
        badge: "/badge-72.png",
        ...options,
      });
    }
  }

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Push Notifications</h3>
          <p className="text-sm text-muted-foreground">
            Get notified about important updates
          </p>
        </div>
        <Switch
          checked={permission === "granted" && !!subscription}
          onCheckedChange={(checked) => {
            if (checked) {
              requestPermission();
            } else {
              unsubscribe();
            }
          }}
        />
      </div>

      {permission === "denied" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Notifications Blocked</AlertTitle>
          <AlertDescription>
            You've blocked notifications. Please enable them in your browser settings.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// Service worker (public/sw.js)
self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};

  const options = {
    body: data.body || "You have a new notification",
    icon: data.icon || "/icon-192.png",
    badge: "/badge-72.png",
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
      url: data.url || "/",
    },
    actions: [
      {
        action: "view",
        title: "View",
        icon: "/icons/view.png",
      },
      {
        action: "dismiss",
        title: "Dismiss",
        icon: "/icons/dismiss.png",
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Notification", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "view") {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});
```

### 3. Real-time Notifications

```typescript
// ✅ GOOD: Real-time notifications with Convex
"use client";

import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function RealtimeNotifications() {
  // Subscribe to real-time notifications
  const newNotifications = useQuery(api.notifications.subscribe);

  useEffect(() => {
    if (!newNotifications || newNotifications.length === 0) return;

    // Show toast for each new notification
    newNotifications.forEach((notification) => {
      const toastId = toast(
        <div className="flex items-start gap-3">
          <NotificationIcon type={notification.type} />
          <div className="flex-1">
            <p className="font-medium">{notification.title}</p>
            <p className="text-sm text-muted-foreground">
              {notification.message}
            </p>
          </div>
        </div>,
        {
          duration: notification.priority === "high" ? Infinity : 5000,
          action: notification.actionUrl ? {
            label: notification.actionLabel || "View",
            onClick: () => window.location.href = notification.actionUrl,
          } : undefined,
          onDismiss: () => {
            // Mark as seen
            markAsSeen({ id: notification._id });
          },
        }
      );

      // Auto-dismiss after reading
      if (notification.autoDismiss) {
        setTimeout(() => toast.dismiss(toastId), 10000);
      }
    });

    // Play sound for high priority
    const highPriority = newNotifications.some(n => n.priority === "high");
    if (highPriority) {
      playNotificationSound();
    }
  }, [newNotifications]);

  return null; // This is a listener component
}

function playNotificationSound() {
  const audio = new Audio("/notification-sound.mp3");
  audio.volume = 0.5;
  audio.play().catch(() => {
    // User hasn't interacted with page yet
  });
}
```

### 4. Email Notification Preferences

```typescript
// ✅ GOOD: User notification preferences
"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface NotificationPreferences {
  email: {
    enabled: boolean;
    frequency: "instant" | "daily" | "weekly";
    categories: {
      updates: boolean;
      mentions: boolean;
      marketing: boolean;
      security: boolean;
    };
  };
  push: {
    enabled: boolean;
    categories: {
      updates: boolean;
      mentions: boolean;
      messages: boolean;
    };
  };
  inApp: {
    enabled: boolean;
    playSound: boolean;
    showDesktop: boolean;
  };
}

export function NotificationPreferences() {
  const preferences = useQuery(api.users.getNotificationPreferences);
  const updatePreferences = useMutation(api.users.updateNotificationPreferences);
  const [localPrefs, setLocalPrefs] = useState<NotificationPreferences>(
    preferences || defaultPreferences
  );

  async function handleSave() {
    try {
      await updatePreferences(localPrefs);
      toast.success("Preferences saved");
    } catch (error) {
      toast.error("Failed to save preferences");
    }
  }

  return (
    <div className="space-y-6">
      {/* Email Notifications */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Email Notifications</h3>
            <p className="text-sm text-muted-foreground">
              Receive notifications via email
            </p>
          </div>
          <Switch
            checked={localPrefs.email.enabled}
            onCheckedChange={(checked) =>
              setLocalPrefs({
                ...localPrefs,
                email: { ...localPrefs.email, enabled: checked },
              })
            }
          />
        </div>

        {localPrefs.email.enabled && (
          <>
            <div className="space-y-3">
              <Label>Frequency</Label>
              <RadioGroup
                value={localPrefs.email.frequency}
                onValueChange={(value) =>
                  setLocalPrefs({
                    ...localPrefs,
                    email: {
                      ...localPrefs.email,
                      frequency: value as any,
                    },
                  })
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="instant" id="instant" />
                  <Label htmlFor="instant">Instant</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="daily" id="daily" />
                  <Label htmlFor="daily">Daily digest</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="weekly" id="weekly" />
                  <Label htmlFor="weekly">Weekly digest</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>Categories</Label>
              {Object.entries(localPrefs.email.categories).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <Label htmlFor={`email-${key}`} className="capitalize">
                    {key}
                  </Label>
                  <Switch
                    id={`email-${key}`}
                    checked={value}
                    onCheckedChange={(checked) =>
                      setLocalPrefs({
                        ...localPrefs,
                        email: {
                          ...localPrefs.email,
                          categories: {
                            ...localPrefs.email.categories,
                            [key]: checked,
                          },
                        },
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Push Notifications */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Push Notifications</h3>
            <p className="text-sm text-muted-foreground">
              Receive browser push notifications
            </p>
          </div>
          <Switch
            checked={localPrefs.push.enabled}
            onCheckedChange={(checked) =>
              setLocalPrefs({
                ...localPrefs,
                push: { ...localPrefs.push, enabled: checked },
              })
            }
          />
        </div>

        {localPrefs.push.enabled && (
          <div className="space-y-3">
            <Label>Categories</Label>
            {Object.entries(localPrefs.push.categories).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <Label htmlFor={`push-${key}`} className="capitalize">
                  {key}
                </Label>
                <Switch
                  id={`push-${key}`}
                  checked={value}
                  onCheckedChange={(checked) =>
                    setLocalPrefs({
                      ...localPrefs,
                      push: {
                        ...localPrefs.push,
                        categories: {
                          ...localPrefs.push.categories,
                          [key]: checked,
                        },
                      },
                    })
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* In-App Notifications */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">In-App Notifications</h3>
            <p className="text-sm text-muted-foreground">
              Show notifications within the app
            </p>
          </div>
          <Switch
            checked={localPrefs.inApp.enabled}
            onCheckedChange={(checked) =>
              setLocalPrefs({
                ...localPrefs,
                inApp: { ...localPrefs.inApp, enabled: checked },
              })
            }
          />
        </div>

        {localPrefs.inApp.enabled && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="play-sound">Play sound</Label>
              <Switch
                id="play-sound"
                checked={localPrefs.inApp.playSound}
                onCheckedChange={(checked) =>
                  setLocalPrefs({
                    ...localPrefs,
                    inApp: { ...localPrefs.inApp, playSound: checked },
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="show-desktop">Show desktop notifications</Label>
              <Switch
                id="show-desktop"
                checked={localPrefs.inApp.showDesktop}
                onCheckedChange={(checked) =>
                  setLocalPrefs({
                    ...localPrefs,
                    inApp: { ...localPrefs.inApp, showDesktop: checked },
                  })
                }
              />
            </div>
          </div>
        )}
      </div>

      <Button onClick={handleSave} className="w-full">
        Save Preferences
      </Button>
    </div>
  );
}
```

### 5. Action-Based Toasts

```typescript
// ✅ GOOD: Context-aware action toasts
export function useActionToasts() {
  const { user } = useUser();

  function showUndoToast(action: string, undoAction: () => void) {
    toast.success(action, {
      action: {
        label: "Undo",
        onClick: undoAction,
      },
      duration: 8000,
    });
  }

  function showConfirmToast(
    message: string,
    onConfirm: () => void,
    onCancel?: () => void
  ) {
    toast(
      <div>
        <p>{message}</p>
        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            onClick={() => {
              onConfirm();
              toast.dismiss();
            }}
          >
            Confirm
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onCancel?.();
              toast.dismiss();
            }}
          >
            Cancel
          </Button>
        </div>
      </div>,
      {
        duration: Infinity,
        closeButton: false,
      }
    );
  }

  function showProgressToast(promise: Promise<any>, message: string) {
    return toast.promise(promise, {
      loading: (
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{message}</span>
        </div>
      ),
      success: (data) => {
        return `Operation completed successfully`;
      },
      error: (err) => {
        console.error(err);
        return `Failed: ${err.message || "Unknown error"}`;
      },
    });
  }

  return {
    showUndoToast,
    showConfirmToast,
    showProgressToast,
  };
}

// Usage
export function ItemActions({ item }: { item: Item }) {
  const { showUndoToast, showConfirmToast } = useActionToasts();
  const deleteItem = useMutation(api.items.delete);
  const restoreItem = useMutation(api.items.restore);

  async function handleDelete() {
    await deleteItem({ id: item.id });

    showUndoToast(
      `"${item.name}" has been deleted`,
      async () => {
        await restoreItem({ id: item.id });
        toast.success("Item restored");
      }
    );
  }

  function handleDangerousAction() {
    showConfirmToast(
      "This action cannot be undone. Are you sure?",
      async () => {
        await performDangerousAction();
      }
    );
  }

  return (
    <div className="space-x-2">
      <Button onClick={handleDelete}>Delete</Button>
      <Button onClick={handleDangerousAction} variant="destructive">
        Dangerous Action
      </Button>
    </div>
  );
}
```

## Accessibility

```typescript
// ✅ GOOD: Accessible notifications
export function AccessibleToast() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        className: "",
        style: {
          // High contrast for readability
          background: "hsl(var(--background))",
          color: "hsl(var(--foreground))",
          border: "2px solid hsl(var(--border))",
        },
        // ARIA live region announcements
        ariaProps: {
          role: "status",
          "aria-live": "polite",
        },
      }}
    />
  );
}

// Screen reader only notifications
export function ScreenReaderNotification({ message }: { message: string }) {
  return (
    <div className="sr-only" role="status" aria-live="polite">
      {message}
    </div>
  );
}
```

## Best Practices

### ✅ DO's
1. **Provide clear actions** - Undo, retry, or view details
2. **Use appropriate duration** - Critical messages should persist
3. **Group similar notifications** - Avoid notification spam
4. **Respect user preferences** - Allow disabling notifications
5. **Include timestamps** - Show when notifications occurred

### ❌ DON'Ts
1. **Don't overwhelm users** - Limit concurrent toasts
2. **Don't auto-dismiss critical** messages too quickly
3. **Don't use for validation** - Use inline errors instead
4. **Don't block interactions** - Keep toasts non-modal
5. **Don't forget accessibility** - Screen reader support

## Testing Notifications

```typescript
describe("Notifications", () => {
  it("should show success toast", async () => {
    render(<ToastExample />);

    const button = screen.getByText("Save");
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Saved successfully")).toBeInTheDocument();
    });
  });

  it("should handle undo action", async () => {
    render(<UndoableAction />);

    await userEvent.click(screen.getByText("Delete"));
    await userEvent.click(screen.getByText("Undo"));

    expect(mockRestore).toHaveBeenCalled();
  });

  it("should respect notification preferences", async () => {
    mockPreferences({ email: { enabled: false } });

    await triggerNotification();

    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
```

## Related Patterns
- 🔗 [Loading States](./loading-states.md)
- 🔗 [Error Handling](../error-handling/README.md)
- 🔗 [Modals & Dialogs](./modals-dialogs.md)
- 🔗 [Real-time Updates](../data-management/real-time.md)

---

*Effective notifications keep users informed without being intrusive. Balance visibility, timing, and user control for the best experience.*