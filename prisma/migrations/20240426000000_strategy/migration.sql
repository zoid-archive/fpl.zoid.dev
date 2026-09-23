-- Baseline of the Strategy table that predates Prisma migration tracking.
CREATE TABLE "Strategy" (
  "id" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "name" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "sql" TEXT NOT NULL,
  CONSTRAINT "Strategy_pkey" PRIMARY KEY ("id")
);
