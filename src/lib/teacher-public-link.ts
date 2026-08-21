export function teacherPublicSharePath(teacherId: string) {
  return `/p/${encodeURIComponent(teacherId.trim())}`;
}

export function teacherPublicProfilePath(teacherId: string) {
  return `/professeurs/${encodeURIComponent(teacherId.trim())}`;
}
