import { NextResponse } from "next/server";
import {
  CLIENT_TYPES,
  COURSE_CATALOG,
  COURSE_CATEGORIES,
  SCHOOL_SYSTEMS,
  LYCEE_LEVEL_OPTIONS,
} from "@/lib/course-catalog";

export async function GET() {
  const groups = COURSE_CATEGORIES.map((category) => ({
    ...category,
    items: COURSE_CATALOG.filter((item) => item.categorie === category.code),
  }));

  return NextResponse.json({
    clientTypes: CLIENT_TYPES,
    categories: COURSE_CATEGORIES,
    schoolSystems: SCHOOL_SYSTEMS,
    lyceeLevelOptions: LYCEE_LEVEL_OPTIONS,
    items: COURSE_CATALOG,
    groups,
  });
}
