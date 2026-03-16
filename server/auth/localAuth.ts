import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import connectPg from "connect-pg-simple";
import type { Express, RequestHandler } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

// ── Session Setup ─────────────────────────────────────────────────────────────

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week

  // Use in-memory store if no DATABASE_URL (handy for first run)
  if (!process.env.DATABASE_URL) {
    const MemoryStore = require("memorystore")(session);
    return session({
      secret: process.env.SESSION_SECRET || "studysync-dev-secret-change-in-prod",
      store: new MemoryStore({ checkPeriod: 86400000 }),
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, secure: false, maxAge: sessionTtl },
    });
  }

  const PgStore = connectPg(session);
  return session({
    secret: process.env.SESSION_SECRET || "studysync-dev-secret-change-in-prod",
    store: new PgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      ttl: sessionTtl,
      tableName: "sessions",
    }),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: false, maxAge: sessionTtl },
  });
}

// ── Passport Local Strategy ───────────────────────────────────────────────────

export async function setupAuth(app: Express) {
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email.toLowerCase().trim()));

          if (!user || !user.password) {
            return done(null, false, { message: "Invalid email or password" });
          }

          const valid = await bcrypt.compare(password, user.password);
          if (!valid) {
            return done(null, false, { message: "Invalid email or password" });
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user: any, cb) => cb(null, user.id));
  passport.deserializeUser(async (id: string, cb) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      cb(null, user ?? null);
    } catch (err) {
      cb(err);
    }
  });
}

// ── isAuthenticated Middleware ────────────────────────────────────────────────

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ message: "Unauthorized" });
};
