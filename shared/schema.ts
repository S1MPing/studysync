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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
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
  tutorId: varchar("tutor_id").references(() => users.id).notNull(),
  courseId: integer("course_id").references(() => courses.id).notNull(),
  grade: text("grade"),
});

export const availabilities = pgTable("availabilities", {
  id: serial("id").primaryKey(),
  tutorId: varchar("tutor_id").references(() => users.id).notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
});

export const tutoringSessions = pgTable("tutoring_sessions", {
  id: serial("id").primaryKey(),
  studentId: varchar("student_id").references(() => users.id).notNull(),
  tutorId: varchar("tutor_id").references(() => users.id).notNull(),
  courseId: integer("course_id").references(() => courses.id).notNull(),
  status: text("status", { enum: ["pending", "accepted", "declined", "scheduled", "completed", "cancelled"] }).default("pending"),
  date: timestamp("date"),
  startTime: text("start_time"),
  durationMinutes: integer("duration_minutes").default(60),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => tutoringSessions.id).notNull(),
  senderId: varchar("sender_id").references(() => users.id).notNull(),
  content: text("content"),
  type: text("type", { enum: ["text", "voice", "image", "document"] }).default("text"),
  fileUrl: text("file_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => tutoringSessions.id).notNull(),
  reviewerId: varchar("reviewer_id").references(() => users.id).notNull(),
  revieweeId: varchar("reviewee_id").references(() => users.id).notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- Relations ---
export const usersRelations = relations(users, ({ many }) => ({
  tutorCourses: many(tutorCourses),
  availabilities: many(availabilities),
  sessionsAsStudent: many(tutoringSessions, { relationName: "studentSessions" }),
  sessionsAsTutor: many(tutoringSessions, { relationName: "tutorSessions" }),
  reviewsWritten: many(reviews, { relationName: "reviewer" }),
  reviewsReceived: many(reviews, { relationName: "reviewee" }),
}));

export const coursesRelations = relations(courses, ({ many }) => ({
  tutors: many(tutorCourses),
  sessions: many(tutoringSessions),
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

// --- Schemas & Types ---
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type TutorCourse = typeof tutorCourses.$inferSelect;
export type Availability = typeof availabilities.$inferSelect;
export type TutoringSession = typeof tutoringSessions.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Review = typeof reviews.$inferSelect;

export const updateProfileSchema = z.object({
  role: z.enum(["student", "tutor", "both"]).optional(),
  university: z.string().optional(),
  level: z.string().optional(),
  major: z.string().optional(),
  teachingLevels: z.string().optional(),
  bio: z.string().optional(),
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
