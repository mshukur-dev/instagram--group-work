-- AlterEnum
ALTER TYPE "MessageType" ADD VALUE 'VOICE';

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "voiceDuration" DOUBLE PRECISION,
ADD COLUMN     "voiceWaveform" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
