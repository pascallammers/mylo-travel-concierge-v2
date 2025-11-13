# React 19 Development Standards

**Version:** 1.0.0
**Last Updated:** 2025-11-13
**React Version:** 19.1.1

## Overview

React 19 introduces significant improvements including the new React Compiler, enhanced Server Components, Actions, and better async handling. This document outlines best practices for React 19 development.

## New Features in React 19

### 1. Actions

Actions replace the manual handling of pending states, errors, and optimistic updates.

```typescript
'use client'

import { useActionState } from 'react'

function UpdateNameForm({ name }: { name: string }) {
  const [error, submitAction, isPending] = useActionState(
    async (previousState: any, formData: FormData) => {
      const newName = formData.get('name') as string
      const error = await updateName(newName)
      if (error) return error
      return null
    },
    null
  )

  return (
    <form action={submitAction}>
      <input type="text" name="name" defaultValue={name} />
      <button type="submit" disabled={isPending}>
        Update
      </button>
      {error && <p>{error}</p>}
    </form>
  )
}
```

### 2. useOptimistic Hook

```typescript
'use client'

import { useOptimistic } from 'react'

function TodoList({ todos }: { todos: Todo[] }) {
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    todos,
    (state, newTodo: Todo) => [...state, { ...newTodo, pending: true }]
  )

  async function addTodo(formData: FormData) {
    const title = formData.get('title') as string
    addOptimisticTodo({ id: Math.random(), title, completed: false })
    await createTodo(title)
  }

  return (
    <>
      <form action={addTodo}>
        <input name="title" />
        <button>Add</button>
      </form>
      <ul>
        {optimisticTodos.map(todo => (
          <li key={todo.id} style={{ opacity: todo.pending ? 0.5 : 1 }}>
            {todo.title}
          </li>
        ))}
      </ul>
    </>
  )
}
```

### 3. use() Hook

The `use()` hook lets you read resources like Promises and Context.

```typescript
'use client'

import { use, Suspense } from 'react'

function UserProfile({ userPromise }: { userPromise: Promise<User> }) {
  // ✅ use() unwraps the promise
  const user = use(userPromise)

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  )
}

// Usage with Suspense
export default function Page() {
  const userPromise = fetchUser()

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <UserProfile userPromise={userPromise} />
    </Suspense>
  )
}
```

### 4. Document Metadata

```typescript
function BlogPost({ post }: { post: Post }) {
  return (
    <article>
      {/* ✅ Metadata directly in components */}
      <title>{post.title}</title>
      <meta name="author" content={post.author} />

      <h1>{post.title}</h1>
      <p>{post.content}</p>
    </article>
  )
}
```

## Component Patterns

### Function Components (Default)

```typescript
// ✅ Always use function components
interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary'
}

export function Button({ children, onClick, variant = 'primary' }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`btn btn-${variant}`}
    >
      {children}
    </button>
  )
}
```

### Props with Children

```typescript
// ✅ Type children explicitly
interface CardProps {
  children: React.ReactNode
  title?: string
  footer?: React.ReactNode
}

export function Card({ children, title, footer }: CardProps) {
  return (
    <div className="card">
      {title && <h2>{title}</h2>}
      <div className="content">{children}</div>
      {footer && <div className="footer">{footer}</div>}
    </div>
  )
}
```

### Prop Spreading

```typescript
// ✅ Use prop spreading with type safety
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
}

export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant} ${className || ''}`}
      {...props}
    />
  )
}
```

## Hooks Best Practices

### useState

```typescript
// ✅ Initialize with proper types
const [count, setCount] = useState<number>(0)
const [user, setUser] = useState<User | null>(null)

// ✅ Use function updates for dependent changes
setCount(prev => prev + 1)

// ❌ Don't use multiple setState calls that depend on each other
setCount(count + 1)
setCount(count + 2) // Bug: both use old count
```

### useEffect

```typescript
// ✅ Clean up side effects
useEffect(() => {
  const controller = new AbortController()

  async function fetchData() {
    try {
      const response = await fetch('/api/data', {
        signal: controller.signal
      })
      const data = await response.json()
      setData(data)
    } catch (error) {
      if (error.name !== 'AbortError') {
        setError(error)
      }
    }
  }

  fetchData()

  return () => controller.abort()
}, [])

