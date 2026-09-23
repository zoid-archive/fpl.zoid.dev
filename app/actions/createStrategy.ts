'use server'

import { prisma } from "app/lib/prisma"

export async function createStrategy(id: string, name: string, text: string, sql: string) {
    const r = await prisma.strategy.create({
        data: {
            id,
            updatedAt: new Date(),
            name,
            text,
            sql,
        },
    })
    return r
}