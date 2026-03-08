// Re-export from the single source of truth so the User type
// includes all fields (role, university, bio, password, etc.)
export { users, sessions, type User, type UpsertUser } from "../schema";
