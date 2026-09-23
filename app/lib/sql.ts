import { format } from 'sql-formatter'
import { QueryExecResult, SqlValue } from 'sql.js'
import { Effect } from 'effect'

export function formatQuery(query: string) {
  const program = Effect.try({
    try: () =>
      format(query, {
        language: 'postgresql',
        keywordCase: 'upper',
      }),
    catch: (e) => {
      console.error(`Failed to format SQL`)
      console.error(e)
      return query
    },
  })
  return program
}

export function getRowDataFromResultSet(
  columns: string[],
  result: QueryExecResult[],
) {
  const data = result?.[0]?.values.map((row: SqlValue[]) => {
    return row.reduce((acc, rowValue: SqlValue, index) => {
      const currentColumnName = columns?.[index]

      return {
        ...acc,
        [`${currentColumnName}`]: rowValue,
      }
    }, {})
  })
  return data
}

export function getDefaultQuery() {
  return `SELECT
	printf('%s %s (%s)', first_name, second_name, element_type) AS name,
	total_points,
	minutes,
	now_cost AS price,
	influence,
	threat,
	creativity
FROM
	players
WHERE
	element_type = 'GK'
ORDER BY
	CAST(total_points AS INTEGER)
	DESC,
	CAST(minutes AS INTEGER)
	DESC
LIMIT 20`
}

export function getAllColumns() {
  return `
  SELECT
    m.name AS tableName,
    p.name AS columnName
  FROM
    sqlite_master m
    LEFT OUTER JOIN pragma_table_info((m.name)) p ON m.name <> p.name
  WHERE
    m.type IN ('table', 'view') AND m.name NOT LIKE 'sqlite_%'
  ORDER BY
    CASE m.name WHEN 'players' THEN 0 WHEN 'player_seasons' THEN 1 ELSE 2 END,
    tableName,
    columnName;
      `
}
