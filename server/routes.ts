import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { registerLocalAuthRoutes, isAuthenticated } from "./localAuth";
import { registerAdminRoutes } from "./adminRoutes";
import { db } from "./db";
import { courses, tutoringSessions, users, messages, reviews, quizzes, flashcards, quizAttempts, studyGoals, studyRooms } from "@shared/schema";
import { insertQuizSchema, insertFlashcardSchema, insertStudyRoomSchema } from "@shared/schema";
import { eq, or, and, inArray, sql, ilike, desc } from "drizzle-orm";
import { notifySessionRequest, notifySessionStatus, notifyNewMessage } from "./email";
import { broadcastToUser, getRoomParticipantIds } from "./websocket";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Register local email/password auth routes
  registerLocalAuthRoutes(app);

  // Register admin routes
  registerAdminRoutes(app);

  // Users
  app.patch(api.users.updateProfile.path, isAuthenticated, async (req: any, res) => {
    try {
      const input = api.users.updateProfile.input.parse(req.body);
      const user = await storage.updateUser(req.userId, input);
      res.json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Profile image upload (base64)
  app.post("/api/users/me/avatar", isAuthenticated, async (req: any, res) => {
    try {
      const { image } = req.body;
      // Allow clearing the profile image
      if (image === null || image === "" || image === undefined) {
        const user = await storage.updateUser(req.userId, { profileImageUrl: null } as any);
        const { password: _pw, ...safeUser } = user;
        return res.json(safeUser);
      }
      if (typeof image !== "string") {
        return res.status(400).json({ message: "Invalid image data" });
      }
      // Limit size ~7MB binary (base64 overhead ~1.37x)
      if (image.length > 7 * 1024 * 1024 * 1.37) {
        return res.status(400).json({ message: "Image too large. Max 7MB." });
      }
      const user = await storage.updateUser(req.userId, { profileImageUrl: image } as any);
      const { password: _pw, ...safeUser } = user;
      res.json(safeUser);
    } catch (err) {
      res.status(500).json({ message: "Failed to upload image" });
    }
  });

  app.get(api.users.tutors.path, async (req, res) => {
    try {
      const queryParams = req.query;
      const tutors = await storage.searchTutors({
        courseId: queryParams.courseId as string | undefined,
        university: queryParams.university as string | undefined,
      });
      res.json(tutors);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get students (for tutors to browse)
  app.get("/api/users/students", isAuthenticated, async (req, res) => {
    try {
      const university = req.query.university as string | undefined;
      let query = db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        role: users.role,
        university: users.university,
        level: users.level,
        major: users.major,
        bio: users.bio,
        createdAt: users.createdAt,
      }).from(users).where(eq(users.role, "student"));

      const results = await query;
      const filtered = university && university !== "all" 
        ? results.filter(u => u.university === university)
        : results;
      res.json(filtered);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Search users by name (for report dialog)
  app.get("/api/users/search", isAuthenticated, async (req: any, res) => {
    try {
      const q = (req.query.q as string || "").toLowerCase().trim();
      if (!q || q.length < 2) return res.json([]);
      const all = await db.select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        role: users.role,
        university: users.university,
      }).from(users).where(eq(users.isBanned, false));
      const results = all.filter(u =>
        u.id !== req.userId &&
        (`${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
         (u.firstName?.toLowerCase() || "").includes(q) ||
         (u.lastName?.toLowerCase() || "").includes(q))
      ).slice(0, 10);
      res.json(results);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.users.getById.path, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Courses
  app.get(api.courses.list.path, async (req, res) => {
    try {
      const allCourses = await storage.getAllCourses(req.query.query as string | undefined);
      res.json(allCourses);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST /api/courses/find-or-create — authenticated users can find or create a course
  app.post("/api/courses/find-or-create", isAuthenticated, async (req: any, res) => {
    try {
      const { code, name, university } = req.body;
      if (!code || !name) return res.status(400).json({ message: "code and name are required" });
      const codeUpper = code.trim().toUpperCase();
      const uni = (university || "").trim();
      // Try to find existing course by code
      const existing = await db.select().from(courses).where(eq(courses.code, codeUpper));
      if (existing.length > 0) return res.json(existing[0]);
      // Create new
      const [course] = await db.insert(courses).values({ code: codeUpper, name: name.trim(), university: uni }).returning();
      res.json(course);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Tutor Courses
  app.get(api.tutorCourses.list.path, async (req, res) => {
    try {
      const courses = await storage.getTutorCourses(req.params.tutorId);
      res.json(courses);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.tutorCourses.add.path, isAuthenticated, async (req: any, res) => {
    try {
      const input = api.tutorCourses.add.input.parse(req.body);
      const tutorCourse = await storage.addTutorCourse({ ...input, tutorId: req.userId } as any);
      res.status(201).json(tutorCourse);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete(api.tutorCourses.remove.path, isAuthenticated, async (req: any, res) => {
    try {
      await storage.removeTutorCourse(parseInt(req.params.id), req.userId);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Availabilities
  app.get(api.availabilities.list.path, async (req, res) => {
    try {
      const items = await storage.getAvailabilities(req.params.tutorId);
      res.json(items);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.availabilities.add.path, isAuthenticated, async (req: any, res) => {
    try {
      const input = api.availabilities.add.input.parse(req.body);
      const availability = await storage.addAvailability({ ...input, tutorId: req.userId } as any);
      res.status(201).json(availability);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete(api.availabilities.remove.path, isAuthenticated, async (req: any, res) => {
    try {
      await storage.removeAvailability(parseInt(req.params.id), req.userId);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Sessions
  app.get(api.sessions.list.path, isAuthenticated, async (req: any, res) => {
    try {
      const sessions = await storage.getUserSessions(req.userId);
      res.json(sessions);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.sessions.get.path, isAuthenticated, async (req: any, res) => {
    try {
      const session = await storage.getSession(parseInt(req.params.id));
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      if (session.studentId !== req.userId && session.tutorId !== req.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      res.json(session);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.sessions.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const { recurringWeeks, ...rawInput } = req.body;
      const input = api.sessions.create.input.parse({
        ...rawInput,
        studentId: rawInput.studentId || req.userId,
      });

      const sessionData = {
        ...input,
        tutorId: input.tutorId || req.userId,
      };

      const session = await storage.createSession(sessionData);

      // Create recurring copies if requested (up to 12 weeks)
      const weeks = Math.min(parseInt(recurringWeeks || "1", 10), 12);
      if (weeks > 1 && sessionData.date) {
        for (let w = 1; w < weeks; w++) {
          const d = new Date(sessionData.date);
          d.setDate(d.getDate() + w * 7);
          await storage.createSession({ ...sessionData, date: d });
        }
      }

      // Notify tutor via WebSocket + email about new session request
      try {
        const student = await storage.getUser(sessionData.studentId!);
        const studentName = student ? `${student.firstName || ""} ${student.lastName || ""}`.trim() : "A student";
        broadcastToUser(sessionData.tutorId!, {
          type: "session-request",
          sessionId: session.id,
          studentName,
        });
      } catch {}

      // Email the tutor about the new request
      try {
        const tutor = await storage.getUser(sessionData.tutorId!);
        const student = await storage.getUser(sessionData.studentId!);
        const course = (await db.select().from(courses).where(eq(courses.id, sessionData.courseId!)))[0];
        if (tutor?.email && student && course) {
          notifySessionRequest(tutor.email, tutor.firstName || "Tutor", `${student.firstName} ${student.lastName}`, course.code).catch(() => {});
        }
      } catch {}

      res.status(201).json(session);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Create session error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch(api.sessions.updateStatus.path, isAuthenticated, async (req: any, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const session = await storage.getSession(sessionId);

      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      const isTutor = session.tutorId === req.userId;
      const isStudent = session.studentId === req.userId;

      if (!isTutor && !isStudent) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const input = api.sessions.updateStatus.input.parse(req.body);

      if (["accepted", "declined"].includes(input.status) && !isTutor) {
        return res.status(401).json({ message: "Only tutor can accept or decline" });
      }

      const updated = await storage.updateSessionStatus(sessionId, input.status);

      // Email the student when tutor accepts/declines
      if (["accepted", "declined"].includes(input.status)) {
        try {
          const student = await storage.getUser(session.studentId);
          const course = (await db.select().from(courses).where(eq(courses.id, session.courseId)))[0];
          if (student?.email && course) {
            notifySessionStatus(student.email, student.firstName || "Student", input.status, course.code, session.tutor?.firstName || "Tutor").catch(() => {});
          }
        } catch {}
      }

      // Notify both parties via WebSocket so they don't need to refresh
      try {
        const actor = await storage.getUser(req.userId);
        const actorName = actor ? `${actor.firstName || ""} ${actor.lastName || ""}`.trim() : "Someone";
        broadcastToUser(session.studentId, { type: "session-update", sessionId, status: input.status, actorName });
        broadcastToUser(session.tutorId, { type: "session-update", sessionId, status: input.status, actorName });
      } catch {}

      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Schedule a session (set date/time after chatting)
  app.patch(api.sessions.schedule.path, isAuthenticated, async (req: any, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const session = await storage.getSession(sessionId);

      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      if (session.studentId !== req.userId && session.tutorId !== req.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (session.status !== "accepted") {
        return res.status(400).json({ message: "Session must be accepted before scheduling" });
      }

      const input = api.sessions.schedule.input.parse(req.body);
      
      // Update session with schedule and set status to "scheduled"
      const [updated] = await db.update(tutoringSessions)
        .set({ 
          date: input.date, 
          startTime: input.startTime, 
          durationMinutes: input.durationMinutes,
          status: "scheduled" 
        })
        .where(eq(tutoringSessions.id, sessionId))
        .returning();
      
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete a session (only participants; typically after completion/cancellation)
  app.delete(api.sessions.delete.path, isAuthenticated, async (req: any, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const session = await storage.getSession(sessionId);

      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      if (session.studentId !== req.userId && session.tutorId !== req.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!["completed", "cancelled", "declined"].includes(session.status ?? "")) {
        return res.status(400).json({ message: "Only completed or cancelled sessions can be deleted" });
      }

      await storage.deleteSession(sessionId, req.userId);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Messages
  app.get(api.messages.list.path, isAuthenticated, async (req: any, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const session = await storage.getSession(sessionId);

      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      if (session.studentId !== req.userId && session.tutorId !== req.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const items = await storage.getSessionMessages(sessionId);
      res.json(items);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.messages.send.path, isAuthenticated, async (req: any, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const session = await storage.getSession(sessionId);

      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      if (session.studentId !== req.userId && session.tutorId !== req.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Allow larger fileUrl for documents/videos/images (up to ~50MB base64)
      const { fileUrl, ...rest } = req.body;
      if (fileUrl && typeof fileUrl === "string" && fileUrl.length > 50 * 1024 * 1024 * 1.37) {
        return res.status(413).json({ message: "File too large. Max 50MB." });
      }

      const input = api.messages.send.input.parse({ ...rest, fileUrl });
      const message = await storage.createMessage({
        ...input,
        sessionId,
        senderId: req.userId,
      } as any);

      // Notify the other party via WebSocket and email
      try {
        const otherId = session.studentId === req.userId ? session.tutorId : session.studentId;
        const sender = await storage.getUser(req.userId);
        const senderName = sender ? `${sender.firstName || ""} ${sender.lastName || ""}`.trim() : "Someone";

        // WebSocket notification to the other person
        broadcastToUser(otherId, {
          type: "message-notification",
          sessionId,
          senderName,
          preview: (input.type as string) === "text" ? (input.content || "").slice(0, 80) : "Sent a file",
          messageType: input.type,
        });

        // Email for text messages only
        if ((input.type as string) === "text") {
          const other = await storage.getUser(otherId);
          const course = (await db.select().from(courses).where(eq(courses.id, session.courseId)))[0];
          if (other?.email && sender && course) {
            notifyNewMessage(other.email, other.firstName || "", senderName, course.code).catch(() => {});
          }
        }
      } catch {}

      res.status(201).json(message);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete(api.messages.delete.path, isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      // Ensure message exists and belongs to a session the user is in
      const msgList = await db.select().from(messages).where(eq(messages.id, id));
      if (!msgList[0]) {
        return res.status(404).json({ message: "Message not found" });
      }
      const msg = msgList[0];
      const session = await storage.getSession(msg.sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      if (session.studentId !== req.userId && session.tutorId !== req.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await storage.deleteMessage(id, req.userId);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update session notes
  app.patch("/api/sessions/:id/notes", isAuthenticated, async (req: any, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const session = await storage.getSession(sessionId);
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.studentId !== req.userId && session.tutorId !== req.userId) return res.status(401).json({ message: "Unauthorized" });
      const { notes } = z.object({ notes: z.string().max(2000) }).parse(req.body);
      const [updated] = await db.update(tutoringSessions).set({ notes }).where(eq(tutoringSessions.id, sessionId)).returning();
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all file messages for the current user's sessions (media gallery)
  app.get("/api/messages/files", isAuthenticated, async (req: any, res) => {
    try {
      const userSessions = await storage.getUserSessions(req.userId);
      const sessionIds = userSessions.map(s => s.id);
      if (sessionIds.length === 0) return res.json([]);

      const fileMessages = await db.execute(sql`
        SELECT m.*,
          json_build_object('id', u.id, 'firstName', u.first_name, 'lastName', u.last_name, 'profileImageUrl', u.profile_image_url) AS sender,
          json_build_object('id', c.id, 'code', c.code, 'name', c.name) AS course
        FROM messages m
        INNER JOIN users u ON m.sender_id = u.id
        INNER JOIN tutoring_sessions ts ON m.session_id = ts.id
        INNER JOIN courses c ON ts.course_id = c.id
        WHERE m.type IN ('image', 'video', 'document')
          AND m.session_id = ANY(${sessionIds})
        ORDER BY m.created_at DESC
        LIMIT 200
      `);

      res.json(fileMessages.rows.map((r: any) => ({
        id: r.id,
        sessionId: r.session_id,
        senderId: r.sender_id,
        content: r.content,
        type: r.type,
        fileUrl: r.file_url,
        createdAt: r.created_at,
        sender: r.sender,
        course: r.course,
      })));
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Check if user has already reviewed a session
  app.get("/api/sessions/:id/review-status", isAuthenticated, async (req: any, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const existing = await db.select().from(reviews)
        .where(and(eq(reviews.sessionId, sessionId), eq(reviews.reviewerId, req.userId)));
      res.json({ hasReviewed: existing.length > 0 });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Reviews
  app.get(api.reviews.getByUser.path, async (req, res) => {
    try {
      const items = await storage.getUserReviews(req.params.userId);
      res.json(items);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.reviews.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const input = api.reviews.create.input.parse(req.body);
      const review = await storage.createReview({
        ...input,
        reviewerId: req.userId,
      });
      res.status(201).json(review);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ---- QUIZ ROUTES ----

  // GET /api/quizzes - list all public quizzes (optional ?courseId=)
  app.get("/api/quizzes", async (req, res) => {
    try {
      const courseIdParam = req.query.courseId ? parseInt(req.query.courseId as string) : undefined;
      let query = db.select().from(quizzes).where(eq(quizzes.isPublic, true)).orderBy(desc(quizzes.createdAt));
      const results = await query;
      const filtered = courseIdParam
        ? results.filter(q => q.courseId === courseIdParam)
        : results;
      res.json(filtered);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST /api/quizzes - create quiz
  app.post("/api/quizzes", isAuthenticated, async (req: any, res) => {
    try {
      const input = insertQuizSchema.parse(req.body);
      const [quiz] = await db.insert(quizzes).values({
        ...input,
        tutorId: req.userId,
      }).returning();
      res.status(201).json(quiz);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/quizzes/:id - get quiz with flashcards
  app.get("/api/quizzes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, id));
      if (!quiz) return res.status(404).json({ message: "Quiz not found" });
      const cards = await db.select().from(flashcards).where(eq(flashcards.quizId, id)).orderBy(flashcards.orderIdx);
      res.json({ ...quiz, flashcards: cards });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // DELETE /api/quizzes/:id - delete quiz (owner only)
  app.delete("/api/quizzes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, id));
      if (!quiz) return res.status(404).json({ message: "Quiz not found" });
      if (quiz.tutorId !== req.userId) return res.status(401).json({ message: "Unauthorized" });
      await db.delete(quizzes).where(eq(quizzes.id, id));
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST /api/quizzes/:id/cards - add flashcard
  app.post("/api/quizzes/:id/cards", isAuthenticated, async (req: any, res) => {
    try {
      const quizId = parseInt(req.params.id);
      const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, quizId));
      if (!quiz) return res.status(404).json({ message: "Quiz not found" });
      if (quiz.tutorId !== req.userId) return res.status(401).json({ message: "Unauthorized" });
      const input = insertFlashcardSchema.parse(req.body);
      const [card] = await db.insert(flashcards).values({ ...input, quizId }).returning();
      res.status(201).json(card);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // DELETE /api/quizzes/cards/:cardId - delete flashcard
  app.delete("/api/quizzes/cards/:cardId", isAuthenticated, async (req: any, res) => {
    try {
      const cardId = parseInt(req.params.cardId);
      const [card] = await db.select().from(flashcards).where(eq(flashcards.id, cardId));
      if (!card) return res.status(404).json({ message: "Flashcard not found" });
      const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, card.quizId));
      if (!quiz || quiz.tutorId !== req.userId) return res.status(401).json({ message: "Unauthorized" });
      await db.delete(flashcards).where(eq(flashcards.id, cardId));
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST /api/quizzes/:id/attempt - record attempt
  app.post("/api/quizzes/:id/attempt", isAuthenticated, async (req: any, res) => {
    try {
      const quizId = parseInt(req.params.id);
      const { score, totalCards } = z.object({ score: z.number(), totalCards: z.number() }).parse(req.body);
      const [attempt] = await db.insert(quizAttempts).values({
        userId: req.userId,
        quizId,
        score,
        totalCards,
      }).returning();
      res.status(201).json(attempt);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ---- STUDY ROOMS ROUTES ----

  // GET /api/rooms - list all rooms with host and course
  app.get("/api/rooms", async (req, res) => {
    try {
      const results = await db.execute(sql`
        SELECT
          r.*,
          r.is_active AS "isOpen",
          json_build_object('id', u.id, 'firstName', u.first_name, 'lastName', u.last_name) AS host,
          CASE WHEN r.course_id IS NOT NULL THEN
            json_build_object('id', c.id, 'code', c.code, 'name', c.name)
          ELSE NULL END AS course
        FROM study_rooms r
        INNER JOIN users u ON r.host_id = u.id
        LEFT JOIN courses c ON r.course_id = c.id
        ORDER BY r.created_at DESC
      `);
      const rooms = results.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        courseId: r.course_id,
        hostId: r.host_id,
        jitsiRoomId: r.jitsi_room_id,
        maxParticipants: r.max_participants,
        isActive: r.is_active,
        isOpen: r.is_active,
        createdAt: r.created_at,
        host: r.host,
        course: r.course,
      }));
      res.json(rooms);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST /api/rooms - create room
  app.post("/api/rooms", isAuthenticated, async (req: any, res) => {
    try {
      // Only tutors can create rooms
      const [creator] = await db.select({ role: users.role }).from(users).where(eq(users.id, req.userId));
      if (!creator || (creator.role !== "tutor" && creator.role !== "both")) {
        return res.status(403).json({ message: "Only tutors can create study rooms" });
      }
      const input = insertStudyRoomSchema.parse(req.body);
      const jitsiRoomId = "studysync-room-" + Math.random().toString(36).slice(2, 10);
      const [room] = await db.insert(studyRooms).values({
        ...input,
        hostId: req.userId,
        jitsiRoomId,
      } as any).returning();
      // Return with isOpen alias
      res.status(201).json({ ...room, isOpen: room.isActive });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // PATCH /api/rooms/:id/close - set isActive=false (host only)
  app.patch("/api/rooms/:id/close", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const [room] = await db.select().from(studyRooms).where(eq(studyRooms.id, id));
      if (!room) return res.status(404).json({ message: "Room not found" });
      if (room.hostId !== req.userId) return res.status(401).json({ message: "Unauthorized" });
      const [updated] = await db.update(studyRooms).set({ isActive: false }).where(eq(studyRooms.id, id)).returning();
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // DELETE /api/rooms/:id - delete room (host only)
  app.delete("/api/rooms/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const [room] = await db.select().from(studyRooms).where(eq(studyRooms.id, id));
      if (!room) return res.status(404).json({ message: "Room not found" });
      if (room.hostId !== req.userId) return res.status(401).json({ message: "Unauthorized" });
      await db.delete(studyRooms).where(eq(studyRooms.id, id));
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/rooms/:id/invite-candidates — users from accepted sessions (for invite list)
  app.get("/api/rooms/:id/invite-candidates", isAuthenticated, async (req: any, res) => {
    try {
      const results = await db.execute(sql`
        SELECT DISTINCT
          CASE WHEN ts.student_id = ${req.userId} THEN ts.tutor_id ELSE ts.student_id END as user_id,
          CASE WHEN ts.student_id = ${req.userId} THEN t.first_name ELSE s.first_name END as first_name,
          CASE WHEN ts.student_id = ${req.userId} THEN t.last_name ELSE s.last_name END as last_name,
          CASE WHEN ts.student_id = ${req.userId} THEN t.profile_image_url ELSE s.profile_image_url END as profile_image_url
        FROM tutoring_sessions ts
        INNER JOIN users s ON ts.student_id = s.id
        INNER JOIN users t ON ts.tutor_id = t.id
        WHERE (ts.student_id = ${req.userId} OR ts.tutor_id = ${req.userId})
          AND ts.status = 'accepted'
      `);
      res.json(results.rows.map((r: any) => ({
        id: r.user_id,
        firstName: r.first_name,
        lastName: r.last_name,
        profileImageUrl: r.profile_image_url,
      })));
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch candidates" });
    }
  });

  // ---- GOALS ROUTES ----

  // GET /api/goals - get current user's goal
  app.get("/api/goals", isAuthenticated, async (req: any, res) => {
    try {
      const [goal] = await db.select().from(studyGoals).where(eq(studyGoals.userId, req.userId));
      res.json(goal || null);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST /api/goals - upsert goal by userId
  app.post("/api/goals", isAuthenticated, async (req: any, res) => {
    try {
      const { weeklyHoursTarget } = z.object({ weeklyHoursTarget: z.number().min(1).max(168) }).parse(req.body);
      const [goal] = await db.insert(studyGoals)
        .values({ userId: req.userId, weeklyHoursTarget, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: studyGoals.userId,
          set: { weeklyHoursTarget, updatedAt: new Date() },
        })
        .returning();
      res.json(goal);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ---- SEARCH ROUTE ----

  // GET /api/search?q=... - search across users (tutors), courses, quizzes
  app.get("/api/search", async (req, res) => {
    try {
      const q = ((req.query.q as string) || "").trim();
      if (!q || q.length < 1) return res.json({ users: [], courses: [], quizzes: [] });

      const pattern = `%${q}%`;

      const [matchedUsers, matchedCourses, matchedQuizzes] = await Promise.all([
        db.select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          role: users.role,
          university: users.university,
          bio: users.bio,
        }).from(users).where(
          and(
            eq(users.isBanned, false),
            or(
              ilike(users.firstName, pattern),
              ilike(users.lastName, pattern),
              ilike(users.university, pattern),
            )
          )
        ).limit(10),

        db.select().from(courses).where(
          or(
            ilike(courses.code, pattern),
            ilike(courses.name, pattern),
            ilike(courses.university, pattern),
          )
        ).limit(10),

        db.select().from(quizzes).where(
          and(
            eq(quizzes.isPublic, true),
            ilike(quizzes.title, pattern),
          )
        ).limit(10),
      ]);

      res.json({ users: matchedUsers, courses: matchedCourses, quizzes: matchedQuizzes });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ---- ICAL EXPORT ----

  // GET /api/sessions/ical - return .ics file for all user's sessions
  app.get("/api/sessions/ical", isAuthenticated, async (req: any, res) => {
    try {
      const userSessions = await storage.getUserSessions(req.userId);

      const pad = (n: number) => String(n).padStart(2, "0");
      const toIcalDate = (d: Date) => {
        return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
      };

      const lines: string[] = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//StudySync//StudySync Calendar//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
      ];

      for (const session of userSessions) {
        if (!session.date) continue;
        const start = new Date(session.date);
        const end = new Date(start.getTime() + (session.durationMinutes || 60) * 60 * 1000);
        const summary = `Study Session (${session.status})`;
        const description = session.notes ? session.notes.replace(/\n/g, "\\n") : "";
        lines.push("BEGIN:VEVENT");
        lines.push(`UID:studysync-session-${session.id}@studysync`);
        lines.push(`DTSTAMP:${toIcalDate(new Date())}`);
        lines.push(`DTSTART:${toIcalDate(start)}`);
        lines.push(`DTEND:${toIcalDate(end)}`);
        lines.push(`SUMMARY:${summary}`);
        if (description) lines.push(`DESCRIPTION:${description}`);
        lines.push("END:VEVENT");
      }

      lines.push("END:VCALENDAR");

      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=studysync-sessions.ics");
      res.send(lines.join("\r\n"));
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  try {
    const existingCourses = await db.select().from(courses);
    if (existingCourses.length === 0) {
      await db.insert(courses).values([
        { code: "MATH 121", name: "Calculus I", university: "University of Ghana" },
        { code: "MATH 122", name: "Calculus II", university: "University of Ghana" },
        { code: "ACCT 201", name: "Financial Accounting", university: "UPSA" },
        { code: "CSCD 201", name: "Information Systems", university: "KNUST" },
        { code: "ECON 101", name: "Microeconomics", university: "University of Ghana" },
        { code: "STAT 111", name: "Introduction to Statistics", university: "UPSA" },
      ]);
      console.log("Database seeded with default courses.");
    }
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}
