import {
    columnSizingFeature,
    tableFeatures,
    useTable,
    type ColumnDef,
    type RowData,
} from '@tanstack/react-table'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

const baseFeatures = tableFeatures({ columnSizingFeature })

export type DataTableColumn<TData extends RowData = any> = ColumnDef<typeof baseFeatures, TData>

interface DataTableProps<TData extends RowData = any> {
    columns: DataTableColumn<TData>[]
    data: TData[]
    tableKey?: string
    emptyMessage?: string
    isLoading?: boolean
}

export function DataTable<TData extends RowData = any>({
    columns,
    data,
    tableKey = 'data-table',
    emptyMessage = 'Tidak ada data.',
    isLoading = false,
}: DataTableProps<TData>) {
    const table = useTable({
        key: tableKey,
        features: baseFeatures,
        columns,
        data,
    })

    return (
        <div className="relative w-full max-w-full overflow-hidden rounded-lg border bg-card">
            {isLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
                    <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm font-medium shadow-sm">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span>Memuat data...</span>
                    </div>
                </div>
            )}

            <Table className={cn(isLoading && 'pointer-events-none opacity-60 transition-opacity')}>
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <TableHead
                                    key={header.id}
                                    style={{ width: `${header.getSize()}px` }}
                                >
                                    {header.isPlaceholder ? null : (
                                        <table.FlexRender header={header} />
                                    )}
                                </TableHead>
                            ))}
                        </TableRow>
                    ))}
                </TableHeader>

                <TableBody>
                    {table.getRowModel().rows.length > 0 ? (
                        table.getRowModel().rows.map((row) => (
                            <TableRow key={row.id}>
                                {row.getAllCells().map((cell) => (
                                    <TableCell key={cell.id}>
                                        <table.FlexRender cell={cell} />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell
                                colSpan={columns.length}
                                className="h-24 text-center text-muted-foreground"
                            >
                                {emptyMessage}
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
