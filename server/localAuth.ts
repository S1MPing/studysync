import type { Express } from "express";
import { db } from "./db";
import { users, passwordResetTokens, auditLogs, blockedUsers, reports, tutorCourses, availabilities, tutoringSessions, messages, reviews } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import * as crypto from "crypto";

// Simple password hashing using Node's built-in crypto (no extra deps needed)
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const hashBuffer = crypto.scryptSync(password, salt, 64);
  return hashBuffer.toString("hex") === hash;
}

// Send email via Resend API
async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "StudySync <onboarding@resend.dev>",
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Resend API error: ${error}`);
  }

  return res.json();
}

// Audit log helper
export async function createAuditLog(data: {
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    await db.insert(auditLogs).values({
      userId: data.userId || null,
      action: data.action,
      entityType: data.entityType || null,
      entityId: data.entityId || null,
      details: data.details || null,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
    });
  } catch (e) {
    // Non-fatal
    console.error("Audit log error:", e);
  }
}

const registerSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

export function registerLocalAuthRoutes(app: Express): void {

  // Register
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName } = registerSchema.parse(req.body);

      // Check if user already exists
      const [existing] = await db.select().from(users).where(eq(users.email, email));
      if (existing) {
        return res.status(400).json({ message: "An account with this email already exists" });
      }

      const hashed = hashPassword(password);
      const [user] = await db.insert(users).values({
        email,
        password: hashed,
        firstName,
        lastName,
      }).returning();

      // Set session
      (req.session as any).userId = user.id;

      await createAuditLog({
        userId: user.id,
        action: "user.register",
        entityType: "user",
        entityId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      // Return user without password
      const { password: _pw, ...safeUser } = user;
      return res.json(safeUser);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Register error:", err);
      return res.status(500).json({ message: "Registration failed" });
    }
  });

  // Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);

      const [user] = await db.select().from(users).where(eq(users.email, email));
      if (!user || !user.password) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (user.isBanned) {
        // Auto-unban if ban has expired
        if (user.bannedUntil && new Date() > new Date(user.bannedUntil)) {
          await db.update(users).set({ isBanned: false, bannedUntil: null, banReason: null, updatedAt: new Date() }).where(eq(users.id, user.id));
        } else {
          return res.status(403).json({ message: "This account has been suspended." });
        }
      }

      const valid = verifyPassword(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Set session
      (req.session as any).userId = user.id;

      await createAuditLog({
        userId: user.id,
        action: "user.login",
        entityType: "user",
        entityId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      const { password: _pw, ...safeUser } = user;
      return res.json(safeUser);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Login error:", err);
      return res.status(500).json({ message: "Login failed" });
    }
  });

  // Get current user
  app.get("/api/auth/user", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      if (user.isBanned) {
        // Auto-unban if ban has expired
        if (user.bannedUntil && new Date() > new Date(user.bannedUntil)) {
          await db.update(users).set({ isBanned: false, bannedUntil: null, banReason: null, updatedAt: new Date() }).where(eq(users.id, userId));
          const { password: _pw, ...safeUser2 } = (await db.select().from(users).where(eq(users.id, userId)))[0];
          return res.json(safeUser2);
        }
        (req.session as any).destroy?.(() => {});
        return res.status(403).json({
          message: "banned",
          bannedUntil: user.bannedUntil ?? null,
          banReason: user.banReason ?? null,
        });
      }
      const { password: _pw, ...safeUser } = user;
      return res.json(safeUser);
    } catch (err) {
      return res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Change Password
  app.post("/api/auth/change-password", isAuthenticated, async (req: any, res) => {
    try {
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
      const [user] = await db.select().from(users).where(eq(users.id, req.userId));
      if (!user || !user.password) {
        return res.status(404).json({ message: "User not found" });
      }
      const valid = verifyPassword(currentPassword, user.password);
      if (!valid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      const hashed = hashPassword(newPassword);
      await db.update(users).set({ password: hashed, updatedAt: new Date() }).where(eq(users.id, req.userId));

      await createAuditLog({
        userId: req.userId,
        action: "user.change_password",
        entityType: "user",
        entityId: req.userId,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      return res.json({ message: "Password changed successfully" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      return res.status(500).json({ message: "Failed to change password" });
    }
  });

  // Delete Account
  app.delete("/api/auth/account", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;

      await createAuditLog({
        userId,
        action: "user.delete_account",
        entityType: "user",
        entityId: userId,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      // Delete user — cascade handles related records
      await db.delete(users).where(eq(users.id, userId));

      req.session.destroy(() => {});
      return res.json({ message: "Account deleted" });
    } catch (err) {
      console.error("Delete account error:", err);
      return res.status(500).json({ message: "Failed to delete account" });
    }
  });

  // Block a user
  app.post("/api/users/:id/block", isAuthenticated, async (req: any, res) => {
    try {
      const blockedId = req.params.id;
      if (blockedId === req.userId) {
        return res.status(400).json({ message: "Cannot block yourself" });
      }
      // Upsert — ignore duplicates
      const existing = await db.select().from(blockedUsers)
        .where(and(eq(blockedUsers.blockerId, req.userId), eq(blockedUsers.blockedId, blockedId)));
      if (existing.length === 0) {
        await db.insert(blockedUsers).values({ blockerId: req.userId, blockedId });
      }
      await createAuditLog({ userId: req.userId, action: "user.block", entityType: "user", entityId: blockedId, ipAddress: req.ip });
      return res.json({ message: "User blocked" });
    } catch (err) {
      return res.status(500).json({ message: "Failed to block user" });
    }
  });

  // Unblock a user
  app.delete("/api/users/:id/block", isAuthenticated, async (req: any, res) => {
    try {
      await db.delete(blockedUsers).where(
        and(eq(blockedUsers.blockerId, req.userId), eq(blockedUsers.blockedId, req.params.id))
      );
      return res.json({ message: "User unblocked" });
    } catch (err) {
      return res.status(500).json({ message: "Failed to unblock user" });
    }
  });

  // Get my blocked users
  app.get("/api/users/me/blocked", isAuthenticated, async (req: any, res) => {
    try {
      const blocked = await db.select().from(blockedUsers).where(eq(blockedUsers.blockerId, req.userId));
      return res.json(blocked);
    } catch (err) {
      return res.status(500).json({ message: "Failed to fetch blocked users" });
    }
  });

  // Report a user
  app.post("/api/users/:id/report", isAuthenticated, async (req: any, res) => {
    try {
      const reportedId = req.params.id;
      if (reportedId === req.userId) {
        return res.status(400).json({ message: "Cannot report yourself" });
      }
      const { reason, details } = z.object({
        reason: z.string().min(1),
        details: z.string().optional(),
      }).parse(req.body);

      const [report] = await db.insert(reports).values({
        reporterId: req.userId,
        reportedId,
        reason,
        details: details || null,
      }).returning();

      await createAuditLog({
        userId: req.userId,
        action: "user.report",
        entityType: "user",
        entityId: reportedId,
        details: { reason },
        ipAddress: req.ip,
      });

      return res.status(201).json(report);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      return res.status(500).json({ message: "Failed to submit report" });
    }
  });

  // Forgot Password — sends reset email
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);

      const [user] = await db.select().from(users).where(eq(users.email, email));

      // Always return success to prevent email enumeration
      if (!user) {
        return res.json({ message: "If that email exists, a reset link has been sent." });
      }

      // Generate a secure token
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store token in database
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token,
        expiresAt,
      });

      // Build reset link
      const baseUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`;
      const resetLink = `${baseUrl}/reset-password?token=${token}`;

      // Send email
      try {
        await sendEmail(email, "Reset your StudySync password", `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #16a34a; font-size: 24px; margin: 0;">StudySync</h1>
            </div>
            <h2 style="color: #1f2937; font-size: 20px;">Reset your password</h2>
            <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
              Hi ${user.firstName || "there"},<br><br>
              We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetLink}" style="background-color: #16a34a; color: white; padding: 12px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p style="color: #9ca3af; font-size: 12px; line-height: 1.5;">
              If you didn't request this, you can safely ignore this email. Your password won't change unless you click the link above.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            <p style="color: #9ca3af; font-size: 11px; text-align: center;">
              StudySync — Peer Tutoring Platform
            </p>
          </div>
        `);
      } catch (emailErr) {
        console.error("Failed to send reset email:", emailErr);
        return res.status(500).json({ message: "Failed to send reset email." });
      }

      return res.json({ message: "If that email exists, a reset link has been sent." });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Forgot password error:", err);
      return res.status(500).json({ message: "Something went wrong" });
    }
  });

  // Reset Password — validates token and sets new password
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = resetPasswordSchema.parse(req.body);

      // Find valid, unused, non-expired token
      const [resetToken] = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, token),
            eq(passwordResetTokens.used, false)
          )
        );

      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired reset link" });
      }

      if (new Date() > new Date(resetToken.expiresAt)) {
        return res.status(400).json({ message: "This reset link has expired. Please request a new one." });
      }

      // Update password
      const hashed = hashPassword(password);
      await db.update(users)
        .set({ password: hashed, updatedAt: new Date() })
        .where(eq(users.id, resetToken.userId));

      // Mark token as used
      await db.update(passwordResetTokens)
        .set({ used: true })
        .where(eq(passwordResetTokens.id, resetToken.id));

      return res.json({ message: "Password reset successful. You can now sign in." });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Reset password error:", err);
      return res.status(500).json({ message: "Something went wrong" });
    }
  });

  // Logout
  app.post("/api/auth/logout", (req: any, res) => {
    const userId = (req.session as any)?.userId;
    if (userId) {
      createAuditLog({ userId, action: "user.logout", entityType: "user", entityId: userId, ipAddress: req.ip }).catch(() => {});
    }
    req.session.destroy(() => {
      res.json({ message: "Logged out" });
    });
  });
}

// Middleware to check auth
export const isAuthenticated = async (req: any, res: any, next: any) => {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  // Check if the user has been banned since they logged in
  const [user] = await db.select({ isBanned: users.isBanned, bannedUntil: users.bannedUntil, banReason: users.banReason }).from(users).where(eq(users.id, userId));
  if (user?.isBanned) {
    // Auto-unban if ban has expired
    if (user.bannedUntil && new Date() > new Date(user.bannedUntil)) {
      await db.update(users).set({ isBanned: false, bannedUntil: null, banReason: null, updatedAt: new Date() }).where(eq(users.id, userId));
    } else {
      return res.status(403).json({ message: "banned", bannedUntil: user.bannedUntil ?? null, banReason: user.banReason ?? null });
    }
  }
  req.userId = userId;
  next();
};

// Middleware to check admin
export const isAdmin = async (req: any, res: any, next: any) => {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user || !user.isAdmin) {
    return res.status(403).json({ message: "Forbidden" });
  }
  req.userId = userId;
  req.adminUser = user;
  next();
};
