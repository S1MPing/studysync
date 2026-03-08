import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { registerLocalAuthRoutes, isAuthenticated } from "./localAuth";
import { db } from "./db";
import { courses, tutoringSessions, users } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Register local email/password auth routes
  registerLocalAuthRoutes(app);

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
      if (!image || typeof image !== "string") {
        return res.status(400).json({ message: "Image data is required" });
      }
      // Limit size ~2MB base64
      if (image.length > 2 * 1024 * 1024 * 1.37) {
        return res.status(400).json({ message: "Image too large. Max 2MB." });
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
      const input = api.sessions.create.input.parse(req.body);
      
      // If studentId is provided (tutor offering), use it. Otherwise the requester is the student.
      const sessionData = {
        ...input,
        studentId: input.studentId || req.userId,
        tutorId: input.tutorId || req.userId,
      };
      
      const session = await storage.createSession(sessionData);
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

      const input = api.messages.send.input.parse(req.body);
      const message = await storage.createMessage({
        ...input,
        sessionId,
        senderId: req.userId,
      });
      res.status(201).json(message);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
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
