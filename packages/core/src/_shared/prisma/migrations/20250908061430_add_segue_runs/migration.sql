-- DropIndex
DROP INDEX "idx_songs_search_text_trgm";

-- DropIndex
DROP INDEX "idx_songs_search_vector";

-- DropIndex
DROP INDEX "idx_venues_search_text_trgm";

-- DropIndex
DROP INDEX "idx_venues_search_vector";

-- CreateTable
CREATE TABLE "segue_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "show_id" UUID NOT NULL,
    "set" VARCHAR NOT NULL,
    "track_ids" UUID[],
    "sequence" TEXT NOT NULL,
    "length" INTEGER NOT NULL,
    "search_text" TEXT,
    "search_vector" tsvector,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "segue_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "segue_runs_show_id_idx" ON "segue_runs"("show_id");

-- CreateIndex
CREATE INDEX "segue_runs_set_idx" ON "segue_runs"("set");

-- AddForeignKey
ALTER TABLE "segue_runs" ADD CONSTRAINT "fk_segue_runs_shows_show_id" FOREIGN KEY ("show_id") REFERENCES "shows"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
