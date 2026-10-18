-- CreateEnum
CREATE TYPE "TeamStatus" AS ENUM ('active', 'frozen');

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('team_create', 'team_monthly');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('awaiting', 'review', 'approved', 'fraud', 'cancelled');

-- CreateEnum
CREATE TYPE "MethodStatus" AS ENUM ('on', 'msg', 'off');

-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "member_limit" INTEGER,
ADD COLUMN     "paid_until" TIMESTAMPTZ,
ADD COLUMN     "status" "TeamStatus" NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "fraud_streak" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "badge" TEXT,
    "color" TEXT,
    "status" "MethodStatus" NOT NULL DEFAULT 'off',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_cards" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "holder" TEXT NOT NULL,
    "bank" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "team_id" UUID,
    "purpose" "PaymentPurpose" NOT NULL,
    "amount" INTEGER NOT NULL,
    "method_id" UUID,
    "card_id" UUID,
    "status" "PaymentStatus" NOT NULL DEFAULT 'awaiting',
    "team_draft" JSONB,
    "receipt_path" TEXT,
    "submitted_at" TIMESTAMPTZ,
    "decided_by_id" UUID,
    "decided_via" TEXT,
    "decided_at" TIMESTAMPTZ,
    "bot_messages" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_blocks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMPTZ NOT NULL,
    "lifted_at" TIMESTAMPTZ,
    "lifted_by_id" UUID,

    CONSTRAINT "payment_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_code_key" ON "payment_methods"("code");

-- CreateIndex
CREATE UNIQUE INDEX "payments_code_key" ON "payments"("code");

-- CreateIndex
CREATE INDEX "payments_status_submitted_at_idx" ON "payments"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "payments_user_id_created_at_idx" ON "payments"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "payments_team_id_idx" ON "payments"("team_id");

-- CreateIndex
CREATE INDEX "payment_blocks_user_id_ends_at_idx" ON "payment_blocks"("user_id", "ends_at");

-- CreateIndex
CREATE INDEX "bookings_user_id_date_idx" ON "bookings"("user_id", "date");

-- CreateIndex
CREATE INDEX "chat_members_user_id_idx" ON "chat_members"("user_id");

-- CreateIndex
CREATE INDEX "comments_post_id_created_at_idx" ON "comments"("post_id", "created_at");

-- CreateIndex
CREATE INDEX "comments_reel_id_created_at_idx" ON "comments"("reel_id", "created_at");

-- CreateIndex
CREATE INDEX "follows_following_id_idx" ON "follows"("following_id");

-- CreateIndex
CREATE INDEX "match_players_user_id_idx" ON "match_players"("user_id");

-- CreateIndex
CREATE INDEX "matches_status_idx" ON "matches"("status");

-- CreateIndex
CREATE INDEX "matches_organizer_id_idx" ON "matches"("organizer_id");

-- CreateIndex
CREATE INDEX "pitches_stadium_id_idx" ON "pitches"("stadium_id");

-- CreateIndex
CREATE INDEX "posts_author_id_created_at_idx" ON "posts"("author_id", "created_at");

-- CreateIndex
CREATE INDEX "reels_author_id_created_at_idx" ON "reels"("author_id", "created_at");

-- CreateIndex
CREATE INDEX "reviews_stadium_id_created_at_idx" ON "reviews"("stadium_id", "created_at");

-- CreateIndex
CREATE INDEX "stadium_photos_stadium_id_idx" ON "stadium_photos"("stadium_id");

-- CreateIndex
CREATE INDEX "stadium_staff_user_id_idx" ON "stadium_staff"("user_id");

-- CreateIndex
CREATE INDEX "stadiums_status_idx" ON "stadiums"("status");

-- CreateIndex
CREATE INDEX "stadiums_owner_id_idx" ON "stadiums"("owner_id");

-- CreateIndex
CREATE INDEX "team_members_user_id_idx" ON "team_members"("user_id");

-- CreateIndex
CREATE INDEX "teams_captain_id_idx" ON "teams"("captain_id");

-- CreateIndex
CREATE INDEX "teams_status_idx" ON "teams"("status");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_method_id_fkey" FOREIGN KEY ("method_id") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "payment_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_blocks" ADD CONSTRAINT "payment_blocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_blocks" ADD CONSTRAINT "payment_blocks_lifted_by_id_fkey" FOREIGN KEY ("lifted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- To‘lov raqami: PAY-20001, PAY-20002, …
CREATE SEQUENCE IF NOT EXISTS "payment_code_seq" START 20001;

-- Boshlang‘ich tarif (admin keyin o‘zgartiradi)
INSERT INTO "settings" ("key", "value", "updated_at") VALUES
  ('team.createPrice', '150000', now()),
  ('team.monthlyPrice', '50000', now()),
  ('team.memberLimit', '15', now()),
  ('payment.instruction', to_jsonb('1. Karta raqamini nusxa oling.' || chr(10) || '2. Bank ilovangizdan aynan ko‘rsatilgan summani o‘tkazing.' || chr(10) || '3. O‘tkazma chekining skrinshotini shu yerga yuklang.' || chr(10) || '4. Admin 15 daqiqadan 2 soatgacha tekshiradi.'::text), now())
ON CONFLICT ("key") DO NOTHING;

-- To‘lov usullari: Click va Payme hozircha «xizmat xabari» rejimida, karta – qo‘lda tekshiruv
INSERT INTO "payment_methods" ("id", "code", "provider", "name", "description", "badge", "color", "status", "sort") VALUES
  (gen_random_uuid(), 'click', 'click', 'Click', 'Avtomatik to‘lov', 'C', '#0BA5EC', 'msg', 1),
  (gen_random_uuid(), 'payme', 'payme', 'Payme', 'Avtomatik to‘lov', 'P', '#18B5A4', 'msg', 2),
  (gen_random_uuid(), 'card', 'card', 'Bank kartasi', 'Kartaga o‘tkazma va chek yuborish · admin tekshiradi', 'K', '#3B4253', 'on', 3),
  (gen_random_uuid(), 'uzum', 'uzum', 'Uzum', 'Tez kunda', 'U', '#7B3FE4', 'off', 4),
  (gen_random_uuid(), 'payeer', 'payeer', 'Payeer', 'Tez kunda', 'Py', '#2F6FD6', 'off', 5)
ON CONFLICT ("code") DO NOTHING;
