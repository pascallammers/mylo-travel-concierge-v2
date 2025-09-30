# 📝 Forms & Validation Pattern

## Overview
Comprehensive form handling patterns using React Hook Form, Zod validation, and ShadCN form components for type-safe, accessible forms.

## Quick Links
- → [ShadCN Form Components](../../stack/ui-components/shadcn-setup.md)
- → [Zod Schema Validation](https://zod.dev)
- → [React Hook Form](https://react-hook-form.com)
- → [Error Handling](#error-handling)

## Core Pattern

### Basic Form with Validation

```typescript
// ✅ GOOD: Type-safe form with Zod validation
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

// Define schema
const profileFormSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be less than 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers and underscores"),
  email: z
    .string()
    .email("Invalid email address"),
  bio: z
    .string()
    .max(160, "Bio must be less than 160 characters")
    .optional(),
  age: z
    .number()
    .min(13, "Must be at least 13 years old")
    .max(120, "Invalid age")
    .optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export function ProfileForm() {
  const updateProfile = useMutation(api.users.updateProfile);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      username: "",
      email: "",
      bio: "",
    },
  });

  async function onSubmit(values: ProfileFormValues) {
    try {
      await updateProfile(values);
      toast.success("Profile updated successfully");
    } catch (error) {
      toast.error("Failed to update profile");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="johndoe" {...field} />
              </FormControl>
              <FormDescription>
                This is your public display name.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="john@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <textarea
                  className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2"
                  placeholder="Tell us about yourself"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Brief description for your profile.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving..." : "Save changes"}
        </Button>
      </form>
    </Form>
  );
}
```

## Advanced Patterns

### 1. Multi-Step Form with Progress

```typescript
// ✅ GOOD: Multi-step form with validation per step
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

// Step schemas
const step1Schema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email"),
});

const step2Schema = z.object({
  company: z.string().min(1, "Company is required"),
  role: z.string().min(1, "Role is required"),
  experience: z.enum(["0-2", "3-5", "5-10", "10+"]),
});

const step3Schema = z.object({
  goals: z.array(z.string()).min(1, "Select at least one goal"),
  budget: z.string().min(1, "Budget is required"),
  timeline: z.enum(["asap", "1month", "3months", "6months", "1year"]),
});

const fullSchema = step1Schema.merge(step2Schema).merge(step3Schema);
type FormData = z.infer<typeof fullSchema>;

const steps = [
  { title: "Personal Info", schema: step1Schema },
  { title: "Professional", schema: step2Schema },
  { title: "Project Details", schema: step3Schema },
];

export function MultiStepForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Partial<FormData>>({});

  const currentSchema = steps[currentStep].schema;

  const form = useForm({
    resolver: zodResolver(currentSchema),
    defaultValues: formData,
  });

  async function handleNext(data: any) {
    // Save current step data
    const newData = { ...formData, ...data };
    setFormData(newData);

    if (currentStep === steps.length - 1) {
      // Final submission
      try {
        await submitForm(newData as FormData);
        toast.success("Form submitted successfully!");
      } catch (error) {
        toast.error("Submission failed");
      }
    } else {
      // Move to next step
      setCurrentStep(currentStep + 1);
      form.reset(newData);
    }
  }

  function handlePrevious() {
    setCurrentStep(currentStep - 1);
  }

  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2">
          Step {currentStep + 1} of {steps.length}: {steps[currentStep].title}
        </h2>
        <Progress value={progress} className="h-2" />
      </div>

      <form onSubmit={form.handleSubmit(handleNext)}>
        {/* Render step-specific fields based on currentStep */}
        {currentStep === 0 && <Step1Fields form={form} />}
        {currentStep === 1 && <Step2Fields form={form} />}
        {currentStep === 2 && <Step3Fields form={form} />}

        <div className="flex justify-between mt-8">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
          >
            Previous
          </Button>
          <Button type="submit">
            {currentStep === steps.length - 1 ? "Submit" : "Next"}
          </Button>
        </div>
      </form>
    </div>
  );
}
```

### 2. Dynamic Form Fields

```typescript
// ✅ GOOD: Dynamic field arrays
"use client";

import { useFieldArray, useForm } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const teamFormSchema = z.object({
  teamName: z.string().min(1, "Team name is required"),
  members: z.array(
    z.object({
      name: z.string().min(1, "Name is required"),
      email: z.string().email("Invalid email"),
      role: z.enum(["admin", "member", "viewer"]),
    })
  ).min(1, "At least one member is required"),
});

export function TeamForm() {
  const form = useForm({
    resolver: zodResolver(teamFormSchema),
    defaultValues: {
      teamName: "",
      members: [{ name: "", email: "", role: "member" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "members",
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="teamName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Team Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Team Members</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ name: "", email: "", role: "member" })}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          </div>

          {fields.map((field, index) => (
            <div key={field.id} className="flex gap-4 items-start">
              <FormField
                control={form.control}
                name={`members.${index}.name`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input placeholder="Name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`members.${index}.email`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input type="email" placeholder="Email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`members.${index}.role`}
                render={({ field }) => (
                  <FormItem className="w-32">
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <Button type="submit">Create Team</Button>
      </form>
    </Form>
  );
}
```

### 3. Async Validation

```typescript
// ✅ GOOD: Async validation for uniqueness checks
const usernameSchema = z.string().refine(
  async (username) => {
    if (!username || username.length < 3) return false;

    // Check availability via API
    const response = await fetch(`/api/check-username?username=${username}`);
    const { available } = await response.json();
    return available;
  },
  {
    message: "Username is already taken",
  }
);

// Form field with debounced async validation
export function UsernameField() {
  const [isChecking, setIsChecking] = useState(false);
  const form = useForm();

  const checkUsername = useDebouncedCallback(async (username: string) => {
    setIsChecking(true);
    try {
      await form.trigger("username");
    } finally {
      setIsChecking(false);
    }
  }, 500);

  return (
    <FormField
      control={form.control}
      name="username"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Username</FormLabel>
          <FormControl>
            <div className="relative">
              <Input
                {...field}
                onChange={(e) => {
                  field.onChange(e);
                  checkUsername(e.target.value);
                }}
              />
              {isChecking && (
                <Loader className="absolute right-2 top-2.5 h-4 w-4 animate-spin" />
              )}
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
```

### 4. File Upload Form

```typescript
// ✅ GOOD: File upload with preview and validation
"use client";

import { useDropzone } from "react-dropzone";
import { Upload, X, File } from "lucide-react";

const fileSchema = z.object({
  files: z
    .array(
      z.object({
        file: z.instanceof(File),
        preview: z.string(),
      })
    )
    .min(1, "At least one file is required")
    .max(5, "Maximum 5 files allowed"),
});

export function FileUploadForm() {
  const [files, setFiles] = useState<Array<{ file: File; preview: string }>>([]);
  const uploadFiles = useMutation(api.files.upload);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 5,
    maxSize: 5 * 1024 * 1024, // 5MB
    onDrop: (acceptedFiles) => {
      const newFiles = acceptedFiles.map(file => ({
        file,
        preview: URL.createObjectURL(file),
      }));
      setFiles(prev => [...prev, ...newFiles].slice(0, 5));
    },
  });

  const removeFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const handleSubmit = async () => {
    try {
      // Upload files
      const uploadPromises = files.map(({ file }) => {
        const formData = new FormData();
        formData.append('file', file);
        return uploadFiles({ formData });
      });

      await Promise.all(uploadPromises);
      toast.success("Files uploaded successfully");
      setFiles([]);
    } catch (error) {
      toast.error("Failed to upload files");
    }
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-border'}
        `}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">
          {isDragActive
            ? "Drop the files here..."
            : "Drag & drop files here, or click to select"}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Max 5 files, up to 5MB each
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div key={index} className="flex items-center gap-2 p-2 border rounded">
              {file.file.type.startsWith('image/') ? (
                <img src={file.preview} alt="" className="h-10 w-10 object-cover rounded" />
              ) : (
                <File className="h-10 w-10" />
              )}
              <span className="flex-1 text-sm truncate">{file.file.name}</span>
              <span className="text-xs text-muted-foreground">
                {(file.file.size / 1024).toFixed(1)} KB
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeFile(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button onClick={handleSubmit} disabled={files.length === 0}>
        Upload {files.length} file{files.length !== 1 ? 's' : ''}
      </Button>
    </div>
  );
}
```

## Error Handling

### Field-Level Error Display

```typescript
// ✅ GOOD: Comprehensive error handling
export function FormWithErrors() {
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  async function onSubmit(values: FormValues) {
    try {
      setServerErrors({});
      await submitForm(values);
    } catch (error) {
      if (error.response?.data?.errors) {
        // Map server errors to form fields
        const fieldErrors = error.response.data.errors;
        setServerErrors(fieldErrors);

        // Set errors on form
        Object.entries(fieldErrors).forEach(([field, message]) => {
          form.setError(field as any, {
            type: "server",
            message: message as string,
          });
        });
      } else {
        toast.error("An unexpected error occurred");
      }
    }
  }

  return (
    <Form {...form}>
      {/* Global error message */}
      {Object.keys(serverErrors).length > 0 && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded mb-4">
          <p className="font-medium">Please fix the following errors:</p>
          <ul className="list-disc list-inside mt-2">
            {Object.entries(serverErrors).map(([field, error]) => (
              <li key={field}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Form fields with inline errors */}
    </Form>
  );
}
```

## Accessibility Best Practices

### ✅ DO's
1. **Use semantic HTML** - Proper form, label, input relationships
2. **Provide error messages** - Clear, actionable error text
3. **Support keyboard navigation** - Tab order, Enter to submit
4. **Include aria-labels** - For screen reader support
5. **Show loading states** - Indicate form submission progress

### ❌ DON'Ts
1. **Don't disable submit** without clear indication why
2. **Don't auto-focus** without user expectation
3. **Don't validate on blur** for slow async validations
4. **Don't clear forms** without confirmation
5. **Don't use placeholder** as label replacement

## Performance Optimization

```typescript
// ✅ GOOD: Optimized form rendering
import { memo } from 'react';
import { Controller } from 'react-hook-form';

// Memoized field component
const ExpensiveField = memo(({ control, name }) => {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <ComplexInput {...field} />
      )}
    />
  );
});

// Avoid unnecessary re-renders
export function OptimizedForm() {
  const form = useForm({
    mode: "onChange", // Only re-render changed fields
    reValidateMode: "onBlur", // Validate on blur, not every change
  });

  // Use watch selectively
  const username = form.watch("username"); // Only watch needed fields

  return (
    <Form {...form}>
      {/* Fields render independently */}
    </Form>
  );
}
```

## Testing Forms

```typescript
// Test form validation and submission
describe("ProfileForm", () => {
  it("should validate required fields", async () => {
    render(<ProfileForm />);

    const submitButton = screen.getByText("Save changes");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Username is required")).toBeInTheDocument();
    });
  });

  it("should submit valid data", async () => {
    const mockSubmit = jest.fn();
    render(<ProfileForm onSubmit={mockSubmit} />);

    await userEvent.type(screen.getByLabelText("Username"), "testuser");
    await userEvent.type(screen.getByLabelText("Email"), "test@example.com");

    fireEvent.click(screen.getByText("Save changes"));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        username: "testuser",
        email: "test@example.com",
      });
    });
  });
});
```

## Related Patterns
- 🔗 [Loading States](./loading-states.md)
- 🔗 [Error Handling](../error-handling/README.md)
- 🔗 [Optimistic Updates](../data-management/optimistic-updates.md)
- 🔗 [Modals & Dialogs](./modals-dialogs.md)

---

*Well-designed forms are crucial for user experience. Focus on validation, accessibility, and clear error messaging for the best results.*