// ❌ Don't omit dependencies
useEffect(() => {
  doSomething(value) // Missing 'value' in deps
}, []) // Bug: stale closure

// ✅ Include all dependencies
useEffect(() => {
  doSomething(value)
}, [value])
```

### useMemo

```typescript
// ✅ Memoize expensive calculations
const expensiveValue = useMemo(() => {
  return items.reduce((sum, item) => sum + item.price, 0)
}, [items])

// ❌ Don't memoize everything
const simple = useMemo(() => a + b, [a, b]) // Overkill
```

### useCallback

```typescript
// ✅ Use for callbacks passed to optimized children
const handleClick = useCallback(() => {
  doSomething(value)
}, [value])

return <ExpensiveChild onClick={handleClick} />

// ❌ Don't wrap every function
const handleClick = useCallback(() => {
  console.log('clicked')
}, []) // Unnecessary if not passed to memo'd child
```

### useRef

```typescript
// ✅ Type refs properly
const inputRef = useRef<HTMLInputElement>(null)
const countRef = useRef<number>(0)

// ✅ Use for DOM access
function Input() {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return <input ref={inputRef} />
}

// ✅ Use for persisting values across renders
function Timer() {
  const intervalRef = useRef<number>()

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      console.log('tick')
    }, 1000)

    return () => clearInterval(intervalRef.current)
  }, [])
}
```

## State Management Patterns

### Local State (useState)

```typescript
// ✅ Use for component-local state
function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}
```

### Lifted State

```typescript
// ✅ Lift state to nearest common ancestor
function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([])

  return (
    <>
      <TodoForm onAdd={newTodo => setTodos([...todos, newTodo])} />
      <TodoList todos={todos} onToggle={id => {
        setTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t))
      }} />
    </>
  )
}
```

### Context for Deep Props

```typescript
// ✅ Use Context to avoid prop drilling
interface ThemeContextType {
  theme: 'light' | 'dark'
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
```

### Tanstack Query for Server State

```typescript
// ✅ Use Tanstack Query for server data
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

function TodoList() {
  const queryClient = useQueryClient()

  const { data: todos, isLoading } = useQuery({
    queryKey: ['todos'],
    queryFn: async () => {
      const res = await fetch('/api/todos')
      return res.json()
    }
  })

  const mutation = useMutation({
    mutationFn: async (newTodo: Todo) => {
      const res = await fetch('/api/todos', {
        method: 'POST',
        body: JSON.stringify(newTodo)
      })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    }
  })

  if (isLoading) return <div>Loading...</div>

  return (
    <ul>
      {todos?.map(todo => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  )
}
```

## Performance Optimization

### React.memo

```typescript
// ✅ Memoize expensive components
interface ListItemProps {
  item: Item
  onDelete: (id: string) => void
}

export const ListItem = memo(function ListItem({ item, onDelete }: ListItemProps) {
  console.log('Rendering:', item.id)
  return (
    <div>
      <span>{item.title}</span>
      <button onClick={() => onDelete(item.id)}>Delete</button>
    </div>
  )
})

// ❌ Don't memo everything
const Simple = memo(function Simple({ text }: { text: string }) {
  return <span>{text}</span> // Too simple to benefit
})
```

### Code Splitting

```typescript
// ✅ Lazy load heavy components
import { lazy, Suspense } from 'react'

const HeavyChart = lazy(() => import('./HeavyChart'))

function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <Suspense fallback={<ChartSkeleton />}>
        <HeavyChart />
      </Suspense>
    </div>
  )
}
```

### Virtual Lists

```typescript
// ✅ Use virtualization for long lists
import { useVirtualizer } from '@tanstack/react-virtual'

function VirtualList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35
  })

  return (
    <div ref={parentRef} style={{ height: '400px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map(virtualItem => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`
            }}
          >
            {items[virtualItem.index].title}
          </div>
        ))}
      </div>
    </div>
  )
}
```

## Form Handling

### React Hook Form + Zod

```typescript
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Must be at least 8 characters'),
  age: z.number().min(18, 'Must be 18 or older')
})

