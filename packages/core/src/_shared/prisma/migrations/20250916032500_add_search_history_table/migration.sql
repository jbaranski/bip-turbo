-- Drop the old search_indexes table
DROP TABLE IF EXISTS "search_indexes";

-- Create the new search_histories table
CREATE TABLE "search_histories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "search_query" TEXT NOT NULL,
    "result_count" INTEGER NOT NULL DEFAULT 0,
    "search_type" TEXT NOT NULL,
    "sentiment" TEXT,
    "feedback_message" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT NOW(),

    CONSTRAINT "search_histories_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "idx_search_histories_query" ON "search_histories"("search_query");
CREATE INDEX "idx_search_histories_created_at" ON "search_histories"("created_at");
CREATE INDEX "idx_search_histories_type" ON "search_histories"("search_type");