/*
  Warnings:

  - A unique constraint covering the columns `[show_id,track_ids]` on the table `segue_runs` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "segue_runs_show_id_track_ids_key" ON "segue_runs"("show_id", "track_ids");
