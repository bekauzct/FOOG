-- CreateTable
CREATE TABLE "broadcasts" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "recipients" INTEGER NOT NULL DEFAULT 0,
    "tg_total" INTEGER NOT NULL DEFAULT 0,
    "tg_sent" INTEGER NOT NULL DEFAULT 0,
    "tg_failed" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'sending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ,

    CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "broadcasts_created_at_idx" ON "broadcasts"("created_at");
