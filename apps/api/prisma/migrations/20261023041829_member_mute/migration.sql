-- AlterTable
ALTER TABLE "conversation_members" ADD COLUMN     "mutedCalls" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mutedMessages" BOOLEAN NOT NULL DEFAULT false;
