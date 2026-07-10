import { getReschedulePolicy } from "@/lib/reschedule-policy";

export const TEACHER_UNAVAILABILITY_NOTICE_HOURS = 24;

type TeacherMissionSchedule = {
  scheduledDate?: Date | string | null;
  startDate?: Date | string | null;
  scheduledTime?: string | null;
  preferredTime?: string | null;
};

export function getTeacherMissionTiming(booking: TeacherMissionSchedule, now = new Date()) {
  const policy = getReschedulePolicy({
    scheduledDate: booking.scheduledDate ?? booking.startDate,
    scheduledTime: booking.scheduledTime || booking.preferredTime,
  }, now);
  const hoursBeforeCourse = policy.hoursBeforeCourse;

  return {
    hoursBeforeCourse,
    within24Hours: hoursBeforeCourse !== null && hoursBeforeCourse > 0 && hoursBeforeCourse < TEACHER_UNAVAILABILITY_NOTICE_HOURS,
    courseStarted: hoursBeforeCourse !== null && hoursBeforeCourse <= 0,
    ordinaryUnavailabilityAllowed: hoursBeforeCourse === null || hoursBeforeCourse >= TEACHER_UNAVAILABILITY_NOTICE_HOURS,
  };
}
