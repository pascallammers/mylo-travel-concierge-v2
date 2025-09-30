# 🪟 Modals & Dialogs Pattern

## Overview
Implement accessible, responsive modals, dialogs, sheets, and popovers using Radix UI primitives with ShadCN components.

## Quick Links
- → [ShadCN Dialog](https://ui.shadcn.com/docs/components/dialog)
- → [ShadCN Sheet](https://ui.shadcn.com/docs/components/sheet)
- → [ShadCN AlertDialog](https://ui.shadcn.com/docs/components/alert-dialog)
- → [Radix UI Primitives](https://www.radix-ui.com)

## Core Pattern

### Basic Dialog Implementation

```typescript
// ✅ GOOD: Controlled dialog with form
"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export function CreateItemDialog() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createItem = useMutation(api.items.create);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;

    try {
      await createItem({ name, description });
      setOpen(false);
      toast.success("Item created successfully");
      e.currentTarget.reset();
    } catch (error) {
      toast.error("Failed to create item");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create Item</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Item</DialogTitle>
          <DialogDescription>
            Add a new item to your collection. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                name="name"
                className="col-span-3"
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Description
              </Label>
              <Input
                id="description"
                name="description"
                className="col-span-3"
                disabled={isSubmitting}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

## Advanced Patterns

### 1. Confirmation Dialog

```typescript
// ✅ GOOD: Reusable confirmation dialog
"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  actionLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  actionLabel = "Continue",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
}: ConfirmDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleConfirm() {
    setIsLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      toast.error("Action failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className={variant === "destructive" ? "bg-destructive text-destructive-foreground" : ""}
          >
            {isLoading ? "Processing..." : actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Usage
export function DeleteButton({ itemId }: { itemId: string }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const deleteItem = useMutation(api.items.delete);

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setShowConfirm(true)}
      >
        Delete
      </Button>

      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="Delete Item?"
        description="This action cannot be undone. This will permanently delete the item from our servers."
        actionLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteItem({ id: itemId })}
      />
    </>
  );
}
```

### 2. Multi-Step Modal

```typescript
// ✅ GOOD: Modal with multiple steps
"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Step {
  title: string;
  description: string;
  component: React.ComponentType<any>;
}

const steps: Step[] = [
  {
    title: "Select Type",
    description: "Choose the type of item to create",
    component: TypeSelectionStep,
  },
  {
    title: "Basic Details",
    description: "Provide basic information",
    component: DetailsStep,
  },
  {
    title: "Configuration",
    description: "Configure advanced settings",
    component: ConfigurationStep,
  },
];

export function MultiStepModal() {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({});

  const CurrentStepComponent = steps[currentStep].component;

  function handleNext(stepData: any) {
    const newData = { ...formData, ...stepData };
    setFormData(newData);

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit(newData);
    }
  }

  function handlePrevious() {
    setCurrentStep(currentStep - 1);
  }

  async function handleSubmit(data: any) {
    try {
      await createItem(data);
      setOpen(false);
      setCurrentStep(0);
      setFormData({});
      toast.success("Item created successfully");
    } catch (error) {
      toast.error("Failed to create item");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create Item</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>{steps[currentStep].title}</DialogTitle>
              <DialogDescription>
                {steps[currentStep].description}
              </DialogDescription>
            </div>
            <div className="text-sm text-muted-foreground">
              Step {currentStep + 1} of {steps.length}
            </div>
          </div>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex gap-2 mb-4">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-2 flex-1 rounded-full ${
                index <= currentStep ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="py-4">
          <CurrentStepComponent
            data={formData}
            onNext={handleNext}
            onPrevious={handlePrevious}
            isFirstStep={currentStep === 0}
            isLastStep={currentStep === steps.length - 1}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Step component example
function TypeSelectionStep({ data, onNext }) {
  const [selectedType, setSelectedType] = useState(data.type || "");

  const types = [
    { id: "basic", name: "Basic", icon: File },
    { id: "advanced", name: "Advanced", icon: Settings },
    { id: "custom", name: "Custom", icon: Code },
  ];

  return (
    <div>
      <div className="grid grid-cols-3 gap-4">
        {types.map((type) => (
          <button
            key={type.id}
            onClick={() => setSelectedType(type.id)}
            className={`
              p-4 rounded-lg border-2 text-center transition-colors
              ${selectedType === type.id
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50"
              }
            `}
          >
            <type.icon className="h-8 w-8 mx-auto mb-2" />
            <p className="font-medium">{type.name}</p>
          </button>
        ))}
      </div>

      <div className="flex justify-end mt-6">
        <Button
          onClick={() => onNext({ type: selectedType })}
          disabled={!selectedType}
        >
          Next
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
```

### 3. Sheet (Slide-over Panel)

```typescript
// ✅ GOOD: Responsive sheet for mobile and desktop
"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

export function DetailsSheet({ item }: { item: Item }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm">
          View Details
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>{item.name}</SheetTitle>
          <SheetDescription>
            View and edit item details
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-200px)] my-6">
          <div className="space-y-6">
            {/* Item details */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-1">Description</h4>
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-1">Created</h4>
                <p className="text-sm text-muted-foreground">
                  {formatDate(item.createdAt)}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-1">Status</h4>
                <Badge variant={item.status === "active" ? "default" : "secondary"}>
                  {item.status}
                </Badge>
              </div>
            </div>

            {/* Activity log */}
            <div>
              <h4 className="text-sm font-medium mb-3">Activity</h4>
              <div className="space-y-3">
                {item.activities.map((activity) => (
                  <div key={activity.id} className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                    <div className="flex-1">
                      <p className="text-sm">{activity.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline">Close</Button>
          </SheetClose>
          <Button>Edit Item</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

### 4. Command Palette

```typescript
// ✅ GOOD: Global command palette modal
"use client";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Suggestions">
          <CommandItem onSelect={() => {
            router.push("/dashboard");
            setOpen(false);
          }}>
            <Home className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => {
            router.push("/projects");
            setOpen(false);
          }}>
            <Folder className="mr-2 h-4 w-4" />
            <span>Projects</span>
            <CommandShortcut>⌘P</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => {
            // Trigger create modal
            setOpen(false);
          }}>
            <Plus className="mr-2 h-4 w-4" />
            <span>Create New Item</span>
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <Search className="mr-2 h-4 w-4" />
            <span>Search</span>
            <CommandShortcut>⌘S</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Settings">
          <CommandItem>
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
            <CommandShortcut>⌘U</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
            <CommandShortcut>⌘,</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
```

### 5. Nested Modals

```typescript
// ✅ GOOD: Properly managed nested modals
"use client";

export function ParentModal() {
  const [parentOpen, setParentOpen] = useState(false);
  const [childOpen, setChildOpen] = useState(false);

  // Close child when parent closes
  useEffect(() => {
    if (!parentOpen) {
      setChildOpen(false);
    }
  }, [parentOpen]);

  return (
    <>
      <Dialog open={parentOpen} onOpenChange={setParentOpen}>
        <DialogTrigger asChild>
          <Button>Open Parent</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Parent Modal</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>This is the parent modal content.</p>
            <Button
              onClick={() => setChildOpen(true)}
              className="mt-4"
            >
              Open Child Modal
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Render child modal outside parent to avoid z-index issues */}
      <Dialog open={childOpen} onOpenChange={setChildOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Child Modal</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>This is the child modal content.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setChildOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

## Mobile Responsiveness

### Responsive Modal Sizing

```typescript
// ✅ GOOD: Responsive modal that adapts to screen size
export function ResponsiveModal() {
  const [open, setOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 640px)");

  if (isMobile) {
    // Use Sheet for mobile
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button>Open</Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[90vh]">
          <ModalContent />
        </SheetContent>
      </Sheet>
    );
  }

  // Use Dialog for desktop
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Open</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <ModalContent />
      </DialogContent>
    </Dialog>
  );
}
```

## Accessibility

### Keyboard Navigation

```typescript
// ✅ GOOD: Proper focus management
export function AccessibleModal() {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap is handled by Radix UI
  // Additional keyboard handlers
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Close on Escape (handled by Radix)
      // Custom shortcuts
      if (e.key === "Enter" && e.ctrlKey) {
        handleSubmit();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        // Proper ARIA attributes are added by Radix
        onOpenAutoFocus={(e) => {
          // Focus first input instead of close button
          e.preventDefault();
          document.querySelector<HTMLInputElement>("input")?.focus();
        }}
      >
        {/* Content */}
      </DialogContent>
    </Dialog>
  );
}
```

## Animation Patterns

```typescript
// ✅ GOOD: Smooth animations with Framer Motion
import { motion, AnimatePresence } from "framer-motion";

export function AnimatedModal({ open, onClose, children }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
          >
            <div className="bg-background rounded-lg shadow-lg max-w-md w-full p-6">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

## Best Practices

### ✅ DO's
1. **Use appropriate component** - Dialog, Sheet, or Popover based on use case
2. **Manage focus properly** - Focus management and keyboard navigation
3. **Prevent body scroll** - Lock background when modal is open
4. **Handle escape key** - Close modal on escape
5. **Provide close options** - Multiple ways to dismiss

### ❌ DON'Ts
1. **Don't nest unnecessarily** - Avoid deeply nested modals
2. **Don't auto-open** - User-triggered modals only
3. **Don't block urgently** - Consider toast for non-blocking messages
4. **Don't forget mobile** - Test on small screens
5. **Don't lose form data** - Confirm before closing with unsaved changes

## State Management

```typescript
// ✅ GOOD: Global modal state with Zustand
import { create } from "zustand";

interface ModalStore {
  modals: Record<string, boolean>;
  openModal: (id: string) => void;
  closeModal: (id: string) => void;
  toggleModal: (id: string) => void;
}

export const useModalStore = create<ModalStore>((set) => ({
  modals: {},
  openModal: (id) =>
    set((state) => ({
      modals: { ...state.modals, [id]: true },
    })),
  closeModal: (id) =>
    set((state) => ({
      modals: { ...state.modals, [id]: false },
    })),
  toggleModal: (id) =>
    set((state) => ({
      modals: { ...state.modals, [id]: !state.modals[id] },
    })),
}));

// Usage
export function MyComponent() {
  const { modals, openModal, closeModal } = useModalStore();

  return (
    <>
      <Button onClick={() => openModal("settings")}>
        Open Settings
      </Button>

      <Dialog
        open={modals.settings || false}
        onOpenChange={(open) =>
          open ? openModal("settings") : closeModal("settings")
        }
      >
        {/* Dialog content */}
      </Dialog>
    </>
  );
}
```

## Testing Modals

```typescript
describe("Modal", () => {
  it("should open when trigger is clicked", async () => {
    render(<CreateItemDialog />);

    const trigger = screen.getByText("Create Item");
    await userEvent.click(trigger);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("should close on escape key", async () => {
    render(<CreateItemDialog />);

    await userEvent.click(screen.getByText("Create Item"));
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("should trap focus within modal", async () => {
    render(<CreateItemDialog />);

    await userEvent.click(screen.getByText("Create Item"));
    await userEvent.tab();

    expect(document.activeElement).toHaveAttribute("name", "name");
  });
});
```

## Related Patterns
- 🔗 [Forms & Validation](./forms-validation.md)
- 🔗 [Loading States](./loading-states.md)
- 🔗 [Notifications](./notifications.md)
- 🔗 [Command Menu](./command-menu.md)

---

*Modals should enhance, not interrupt, the user experience. Use them thoughtfully and ensure they're accessible, responsive, and easy to dismiss.*