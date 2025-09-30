# 📊 Data Tables & Lists Pattern

## Overview
Build powerful, sortable, filterable data tables and lists using Tanstack Table (React Table v8) with ShadCN components.

## Quick Links
- → [Tanstack Table](https://tanstack.com/table/v8)
- → [ShadCN Data Table](https://ui.shadcn.com/docs/components/data-table)
- → [Virtualization](https://tanstack.com/virtual/v3)
- → [Pagination Patterns](#pagination)

## Core Pattern

### Basic Data Table

```typescript
// ✅ GOOD: Full-featured data table
"use client";

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, ArrowUpDown } from "lucide-react";
import { useState } from "react";

// Define your data type
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "inactive";
  createdAt: Date;
}

// Define columns
export const columns: ColumnDef<User>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8">
          <AvatarImage src={`/avatars/${row.original.id}.jpg`} />
          <AvatarFallback>
            {row.getValue("name").split(" ").map(n => n[0]).join("")}
          </AvatarFallback>
        </Avatar>
        <span className="font-medium">{row.getValue("name")}</span>
      </div>
    ),
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => (
      <a href={`mailto:${row.getValue("email")}`} className="text-blue-600 hover:underline">
        {row.getValue("email")}
      </a>
    ),
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => {
      const role = row.getValue("role") as string;
      return (
        <Badge variant={role === "admin" ? "default" : "secondary"}>
          {role}
        </Badge>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${
            status === "active" ? "bg-green-500" : "bg-gray-300"
          }`} />
          <span className="capitalize">{status}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => {
      return formatDate(row.getValue("createdAt"));
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const user = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(user.id)}>
              Copy user ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>View details</DropdownMenuItem>
            <DropdownMenuItem>Edit user</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">
              Delete user
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

// Main DataTable component
export function DataTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
  });

  return (
    <div className="w-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search all columns..."
            value={globalFilter ?? ""}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="max-w-sm"
          />
          {table.getFilteredSelectedRowModel().rows.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {table.getFilteredSelectedRowModel().rows.length} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Bulk action logic
                }}
              >
                Delete Selected
              </Button>
            </div>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              Columns <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
```

## Advanced Patterns

### 1. Server-Side Pagination & Filtering

```typescript
// ✅ GOOD: Server-side data handling
"use client";

import { useQuery } from "@tanstack/react-query";
import { PaginationState, SortingState } from "@tanstack/react-table";

interface FetchDataOptions {
  pageIndex: number;
  pageSize: number;
  sorting: SortingState;
  filters: any;
}

async function fetchTableData({
  pageIndex,
  pageSize,
  sorting,
  filters,
}: FetchDataOptions) {
  const params = new URLSearchParams({
    page: String(pageIndex + 1),
    limit: String(pageSize),
    sortBy: sorting[0]?.id || "createdAt",
    sortOrder: sorting[0]?.desc ? "desc" : "asc",
    ...filters,
  });

  const response = await fetch(`/api/users?${params}`);
  const data = await response.json();

  return {
    rows: data.items,
    pageCount: Math.ceil(data.total / pageSize),
    total: data.total,
  };
}

export function ServerSideTable() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filters, setFilters] = useState({});

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["users", pagination, sorting, filters],
    queryFn: () => fetchTableData({
      pageIndex: pagination.pageIndex,
      pageSize: pagination.pageSize,
      sorting,
      filters,
    }),
    keepPreviousData: true,
  });

  const table = useReactTable({
    data: data?.rows ?? [],
    columns,
    pageCount: data?.pageCount ?? -1,
    state: {
      pagination,
      sorting,
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
  });

  if (isLoading) {
    return <TableSkeleton />;
  }

  return (
    <div className="relative">
      {isFetching && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}
      <DataTable table={table} />
    </div>
  );
}
```

### 2. Virtualized Large Lists

```typescript
// ✅ GOOD: Virtual scrolling for large datasets
"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

interface VirtualListProps {
  items: any[];
  height?: number;
  itemHeight?: number;
}

