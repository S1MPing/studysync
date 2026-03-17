import { pgTable, text, serial, integer, boolean, timestamp, varchar, jsonb, index } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// --- Auth Tables ---
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  password: varchar("password"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: text("role", { enum: ["student", "tutor", "both"] }).default("student"),
  university: text("university"),
  level: text("level"),
  major: text("major"),
  teachingLevels: text("teaching_levels"), // comma-separated: "100,200,300"
  bio: text("bio"),
  isVerified: boolean("is_verified").default(false),
  isAdmin: boolean("is_admin").default(false),
  adminRole: text("admin_role", { enum: ["super-admin", "admin", "editor", "viewer"] }),
  isBanned: boolean("is_banned").default(false),
  bannedUntil: timestamp("banned_until"),
  banReason: text("ban_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- App Tables ---
export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  university: text("university").notNull(),
});

export const tutorCourses = pgTable("tutor_courses", {
  id: serial("id").primaryKey(),
  tutorId: varchar("tutor_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  courseId: integer("course_id").references(() => courses.id, { onDelete: "cascade" }).notNull(),
  grade: text("grade"),
});

export const availabilities = pgTable("availabilities", {
  id: serial("id").primaryKey(),
  tutorId: varchar("tutor_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
});

export const tutoringSessions = pgTable("tutoring_sessions", {
  id: serial("id").primaryKey(),
  studentId: varchar("student_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  tutorId: varchar("tutor_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  courseId: integer("course_id").references(() => courses.id, { onDelete: "cascade" }).notNull(),
  status: text("status", { enum: ["pending", "accepted", "declined", "scheduled", "completed", "cancelled"] }).default("pending"),
  date: timestamp("date"),
  startTime: text("start_time"),
  durationMinutes: integer("duration_minutes").default(60),
  notes: text("notes"),
  isRecurring: boolean("is_recurring").default(false),
  recurringDays: text("recurring_days"), // e.g. "1,3,5" = Mon,Wed,Fri
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => tutoringSessions.id, { onDelete: "cascade" }).notNull(),
  senderId: varchar("sender_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  content: text("content"),
  type: text("type", { enum: ["text", "voice", "image", "document", "video"] }).default("text"),
  fileUrl: text("file_url"),
  createdAt: timestamp("created_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => tutoringSessions.id, { onDelete: "cascade" }).notNull(),
  reviewerId: varchar("reviewer_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  revieweeId: varchar("reviewee_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(), // e.g. "user.login", "session.delete", "admin.ban_user"
  entityType: text("entity_type"), // e.g. "user", "session", "message"
  entityId: text("entity_id"),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const blockedUsers = pgTable("blocked_users", {
  id: serial("id").primaryKey(),
  blockerId: varchar("blocker_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  blockedId: varchar("blocked_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  reporterId: varchar("reporter_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  reportedId: varchar("reported_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  messageId: integer("message_id").references(() => messages.id, { onDelete: "set null" }),
  reason: text("reason").notNull(), // "foul_language", "harassment", "inappropriate", "threats", "spam", "cheating", "impersonation", "other"
  details: text("details"),
  status: text("status", { enum: ["pending", "reviewed", "dismissed", "actioned"] }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const quizzes = pgTable("quizzes", {
  id: serial("id").primaryKey(),
  tutorId: varchar("tutor_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  courseId: integer("course_id").references(() => courses.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  isPublic: boolean("is_public").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const flashcards = pgTable("flashcards", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").references(() => quizzes.id, { onDelete: "cascade" }).notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  orderIdx: integer("order_idx").default(0),
});

export const quizAttempts = pgTable("quiz_attempts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  quizId: integer("quiz_id").references(() => quizzes.id, { onDelete: "cascade" }).notNull(),
  score: integer("score").notNull(),
  totalCards: integer("total_cards").notNull(),
  completedAt: timestamp("completed_at").defaultNow(),
});

export const studyGoals = pgTable("study_goals", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  weeklyHoursTarget: integer("weekly_hours_target").default(10),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const studyRooms = pgTable("study_rooms", {
  id: serial("id").primaryKey(),
  hostId: varchar("host_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  courseId: integer("course_id").references(() => courses.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  maxParticipants: integer("max_participants").default(10),
  isActive: boolean("is_active").default(true),
  jitsiRoomId: varchar("jitsi_room_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- Relations ---
export const usersRelations = relations(users, ({ many, one }) => ({
  tutorCourses: many(tutorCourses),
  availabilities: many(availabilities),
  sessionsAsStudent: many(tutoringSessions, { relationName: "studentSessions" }),
  sessionsAsTutor: many(tutoringSessions, { relationName: "tutorSessions" }),
  reviewsWritten: many(reviews, { relationName: "reviewer" }),
  reviewsReceived: many(reviews, { relationName: "reviewee" }),
  auditLogs: many(auditLogs),
  blocksGiven: many(blockedUsers, { relationName: "blocker" }),
  blocksReceived: many(blockedUsers, { relationName: "blocked" }),
  reportsGiven: many(reports, { relationName: "reporter" }),
  reportsReceived: many(reports, { relationName: "reported" }),
  quizzes: many(quizzes),
  quizAttempts: many(quizAttempts),
  studyGoal: one(studyGoals, { fields: [users.id], references: [studyGoals.userId] }),
  hostedRooms: many(studyRooms),
}));

export const coursesRelations = relations(courses, ({ many }) => ({
  tutors: many(tutorCourses),
  sessions: many(tutoringSessions),
  quizzes: many(quizzes),
  studyRooms: many(studyRooms),
}));

export const tutorCoursesRelations = relations(tutorCourses, ({ one }) => ({
  tutor: one(users, { fields: [tutorCourses.tutorId], references: [users.id] }),
  course: one(courses, { fields: [tutorCourses.courseId], references: [courses.id] }),
}));

export const tutoringSessionsRelations = relations(tutoringSessions, ({ one, many }) => ({
  student: one(users, { fields: [tutoringSessions.studentId], references: [users.id], relationName: "studentSessions" }),
  tutor: one(users, { fields: [tutoringSessions.tutorId], references: [users.id], relationName: "tutorSessions" }),
  course: one(courses, { fields: [tutoringSessions.courseId], references: [courses.id] }),
  messages: many(messages),
  reviews: many(reviews),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  session: one(tutoringSessions, { fields: [messages.sessionId], references: [tutoringSessions.id] }),
  sender: one(users, { fields: [messages.senderId], references: [users.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  session: one(tutoringSessions, { fields: [reviews.sessionId], references: [tutoringSessions.id] }),
  reviewer: one(users, { fields: [reviews.reviewerId], references: [users.id], relationName: "reviewer" }),
  reviewee: one(users, { fields: [reviews.revieweeId], references: [users.id], relationName: "reviewee" }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));

export const blockedUsersRelations = relations(blockedUsers, ({ one }) => ({
  blocker: one(users, { fields: [blockedUsers.blockerId], references: [users.id], relationName: "blocker" }),
  blocked: one(users, { fields: [blockedUsers.blockedId], references: [users.id], relationName: "blocked" }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(users, { fields: [reports.reporterId], references: [users.id], relationName: "reporter" }),
  reported: one(users, { fields: [reports.reportedId], references: [users.id], relationName: "reported" }),
}));

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  tutor: one(users, { fields: [quizzes.tutorId], references: [users.id] }),
  course: one(courses, { fields: [quizzes.courseId], references: [courses.id] }),
  flashcards: many(flashcards),
  attempts: many(quizAttempts),
}));

export const flashcardsRelations = relations(flashcards, ({ one }) => ({
  quiz: one(quizzes, { fields: [flashcards.quizId], references: [quizzes.id] }),
}));

export const quizAttemptsRelations = relations(quizAttempts, ({ one }) => ({
  user: one(users, { fields: [quizAttempts.userId], references: [users.id] }),
  quiz: one(quizzes, { fields: [quizAttempts.quizId], references: [quizzes.id] }),
}));

export const studyGoalsRelations = relations(studyGoals, ({ one }) => ({
  user: one(users, { fields: [studyGoals.userId], references: [users.id] }),
}));

export const studyRoomsRelations = relations(studyRooms, ({ one }) => ({
  host: one(users, { fields: [studyRooms.hostId], references: [users.id] }),
  course: one(courses, { fields: [studyRooms.courseId], references: [courses.id] }),
}));

// --- Schemas & Types ---
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type TutorCourse = typeof tutorCourses.$inferSelect;
export type Availability = typeof availabilities.$inferSelect;
export type TutoringSession = typeof tutoringSessions.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type BlockedUser = typeof blockedUsers.$inferSelect;
export type Report = typeof reports.$inferSelect;

export const updateProfileSchema = z.object({
  role: z.enum(["student", "tutor", "both"]).optional(),
  university: z.string().optional(),
  level: z.string().optional(),
  major: z.string().optional(),
  teachingLevels: z.string().optional(),
  bio: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;

export const insertCourseSchema = createInsertSchema(courses).omit({ id: true });
export type InsertCourse = z.infer<typeof insertCourseSchema>;

export const insertTutorCourseSchema = createInsertSchema(tutorCourses).omit({ id: true, tutorId: true });
export type InsertTutorCourse = z.infer<typeof insertTutorCourseSchema>;

export const insertAvailabilitySchema = createInsertSchema(availabilities).omit({ id: true, tutorId: true });
export type InsertAvailability = z.infer<typeof insertAvailabilitySchema>;

export const insertTutoringSessionSchema = createInsertSchema(tutoringSessions).omit({ id: true, status: true, createdAt: true }).extend({
  date: z.coerce.date().optional(),
  startTime: z.string().optional(),
  durationMinutes: z.number().optional(),
  studentId: z.string().optional(),
  tutorId: z.string().optional(),
});
export type InsertTutoringSession = z.infer<typeof insertTutoringSessionSchema>;

export const updateSessionStatusSchema = z.object({
  status: z.enum(["accepted", "declined", "scheduled", "completed", "cancelled"]),
});

export const scheduleSessionSchema = z.object({
  date: z.coerce.date(),
  startTime: z.string(),
  durationMinutes: z.number().default(60),
});

export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true, senderId: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true, createdAt: true, reviewerId: true });
export type InsertReview = z.infer<typeof insertReviewSchema>;

export type TutorSearchQuery = {
  courseId?: string;
  university?: string;
};

export const insertQuizSchema = z.object({
  courseId: z.number().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  isPublic: z.boolean().default(true),
});
export const insertFlashcardSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  orderIdx: z.number().default(0),
});
export const insertStudyRoomSchema = z.object({
  courseId: z.number().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  maxParticipants: z.number().default(10),
});
export type Quiz = typeof quizzes.$inferSelect;
export type Flashcard = typeof flashcards.$inferSelect;
export type StudyGoal = typeof studyGoals.$inferSelect;
export type StudyRoom = typeof studyRooms.$inferSelect;
