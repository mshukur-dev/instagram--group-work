-- CreateEnum
CREATE TYPE "LiveStatus" AS ENUM ('LIVE', 'ENDED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'LIVE_STARTED';

-- CreateTable
CREATE TABLE "live_streams" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "roomName" TEXT NOT NULL,
    "status" "LiveStatus" NOT NULL DEFAULT 'LIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "hostLeftAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_streams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "live_streams_roomName_key" ON "live_streams"("roomName");

-- CreateIndex
CREATE INDEX "live_streams_hostId_status_idx" ON "live_streams"("hostId", "status");

-- CreateIndex
CREATE INDEX "live_streams_status_hostLeftAt_idx" ON "live_streams"("status", "hostLeftAt");

-- AddForeignKey
ALTER TABLE "live_streams" ADD CONSTRAINT "live_streams_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
