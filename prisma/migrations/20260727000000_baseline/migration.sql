-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CLIENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "AdminTeamRole" AS ENUM ('OWNER', 'SUPER_ADMIN', 'OPERATIONS', 'FINANCE', 'SUPPORT', 'QUALITY', 'CONTENT', 'OBSERVER');

-- CreateEnum
CREATE TYPE "AdminAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "CommuneTransportClass" AS ENUM ('GRAND_ABIDJAN', 'PERI_URBAN', 'INTERIOR');

-- CreateEnum
CREATE TYPE "TeacherStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING', 'TEMPORARILY_SUSPENDED', 'PERMANENTLY_SUSPENDED', 'OBSERVATION', 'REPLACEABLE', 'PRIORITY', 'BLACKLISTED');

-- CreateEnum
CREATE TYPE "TeacherProfileType" AS ENUM ('ENSEIGNANT', 'ETUDIANT', 'REPETITEUR', 'FORMATEUR', 'PROFESSIONNEL');

-- CreateEnum
CREATE TYPE "PricingTier" AS ENUM ('STANDARD', 'RECOMMENDED', 'PREMIUM', 'PROMOTIONAL');

-- CreateEnum
CREATE TYPE "BookingSessionStatus" AS ENUM ('PLANNED', 'TEACHER_CONFIRMED', 'IN_PROGRESS', 'AWAITING_CLIENT_CONFIRMATION', 'RELEASED', 'PARTIALLY_PAID', 'PAID', 'RESCHEDULE_PROPOSED', 'REPLACEMENT_PROPOSED', 'NEEDS_REPLACEMENT', 'DISPUTED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "CourseFormat" AS ENUM ('HOME', 'ONLINE');

-- CreateEnum
CREATE TYPE "GroupType" AS ENUM ('INDIVIDUAL', 'SMALL_GROUP');

-- CreateEnum
CREATE TYPE "PackType" AS ENUM ('SINGLE', 'PACK_4', 'PACK_8', 'PACK_12', 'EXAM_PREP', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'PENDING_ADMIN_VALIDATION', 'CONFIRMED', 'ASSIGNED', 'IN_PROGRESS', 'COURSE_DONE', 'PENDING_CLIENT_VALIDATION', 'VALIDATED_BY_CLIENT', 'PAYMENT_TO_RELEASE', 'TEACHER_PAID', 'DISPUTED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('FAILED', 'RECEIVED', 'BLOCKED', 'VALIDATED', 'TO_PAY_TEACHER', 'TEACHER_PAID', 'DISPUTED', 'REFUND_PENDING', 'PARTIAL_REFUND_PENDING', 'REFUNDED', 'PARTIALLY_REFUNDED', 'RETAINED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('WAVE', 'ORANGE_MONEY', 'MTN_MONEY', 'MOOV_MONEY', 'CARD');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('CLIENT_PAYMENT', 'RESCHEDULE_FEE', 'TEACHER_PAYOUT', 'REFUND', 'COMMISSION');

-- CreateEnum
CREATE TYPE "ReviewAdminStatus" AS ENUM ('NEW', 'TO_REVIEW', 'CONTACT_CLIENT', 'CONTACT_TEACHER', 'WARNING_SENT', 'RESOLVED', 'ESCALATED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED', 'REFUNDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CommunicationAudience" AS ENUM ('ONE_CLIENT', 'ONE_TEACHER', 'ALL_CLIENTS', 'ALL_TEACHERS', 'ALL_USERS');

-- CreateEnum
CREATE TYPE "CommunicationCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'PARTIAL', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationRecipientType" AS ENUM ('CLIENT', 'TEACHER', 'ADMIN');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('INTERNAL', 'SMS', 'WHATSAPP', 'EMAIL', 'BROWSER', 'PWA', 'MANUAL_CALL', 'PRIVATE_LINK');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('CREATED', 'SENT', 'FAILED', 'SEEN', 'CONFIRMED', 'EXPIRED', 'RELAUNCHED');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('NORMAL', 'IMPORTANT', 'URGENT', 'CRITICAL');

-- CreateEnum
CREATE TYPE "WebPushOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'PARTIAL', 'NO_SUBSCRIPTION', 'FAILED', 'DEAD');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('DRAFT', 'PENDING', 'SENT', 'FAILED', 'READ', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "TeacherMissionStatus" AS ENUM ('PENDING_CONFIRMATION', 'RELAUNCHED', 'CONFIRMED', 'UNAVAILABLE', 'PROBLEM_REPORTED', 'RESCHEDULE_PROPOSED', 'EXPIRED', 'REPLACEMENT_RECOMMENDED');

-- CreateEnum
CREATE TYPE "ScheduleProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RescheduleRequestActor" AS ENUM ('CLIENT', 'TEACHER', 'ADMIN');

-- CreateEnum
CREATE TYPE "RescheduleRequestStatus" AS ENUM ('PAYMENT_PENDING', 'PAYMENT_FAILED', 'AWAITING_TEACHER', 'APPLIED', 'TEACHER_REJECTED', 'CANCELLED', 'REFUND_REQUIRED');

-- CreateEnum
CREATE TYPE "TeacherTaskType" AS ENUM ('CONTACT_CLIENT', 'CONFIRM_AVAILABILITY', 'GO_TO_COURSE', 'SEND_ONLINE_LINK', 'TEACH_COURSE', 'REPORT_COURSE_DONE', 'JUSTIFY_DELAY', 'ANSWER_DISPUTE', 'SEND_DOCUMENT', 'CONFIRM_RESCHEDULE', 'CONTACT_ADMIN', 'ADMIN_ACTION');

-- CreateEnum
CREATE TYPE "TeacherTaskStatus" AS ENUM ('TODO', 'SENT_TO_TEACHER', 'SEEN_BY_TEACHER', 'CONFIRMED', 'IN_PROGRESS', 'DONE', 'LATE', 'NOT_DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TeacherTaskPriority" AS ENUM ('NORMAL', 'IMPORTANT', 'URGENT', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TeacherAdminMessageSender" AS ENUM ('TEACHER', 'ADMIN');

-- CreateEnum
CREATE TYPE "TeacherAdminMessageStatus" AS ENUM ('OPEN', 'WAITING_ADMIN', 'WAITING_TEACHER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TeacherWarningLevel" AS ENUM ('SIMPLE_REMINDER', 'OFFICIAL_WARNING', 'FINAL_WARNING', 'SUSPENSION_WARNING');

-- CreateEnum
CREATE TYPE "TeacherWarningReason" AS ENUM ('LATE_TO_COURSE', 'UNJUSTIFIED_ABSENCE', 'POOR_COURSE_QUALITY', 'BAD_CLIENT_COMMUNICATION', 'SCHEDULE_NOT_RESPECTED', 'REPEATED_CANCELLATION', 'DIRECT_CONTACT_OUTSIDE_PLATFORM', 'UNPROFESSIONAL_BEHAVIOR', 'CLIENT_COMPLAINT', 'UNJUSTIFIED_REFUSAL', 'LACK_OF_AVAILABILITY', 'ADMIN_INSTRUCTIONS_NOT_RESPECTED', 'OTHER');

-- CreateEnum
CREATE TYPE "TeacherSanctionType" AS ENUM ('LIGHT', 'MEDIUM', 'FINANCIAL', 'STRONG');

-- CreateEnum
CREATE TYPE "TeacherSanctionStatus" AS ENUM ('PENDING_VALIDATION', 'APPLIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TeacherReplacementReason" AS ENUM ('UNAVAILABLE', 'LATE', 'ABSENT', 'CLIENT_REQUEST', 'QUALITY_ISSUE', 'ASSIGNMENT_ERROR', 'TEACHER_SUSPENDED', 'BETTER_MATCH', 'OTHER');

-- CreateEnum
CREATE TYPE "TeacherReplacementStatus" AS ENUM ('DRAFT', 'APPLIED', 'CANCELLED', 'CLIENT_NOTIFIED', 'TEACHERS_NOTIFIED');

-- CreateEnum
CREATE TYPE "ClientCommunicationType" AS ENUM ('INFORMATION', 'REMINDER', 'WARNING', 'TEACHER_CHANGE', 'RESCHEDULE', 'PAYMENT', 'DISPUTE', 'COURSE_CONFIRMATION');

-- CreateEnum
CREATE TYPE "ClientRefundRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TeacherPaymentAdjustmentStatus" AS ENUM ('PENDING', 'APPLIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TeacherPayoutRecordStatus" AS ENUM ('DRAFT', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TeacherPayoutRequestStatus" AS ENUM ('PENDING', 'PAID', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CLIENT',
    "commune" TEXT,
    "quartier" TEXT,
    "avatarUrl" TEXT,
    "adminTeamRole" "AdminTeamRole",
    "adminAccountStatus" "AdminAccountStatus",
    "adminPermissions" JSONB,
    "adminAccessEnabled" BOOLEAN NOT NULL DEFAULT true,
    "adminLastLoginAt" TIMESTAMP(3),
    "adminPasswordChangedAt" TIMESTAMP(3),
    "adminCreatedById" TEXT,
    "adminSuspendedAt" TIMESTAMP(3),
    "adminSuspensionReason" TEXT,
    "adminDeletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Level" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Level_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commune" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "zone" TEXT,
    "countryCode" TEXT NOT NULL DEFAULT 'CI',
    "transportClass" "CommuneTransportClass" NOT NULL DEFAULT 'INTERIOR',
    "transportFeeOverride" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Commune_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommuneQuarter" (
    "id" TEXT NOT NULL,
    "communeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "aliases" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommuneQuarter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Teacher" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "professionalName" TEXT,
    "photoUrl" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "commune" TEXT,
    "quartier" TEXT,
    "addressHint" TEXT,
    "portalAccessEnabled" BOOLEAN NOT NULL DEFAULT false,
    "portalPhone" TEXT,
    "portalPasswordHash" TEXT,
    "portalLastLoginAt" TIMESTAMP(3),
    "defaultPayoutMethod" "PaymentMethod",
    "defaultPayoutPhone" TEXT,
    "payoutInstructions" TEXT,
    "jobTitle" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "experienceYears" INTEGER NOT NULL DEFAULT 0,
    "diploma" TEXT,
    "cvUrl" TEXT,
    "careerSummary" TEXT,
    "skills" TEXT,
    "workHistory" TEXT,
    "certifications" TEXT,
    "teachingAchievements" TEXT,
    "learnersCoached" INTEGER NOT NULL DEFAULT 0,
    "profileType" "TeacherProfileType" NOT NULL DEFAULT 'ENSEIGNANT',
    "status" "TeacherStatus" NOT NULL DEFAULT 'PENDING',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "qualityScore" INTEGER NOT NULL DEFAULT 85,
    "lastActivityAt" TIMESTAMP(3),
    "operationalComment" TEXT,
    "adminRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adminRatingNote" TEXT,
    "adminRatingPublic" BOOLEAN NOT NULL DEFAULT true,
    "adminRatingUpdatedAt" TIMESTAMP(3),
    "adminRatingUpdatedById" TEXT,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "badgeVerified" BOOLEAN NOT NULL DEFAULT true,
    "badgeRecommended" BOOLEAN NOT NULL DEFAULT false,
    "badgeNew" BOOLEAN NOT NULL DEFAULT true,
    "badgePopular" BOOLEAN NOT NULL DEFAULT false,
    "badgePremium" BOOLEAN NOT NULL DEFAULT false,
    "internalNote" TEXT,
    "offersHome" BOOLEAN NOT NULL DEFAULT true,
    "offersOnline" BOOLEAN NOT NULL DEFAULT true,
    "offersGroup" BOOLEAN NOT NULL DEFAULT false,
    "pricePerHour" INTEGER NOT NULL DEFAULT 10000,
    "pricePerSession" INTEGER NOT NULL DEFAULT 10000,
    "pricePack4" INTEGER NOT NULL DEFAULT 38000,
    "pricePack8" INTEGER NOT NULL DEFAULT 72000,
    "commissionRate" INTEGER NOT NULL DEFAULT 30,
    "pricingTier" "PricingTier" NOT NULL DEFAULT 'STANDARD',
    "availability" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherPhotoAsset" (
    "id" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'image/webp',
    "data" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherPhotoAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherCvAsset" (
    "id" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherCvAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherSubject" (
    "teacherId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TeacherSubject_pkey" PRIMARY KEY ("teacherId","subjectId")
);

-- CreateTable
CREATE TABLE "TeacherLevel" (
    "teacherId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,

    CONSTRAINT "TeacherLevel_pkey" PRIMARY KEY ("teacherId","levelId")
);

-- CreateTable
CREATE TABLE "TeacherZone" (
    "teacherId" TEXT NOT NULL,
    "communeId" TEXT NOT NULL,

    CONSTRAINT "TeacherZone_pkey" PRIMARY KEY ("teacherId","communeId")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "levelName" TEXT NOT NULL,
    "objective" TEXT,
    "clientType" TEXT,
    "courseCategory" TEXT,
    "schoolSystem" TEXT,
    "preciseLevel" TEXT,
    "courseCatalogId" TEXT,
    "courseCatalogName" TEXT,
    "schoolProgram" TEXT,
    "needDescription" TEXT,
    "courseFormat" "CourseFormat" NOT NULL,
    "groupType" "GroupType" NOT NULL DEFAULT 'INDIVIDUAL',
    "participantsCount" INTEGER NOT NULL DEFAULT 1,
    "commune" TEXT,
    "quartier" TEXT,
    "addressHint" TEXT,
    "onlineLink" TEXT,
    "preferredDays" TEXT NOT NULL,
    "preferredTime" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "scheduledDate" TIMESTAMP(3),
    "scheduledTime" TEXT,
    "sessionsCount" INTEGER NOT NULL DEFAULT 1,
    "packType" "PackType" NOT NULL DEFAULT 'SINGLE',
    "message" TEXT,
    "unitPrice" INTEGER NOT NULL,
    "totalPrice" INTEGER NOT NULL,
    "priceTierKey" TEXT,
    "courseAmount" INTEGER NOT NULL DEFAULT 0,
    "commissionRate" INTEGER NOT NULL DEFAULT 30,
    "commissionAmount" INTEGER NOT NULL DEFAULT 0,
    "teacherRate" INTEGER NOT NULL DEFAULT 70,
    "teacherPayoutAmount" INTEGER NOT NULL DEFAULT 0,
    "transportFee" INTEGER NOT NULL DEFAULT 0,
    "transportFeeKey" TEXT,
    "materialFee" INTEGER NOT NULL DEFAULT 0,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "paymentServiceFeeRate" INTEGER NOT NULL DEFAULT 0,
    "paymentServiceFeeAmount" INTEGER NOT NULL DEFAULT 0,
    "paymentServiceFeeLabel" TEXT,
    "totalClientPays" INTEGER NOT NULL DEFAULT 0,
    "totalTeacherReceives" INTEGER NOT NULL DEFAULT 0,
    "isQuoteOnly" BOOLEAN NOT NULL DEFAULT false,
    "pricingSnapshot" TEXT,
    "teacherNetAmount" INTEGER NOT NULL DEFAULT 0,
    "teacherPaidAmount" INTEGER NOT NULL DEFAULT 0,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'FAILED',
    "paymentMethod" "PaymentMethod",
    "paydunyaToken" TEXT,
    "paydunyaCheckoutUrl" TEXT,
    "paydunyaStatus" TEXT,
    "paydunyaReceiptUrl" TEXT,
    "paydunyaVerifiedAt" TIMESTAMP(3),
    "paydunyaLastCheckedAt" TIMESTAMP(3),
    "paydunyaFailureReason" TEXT,
    "paydunyaLastPayload" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "assignedAt" TIMESTAMP(3),
    "courseDoneAt" TIMESTAMP(3),
    "clientValidatedAt" TIMESTAMP(3),
    "teacherPaidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "cancellationReason" TEXT,
    "cancellationDetail" TEXT,
    "cancellationWindow" TEXT,
    "cancellationFeeRate" INTEGER NOT NULL DEFAULT 0,
    "cancellationFeeAmount" INTEGER NOT NULL DEFAULT 0,
    "cancellationPenaltyTeacherRate" INTEGER NOT NULL DEFAULT 0,
    "cancellationPenaltyTeacherAmount" INTEGER NOT NULL DEFAULT 0,
    "cancellationPenaltyPlatformRate" INTEGER NOT NULL DEFAULT 0,
    "cancellationPenaltyPlatformAmount" INTEGER NOT NULL DEFAULT 0,
    "cancellationRefundAmount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingSession" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "teacherId" TEXT NOT NULL,
    "proposedTeacherId" TEXT,
    "scheduledDate" TIMESTAMP(3),
    "scheduledTime" TEXT,
    "durationMinutes" INTEGER NOT NULL DEFAULT 120,
    "status" "BookingSessionStatus" NOT NULL DEFAULT 'PLANNED',
    "courseAmount" INTEGER NOT NULL DEFAULT 0,
    "commissionAmount" INTEGER NOT NULL DEFAULT 0,
    "teacherCourseAmount" INTEGER NOT NULL DEFAULT 0,
    "transportFee" INTEGER NOT NULL DEFAULT 0,
    "teacherNetAmount" INTEGER NOT NULL DEFAULT 0,
    "releasedAmount" INTEGER NOT NULL DEFAULT 0,
    "paidAmount" INTEGER NOT NULL DEFAULT 0,
    "retainedAmount" INTEGER NOT NULL DEFAULT 0,
    "proposedDate" TIMESTAMP(3),
    "proposedTime" TEXT,
    "unavailableReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "clientValidatedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingSessionHistory" (
    "id" TEXT NOT NULL,
    "bookingSessionId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "oldTeacherId" TEXT,
    "newTeacherId" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingSessionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "rescheduleRequestId" TEXT,
    "amount" INTEGER NOT NULL,
    "commission" INTEGER NOT NULL,
    "teacherNet" INTEGER NOT NULL,
    "type" "TransactionType" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'BLOCKED',
    "method" "PaymentMethod",
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "adminStatus" "ReviewAdminStatus" NOT NULL DEFAULT 'NEW',
    "adminNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "bookingSessionId" TEXT,
    "openedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "recipientType" "NotificationRecipientType" NOT NULL DEFAULT 'ADMIN',
    "recipientName" TEXT,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'INTERNAL',
    "status" "NotificationStatus" NOT NULL DEFAULT 'CREATED',
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "actionLabel" TEXT,
    "actionType" TEXT,
    "bookingId" TEXT,
    "teacherId" TEXT,
    "clientId" TEXT,
    "adminId" TEXT,
    "campaignId" TEXT,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "response" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationCampaign" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "audience" "CommunicationAudience" NOT NULL,
    "targetUserId" TEXT,
    "targetTeacherId" TEXT,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'INTERNAL',
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "CommunicationCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "link" TEXT,
    "actionLabel" TEXT,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebPushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "teacherId" TEXT,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "expirationTime" BIGINT,
    "userAgent" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebPushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebPushOutbox" (
    "id" UUID NOT NULL,
    "notificationId" TEXT,
    "teacherNotificationId" TEXT,
    "recipientType" "NotificationRecipientType" NOT NULL,
    "targetUserId" TEXT,
    "targetTeacherId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "WebPushOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebPushOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherNotification" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "bookingId" TEXT,
    "campaignId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'SENT',
    "sentById" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherMissionLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "status" "TeacherMissionStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "problemAt" TIMESTAMP(3),
    "response" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherMissionLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingScheduleProposal" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "proposedDate" TIMESTAMP(3) NOT NULL,
    "proposedTime" TEXT NOT NULL,
    "reason" TEXT,
    "status" "ScheduleProposalStatus" NOT NULL DEFAULT 'PENDING',
    "clientResponse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "BookingScheduleProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingRescheduleRequest" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "requestedBy" "RescheduleRequestActor" NOT NULL DEFAULT 'CLIENT',
    "oldScheduledDate" TIMESTAMP(3),
    "oldScheduledTime" TEXT,
    "proposedDate" TIMESTAMP(3) NOT NULL,
    "proposedTime" TEXT NOT NULL,
    "reason" TEXT,
    "status" "RescheduleRequestStatus" NOT NULL DEFAULT 'PAYMENT_PENDING',
    "feeWindow" TEXT NOT NULL,
    "feeBaseAmount" INTEGER NOT NULL DEFAULT 0,
    "feeRate" INTEGER NOT NULL DEFAULT 0,
    "feeAmount" INTEGER NOT NULL DEFAULT 0,
    "feeTeacherRate" INTEGER NOT NULL DEFAULT 0,
    "feeTeacherAmount" INTEGER NOT NULL DEFAULT 0,
    "feePlatformRate" INTEGER NOT NULL DEFAULT 0,
    "feePlatformAmount" INTEGER NOT NULL DEFAULT 0,
    "paymentServiceFeeRate" INTEGER NOT NULL DEFAULT 0,
    "paymentServiceFeeAmount" INTEGER NOT NULL DEFAULT 0,
    "paymentServiceFeeLabel" TEXT,
    "totalToPay" INTEGER NOT NULL DEFAULT 0,
    "paydunyaToken" TEXT,
    "paydunyaCheckoutUrl" TEXT,
    "paydunyaStatus" TEXT,
    "paydunyaReceiptUrl" TEXT,
    "paydunyaVerifiedAt" TIMESTAMP(3),
    "paydunyaLastCheckedAt" TIMESTAMP(3),
    "paydunyaFailureReason" TEXT,
    "paydunyaLastPayload" TEXT,
    "clientResponse" TEXT,
    "teacherResponse" TEXT,
    "paidAt" TIMESTAMP(3),
    "teacherRespondedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingRescheduleRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherTask" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "bookingId" TEXT,
    "type" "TeacherTaskType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "TeacherTaskPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "TeacherTaskStatus" NOT NULL DEFAULT 'TODO',
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherAdminMessage" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "bookingId" TEXT,
    "sender" "TeacherAdminMessageSender" NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "TeacherAdminMessageStatus" NOT NULL DEFAULT 'OPEN',
    "adminId" TEXT,
    "readByAdminAt" TIMESTAMP(3),
    "readByTeacherAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherAdminMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherWarning" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "bookingId" TEXT,
    "level" "TeacherWarningLevel" NOT NULL,
    "reason" "TeacherWarningReason" NOT NULL,
    "description" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "requestedAction" TEXT,
    "responseDueAt" TIMESTAMP(3),
    "adminOnly" BOOLEAN NOT NULL DEFAULT false,
    "sentToTeacher" BOOLEAN NOT NULL DEFAULT true,
    "qualityImpact" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherWarning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherSanction" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "bookingId" TEXT,
    "type" "TeacherSanctionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "financial" BOOLEAN NOT NULL DEFAULT false,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "status" "TeacherSanctionStatus" NOT NULL DEFAULT 'PENDING_VALIDATION',
    "qualityImpact" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherSanction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherReplacement" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "oldTeacherId" TEXT NOT NULL,
    "newTeacherId" TEXT NOT NULL,
    "reason" "TeacherReplacementReason" NOT NULL,
    "details" TEXT,
    "financialImpact" INTEGER NOT NULL DEFAULT 0,
    "clientMessage" TEXT,
    "oldTeacherMessage" TEXT,
    "newTeacherMessage" TEXT,
    "status" "TeacherReplacementStatus" NOT NULL DEFAULT 'APPLIED',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "TeacherReplacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientCommunication" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "bookingId" TEXT,
    "type" "ClientCommunicationType" NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "priority" "TeacherTaskPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'SENT',
    "sentById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientCommunication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientRefundRequest" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentServiceFeeNonRefunded" INTEGER NOT NULL DEFAULT 0,
    "method" "PaymentMethod" NOT NULL,
    "paymentPhone" TEXT NOT NULL,
    "accountName" TEXT,
    "note" TEXT,
    "status" "ClientRefundRequestStatus" NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),
    "processedById" TEXT,
    "externalReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientRefundRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherPaymentAdjustment" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "bookingId" TEXT,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "status" "TeacherPaymentAdjustmentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherPaymentAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherPayoutRecord" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod",
    "paymentPhone" TEXT,
    "note" TEXT,
    "status" "TeacherPayoutRecordStatus" NOT NULL DEFAULT 'PAID',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "TeacherPayoutRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherPayoutRequest" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "paymentPhone" TEXT NOT NULL,
    "note" TEXT,
    "status" "TeacherPayoutRequestStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "payoutRecordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherPayoutRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherPayoutAllocation" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "bookingSessionId" TEXT,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherPayoutAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminActionLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "oldStatus" TEXT,
    "newStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "handled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledById" TEXT,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_adminTeamRole_adminAccountStatus_idx" ON "User"("adminTeamRole", "adminAccountStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_name_key" ON "Subject"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_slug_key" ON "Subject"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Level_name_key" ON "Level"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Level_slug_key" ON "Level"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Commune_name_key" ON "Commune"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Commune_slug_key" ON "Commune"("slug");

-- CreateIndex
CREATE INDEX "Commune_isActive_name_idx" ON "Commune"("isActive", "name");

-- CreateIndex
CREATE INDEX "Commune_transportClass_isActive_idx" ON "Commune"("transportClass", "isActive");

-- CreateIndex
CREATE INDEX "CommuneQuarter_communeId_isActive_name_idx" ON "CommuneQuarter"("communeId", "isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CommuneQuarter_communeId_name_key" ON "CommuneQuarter"("communeId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CommuneQuarter_communeId_slug_key" ON "CommuneQuarter"("communeId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_portalPhone_key" ON "Teacher"("portalPhone");

-- CreateIndex
CREATE INDEX "Teacher_status_idx" ON "Teacher"("status");

-- CreateIndex
CREATE INDEX "Teacher_featured_idx" ON "Teacher"("featured");

-- CreateIndex
CREATE INDEX "Teacher_portalAccessEnabled_idx" ON "Teacher"("portalAccessEnabled");

-- CreateIndex
CREATE INDEX "TeacherPhotoAsset_createdAt_idx" ON "TeacherPhotoAsset"("createdAt");

-- CreateIndex
CREATE INDEX "TeacherCvAsset_createdAt_idx" ON "TeacherCvAsset"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_reference_key" ON "Booking"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_paydunyaToken_key" ON "Booking"("paydunyaToken");

-- CreateIndex
CREATE INDEX "Booking_clientId_idx" ON "Booking"("clientId");

-- CreateIndex
CREATE INDEX "Booking_teacherId_idx" ON "Booking"("teacherId");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "BookingSession_bookingId_status_idx" ON "BookingSession"("bookingId", "status");

-- CreateIndex
CREATE INDEX "BookingSession_teacherId_status_scheduledDate_idx" ON "BookingSession"("teacherId", "status", "scheduledDate");

-- CreateIndex
CREATE INDEX "BookingSession_proposedTeacherId_status_idx" ON "BookingSession"("proposedTeacherId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BookingSession_bookingId_sequence_key" ON "BookingSession"("bookingId", "sequence");

-- CreateIndex
CREATE INDEX "BookingSessionHistory_bookingSessionId_createdAt_idx" ON "BookingSessionHistory"("bookingSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "BookingSessionHistory_actorType_actorId_idx" ON "BookingSessionHistory"("actorType", "actorId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_reference_key" ON "Transaction"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_rescheduleRequestId_key" ON "Transaction"("rescheduleRequestId");

-- CreateIndex
CREATE INDEX "Review_adminStatus_idx" ON "Review"("adminStatus");

-- CreateIndex
CREATE INDEX "Review_teacherId_adminStatus_idx" ON "Review"("teacherId", "adminStatus");

-- CreateIndex
CREATE INDEX "Dispute_bookingSessionId_idx" ON "Dispute"("bookingSessionId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Notification_recipientType_status_priority_idx" ON "Notification"("recipientType", "status", "priority");

-- CreateIndex
CREATE INDEX "Notification_bookingId_idx" ON "Notification"("bookingId");

-- CreateIndex
CREATE INDEX "Notification_teacherId_idx" ON "Notification"("teacherId");

-- CreateIndex
CREATE INDEX "Notification_clientId_idx" ON "Notification"("clientId");

-- CreateIndex
CREATE INDEX "Notification_campaignId_idx" ON "Notification"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationCampaign_reference_key" ON "CommunicationCampaign"("reference");

-- CreateIndex
CREATE INDEX "CommunicationCampaign_status_createdAt_idx" ON "CommunicationCampaign"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CommunicationCampaign_audience_createdAt_idx" ON "CommunicationCampaign"("audience", "createdAt");

-- CreateIndex
CREATE INDEX "CommunicationCampaign_createdById_idx" ON "CommunicationCampaign"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "WebPushSubscription_endpoint_key" ON "WebPushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "WebPushSubscription_userId_enabled_idx" ON "WebPushSubscription"("userId", "enabled");

-- CreateIndex
CREATE INDEX "WebPushSubscription_teacherId_enabled_idx" ON "WebPushSubscription"("teacherId", "enabled");

-- CreateIndex
CREATE INDEX "WebPushSubscription_enabled_updatedAt_idx" ON "WebPushSubscription"("enabled", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebPushOutbox_notificationId_key" ON "WebPushOutbox"("notificationId");

-- CreateIndex
CREATE UNIQUE INDEX "WebPushOutbox_teacherNotificationId_key" ON "WebPushOutbox"("teacherNotificationId");

-- CreateIndex
CREATE INDEX "WebPushOutbox_status_nextAttemptAt_idx" ON "WebPushOutbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "WebPushOutbox_targetUserId_status_idx" ON "WebPushOutbox"("targetUserId", "status");

-- CreateIndex
CREATE INDEX "WebPushOutbox_targetTeacherId_status_idx" ON "WebPushOutbox"("targetTeacherId", "status");

-- CreateIndex
CREATE INDEX "TeacherNotification_teacherId_createdAt_idx" ON "TeacherNotification"("teacherId", "createdAt");

-- CreateIndex
CREATE INDEX "TeacherNotification_bookingId_idx" ON "TeacherNotification"("bookingId");

-- CreateIndex
CREATE INDEX "TeacherNotification_campaignId_idx" ON "TeacherNotification"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherMissionLink_token_key" ON "TeacherMissionLink"("token");

-- CreateIndex
CREATE INDEX "TeacherMissionLink_teacherId_status_idx" ON "TeacherMissionLink"("teacherId", "status");

-- CreateIndex
CREATE INDEX "TeacherMissionLink_bookingId_idx" ON "TeacherMissionLink"("bookingId");

-- CreateIndex
CREATE INDEX "TeacherMissionLink_expiresAt_idx" ON "TeacherMissionLink"("expiresAt");

-- CreateIndex
CREATE INDEX "BookingScheduleProposal_bookingId_status_idx" ON "BookingScheduleProposal"("bookingId", "status");

-- CreateIndex
CREATE INDEX "BookingScheduleProposal_teacherId_createdAt_idx" ON "BookingScheduleProposal"("teacherId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BookingRescheduleRequest_paydunyaToken_key" ON "BookingRescheduleRequest"("paydunyaToken");

-- CreateIndex
CREATE INDEX "BookingRescheduleRequest_bookingId_status_idx" ON "BookingRescheduleRequest"("bookingId", "status");

-- CreateIndex
CREATE INDEX "BookingRescheduleRequest_teacherId_status_idx" ON "BookingRescheduleRequest"("teacherId", "status");

-- CreateIndex
CREATE INDEX "BookingRescheduleRequest_clientId_createdAt_idx" ON "BookingRescheduleRequest"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "BookingRescheduleRequest_paydunyaToken_idx" ON "BookingRescheduleRequest"("paydunyaToken");

-- CreateIndex
CREATE INDEX "TeacherTask_teacherId_status_idx" ON "TeacherTask"("teacherId", "status");

-- CreateIndex
CREATE INDEX "TeacherTask_bookingId_idx" ON "TeacherTask"("bookingId");

-- CreateIndex
CREATE INDEX "TeacherTask_priority_status_idx" ON "TeacherTask"("priority", "status");

-- CreateIndex
CREATE INDEX "TeacherAdminMessage_teacherId_createdAt_idx" ON "TeacherAdminMessage"("teacherId", "createdAt");

-- CreateIndex
CREATE INDEX "TeacherAdminMessage_teacherId_status_idx" ON "TeacherAdminMessage"("teacherId", "status");

-- CreateIndex
CREATE INDEX "TeacherAdminMessage_bookingId_idx" ON "TeacherAdminMessage"("bookingId");

-- CreateIndex
CREATE INDEX "TeacherAdminMessage_sender_status_idx" ON "TeacherAdminMessage"("sender", "status");

-- CreateIndex
CREATE INDEX "TeacherAdminMessage_priority_status_idx" ON "TeacherAdminMessage"("priority", "status");

-- CreateIndex
CREATE INDEX "TeacherWarning_teacherId_level_idx" ON "TeacherWarning"("teacherId", "level");

-- CreateIndex
CREATE INDEX "TeacherWarning_bookingId_idx" ON "TeacherWarning"("bookingId");

-- CreateIndex
CREATE INDEX "TeacherSanction_teacherId_status_idx" ON "TeacherSanction"("teacherId", "status");

-- CreateIndex
CREATE INDEX "TeacherSanction_bookingId_idx" ON "TeacherSanction"("bookingId");

-- CreateIndex
CREATE INDEX "TeacherReplacement_bookingId_idx" ON "TeacherReplacement"("bookingId");

-- CreateIndex
CREATE INDEX "TeacherReplacement_oldTeacherId_idx" ON "TeacherReplacement"("oldTeacherId");

-- CreateIndex
CREATE INDEX "TeacherReplacement_newTeacherId_idx" ON "TeacherReplacement"("newTeacherId");

-- CreateIndex
CREATE INDEX "ClientCommunication_clientId_createdAt_idx" ON "ClientCommunication"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "ClientCommunication_bookingId_idx" ON "ClientCommunication"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientRefundRequest_reference_key" ON "ClientRefundRequest"("reference");

-- CreateIndex
CREATE INDEX "ClientRefundRequest_bookingId_status_idx" ON "ClientRefundRequest"("bookingId", "status");

-- CreateIndex
CREATE INDEX "ClientRefundRequest_clientId_createdAt_idx" ON "ClientRefundRequest"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "TeacherPaymentAdjustment_teacherId_status_idx" ON "TeacherPaymentAdjustment"("teacherId", "status");

-- CreateIndex
CREATE INDEX "TeacherPaymentAdjustment_bookingId_idx" ON "TeacherPaymentAdjustment"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherPayoutRecord_reference_key" ON "TeacherPayoutRecord"("reference");

-- CreateIndex
CREATE INDEX "TeacherPayoutRecord_teacherId_paidAt_idx" ON "TeacherPayoutRecord"("teacherId", "paidAt");

-- CreateIndex
CREATE INDEX "TeacherPayoutRecord_createdById_idx" ON "TeacherPayoutRecord"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherPayoutRequest_reference_key" ON "TeacherPayoutRequest"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherPayoutRequest_payoutRecordId_key" ON "TeacherPayoutRequest"("payoutRecordId");

-- CreateIndex
CREATE INDEX "TeacherPayoutRequest_teacherId_status_createdAt_idx" ON "TeacherPayoutRequest"("teacherId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "TeacherPayoutRequest_reviewedById_idx" ON "TeacherPayoutRequest"("reviewedById");

-- CreateIndex
CREATE INDEX "TeacherPayoutAllocation_payoutId_idx" ON "TeacherPayoutAllocation"("payoutId");

-- CreateIndex
CREATE INDEX "TeacherPayoutAllocation_bookingId_idx" ON "TeacherPayoutAllocation"("bookingId");

-- CreateIndex
CREATE INDEX "TeacherPayoutAllocation_bookingSessionId_idx" ON "TeacherPayoutAllocation"("bookingSessionId");

-- CreateIndex
CREATE INDEX "AdminActionLog_entityType_entityId_idx" ON "AdminActionLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AdminActionLog_adminId_idx" ON "AdminActionLog"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "CommuneQuarter" ADD CONSTRAINT "CommuneQuarter_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSubject" ADD CONSTRAINT "TeacherSubject_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSubject" ADD CONSTRAINT "TeacherSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherLevel" ADD CONSTRAINT "TeacherLevel_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherLevel" ADD CONSTRAINT "TeacherLevel_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherZone" ADD CONSTRAINT "TeacherZone_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherZone" ADD CONSTRAINT "TeacherZone_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSession" ADD CONSTRAINT "BookingSession_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSession" ADD CONSTRAINT "BookingSession_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSession" ADD CONSTRAINT "BookingSession_proposedTeacherId_fkey" FOREIGN KEY ("proposedTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSessionHistory" ADD CONSTRAINT "BookingSessionHistory_bookingSessionId_fkey" FOREIGN KEY ("bookingSessionId") REFERENCES "BookingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_rescheduleRequestId_fkey" FOREIGN KEY ("rescheduleRequestId") REFERENCES "BookingRescheduleRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_bookingSessionId_fkey" FOREIGN KEY ("bookingSessionId") REFERENCES "BookingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CommunicationCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationCampaign" ADD CONSTRAINT "CommunicationCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebPushSubscription" ADD CONSTRAINT "WebPushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebPushSubscription" ADD CONSTRAINT "WebPushSubscription_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherNotification" ADD CONSTRAINT "TeacherNotification_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherNotification" ADD CONSTRAINT "TeacherNotification_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CommunicationCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherMissionLink" ADD CONSTRAINT "TeacherMissionLink_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherMissionLink" ADD CONSTRAINT "TeacherMissionLink_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingScheduleProposal" ADD CONSTRAINT "BookingScheduleProposal_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingScheduleProposal" ADD CONSTRAINT "BookingScheduleProposal_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRescheduleRequest" ADD CONSTRAINT "BookingRescheduleRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRescheduleRequest" ADD CONSTRAINT "BookingRescheduleRequest_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRescheduleRequest" ADD CONSTRAINT "BookingRescheduleRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherTask" ADD CONSTRAINT "TeacherTask_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherTask" ADD CONSTRAINT "TeacherTask_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherTask" ADD CONSTRAINT "TeacherTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAdminMessage" ADD CONSTRAINT "TeacherAdminMessage_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAdminMessage" ADD CONSTRAINT "TeacherAdminMessage_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAdminMessage" ADD CONSTRAINT "TeacherAdminMessage_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherWarning" ADD CONSTRAINT "TeacherWarning_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherWarning" ADD CONSTRAINT "TeacherWarning_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherWarning" ADD CONSTRAINT "TeacherWarning_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSanction" ADD CONSTRAINT "TeacherSanction_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSanction" ADD CONSTRAINT "TeacherSanction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSanction" ADD CONSTRAINT "TeacherSanction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherReplacement" ADD CONSTRAINT "TeacherReplacement_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherReplacement" ADD CONSTRAINT "TeacherReplacement_oldTeacherId_fkey" FOREIGN KEY ("oldTeacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherReplacement" ADD CONSTRAINT "TeacherReplacement_newTeacherId_fkey" FOREIGN KEY ("newTeacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherReplacement" ADD CONSTRAINT "TeacherReplacement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCommunication" ADD CONSTRAINT "ClientCommunication_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCommunication" ADD CONSTRAINT "ClientCommunication_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCommunication" ADD CONSTRAINT "ClientCommunication_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRefundRequest" ADD CONSTRAINT "ClientRefundRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRefundRequest" ADD CONSTRAINT "ClientRefundRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherPaymentAdjustment" ADD CONSTRAINT "TeacherPaymentAdjustment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherPaymentAdjustment" ADD CONSTRAINT "TeacherPaymentAdjustment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherPayoutRecord" ADD CONSTRAINT "TeacherPayoutRecord_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherPayoutRecord" ADD CONSTRAINT "TeacherPayoutRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherPayoutRequest" ADD CONSTRAINT "TeacherPayoutRequest_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherPayoutRequest" ADD CONSTRAINT "TeacherPayoutRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherPayoutRequest" ADD CONSTRAINT "TeacherPayoutRequest_payoutRecordId_fkey" FOREIGN KEY ("payoutRecordId") REFERENCES "TeacherPayoutRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherPayoutAllocation" ADD CONSTRAINT "TeacherPayoutAllocation_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "TeacherPayoutRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherPayoutAllocation" ADD CONSTRAINT "TeacherPayoutAllocation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherPayoutAllocation" ADD CONSTRAINT "TeacherPayoutAllocation_bookingSessionId_fkey" FOREIGN KEY ("bookingSessionId") REFERENCES "BookingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminActionLog" ADD CONSTRAINT "AdminActionLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
