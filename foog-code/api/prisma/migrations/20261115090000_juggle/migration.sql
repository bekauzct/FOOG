-- CreateEnum
CREATE TYPE "JuggleStatus" AS ENUM ('processing', 'pending', 'approved', 'rejected', 'failed');

-- CreateTable
CREATE TABLE "juggle_attempts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "claimed" INTEGER NOT NULL,
    "count" INTEGER,
    "status" "JuggleStatus" NOT NULL DEFAULT 'processing',
    "code" TEXT NOT NULL,
    "video_url" TEXT,
    "poster_url" TEXT,
    "duration_sec" DOUBLE PRECISION,
    "elapsed_sec" DOUBLE PRECISION NOT NULL,
    "reject_reason" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "juggle_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "juggle_attempts_status_created_at_idx" ON "juggle_attempts"("status", "created_at");

-- CreateIndex
CREATE INDEX "juggle_attempts_user_id_created_at_idx" ON "juggle_attempts"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "juggle_attempts" ADD CONSTRAINT "juggle_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "juggle_attempts" ADD CONSTRAINT "juggle_attempts_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
