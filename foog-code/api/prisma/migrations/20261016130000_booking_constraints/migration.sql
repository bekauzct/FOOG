-- ERD izohi: bir maydonda bir vaqtga ikkita faol bron bo‘lmasligi uchun
-- (pitch_id, date, start_time–end_time) bo‘yicha kesishishni taqiqlovchi cheklov.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_end_after_start"
  CHECK (end_time > start_time OR end_time = '00:00'::time);

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist (
    pitch_id WITH =,
    tsrange(
      date + start_time,
      CASE WHEN end_time <= start_time THEN date + end_time + interval '1 day' ELSE date + end_time END,
      '[)'
    ) WITH &&
  ) WHERE (status IN ('pending', 'confirmed', 'arrived'));

-- likes / comments / saves: post_id yoki reel_id – faqat bittasi to‘ldiriladi
ALTER TABLE "likes" ADD CONSTRAINT "likes_one_target" CHECK (num_nonnulls(post_id, reel_id) = 1);
ALTER TABLE "comments" ADD CONSTRAINT "comments_one_target" CHECK (num_nonnulls(post_id, reel_id) = 1);
ALTER TABLE "saves" ADD CONSTRAINT "saves_one_target" CHECK (num_nonnulls(post_id, reel_id, stadium_id) = 1);

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_range" CHECK (rating BETWEEN 1 AND 5);
ALTER TABLE "schedule" ADD CONSTRAINT "schedule_weekday_range" CHECK (weekday IS NULL OR weekday BETWEEN 0 AND 6);