export function VirtualList({
  items,
  height = 600,
  itemHeight = 50
}: VirtualListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan: 5,
  });

  return (
    <div
      ref={parentRef}
      className="h-[600px] overflow-auto border rounded-lg"
      style={{ height }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.index}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <ListItem item={items[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ListItem({ item }: { item: any }) {
  return (
    <div className="flex items-center justify-between p-3 border-b hover:bg-muted/50">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback>{item.name[0]}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{item.name}</p>
          <p className="text-sm text-muted-foreground">{item.email}</p>
        </div>
      </div>
      <Button variant="ghost" size="sm">
        View
      </Button>
    </div>
  );
}
```

### 3. Expandable Rows

```typescript
// ✅ GOOD: Table with expandable row details
export function ExpandableTable() {
  const columns: ColumnDef<Order>[] = [
    {
      id: "expander",
      header: () => null,
      cell: ({ row }) => {
        return row.getCanExpand() ? (
          <button
            onClick={row.getToggleExpandedHandler()}
            className="cursor-pointer"
          >
            {row.getIsExpanded() ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : null;
      },
    },
    // ... other columns
  ];

  const table = useReactTable({
    data,
    columns,
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Table>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <React.Fragment key={row.id}>
            <TableRow>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
            {row.getIsExpanded() && (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <div className="p-4 bg-muted/50">
                    <OrderDetails order={row.original} />
                  </div>
                </TableCell>
              </TableRow>
            )}
          </React.Fragment>
        ))}
      </TableBody>
    </Table>
  );
}
```

### 4. Inline Editing

```typescript
// ✅ GOOD: Editable cells in table
const editableColumns: ColumnDef<Product>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row, column, table }) => {
      const initialValue = row.getValue("name");
      const [value, setValue] = useState(initialValue);
      const [isEditing, setIsEditing] = useState(false);

      const onBlur = () => {
        table.options.meta?.updateData(row.index, column.id, value);
        setIsEditing(false);
      };

      if (isEditing) {
        return (
          <Input
            value={value as string}
            onChange={(e) => setValue(e.target.value)}
            onBlur={onBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") onBlur();
              if (e.key === "Escape") {
                setValue(initialValue);
                setIsEditing(false);
              }
            }}
            autoFocus
          />
        );
      }

      return (
        <div
          className="cursor-pointer hover:bg-muted p-2 -m-2"
          onClick={() => setIsEditing(true)}
        >
          {value as string}
        </div>
      );
    },
  },
  {
    accessorKey: "price",
    header: "Price",
    cell: EditableNumberCell,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row, column, table }) => {
      const value = row.getValue("status") as string;

      return (
        <Select
          value={value}
          onValueChange={(newValue) => {
            table.options.meta?.updateData(row.index, column.id, newValue);
          }}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      );
    },
  },
];
```

### 5. Advanced Filtering

```typescript
// ✅ GOOD: Multi-faceted filtering
export function AdvancedFilters({ table }) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const statusOptions = ["active", "inactive", "pending"];
  const roleOptions = ["admin", "user", "guest"];

  return (
    <div className="flex flex-wrap gap-2 p-4 border rounded-lg">
      {/* Search */}
      <Input
        placeholder="Search..."
        value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
        onChange={(event) =>
          table.getColumn("name")?.setFilterValue(event.target.value)
        }
        className="max-w-sm"
      />

      {/* Status Filter */}
      <Select
        value={(table.getColumn("status")?.getFilterValue() as string) ?? ""}
        onValueChange={(value) =>
          table.getColumn("status")?.setFilterValue(value || undefined)
        }
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All</SelectItem>
          {statusOptions.map((status) => (
            <SelectItem key={status} value={status}>
              {status}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Date Range */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="justify-start">
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, "LLL dd, y")} -{" "}
                  {format(dateRange.to, "LLL dd, y")}
                </>
              ) : (
                format(dateRange.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={dateRange}
            onSelect={setDateRange}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>

      {/* Clear Filters */}
      <Button
        variant="ghost"
        onClick={() => table.resetColumnFilters()}
        className="ml-auto"
      >
        Clear Filters
      </Button>
    </div>
  );
}
```

## List Variations

### 1. Card Grid View

```typescript
// ✅ GOOD: Toggle between table and card view
export function DataView() {
  const [view, setView] = useState<"table" | "grid">("table");

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h2 className="text-2xl font-bold">Products</h2>
        <ToggleGroup value={view} onValueChange={(v) => v && setView(v as any)}>
          <ToggleGroupItem value="table">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="grid">
            <Grid className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {view === "table" ? (
        <DataTable data={data} columns={columns} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle>{item.name}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">Status:</span> {item.status}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Price:</span> ${item.price}
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm" className="w-full">
                  View Details
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 2. Grouped List

```typescript
// ✅ GOOD: List with grouped items
export function GroupedList({ items }: { items: Task[] }) {
  const grouped = items.reduce((acc, item) => {
    const key = item.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, Task[]>);

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([category, tasks]) => (
        <div key={category}>
          <div className="sticky top-0 bg-background z-10 pb-2 mb-2 border-b">
            <h3 className="font-semibold text-lg flex items-center justify-between">
              {category}
              <Badge variant="secondary">{tasks.length}</Badge>
            </h3>
          </div>
          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <Checkbox />
                  <div>
                    <p className="font-medium">{task.title}</p>
                    <p className="text-sm text-muted-foreground">
                      Due: {formatDate(task.dueDate)}
                    </p>
                  </div>
                </div>
                <Badge>{task.priority}</Badge>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

## Performance Optimization

### 1. Memoized Columns

```typescript
// ✅ GOOD: Prevent unnecessary re-renders
const columns = useMemo<ColumnDef<User>[]>(
  () => [
    // Column definitions
  ],
  []
);
```

### 2. Lazy Load Data

```typescript
// ✅ GOOD: Load data on demand
export function LazyTable() {
  const [data, setData] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const observerRef = useRef<IntersectionObserver>();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading) {
          loadMoreData();
        }
      },
      { threshold: 1.0 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [isLoading]);

  async function loadMoreData() {
    setIsLoading(true);
    const newData = await fetchMoreData();
    setData((prev) => [...prev, ...newData]);
    setIsLoading(false);
  }

  return (
    <>
      <DataTable data={data} columns={columns} />
      <div ref={loadMoreRef} className="h-10" />
      {isLoading && <Loader />}
    </>
  );
}
```

## Best Practices

### ✅ DO's
1. **Implement virtualization** for large datasets (>1000 rows)
2. **Add loading states** during data fetches
3. **Provide bulk actions** for selected rows
4. **Include empty states** with clear CTAs
5. **Make columns resizable** and reorderable when useful

### ❌ DON'Ts
1. **Don't load all data** at once for large sets
2. **Don't forget accessibility** (keyboard navigation, ARIA)
3. **Don't auto-refresh** without user control
4. **Don't hide important actions** in menus
5. **Don't forget mobile** responsive design

## Export & Import

```typescript
// ✅ GOOD: Export table data
export function ExportButton({ table }) {
  const exportToCSV = () => {
    const rows = table.getFilteredRowModel().rows;
    const csv = [
      // Headers
      table.getHeaderGroups()[0].headers.map(h => h.column.id).join(","),
      // Data
      ...rows.map(row =>
        row.getVisibleCells().map(cell => cell.getValue()).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "export.csv";
    a.click();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={exportToCSV}>
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToExcel}>
          Export as Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToPDF}>
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

## Testing Tables

```typescript
describe("DataTable", () => {
  it("should sort by column", async () => {
    render(<DataTable data={mockData} columns={columns} />);

    const nameHeader = screen.getByText("Name");
    await userEvent.click(nameHeader);

    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Alice");
    expect(rows[2]).toHaveTextContent("Bob");
  });

  it("should filter results", async () => {
    render(<DataTable data={mockData} columns={columns} />);

    const searchInput = screen.getByPlaceholder("Search...");
    await userEvent.type(searchInput, "admin");

    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(2); // Header + 1 result
  });
});
```

## Related Patterns
- 🔗 [Loading States](./loading-states.md)
- 🔗 [Pagination](./pagination.md)
- 🔗 [Forms & Validation](./forms-validation.md)
- 🔗 [Real-time Updates](../data-management/real-time.md)

---

*Well-designed data tables are crucial for managing and displaying large amounts of information. Focus on performance, usability, and clear visual hierarchy.*