import { PrismaClient } from '@prisma/client'
import Dashboard from 'app/sections/Dashboard'
import { SidePanel } from 'app/sections/SidePanel'
import { notFound } from 'next/navigation'

interface Props {
  params: {
    id: string
  }
}

async function Strategy({ params: { id } }: Props) {
  const prisma = new PrismaClient()
  const strategy = await prisma.strategy.findUnique({
    where: {
      id,
    },
  })
  if (!strategy) {
    return notFound()
  }

  return (
    <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-4 lg:gap-6">
      <div className="min-w-0 lg:col-span-3">
        <Dashboard
          name={strategy.name}
          description={strategy.text}
          queryFromDatabase={strategy.sql}
        ></Dashboard>
      </div>
      <div className="min-w-0 self-start space-y-4 lg:sticky lg:top-6 lg:col-span-1">
        <SidePanel></SidePanel>
      </div>
    </div>
  )
}

export default Strategy
