# 📚 Complete Application Examples

This directory contains full-featured application examples demonstrating best practices with our standard tech stack. Each example includes both **good implementations** (✅) and **anti-patterns to avoid** (❌).

## 🎯 Purpose

These examples serve as:
- **Reference implementations** for common application patterns
- **Learning resources** for new team members
- **Templates** for starting new features
- **Testing grounds** for new patterns

## 🚀 Available Examples

### 1. [CRUD Application](./crud-app/)
**Task Management System**

A complete Create, Read, Update, Delete application showcasing:
- Database operations with Convex
- Authentication with Clerk
- Form handling with react-hook-form + zod
- Real-time updates
- Optimistic UI
- Data pagination
- Error handling

**Perfect for:** Any feature requiring data management, forms, and user-specific content.

---

### 2. [File Sharing Platform](./file-sharing/)
**Secure File Storage & Sharing**

A robust file management system demonstrating:
- File uploads with Convex storage
- Temporary download URLs
- Access control & permissions
- Sharing with other users
- Upload progress tracking
- File metadata management
- Storage quota handling

**Perfect for:** Features involving file uploads, document management, or media handling.

---

### 3. [Real-Time Chat](./real-time-chat/)
**Instant Messaging Application**

A full-featured chat application showcasing:
- Real-time messaging with Convex subscriptions
- Typing indicators
- Online/offline presence
- Message reactions & editing
- Read receipts
- Direct messages & group chats
- Message search
- File attachments

**Perfect for:** Any feature requiring real-time updates, collaboration, or live interactions.

## 📋 How to Use These Examples

### For AI Agents
1. Reference the specific example matching the user's request
2. Copy patterns from the `good/` implementations
3. Avoid patterns shown in `bad/` examples
4. Cross-reference with pattern documentation

### For Developers
1. Browse examples to find similar functionality
2. Copy and adapt the code structure
3. Follow the same patterns and conventions
4. Learn from both good and bad examples

## 🏗️ Example Structure

Each example follows this structure:
```
example-name/
├── README.md           # Comprehensive documentation
├── good/               # Best practice implementation
│   ├── convex/        # Backend functions
│   ├── app/           # Next.js pages
│   └── components/    # React components
└── bad/               # Anti-patterns to avoid
    └── examples.md    # Common mistakes explained
```

## ✨ Key Features Demonstrated

### Authentication & Security
- User authentication flows
- Protected routes
- Access control
- Input validation
- Rate limiting

### Data Management
- CRUD operations
- Real-time subscriptions
- Optimistic updates
- Database indexing
- Search functionality

### User Interface
- Form handling
- Loading states
- Error boundaries
- Responsive design
- Accessibility

### Performance
- Code splitting
- Lazy loading
- Virtual scrolling
- Caching strategies
- Bundle optimization

## 🔄 Common Patterns Across Examples

### 1. Authentication Check Pattern
```typescript
const identity = await ctx.auth.getUserIdentity();
if (!identity) {
  throw new Error("Not authenticated");
}
```

### 2. Data Validation Pattern
```typescript
const schema = z.object({
  field: z.string().min(1).max(100),
});
```

### 3. Optimistic Update Pattern
```tsx
const [optimisticData, setOptimisticData] = useState(data);
// Update UI immediately
// Then sync with backend
```

### 4. Error Handling Pattern
```tsx
try {
  await mutation();
} catch (error) {
  toast.error(error.message);
}
```

## 🚦 Good vs Bad Examples

Each example includes:

### ✅ Good Examples Show:
- Type safety
- Error handling
- Loading states
- Authentication
- Validation
- Performance optimization
- Security best practices

### ❌ Bad Examples Warn Against:
- Missing authentication
- No error handling
- Poor UX patterns
- Security vulnerabilities
- Performance issues
- Code smells

## 📊 Technology Matrix

| Example | Convex | Clerk | ShadCN | Real-time | Storage | Forms |
|---------|--------|-------|---------|-----------|---------|--------|
| CRUD App | ✅ | ✅ | ✅ | ✅ | - | ✅ |
| File Sharing | ✅ | ✅ | ✅ | - | ✅ | ✅ |
| Chat App | ✅ | ✅ | ✅ | ✅ | ✅ | - |

## 🔍 Quick Reference

### Need to implement...
- **A form?** → Check CRUD App's task form
- **File uploads?** → See File Sharing's uploader
- **Real-time updates?** → Look at Chat's message system
- **Authentication?** → All examples have auth patterns
- **Search?** → CRUD and Chat have search implementations
- **Pagination?** → CRUD App has pagination example

## 📝 Contributing New Examples

When adding new examples:

1. **Follow the structure** - Use the same folder organization
2. **Document thoroughly** - Include README with all sections
3. **Show both good and bad** - Help developers learn from mistakes
4. **Add cross-references** - Link to relevant documentation
5. **Test everything** - Ensure code actually works
6. **Keep it realistic** - Examples should solve real problems

## 🔗 Related Documentation

### Stack Documentation
- [Convex Guide](../stack/convex/)
- [Next.js Patterns](../stack/nextjs-convex/)
- [Clerk Authentication](../stack/clerk/)
- [UI Components](../stack/ui-components/)

### Pattern Libraries
- [Authentication Patterns](../patterns/authentication/)
- [Data Management](../patterns/data-management/)
- [UI Patterns](../patterns/ui-patterns/)

### Workflows
- [Feature Development](../workflows/feature-development/)
- [Testing Guide](../workflows/testing/)
- [Debugging](../workflows/debugging/)

## 💡 Tips for Success

1. **Start with an example** - Don't build from scratch
2. **Copy the structure** - Maintain consistency
3. **Follow the patterns** - They're battle-tested
4. **Check both good and bad** - Learn what to avoid
5. **Test thoroughly** - Especially edge cases
6. **Ask for help** - Reference docs or team members

---

*These examples are living documents. As we discover new patterns or improve existing ones, we update these examples to reflect current best practices.*