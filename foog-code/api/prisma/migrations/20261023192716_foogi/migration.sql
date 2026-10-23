-- CreateEnum
CREATE TYPE "FoogiAudience" AS ENUM ('all', 'guest', 'player', 'owner', 'admin');

-- CreateEnum
CREATE TYPE "FoogiQStatus" AS ENUM ('answered', 'unanswered', 'wrong', 'taught', 'dismissed');

-- CreateTable
CREATE TABLE "foogi_answers" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "questions" TEXT[],
    "keywords" TEXT[],
    "answer" TEXT NOT NULL,
    "pose" TEXT NOT NULL DEFAULT 'thumbs_up',
    "link_href" TEXT,
    "link_label" TEXT,
    "audience" "FoogiAudience" NOT NULL DEFAULT 'all',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "foogi_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foogi_questions" (
    "id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "page" TEXT,
    "user_id" UUID,
    "audience" "FoogiAudience" NOT NULL DEFAULT 'guest',
    "answer_id" UUID,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "FoogiQStatus" NOT NULL,
    "helpful" BOOLEAN,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "foogi_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foogi_tips" (
    "id" UUID NOT NULL,
    "title" TEXT,
    "text" TEXT NOT NULL,
    "pose" TEXT NOT NULL DEFAULT 'present',
    "cta_label" TEXT,
    "cta_href" TEXT,
    "audience" "FoogiAudience" NOT NULL DEFAULT 'all',
    "page" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "foogi_tips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foogi_tour_steps" (
    "id" UUID NOT NULL,
    "page" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "target" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "pose" TEXT NOT NULL DEFAULT 'present',
    "audience" "FoogiAudience" NOT NULL DEFAULT 'all',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "foogi_tour_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "foogi_answers_active_audience_idx" ON "foogi_answers"("active", "audience");

-- CreateIndex
CREATE INDEX "foogi_questions_status_created_at_idx" ON "foogi_questions"("status", "created_at");

-- CreateIndex
CREATE INDEX "foogi_questions_answer_id_idx" ON "foogi_questions"("answer_id");

-- CreateIndex
CREATE INDEX "foogi_tips_active_audience_idx" ON "foogi_tips"("active", "audience");

-- CreateIndex
CREATE INDEX "foogi_tour_steps_page_sort_idx" ON "foogi_tour_steps"("page", "sort");

-- AddForeignKey
ALTER TABLE "foogi_questions" ADD CONSTRAINT "foogi_questions_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "foogi_answers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