type FormData = z.infer<typeof schema>

export function SignupForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<FormData>({
    resolver: zodResolver(schema)
  })

  async function onSubmit(data: FormData) {
    await fetch('/api/signup', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} />
      {errors.email && <span>{errors.email.message}</span>}

      <input type="password" {...register('password')} />
      {errors.password && <span>{errors.password.message}</span>}

      <input type="number" {...register('age', { valueAsNumber: true })} />
      {errors.age && <span>{errors.age.message}</span>}

      <button type="submit" disabled={isSubmitting}>
        Sign Up
      </button>
    </form>
  )
}
```

## Error Handling

### Error Boundaries

```typescript
'use client'

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div>
          <h2>Something went wrong</h2>
          <details>
            <summary>Error details</summary>
            <pre>{this.state.error?.message}</pre>
          </details>
        </div>
      )
    }

    return this.props.children
  }
}
```

## Accessibility

### Semantic HTML

```typescript
// ✅ Use semantic elements
function Article({ post }: { post: Post }) {
  return (
    <article>
      <header>
        <h1>{post.title}</h1>
        <time dateTime={post.date}>{formatDate(post.date)}</time>
      </header>
      <section>{post.content}</section>
      <footer>
        <p>By {post.author}</p>
      </footer>
    </article>
  )
}

// ❌ Don't use divs for everything
function Article({ post }: { post: Post }) {
  return (
    <div>
      <div>{post.title}</div>
      <div>{post.content}</div>
    </div>
  )
}
```

### ARIA Attributes

```typescript
// ✅ Add ARIA when semantic HTML isn't enough
function Modal({ isOpen, onClose, children }: ModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      style={{ display: isOpen ? 'block' : 'none' }}
    >
      <h2 id="modal-title">Modal Title</h2>
      {children}
      <button onClick={onClose} aria-label="Close modal">
        ×
      </button>
    </div>
  )
}
```

### Keyboard Navigation

```typescript
// ✅ Handle keyboard events
function Dropdown({ items }: { items: string[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, items.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        // Select item
        break
      case 'Escape':
        setIsOpen(false)
        break
    }
  }

  return (
    <div onKeyDown={handleKeyDown}>
      {/* dropdown UI */}
    </div>
  )
}
```

## Testing

### Component Tests

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { Counter } from './Counter'

describe('Counter', () => {
  it('increments count when button clicked', () => {
    render(<Counter />)

    const button = screen.getByRole('button', { name: /increment/i })
    fireEvent.click(button)

    expect(screen.getByText('Count: 1')).toBeInTheDocument()
  })

  it('handles initial value prop', () => {
    render(<Counter initialValue={5} />)
    expect(screen.getByText('Count: 5')).toBeInTheDocument()
  })
})
```

## Common Anti-Patterns

### ❌ Mutating State

```typescript
// ❌ Bad: Mutating state directly
const [items, setItems] = useState<Item[]>([])
items.push(newItem) // Mutation!
setItems(items)

// ✅ Good: Create new array
setItems([...items, newItem])
```

### ❌ Derived State

```typescript
// ❌ Bad: Duplicating props in state
function UserProfile({ user }: { user: User }) {
  const [name, setName] = useState(user.name) // Will get stale!
  return <div>{name}</div>
}

// ✅ Good: Use props directly or useMemo
function UserProfile({ user }: { user: User }) {
  return <div>{user.name}</div>
}
```

### ❌ Unnecessary Effects

```typescript
// ❌ Bad: Effect for derived value
const [items, setItems] = useState<Item[]>([])
const [count, setCount] = useState(0)

useEffect(() => {
  setCount(items.length)
}, [items])

// ✅ Good: Calculate directly
const count = items.length
```

## Resources

- [React 19 Documentation](https://react.dev)
- [React 19 Upgrade Guide](https://react.dev/blog/2024/12/05/react-19)
- [React Hooks Reference](https://react.dev/reference/react)
- [Patterns.dev](https://www.patterns.dev/)
