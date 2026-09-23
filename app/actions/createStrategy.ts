'use server'

import { prisma } from 'app/lib/prisma'
import { isSeasonBinding } from 'app/lib/seasons'

export async function createStrategy(
  id: string,
  name: string,
  text: string,
  sql: string,
  season = 'current',
) {
  if (!isSeasonBinding(season)) throw new Error('Unknown season binding')
  const r = await prisma.strategy.create({
    data: {
      id,
      updatedAt: new Date(),
      name,
      text,
      sql,
      season,
    },
  })
  return r
}

export async function listStrategies() {
  return prisma.strategy.findMany({
    select: { id: true, name: true, season: true },
    orderBy: { updatedAt: 'desc' },
  })
}
