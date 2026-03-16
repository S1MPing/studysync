import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { registerLocalAuthRoutes, isAuthenticated } from "./localAuth";
import { registerAdminRoutes } from "./adminRoutes";
import { db } from "./db";
import { courses, tutoringSessions, users, messages, reviews } from "@shared/schema";
import { eq, or, and, inArray, sql } from "drizzle-orm";
import { notifySessionRequest, notifySessionStatus, notifyNewMessage } from "./email";
import { broadcastToUser } from "./websocket";

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
  app.get("/api/users/students", async (req, res) => {
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
      const tutorCourse = await storage.addTutorCourse({ ...input, tutorId: req.userId });
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
      const availability = await storage.addAvailability({ ...input, tutorId: req.userId });
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
      const input = api.sessions.create.input.parse(rawInput);

      const sessionData = {
        ...input,
        studentId: input.studentId || req.userId,
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
        const student = await storage.getUser(sessionData.studentId);
        const studentName = student ? `${student.firstName || ""} ${student.lastName || ""}`.trim() : "A student";
        broadcastToUser(sessionData.tutorId, {
          type: "session-request",
          sessionId: session.id,
          studentName,
        });
      } catch {}

      // Email the tutor about the new request
      try {
        const tutor = await storage.getUser(sessionData.tutorId);
        const student = await storage.getUser(sessionData.studentId);
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

      if (!["completed", "cancelled", "declined"].includes(session.status)) {
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
      });

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
          preview: input.type === "text" ? (input.content || "").slice(0, 80) : input.type === "file" ? "Sent a file" : "Sent a message",
          messageType: input.type,
        });

        // Email for text messages only
        if (input.type === "text") {
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
