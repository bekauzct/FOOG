-- CreateTable
CREATE TABLE "obyektivka_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "fish" TEXT NOT NULL DEFAULT '',
    "data" JSONB NOT NULL,
    "photo" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "obyektivka_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "obyektivka_profiles_user_id_key" ON "obyektivka_profiles"("user_id");

-- CreateIndex
CREATE INDEX "obyektivka_profiles_updated_at_idx" ON "obyektivka_profiles"("updated_at");

-- AddForeignKey
ALTER TABLE "obyektivka_profiles" ADD CONSTRAINT "obyektivka_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
