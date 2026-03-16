import type { Express } from "express";
import passport from "passport";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { isAuthenticated } from "./localAuth";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function registerAuthRoutes(app: Express): void {
  // ── Register ──────────────────────────────────────────────────────────────
  app.post("/api/auth/register", async (req, res) => {
    try {
      const input = registerSchema.parse(req.body);

      // Check if user already exists
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email.toLowerCase().trim()));

      if (existing) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }

      const password = await bcrypt.hash(input.password, 12);

      const [user] = await db
        .insert(users)
        .values({
          email: input.email.toLowerCase().trim(),
          firstName: input.firstName,
          lastName: input.lastName,
          password,
        })
        .returning();

      // Log the user in immediately after registration
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Login after register failed" });
        }
        // Return user without password hash
        const { password: _, ...safeUser } = user;
        res.status(201).json(safeUser);
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Register error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Login ─────────────────────────────────────────────────────────────────
  app.post("/api/auth/login", (req, res, next) => {
    try {
      loginSchema.parse(req.body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
    }

    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        const { password: _, ...safeUser } = user;
        res.json(safeUser);
      });
    })(req, res, next);
  });

  // ── Logout ────────────────────────────────────────────────────────────────
  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => {
      res.json({ message: "Logged out" });
    });
  });

  // Legacy GET logout (keep for any old links)
  app.get("/api/logout", (req, res) => {
    req.logout(() => res.redirect("/"));
  });

  // ── Get Current User ──────────────────────────────────────────────────────
  app.get("/api/auth/user", isAuthenticated, (req, res) => {
    const user = req.user as any;
    const { password: _, ...safeUser } = user;
    res.json(safeUser);
  });
}
