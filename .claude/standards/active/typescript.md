# TypeScript Development Standards

**Version:** 1.0.0
**Last Updated:** 2025-11-13
**TypeScript Version:** 5.x

## Overview

This document defines TypeScript development standards for type-safe, maintainable code. Following these standards ensures consistency and catches errors at compile-time.

## Configuration

### tsconfig.json Setup

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowJs": true,
    "checkJs": false,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

## Type Annotations

### Function Return Types

```typescript
// ✅ Always annotate function return types
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0)
}

// ✅ Async functions return Promise
async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`)
  return response.json()
}

// ❌ Don't rely on inference for public functions
function calculateTotal(items: Item[]) {
  return items.reduce((sum, item) => sum + item.price, 0) // No return type
}
```

### Variable Types

```typescript
// ✅ Let TypeScript infer simple types
const count = 5 // inferred as number
const name = "John" // inferred as string
const items = [1, 2, 3] // inferred as number[]

// ✅ Annotate when type can't be inferred
const user: User | null = null
const items: Item[] = []

// ✅ Use const assertions for literal types
const config = {
  api: "https://api.example.com",
  timeout: 5000
} as const // Type: { readonly api: "https://api.example.com"; readonly timeout: 5000 }
```

## Interface vs Type

### Use Interfaces for Object Shapes

```typescript
// ✅ Use interfaces for objects
interface User {
  id: string
  name: string
  email: string
  createdAt: Date
}

// ✅ Interfaces can be extended
interface AdminUser extends User {
  role: 'admin'
  permissions: string[]
}

// ✅ Interfaces can be merged
interface Window {
  myCustomProp: string
}
```

### Use Types for Unions, Tuples, and Utilities

```typescript
// ✅ Use type for unions
type Status = 'pending' | 'active' | 'completed' | 'cancelled'

// ✅ Use type for tuples
type Coordinate = [number, number]

// ✅ Use type for mapped types
type Readonly<T> = {
  readonly [P in keyof T]: T[P]
}

// ✅ Use type for conditional types
type NonNullable<T> = T extends null | undefined ? never : T
```

## Utility Types

### Built-in Utilities

```typescript
interface User {
  id: string
  name: string
  email: string
  password: string
}

// ✅ Partial - all properties optional
type UserUpdate = Partial<User>

// ✅ Pick - select specific properties
type UserPublic = Pick<User, 'id' | 'name' | 'email'>

// ✅ Omit - exclude specific properties
type UserCreate = Omit<User, 'id'>

// ✅ Required - all properties required
type UserRequired = Required<Partial<User>>

// ✅ Readonly - all properties readonly
type ImmutableUser = Readonly<User>

// ✅ Record - create object type with specific keys
type UserMap = Record<string, User>

// ✅ Extract - extract union members
type StatusExtract = Extract<Status, 'active' | 'completed'> // 'active' | 'completed'

// ✅ Exclude - exclude union members
type StatusExclude = Exclude<Status, 'pending'> // 'active' | 'completed' | 'cancelled'

// ✅ NonNullable - remove null/undefined
type UserNotNull = NonNullable<User | null> // User

// ✅ ReturnType - get function return type
function getUser() { return { id: '1', name: 'John' } }
type UserReturn = ReturnType<typeof getUser>

// ✅ Parameters - get function parameter types
function createUser(name: string, email: string) {}
type CreateUserParams = Parameters<typeof createUser> // [string, string]

// ✅ Awaited - unwrap Promise type
type UserAwaited = Awaited<Promise<User>> // User
```

### Custom Utility Types

```typescript
// ✅ Create reusable utility types

// Make specific properties optional
type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

type UserOptionalEmail = PartialBy<User, 'email'>
// { id: string; name: string; email?: string; password: string }

// Make specific properties required
type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>

// Deep partial
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

// Deep readonly
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P]
}

// Value of object
type ValueOf<T> = T[keyof T]

type UserValue = ValueOf<User> // string | Date

// Merge types
type Merge<T, U> = Omit<T, keyof U> & U

type MergedUser = Merge<User, { age: number }> // User with age added
```

## Type Guards

### User-Defined Type Guards

```typescript
interface Dog {
  type: 'dog'
  bark(): void
}

interface Cat {
  type: 'cat'
  meow(): void
}

type Pet = Dog | Cat

// ✅ Use type predicates
function isDog(pet: Pet): pet is Dog {
  return pet.type === 'dog'
}

function handlePet(pet: Pet) {
  if (isDog(pet)) {
    pet.bark() // TypeScript knows it's a Dog
  } else {
    pet.meow() // TypeScript knows it's a Cat
  }
}
```

### Discriminated Unions

```typescript
// ✅ Use discriminated unions with 'type' field
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string }

