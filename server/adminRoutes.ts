import type { Express } from "express";
import { db } from "./db";
import { users, tutoringSessions, messages, courses, auditLogs, reports, blockedUsers } from "@shared/schema";
import { eq, desc, ilike, or, count, sql, and } from "drizzle-orm";
import { isAdmin, createAuditLog } from "./localAuth";
import { getOnlineUserIds } from "./websocket";
import { z } from "zod";
import * as crypto from "crypto";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function registerAdminRoutes(app: Express) {

  // ── STATS ──────────────────────────────────────────────────
  app.get("/api/admin/stats", isAdmin, async (req: any, res) => {
    try {
      const [totalUsers] = await db.select({ count: count() }).from(users);
      const [totalSessions] = await db.select({ count: count() }).from(tutoringSessions);
      const [totalMessages] = await db.select({ count: count() }).from(messages);
      const [totalCourses] = await db.select({ count: count() }).from(courses);
      const [pendingSessions] = await db.select({ count: count() }).from(tutoringSessions).where(eq(tutoringSessions.status, "pending"));
      const [activeSessions] = await db.select({ count: count() }).from(tutoringSessions).where(eq(tutoringSessions.status, "accepted"));
      const [completedSessions] = await db.select({ count: count() }).from(tutoringSessions).where(eq(tutoringSessions.status, "completed"));
      const [totalTutors] = await db.select({ count: count() }).from(users).where(or(eq(users.role, "tutor"), eq(users.role, "both")));
      const [totalStudents] = await db.select({ count: count() }).from(users).where(or(eq(users.role, "student"), eq(users.role, "both")));
      const [pendingReports] = await db.select({ count: count() }).from(reports).where(eq(reports.status, "pending"));
      const [bannedUsers] = await db.select({ count: count() }).from(users).where(eq(users.isBanned, true));
      const [adminUsers] = await db.select({ count: count() }).from(users).where(eq(users.isAdmin, true));

      // Recent signups per day (last 7 days)
      const recentSignups = await db.execute(sql`
        SELECT DATE(created_at) as day, COUNT(*) as count
        FROM users
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY day ASC
      `);

      // Sessions per status
      const sessionsByStatus = await db.execute(sql`
        SELECT status, COUNT(*) as count FROM tutoring_sessions GROUP BY status
      `);

      // Users by role
      const usersByRole = await db.execute(sql`
        SELECT role, COUNT(*) as count FROM users GROUP BY role
      `);

      res.json({
        totalUsers: Number(totalUsers.count),
        totalSessions: Number(totalSessions.count),
        totalMessages: Number(totalMessages.count),
        totalCourses: Number(totalCourses.count),
        pendingSessions: Number(pendingSessions.count),
        activeSessions: Number(activeSessions.count),
        completedSessions: Number(completedSessions.count),
        totalTutors: Number(totalTutors.count),
        totalStudents: Number(totalStudents.count),
        pendingReports: Number(pendingReports.count),
        bannedUsers: Number(bannedUsers.count),
        adminUsers: Number(adminUsers.count),
        recentSignups: recentSignups.rows,
        sessionsByStatus: sessionsByStatus.rows,
        usersByRole: usersByRole.rows,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // ── ONLINE USERS ───────────────────────────────────────────
  app.get("/api/admin/online-users", isAdmin, async (_req, res) => {
    res.json({ onlineUserIds: getOnlineUserIds() });
  });

  // ── USERS ──────────────────────────────────────────────────
  app.get("/api/admin/users", isAdmin, async (req: any, res) => {
    try {
      const { search, role, page = "1", limit = "50" } = req.query as any;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      let query = db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        university: users.university,
        isVerified: users.isVerified,
        isAdmin: users.isAdmin,
        adminRole: users.adminRole,
        isBanned: users.isBanned,
        bannedUntil: users.bannedUntil,
        banReason: users.banReason,
        createdAt: users.createdAt,
        profileImageUrl: users.profileImageUrl,
      }).from(users).$dynamic();

      const conditions: any[] = [];
      if (search) {
        conditions.push(or(
          ilike(users.email, `%${search}%`),
          ilike(users.firstName, `%${search}%`),
          ilike(users.lastName, `%${search}%`),
        ));
      }
      if (role && role !== "all") {
        conditions.push(eq(users.role, role));
      }
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      const [{ count: total }] = await db.select({ count: count() }).from(users);

      const results = await query.orderBy(desc(users.createdAt)).limit(parseInt(limit)).offset(offset);

      res.json({ users: results, total: Number(total), page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch("/api/admin/users/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const schema = z.object({
        isVerified: z.boolean().optional(),
        isAdmin: z.boolean().optional(),
        adminRole: z.enum(["super-admin", "admin", "editor", "viewer"]).nullable().optional(),
        isBanned: z.boolean().optional(),
        bannedUntil: z.string().nullable().optional(),
        banReason: z.string().nullable().optional(),
        role: z.enum(["student", "tutor", "both"]).optional(),
      });
      const rawUpdates = schema.parse(req.body);
      const updates: any = { ...rawUpdates, updatedAt: new Date() };
      if ("bannedUntil" in rawUpdates) {
        updates.bannedUntil = rawUpdates.bannedUntil ? new Date(rawUpdates.bannedUntil) : null;
      }

      const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
      if (!updated) return res.status(404).json({ message: "User not found" });

      await createAuditLog({
        userId: req.userId,
        action: "admin.update_user",
        entityType: "user",
        entityId: id,
        details: updates,
        ipAddress: req.ip,
      });

      const { password: _pw, ...safeUser } = updated;
      res.json(safeUser);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/admin/users/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      if (id === req.userId) return res.status(400).json({ message: "Cannot delete your own admin account" });

      await createAuditLog({
        userId: req.userId,
        action: "admin.delete_user",
        entityType: "user",
        entityId: id,
        ipAddress: req.ip,
      });

      await db.delete(users).where(eq(users.id, id));
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Reset user password (admin)
  app.post("/api/admin/users/:id/reset-password", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { password } = z.object({ password: z.string().min(6) }).parse(req.body);
      const hashed = hashPassword(password);
      await db.update(users).set({ password: hashed, updatedAt: new Date() }).where(eq(users.id, id));

      await createAuditLog({
        userId: req.userId,
        action: "admin.reset_user_password",
        entityType: "user",
        entityId: id,
        ipAddress: req.ip,
      });

      res.json({ message: "Password reset" });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // ── SESSIONS ───────────────────────────────────────────────
  app.get("/api/admin/sessions", isAdmin, async (req: any, res) => {
    try {
      const { status, page = "1", limit = "50" } = req.query as any;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const results = await db.execute(sql`
        SELECT
          ts.*,
          json_build_object('id', s.id, 'firstName', s.first_name, 'lastName', s.last_name, 'email', s.email) AS student,
          json_build_object('id', t.id, 'firstName', t.first_name, 'lastName', t.last_name, 'email', t.email) AS tutor,
          json_build_object('id', c.id, 'code', c.code, 'name', c.name) AS course
        FROM tutoring_sessions ts
        INNER JOIN users s ON ts.student_id = s.id
        INNER JOIN users t ON ts.tutor_id = t.id
        INNER JOIN courses c ON ts.course_id = c.id
        ${status && status !== "all" ? sql`WHERE ts.status = ${status}` : sql``}
        ORDER BY ts.created_at DESC
        LIMIT ${parseInt(limit)} OFFSET ${offset}
      `);

      const [{ count: total }] = await db.select({ count: count() }).from(tutoringSessions);

      res.json({
        sessions: results.rows.map((r: any) => ({
          id: r.id,
          studentId: r.student_id,
          tutorId: r.tutor_id,
          courseId: r.course_id,
          status: r.status,
          date: r.date,
          startTime: r.start_time,
          durationMinutes: r.duration_minutes,
          notes: r.notes,
          createdAt: r.created_at,
          student: r.student,
          tutor: r.tutor,
          course: r.course,
        })),
        total: Number(total),
        page: parseInt(page),
        limit: parseInt(limit),
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  app.delete("/api/admin/sessions/:id", isAdmin, async (req: any, res) => {
    try {
      await createAuditLog({
        userId: req.userId,
        action: "admin.delete_session",
        entityType: "session",
        entityId: req.params.id,
        ipAddress: req.ip,
      });
      await db.delete(tutoringSessions).where(eq(tutoringSessions.id, parseInt(req.params.id)));
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete session" });
    }
  });

  // ── COURSES ────────────────────────────────────────────────
  app.post("/api/admin/courses", isAdmin, async (req: any, res) => {
    try {
      const schema = z.object({ code: z.string().min(1), name: z.string().min(1), university: z.string().min(1) });
      const data = schema.parse(req.body);
      const [course] = await db.insert(courses).values(data).returning();
      await createAuditLog({ userId: req.userId, action: "admin.create_course", entityType: "course", entityId: String(course.id), ipAddress: req.ip });
      res.status(201).json(course);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Failed to create course" });
    }
  });

  app.delete("/api/admin/courses/:id", isAdmin, async (req: any, res) => {
    try {
      await createAuditLog({ userId: req.userId, action: "admin.delete_course", entityType: "course", entityId: req.params.id, ipAddress: req.ip });
      await db.delete(courses).where(eq(courses.id, parseInt(req.params.id)));
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete course" });
    }
  });

  // ── AUDIT LOGS ─────────────────────────────────────────────
  app.get("/api/admin/audit-logs", isAdmin, async (req: any, res) => {
    try {
      const { page = "1", limit = "100", userId: filterUser } = req.query as any;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const results = await db.execute(sql`
        SELECT al.*,
          json_build_object('id', u.id, 'firstName', u.first_name, 'lastName', u.last_name, 'email', u.email) AS user
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ${filterUser ? sql`WHERE al.user_id = ${filterUser}` : sql``}
        ORDER BY al.created_at DESC
        LIMIT ${parseInt(limit)} OFFSET ${offset}
      `);

      const [{ count: total }] = await db.select({ count: count() }).from(auditLogs);

      res.json({
        logs: results.rows.map((r: any) => ({
          id: r.id,
          userId: r.user_id,
          action: r.action,
          entityType: r.entity_type,
          entityId: r.entity_id,
          details: r.details,
          ipAddress: r.ip_address,
          userAgent: r.user_agent,
          createdAt: r.created_at,
          user: r.user,
        })),
        total: Number(total),
        page: parseInt(page),
        limit: parseInt(limit),
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // ── MESSAGES (admin moderation) ────────────────────────────
  app.get("/api/admin/messages", isAdmin, async (req: any, res) => {
    try {
      const { search, sessionId, includeDeleted, page = "1", limit = "50" } = req.query as any;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const results = await db.execute(sql`
        SELECT m.*,
          json_build_object('id', u.id, 'firstName', u.first_name, 'lastName', u.last_name, 'email', u.email, 'profileImageUrl', u.profile_image_url) AS sender,
          json_build_object('id', ts.id, 'studentId', ts.student_id, 'tutorId', ts.tutor_id, 'courseCode', c.code) AS session
        FROM messages m
        INNER JOIN users u ON m.sender_id = u.id
        INNER JOIN tutoring_sessions ts ON m.session_id = ts.id
        LEFT JOIN courses c ON ts.course_id = c.id
        WHERE 1=1
          ${includeDeleted !== "true" ? sql`AND m.deleted_at IS NULL` : sql``}
          ${sessionId ? sql`AND m.session_id = ${parseInt(sessionId)}` : sql``}
          ${search ? sql`AND (m.content ILIKE ${"%" + search + "%"} OR u.email ILIKE ${"%" + search + "%"} OR u.first_name ILIKE ${"%" + search + "%"})` : sql``}
        ORDER BY m.created_at DESC
        LIMIT ${parseInt(limit)} OFFSET ${offset}
      `);

      res.json(results.rows.map((r: any) => ({
        id: r.id,
        sessionId: r.session_id,
        senderId: r.sender_id,
        content: r.content,
        type: r.type,
        fileUrl: r.file_url,
        createdAt: r.created_at,
        deletedAt: r.deleted_at,
        sender: r.sender,
        session: r.session,
      })));
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.delete("/api/admin/messages/:id", isAdmin, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.delete(messages).where(eq(messages.id, id));
      await createAuditLog({ userId: req.userId, action: "admin.delete_message", entityType: "message", entityId: String(id), ipAddress: req.ip });
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete message" });
    }
  });

  // ── REPORTS ────────────────────────────────────────────────
  app.get("/api/admin/reports", isAdmin, async (req: any, res) => {
    try {
      const { status } = req.query as any;
      const results = await db.execute(sql`
        SELECT r.*,
          json_build_object('id', rep.id, 'firstName', rep.first_name, 'lastName', rep.last_name, 'email', rep.email) AS reporter,
          json_build_object('id', red.id, 'firstName', red.first_name, 'lastName', red.last_name, 'email', red.email) AS reported,
          CASE WHEN r.message_id IS NOT NULL THEN
            json_build_object('id', m.id, 'content', m.content, 'type', m.type, 'deletedAt', m.deleted_at, 'createdAt', m.created_at)
          ELSE NULL END AS reported_message
        FROM reports r
        INNER JOIN users rep ON r.reporter_id = rep.id
        INNER JOIN users red ON r.reported_id = red.id
        LEFT JOIN messages m ON r.message_id = m.id
        ${status && status !== "all" ? sql`WHERE r.status = ${status}` : sql``}
        ORDER BY r.created_at DESC
      `);

      res.json(results.rows.map((r: any) => ({
        id: r.id,
        reporterId: r.reporter_id,
        reportedId: r.reported_id,
        messageId: r.message_id,
        reason: r.reason,
        details: r.details,
        status: r.status,
        createdAt: r.created_at,
        reporter: r.reporter,
        reported: r.reported,
        reportedMessage: r.reported_message,
      })));
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  app.patch("/api/admin/reports/:id", isAdmin, async (req: any, res) => {
    try {
      const { status } = z.object({
        status: z.enum(["pending", "reviewed", "dismissed", "actioned"]),
      }).parse(req.body);

      const [updated] = await db.update(reports).set({ status }).where(eq(reports.id, parseInt(req.params.id))).returning();
      await createAuditLog({ userId: req.userId, action: "admin.update_report", entityType: "report", entityId: req.params.id, details: { status }, ipAddress: req.ip });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Failed to update report" });
    }
  });
}
