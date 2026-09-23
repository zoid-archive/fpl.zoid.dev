import manifest from '../data/fpl.json'

export { manifest }
export const FPL_DB_PATH = `/assets/fpl.db?v=${manifest.revision}`
export const SQL_WASM_WASM_PATH = '/assets/sql.js/1.8.0/sql-wasm.wasm'

export function resolveSeason(binding: string) {
  return binding === 'current' ? manifest.currentSeason : binding
}

export function isSeasonBinding(binding: string) {
  return (
    binding === 'current' ||
    manifest.seasons.some((entry) => entry.season === binding)
  )
}

export function seasonLabel(season: string) {
  const entry = manifest.seasons.find((entry) => entry.season === season)
  if (!entry) return `${season} · Unavailable`
  return `${season} · ${season === manifest.currentSeason ? 'Current' : entry.status === 'completed' ? 'Completed' : 'Partial'}`
}
