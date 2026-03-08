# StudySync — Local Setup Guide

## Prerequisites
- Node.js 18+
- PostgreSQL (or a free cloud DB)

---

## Step 1 — Install dependencies
```bash
npm install
```

You'll also need `bcryptjs` which is used for password hashing:
```bash
npm install bcryptjs
npm install -D @types/bcryptjs
```

---

## Step 2 — Set up your database

**Option A: Local PostgreSQL**
```bash
# Create the database
psql -U postgres -c "CREATE DATABASE studysync;"
```

**Option B: Free cloud (recommended if you don't have Postgres installed)**
- [Neon](https://neon.tech) — free, instant Postgres in the cloud
- [Supabase](https://supabase.com) — free tier
- [Railway](https://railway.app) — easy free Postgres

Copy the connection string they give you.

---

## Step 3 — Configure environment
```bash
cp .env.example .env
# Then edit .env and paste your DATABASE_URL
```

---

## Step 4 — Push the database schema
```bash
npm run db:push
```
This creates all the tables (users, sessions, courses, etc.) automatically.

---

## Step 5 — Run the app
```bash
npm run dev
```

Open your browser at **http://localhost:5000**

---

## What you'll see
1. Landing page → click "Get Started" or "Sign In"
2. Auth page with **Sign In** and **Create Account** tabs
3. Register with your name, email, and password
4. You'll be taken to profile setup to choose your role (student/tutor)
5. Then into the full dashboard!

---

## Folder structure
```
studysync/
├── client/          # React frontend (Vite + Tailwind + shadcn)
│   └── src/
│       ├── pages/   # Landing, Auth, Dashboard, FindTutors, Sessions...
│       ├── hooks/   # useAuth, useSessions, useTutors...
│       └── components/
├── server/          # Express backend
│   ├── auth/        # ← NEW: email/password auth (replaces Replit)
│   ├── routes.ts    # API endpoints
│   └── storage.ts   # Database queries
└── shared/
    └── schema.ts    # Drizzle ORM schema (single source of truth)
```
