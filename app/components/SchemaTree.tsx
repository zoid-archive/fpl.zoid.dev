import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

export const SchemaTree = ({ data }: { data: Record<string, string>[] }) => {
  if (!data) {
    return <p className="py-4 text-sm text-muted-foreground">Loading schema…</p>
  }

  const structureDataTree: Record<string, string[]> = {}
  data
    .filter((d) => d.tableName && d.columnName)
    .forEach((d) => {
      structureDataTree[d.tableName] = (
        structureDataTree[d.tableName] || []
      ).concat(d.columnName)
    })

  const tableNames = Object.keys(structureDataTree)

  return (
    <Accordion
      type="multiple"
      defaultValue={tableNames.slice(0, 1)}
      className="w-full"
    >
      {tableNames.map((tableName) => {
        const columns = structureDataTree[tableName]
        return (
          <AccordionItem key={tableName} value={tableName}>
            <AccordionTrigger className="py-2 text-left text-sm font-medium hover:no-underline">
              <span className="min-w-0 truncate font-mono">{tableName}</span>
              <span className="ml-2 shrink-0 text-xs font-normal text-muted-foreground">
                {columns.length}{' '}
                {columns.length === 1 ? 'column' : 'columns'}
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <ul className="grid grid-cols-1 gap-1 font-mono text-xs text-muted-foreground sm:grid-cols-2">
                {columns.map((columnName) => (
                  <li
                    key={columnName}
                    className="truncate rounded bg-muted px-2 py-1"
                    title={columnName}
                  >
                    {columnName}
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}
