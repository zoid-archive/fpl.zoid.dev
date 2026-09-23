import Workspace from 'app/sections/Workspace'
import { notFound } from 'next/navigation'

import { prisma } from 'app/lib/prisma'

interface Props {
  params: Promise<{
    id: string
  }>
}

async function Strategy({ params }: Props) {
  const { id } = await params
  const strategy = await prisma.strategy.findUnique({
    where: {
      id,
    },
  })
  if (!strategy) {
    return notFound()
  }

  return (
    <Workspace
      key={strategy.id}
      name={strategy.name}
      description={strategy.text}
      queryFromDatabase={strategy.sql}
      seasonBinding={strategy.season}
    />
  )
}

export default Strategy
