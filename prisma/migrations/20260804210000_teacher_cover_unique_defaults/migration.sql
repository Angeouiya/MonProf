-- Give every existing professor without a chosen cover a stable catalogue cover.
-- The first 19 professors receive distinct covers; the catalogue then cycles evenly.
WITH cover_catalog AS (
  SELECT ARRAY[
    '/images/teacher-covers/academic-library.webp',
    '/images/teacher-covers/professional-studio.webp',
    '/images/teacher-covers/science-lab.webp',
    '/images/teacher-covers/early-reading.webp',
    '/images/teacher-covers/primary-math.webp',
    '/images/teacher-covers/children-science.webp',
    '/images/teacher-covers/language-learning.webp',
    '/images/teacher-covers/secondary-math.webp',
    '/images/teacher-covers/literature-library.webp',
    '/images/teacher-covers/robotics-learning.webp',
    '/images/teacher-covers/exam-preparation.webp',
    '/images/teacher-covers/university-research.webp',
    '/images/teacher-covers/business-english.webp',
    '/images/teacher-covers/finance-mentoring.webp',
    '/images/teacher-covers/public-speaking.webp',
    '/images/teacher-covers/data-analysis.webp',
    '/images/teacher-covers/architecture-training.webp',
    '/images/teacher-covers/culinary-training.webp',
    '/images/teacher-covers/renewable-energy.webp'
  ]::TEXT[] AS urls
), ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "createdAt", "id") - 1 AS position
  FROM "Teacher"
  WHERE "coverUrl" IS NULL OR BTRIM("coverUrl") = ''
), assigned AS (
  SELECT
    ranked."id",
    cover_catalog.urls[
      ((ranked.position % ARRAY_LENGTH(cover_catalog.urls, 1)) + 1)::INTEGER
    ] AS "coverUrl"
  FROM ranked
  CROSS JOIN cover_catalog
)
UPDATE "Teacher" AS teacher
SET "coverUrl" = assigned."coverUrl"
FROM assigned
WHERE teacher."id" = assigned."id";
