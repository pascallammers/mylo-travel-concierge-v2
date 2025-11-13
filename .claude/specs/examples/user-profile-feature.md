# Feature Specification: User Profile Management

**Type:** Feature
**Status:** Example
**Created:** 2025-11-13
**Priority:** Medium

## Overview

Implement a comprehensive user profile management system that allows users to view and edit their personal information, preferences, and account settings.

## Context

Users need a centralized location to manage their personal information, travel preferences, and account settings. This feature will integrate with the existing Better Auth authentication system and the database schema.

## Goals

- Provide users with a clean interface to view and edit their profile
- Integrate with existing Better Auth user system
- Store additional user preferences (travel style, dietary restrictions, etc.)
- Support avatar upload to AWS S3/Vercel Blob
- Validate all inputs with Zod schemas
- Maintain responsive design with Tailwind CSS

## Non-Goals

- Social profile features (followers, following)
- Public profile pages (this is private user settings)
- Advanced privacy controls (covered in separate feature)

## Requirements

### Functional Requirements

1. **Profile Display**
   - Show user's current information (name, email, avatar)
   - Display travel preferences
   - Show account creation date and last login

2. **Profile Editing**
   - Edit name and bio
   - Upload/change avatar image
   - Update travel preferences (budget range, preferred destinations, travel style)
   - Update dietary restrictions
   - Change notification preferences

3. **Validation**
   - All fields validated with Zod
   - Image size limits (max 5MB)
   - Supported formats: JPG, PNG, WebP
   - Name length: 2-50 characters

4. **Data Persistence**
   - Store profile data in database via Drizzle ORM
   - Upload images to storage (S3 or Vercel Blob)
   - Optimistic updates with React Query

### Technical Requirements

- Use React 19 with Server Components where appropriate
- Form handling with React Hook Form + Zod
- Image upload with AWS S3 SDK
- Database operations with Drizzle ORM
- Styling with Tailwind CSS v4
- UI components from Radix UI
- State management with Tanstack Query

### Security Requirements

- Validate user authentication with Better Auth
- Ensure users can only edit their own profile
- Sanitize all user inputs
- Validate image uploads (file type, size)
- Rate limit profile updates

## Design

### Database Schema

```typescript
// Add to existing schema
export const userProfiles = pgTable('user_profiles', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  travelStyle: text('travel_style'),
  budgetRange: text('budget_range'),
  dietaryRestrictions: text('dietary_restrictions').array(),
  notificationPreferences: jsonb('notification_preferences'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});
```

### API Endpoints

1. `GET /api/profile` - Get current user's profile
2. `PATCH /api/profile` - Update profile
3. `POST /api/profile/avatar` - Upload avatar

### UI Components

1. `ProfilePage` - Main page component
2. `ProfileForm` - Editable form with sections
3. `AvatarUpload` - Image upload component
4. `PreferencesSection` - Travel preferences UI
5. `NotificationSettings` - Notification toggles

## Implementation Plan

### Phase 1: Database Setup (1 task)
- Create database migration for user_profiles table
- Add Drizzle schema definitions
- Run migration

### Phase 2: API Routes (3 tasks)
- Implement GET /api/profile endpoint
- Implement PATCH /api/profile endpoint
- Implement POST /api/profile/avatar endpoint

### Phase 3: UI Components (4 tasks)
- Create ProfilePage with data fetching
- Build ProfileForm with React Hook Form
- Implement AvatarUpload component
- Create PreferencesSection component

### Phase 4: Integration & Testing (2 tasks)
- Integrate all components
- Write unit tests for API routes
- Write integration tests for profile flow
- Manual testing

## Dependencies

- Better Auth (existing)
- Drizzle ORM schema (needs extension)
- AWS S3 or Vercel Blob configuration
- Existing UI component library

## Success Criteria

1. Users can view their profile information
2. Users can edit all profile fields successfully
3. Avatar uploads work and display correctly
4. All validation works as expected
5. Changes persist to database
6. UI is responsive on mobile and desktop
7. All tests pass
8. No security vulnerabilities

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Image upload failures | High | Implement retry logic, show clear error messages |
| Database migration issues | High | Test migration on dev environment first |
| Performance with large images | Medium | Implement client-side image compression |
| Concurrent edit conflicts | Low | Use optimistic updates with rollback |

## Open Questions

- [ ] Should we support multiple profile pictures (gallery)?
- [ ] Do we need email verification for email changes?
- [ ] Should preferences be shareable with travel partners?
- [ ] What's the maximum bio length?

## Acceptance Criteria

- [ ] User can navigate to profile page
- [ ] User can view current profile data
- [ ] User can edit name and bio
- [ ] User can upload and change avatar
- [ ] User can update travel preferences
- [ ] User can toggle notification settings
- [ ] All changes save successfully
- [ ] Validation errors display clearly
- [ ] Page is responsive
- [ ] Tests cover critical paths
- [ ] No console errors or warnings

## Notes

This feature is a foundation for future social and recommendation features. Keep the data model flexible for future extensions.
