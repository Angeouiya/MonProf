import { db } from "@/lib/db";

export async function refreshTeacherPublicRating(teacherId: string) {
  const aggregate = await db.review.aggregate({
    where: { teacherId, published: true },
    _avg: { rating: true },
    _count: { rating: true },
  });

  await db.teacher.update({
    where: { id: teacherId },
    data: {
      rating: Math.round((aggregate._avg.rating ?? 0) * 10) / 10,
      ratingCount: aggregate._count.rating,
    },
  });
}
