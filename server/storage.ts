import { db } from "./db";
import { eq, and, or, sql, desc, isNull } from "drizzle-orm";
import { 
  users, courses, tutorCourses, availabilities, tutoringSessions, messages, reviews,
  type User, type UpdateProfileRequest,
  type Course, type InsertCourse,
  type TutorCourse, type InsertTutorCourse,
  type Availability, type InsertAvailability,
  type TutoringSession, type InsertTutoringSession,
  type Message, type InsertMessage,
  type Review, type InsertReview,
  type TutorSearchQuery
} from "@shared/schema";

// Helper to map snake_case row_to_json output to camelCase User fields
function mapUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    password: row.password,
    firstName: row.first_name,
    lastName: row.last_name,
    profileImageUrl: row.profile_image_url,
    role: row.role,
    university: row.university,
    level: row.level,
    major: row.major,
    teachingLevels: row.teaching_levels ?? null,
    bio: row.bio,
    isVerified: row.is_verified ?? false,
    isAdmin: row.is_admin ?? false,
    adminRole: row.admin_role ?? null,
    isBanned: row.is_banned ?? false,
    bannedUntil: row.banned_until ?? null,
    banReason: row.ban_reason ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  updateUser(id: string, profile: UpdateProfileRequest): Promise<User>;
  searchTutors(query: TutorSearchQuery): Promise<User[]>;
  
  // Courses
  getAllCourses(query?: string): Promise<Course[]>;
  createCourse(course: InsertCourse): Promise<Course>;
  
  // Tutor Courses
  getTutorCourses(tutorId: string): Promise<(TutorCourse & { course: Course })[]>;
  addTutorCourse(data: InsertTutorCourse): Promise<TutorCourse>;
  removeTutorCourse(id: number, tutorId: string): Promise<void>;
  
  // Availabilities
  getAvailabilities(tutorId: string): Promise<Availability[]>;
  addAvailability(data: InsertAvailability): Promise<Availability>;
  removeAvailability(id: number, tutorId: string): Promise<void>;
  
  // Sessions
  getUserSessions(userId: string): Promise<(TutoringSession & { student: User, tutor: User, course: Course })[]>;
  getSession(id: number): Promise<(TutoringSession & { student: User, tutor: User, course: Course }) | undefined>;
  createSession(data: InsertTutoringSession): Promise<TutoringSession>;
  updateSessionStatus(id: number, status: string): Promise<TutoringSession>;
  deleteSession(id: number, userId: string): Promise<void>;
  
  // Messages
  getSessionMessages(sessionId: number): Promise<(Message & { sender: User })[]>;
  createMessage(data: InsertMessage & { sessionId: number }): Promise<Message>;
  deleteMessage(id: number, userId: string): Promise<void>;
  
  // Reviews
  getUserReviews(userId: string): Promise<(Review & { reviewer: User })[]>;
  createReview(data: InsertReview & { reviewerId: string }): Promise<Review>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async updateUser(id: string, profile: UpdateProfileRequest): Promise<User> {
    const [user] = await db.update(users)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async searchTutors(query: TutorSearchQuery): Promise<User[]> {
    let conditions = [or(eq(users.role, "tutor"), eq(users.role, "both"))];
    
    if (query.university) {
      conditions.push(eq(users.university, query.university));
    }

    const baseQ = db.selectDistinct().from(users);
    const joined = query.courseId
      ? baseQ.innerJoin(tutorCourses, eq(users.id, tutorCourses.tutorId))
      : baseQ;
    conditions.push(query.courseId ? eq(tutorCourses.courseId, parseInt(query.courseId)) : sql`true`);
    const rows = await joined.where(and(...conditions));
    return rows.map((r: any) => r.users ?? r) as User[];
  }

  // Courses
  async getAllCourses(query?: string): Promise<Course[]> {
    if (query) {
      return await db.select().from(courses).where(
        or(
          sql`lower(${courses.code}) like lower(${'%' + query + '%'})`,
          sql`lower(${courses.name}) like lower(${'%' + query + '%'})`
        )
      );
    }
    return await db.select().from(courses);
  }

  async createCourse(course: InsertCourse): Promise<Course> {
    const [newCourse] = await db.insert(courses).values(course).returning();
    return newCourse;
  }

  // Tutor Courses
  async getTutorCourses(tutorId: string): Promise<(TutorCourse & { course: Course })[]> {
    const results = await db.select({
      tutorCourse: tutorCourses,
      course: courses,
    })
    .from(tutorCourses)
    .innerJoin(courses, eq(tutorCourses.courseId, courses.id))
    .where(eq(tutorCourses.tutorId, tutorId));

    return results.map(r => ({ ...r.tutorCourse, course: r.course }));
  }

  async addTutorCourse(data: InsertTutorCourse): Promise<TutorCourse> {
    const [newTutorCourse] = await db.insert(tutorCourses).values(data as any).returning();
    return newTutorCourse;
  }

  async removeTutorCourse(id: number, tutorId: string): Promise<void> {
    await db.delete(tutorCourses).where(and(eq(tutorCourses.id, id), eq(tutorCourses.tutorId, tutorId)));
  }

  // Availabilities
  async getAvailabilities(tutorId: string): Promise<Availability[]> {
    return await db.select().from(availabilities).where(eq(availabilities.tutorId, tutorId));
  }

  async addAvailability(data: InsertAvailability): Promise<Availability> {
    const [newAvailability] = await db.insert(availabilities).values(data as any).returning();
    return newAvailability;
  }

  async removeAvailability(id: number, tutorId: string): Promise<void> {
    await db.delete(availabilities).where(and(eq(availabilities.id, id), eq(availabilities.tutorId, tutorId)));
  }

  // Sessions
  async getUserSessions(userId: string): Promise<(TutoringSession & { student: User, tutor: User, course: Course, lastMessage?: any })[]> {
    const results = await db.execute(sql`
      SELECT
        ts.*,
        row_to_json(s.*) AS student,
        row_to_json(t.*) AS tutor,
        row_to_json(c.*) AS course,
        (
          SELECT json_build_object(
            'id', m.id,
            'senderId', m.sender_id,
            'content', m.content,
            'type', m.type,
            'createdAt', m.created_at
          )
          FROM messages m
          WHERE m.session_id = ts.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) AS last_message
      FROM tutoring_sessions ts
      INNER JOIN users s ON ts.student_id = s.id
      INNER JOIN users t ON ts.tutor_id = t.id
      INNER JOIN courses c ON ts.course_id = c.id
      WHERE ts.student_id = ${userId} OR ts.tutor_id = ${userId}
      ORDER BY ts.created_at DESC
    `);

    return (results.rows as any[]).map(r => ({
      id: r.id,
      studentId: r.student_id,
      tutorId: r.tutor_id,
      courseId: r.course_id,
      status: r.status,
      date: r.date,
      startTime: r.start_time,
      durationMinutes: r.duration_minutes,
      notes: r.notes,
      isRecurring: r.is_recurring ?? false,
      recurringDays: r.recurring_days ?? null,
      createdAt: r.created_at,
      student: mapUser(r.student),
      tutor: mapUser(r.tutor),
      course: r.course,
      lastMessage: r.last_message || null,
    }));
  }

  async getSession(id: number): Promise<(TutoringSession & { student: User, tutor: User, course: Course }) | undefined> {
    const results = await db.execute(sql`
      SELECT
        ts.*,
        row_to_json(s.*) AS student,
        row_to_json(t.*) AS tutor,
        row_to_json(c.*) AS course
      FROM tutoring_sessions ts
      INNER JOIN users s ON ts.student_id = s.id
      INNER JOIN users t ON ts.tutor_id = t.id
      INNER JOIN courses c ON ts.course_id = c.id
      WHERE ts.id = ${id}
    `);

    if (results.rows.length === 0) return undefined;
    const r = results.rows[0] as any;
    return {
      id: r.id,
      studentId: r.student_id,
      tutorId: r.tutor_id,
      courseId: r.course_id,
      status: r.status,
      date: r.date,
      startTime: r.start_time,
      durationMinutes: r.duration_minutes,
      notes: r.notes,
      isRecurring: r.is_recurring ?? false,
      recurringDays: r.recurring_days ?? null,
      createdAt: r.created_at,
      student: mapUser(r.student),
      tutor: mapUser(r.tutor),
      course: r.course,
    };
  }

  async createSession(data: InsertTutoringSession): Promise<TutoringSession> {
    const [newSession] = await db.insert(tutoringSessions).values(data as any).returning();
    return newSession;
  }

  async updateSessionStatus(id: number, status: string): Promise<TutoringSession> {
    const [updatedSession] = await db.update(tutoringSessions)
      .set({ status: status as any })
      .where(eq(tutoringSessions.id, id))
      .returning();
    return updatedSession;
  }

  async deleteSession(id: number, userId: string): Promise<void> {
    await db
      .delete(tutoringSessions)
      .where(
        and(
          eq(tutoringSessions.id, id),
          or(eq(tutoringSessions.studentId, userId), eq(tutoringSessions.tutorId, userId)),
        ),
      );
  }

  // Messages
  async getSessionMessages(sessionId: number): Promise<(Message & { sender: User })[]> {
    const results = await db.select({
      message: messages,
      sender: users,
    })
    .from(messages)
    .innerJoin(users, eq(messages.senderId, users.id))
    .where(and(eq(messages.sessionId, sessionId), isNull(messages.deletedAt)))
    .orderBy(messages.createdAt);

    return results.map(r => ({ ...r.message, sender: r.sender }));
  }

  async createMessage(data: InsertMessage & { sessionId: number }): Promise<Message> {
    const [newMessage] = await db.insert(messages).values(data as any).returning();
    return newMessage;
  }

  async deleteMessage(id: number, userId: string): Promise<void> {
    await db
      .update(messages)
      .set({ deletedAt: new Date() })
      .where(and(eq(messages.id, id), eq(messages.senderId, userId)));
  }

  // Reviews
  async getUserReviews(userId: string): Promise<(Review & { reviewer: User })[]> {
    const results = await db.select({
      review: reviews,
      reviewer: users,
    })
    .from(reviews)
    .innerJoin(users, eq(reviews.reviewerId, users.id))
    .where(eq(reviews.revieweeId, userId))
    .orderBy(desc(reviews.createdAt));

    return results.map(r => ({ ...r.review, reviewer: r.reviewer }));
  }

  async createReview(data: InsertReview & { reviewerId: string }): Promise<Review> {
    const [newReview] = await db.insert(reviews).values(data).returning();
    return newReview;
  }
}

export const storage = new DatabaseStorage();
