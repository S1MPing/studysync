import { useEffect, useRef } from "react";

/**
 * Checks for upcoming sessions starting within the next 60 minutes
 * and fires a notification + sound for each one (only once per session).
 *
 * Call this from AppLayout (or wherever sessions are available), passing
 * the session list and the addNotification function from useNotifications.
 *
 * Checks every 5 minutes.
 */
export function useSessionReminders(
  sessions: any[],
  addNotification: (n: any) => void,
) {
  // Track which session IDs we have already reminded the user about
  const remindedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      const sixtyMinutes = 60 * 60 * 1000;

      for (const session of sessions) {
        if (session.status !== "scheduled") continue;
        if (!session.date) continue;

        // Build a full datetime from session.date + session.startTime
        let sessionTime: number;
        try {
          if (session.startTime) {
            // Combine date string (YYYY-MM-DD) with time string (HH:mm)
            const dateStr = typeof session.date === "string"
              ? session.date.slice(0, 10)
              : new Date(session.date).toISOString().slice(0, 10);
            sessionTime = new Date(`${dateStr}T${session.startTime}`).getTime();
          } else {
            sessionTime = new Date(session.date).getTime();
          }
        } catch {
          continue;
        }

        if (isNaN(sessionTime)) continue;

        const diff = sessionTime - now;

        // Only remind if the session is within 60 minutes and hasn't started yet
        if (diff > 0 && diff <= sixtyMinutes && !remindedRef.current.has(session.id)) {
          remindedRef.current.add(session.id);

          const courseLabel = session.course?.code || `Session #${session.id}`;
          const minutesLeft = Math.round(diff / 60_000);

          addNotification({
            type: "session_update",
            title: "Session starting soon!",
            body: `Your session (${courseLabel}) starts in ${minutesLeft} minute${minutesLeft !== 1 ? "s" : ""}`,
            sessionId: session.id,
          });
        }
      }
    };

    // Run immediately, then every 5 minutes
    check();
    const interval = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, addNotification]);
}
