import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface ResuleSetProps {
  data: Record<string, unknown>[]
}

const isNumeric = (value: unknown): boolean => {
  if (typeof value === 'number') {
    return Number.isFinite(value)
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return Number.isFinite(Number(value))
  }
  return false
}

const formatColumnName = (column: string) => column.replace(/_/g, ' ')

export const ResultSet = ({ data }: ResuleSetProps) => {
  if (!data || data.length === 0) {
    return null
  }

  const columns = Object.keys(data[0])
  const numericColumns = new Set(
    columns.filter((column) => data.every((row) => isNumeric(row[column]))),
  )
  const alignmentFor = (column: string) =>
    numericColumns.has(column) ? 'text-right' : ''

  return (
    <div className="max-h-[65vh] overflow-auto rounded-md border">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background">
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => {
              return (
                <TableHead
                  key={column}
                  className={`whitespace-nowrap text-xs font-semibold uppercase tracking-wider ${alignmentFor(
                    column,
                  )}`}
                >
                  {formatColumnName(column)}
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => {
            return (
              <TableRow key={index}>
                {columns.map((column) => {
                  const value = row[column]
                  return (
                    <TableCell
                      key={column}
                      className={`whitespace-nowrap tabular-nums ${alignmentFor(
                        column,
                      )}`}
                    >
                      {value === null || value === undefined
                        ? '—'
                        : String(value)}
                    </TableCell>
                  )
                })}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
