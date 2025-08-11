-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "fk_reviews_shows_show_id" FOREIGN KEY ("show_id") REFERENCES "shows"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