function handleResult<T>(result: Result<T>) {
  if (result.success) {
    console.log(result.data) // TypeScript knows data exists
  } else {
    console.log(result.error) // TypeScript knows error exists
  }
}
```

### typeof and instanceof

```typescript
// ✅ Use typeof for primitives
function process(value: string | number) {
  if (typeof value === 'string') {
    return value.toUpperCase()
  }
  return value.toFixed(2)
}

// ✅ Use instanceof for classes
class ApiError extends Error {
  statusCode: number
  constructor(message: string, statusCode: number) {
    super(message)
    this.statusCode = statusCode
  }
}

function handleError(error: unknown) {
  if (error instanceof ApiError) {
    console.log(`API Error ${error.statusCode}: ${error.message}`)
  } else if (error instanceof Error) {
    console.log(`Error: ${error.message}`)
  }
}
```

## Generics

### Function Generics

```typescript
// ✅ Use generics for reusable functions
function first<T>(array: T[]): T | undefined {
  return array[0]
}

const num = first([1, 2, 3]) // number | undefined
const str = first(['a', 'b']) // string | undefined

// ✅ Constrain generics
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}

const user = { id: '1', name: 'John' }
const name = getProperty(user, 'name') // string
// getProperty(user, 'invalid') // Error

// ✅ Multiple type parameters
function map<T, U>(array: T[], fn: (item: T) => U): U[] {
  return array.map(fn)
}

const numbers = [1, 2, 3]
const strings = map(numbers, n => n.toString()) // string[]
```

### Generic Interfaces

```typescript
// ✅ Generic interfaces
interface ApiResponse<T> {
  data: T
  status: number
  message: string
}

interface User {
  id: string
  name: string
}

const userResponse: ApiResponse<User> = {
  data: { id: '1', name: 'John' },
  status: 200,
  message: 'Success'
}

// ✅ Generic with constraints
interface Repository<T extends { id: string }> {
  findById(id: string): Promise<T | null>
  save(item: T): Promise<T>
  delete(id: string): Promise<void>
}

class UserRepository implements Repository<User> {
  async findById(id: string): Promise<User | null> {
    // implementation
  }
  async save(user: User): Promise<User> {
    // implementation
  }
  async delete(id: string): Promise<void> {
    // implementation
  }
}
```

## Type Safety Patterns

### Avoid `any`

```typescript
// ❌ Don't use any
function processData(data: any) {
  return data.value // No type checking
}

// ✅ Use unknown and narrow the type
function processData(data: unknown) {
  if (isDataObject(data)) {
    return data.value // Type-safe
  }
  throw new Error('Invalid data')
}

function isDataObject(data: unknown): data is { value: string } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'value' in data &&
    typeof data.value === 'string'
  )
}
```

### Strict Null Checks

```typescript
// ✅ Handle null/undefined explicitly
function getUserName(user: User | null): string {
  if (user === null) {
    return 'Guest'
  }
  return user.name
}

// ✅ Use optional chaining
const email = user?.email

// ✅ Use nullish coalescing
const displayName = user?.name ?? 'Anonymous'

// ❌ Don't use non-null assertion unless absolutely necessary
const name = user!.name // Dangerous!

// ✅ Better: use type guard
if (user) {
  const name = user.name // Safe
}
```

### Array Type Safety

```typescript
// ✅ Enable noUncheckedIndexedAccess
// With noUncheckedIndexedAccess: true
const items = [1, 2, 3]
const first = items[0] // number | undefined (safe!)
const outOfBounds = items[999] // number | undefined (catches bugs!)

// ✅ Handle array access safely
function getFirst<T>(array: T[]): T | undefined {
  return array[0]
}

// ✅ Use Array.prototype methods
const validItems = items.filter((item): item is number => item !== undefined)
```

## Zod Integration

### Runtime Validation

```typescript
import { z } from 'zod'

// ✅ Define schema with Zod
const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().min(18).optional(),
  role: z.enum(['user', 'admin', 'moderator']),
  createdAt: z.date()
})

// ✅ Infer TypeScript type from schema
type User = z.infer<typeof UserSchema>

// ✅ Validate runtime data
function createUser(data: unknown): User {
  return UserSchema.parse(data) // Throws if invalid
}

// ✅ Safe parsing
function createUserSafe(data: unknown): User | null {
  const result = UserSchema.safeParse(data)
  if (result.success) {
    return result.data
  }
  console.error(result.error)
  return null
}

// ✅ Partial schemas for updates
const UserUpdateSchema = UserSchema.partial()
type UserUpdate = z.infer<typeof UserUpdateSchema>
```

### API Validation

```typescript
// ✅ Validate API requests
import { NextRequest, NextResponse } from 'next/server'

