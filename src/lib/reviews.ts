import { db } from "@/lib/db";

export async function refreshTeacherPublicRating(teacherId: string) {
  const [aggregate, marketplace] = await Promise.all([
    db.review.aggregate({
      where: { teacherId, published: true },
      _avg: { rating: true },
      _count: { rating: true },
    }),
    process.env.MARKETPLACE_V2_ENABLED === "true"
      ? db.marketplaceReview.aggregate({ where: { teacherId, published: true }, _avg: { rating: true }, _count: { rating: true } })
      : Promise.resolve({ _avg: { rating: null }, _count: { rating: 0 } }),
  ]);
  const count = aggregate._count.rating + marketplace._count.rating;
  const score = count > 0
    ? ((aggregate._avg.rating ?? 0) * aggregate._count.rating + (marketplace._avg.rating ?? 0) * marketplace._count.rating) / count
    : 0;

  await db.teacher.update({
    where: { id: teacherId },
    data: {
      rating: Math.round(score * 10) / 10,
      ratingCount: count,
    },
  });
}
