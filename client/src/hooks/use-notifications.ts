import { useState, useCallback, useEffect } from "react";

export type NotifType = "message" | "call" | "session_request" | "session_update";

export interface AppNotification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  sessionId?: number;
  timestamp: string;
  read: boolean;
}

export interface NotifPrefs {
  enabled: boolean;
  messages: boolean;
  calls: boolean;
  sessionRequests: boolean;
  sessionUpdates: boolean;
}

const STORAGE_KEY = "ss_notifications";
const PREFS_KEY = "ss_notif_prefs";
const MAX_NOTIFS = 50;

function loadNotifs(): AppNotification[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch { return []; }
}

function saveNotifs(n: AppNotification[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(n.slice(0, MAX_NOTIFS))); } catch {}
}

export function loadNotifPrefs(): NotifPrefs {
  try {
    return { enabled: true, messages: true, calls: true, sessionRequests: true, sessionUpdates: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") };
  } catch { return { enabled: true, messages: true, calls: true, sessionRequests: true, sessionUpdates: true }; }
}

function saveNotifPrefs(p: NotifPrefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch {}
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>(loadNotifs);
  const [prefs, setPrefsState] = useState<NotifPrefs>(loadNotifPrefs);

  // Keep in sync across tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setNotifications(loadNotifs());
      if (e.key === PREFS_KEY) setPrefsState(loadNotifPrefs());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const isAllowed = useCallback((type: NotifType): boolean => {
    if (!prefs.enabled) return false;
    if (type === "message") return prefs.messages;
    if (type === "call") return prefs.calls;
    if (type === "session_request") return prefs.sessionRequests;
    if (type === "session_update") return prefs.sessionUpdates;
    return true;
  }, [prefs]);

  const addNotification = useCallback((notif: Omit<AppNotification, "id" | "timestamp" | "read">) => {
    if (!isAllowed(notif.type)) return;
    const n: AppNotification = {
      ...notif,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications(prev => {
      const updated = [n, ...prev].slice(0, MAX_NOTIFS);
      saveNotifs(updated);
      return updated;
    });
  }, [isAllowed]);

  const markRead = useCallback((id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
      saveNotifs(updated);
      return updated;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      saveNotifs(updated);
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    saveNotifs([]);
  }, []);

  const updatePrefs = useCallback((updates: Partial<NotifPrefs>) => {
    setPrefsState(prev => {
      const next = { ...prev, ...updates };
      saveNotifPrefs(next);
      return next;
    });
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, unreadCount, prefs, addNotification, markRead, markAllRead, clearAll, updatePrefs };
}