const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  tags: z.array(z.string()).max(5)
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = CreatePostSchema.parse(body)

    // validated is fully type-safe
    const post = await createPost(validated)

    return NextResponse.json(post, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { errors: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

## Error Handling

### Custom Error Classes

```typescript
// ✅ Create typed error classes
class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: unknown
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

class NotFoundError extends Error {
  constructor(
    public resource: string,
    public id: string
  ) {
    super(`${resource} with id ${id} not found`)
    this.name = 'NotFoundError'
  }
}

// ✅ Type-safe error handling
function handleError(error: unknown): string {
  if (error instanceof ValidationError) {
    return `Validation failed for ${error.field}: ${error.message}`
  }
  if (error instanceof NotFoundError) {
    return `${error.resource} not found`
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'An unknown error occurred'
}
```

### Result Type Pattern

```typescript
// ✅ Use Result type for operations that can fail
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E }

async function fetchUser(id: string): Promise<Result<User>> {
  try {
    const response = await fetch(`/api/users/${id}`)
    if (!response.ok) {
      return { ok: false, error: new Error('Failed to fetch user') }
    }
    const user = await response.json()
    return { ok: true, value: user }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error('Unknown error')
    }
  }
}

// Usage
const result = await fetchUser('123')
if (result.ok) {
  console.log(result.value.name) // Type-safe access
} else {
  console.error(result.error.message)
}
```

## Module Organization

### Barrel Exports

```typescript
// ✅ Use barrel exports for clean imports
// types/index.ts
export type { User, UserCreate, UserUpdate } from './user'
export type { Post, PostCreate, PostUpdate } from './post'
export type { Comment } from './comment'

// Usage
import { User, Post, Comment } from '@/types'
```

### Path Aliases

```typescript
// ✅ Use path aliases (configured in tsconfig.json)
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import type { User } from '@/types'

// ❌ Don't use relative imports for distant files
import { db } from '../../../lib/db'
```

## Type Declaration Files

### Ambient Declarations

```typescript
// ✅ global.d.ts - augment global types
declare global {
  interface Window {
    gtag: (
      command: string,
      targetId: string,
      config?: Record<string, any>
    ) => void
  }

  var __DEV__: boolean

  namespace NodeJS {
    interface ProcessEnv {
      DATABASE_URL: string
      NEXT_PUBLIC_API_URL: string
    }
  }
}

export {}
```

### Module Declarations

```typescript
// ✅ types/modules.d.ts - declare modules without types
declare module 'untyped-library' {
  export function someFunction(arg: string): number
}

// ✅ Declare CSS modules
declare module '*.module.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}

// ✅ Declare image imports
declare module '*.png' {
  const value: string
  export default value
}
```

## Common Patterns

### Builder Pattern

```typescript
// ✅ Type-safe builder pattern
class QueryBuilder<T> {
  private filters: Array<(item: T) => boolean> = []

  where(predicate: (item: T) => boolean): this {
    this.filters.push(predicate)
    return this
  }

  execute(items: T[]): T[] {
    return items.filter(item =>
      this.filters.every(filter => filter(item))
    )
  }
}

// Usage
const results = new QueryBuilder<User>()
  .where(u => u.age > 18)
  .where(u => u.isActive)
  .execute(users)
```

### Factory Pattern

```typescript
// ✅ Type-safe factory
interface Shape {
  type: string
  area(): number
}

class Circle implements Shape {
  type = 'circle' as const
  constructor(private radius: number) {}
  area() {
    return Math.PI * this.radius ** 2
  }
}

class Rectangle implements Shape {
  type = 'rectangle' as const
  constructor(private width: number, private height: number) {}
  area() {
    return this.width * this.height
  }
}

type ShapeConfig =
  | { type: 'circle'; radius: number }
  | { type: 'rectangle'; width: number; height: number }

function createShape(config: ShapeConfig): Shape {
  switch (config.type) {
    case 'circle':
      return new Circle(config.radius)
    case 'rectangle':
      return new Rectangle(config.width, config.height)
  }
}
```

## Common Anti-Patterns

### ❌ Type Assertions (as)

```typescript
// ❌ Avoid type assertions
const user = data as User // Unsafe!

// ✅ Use type guards
function isUser(data: unknown): data is User {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'name' in data
  )
}

if (isUser(data)) {
  // data is User here, type-safe!
}
```

### ❌ Implicit any

```typescript
// ❌ Functions without types
function process(data) {
  return data.value
}

// ✅ Always type parameters and returns
function process(data: DataType): string {
  return data.value
}
```

### ❌ Too Many Optional Properties

```typescript
// ❌ Everything optional
interface Config {
  host?: string
  port?: number
  timeout?: number
  retries?: number
}

// ✅ Required with defaults, or use Partial
interface Config {
  host: string
  port: number
  timeout: number
  retries: number
}

const defaultConfig: Config = {
  host: 'localhost',
  port: 3000,
  timeout: 5000,
  retries: 3
}
```

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)
- [Type Challenges](https://github.com/type-challenges/type-challenges)
- [Zod Documentation](https://zod.dev/)
