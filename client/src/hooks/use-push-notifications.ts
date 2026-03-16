import { useEffect, useState, useCallback } from "react";

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [swReady, setSwReady] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        setSwReady(true);
        console.log("[SW] Registered:", reg.scope);
      })
      .catch((err) => console.warn("[SW] Registration failed:", err));
  }, []);

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return false;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result === "granted";
  }, []);

  // Send a local push notification (no server needed)
  const notify = useCallback(
    async (title: string, body: string, url?: string) => {
      if (!swReady || permission !== "granted") return;
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification(title, {
        body,
        icon: "/favicon.svg",
        badge: "/favicon-96x96.png",
        data: { url: url || "/" },
        vibrate: [200, 100, 200],
      } as any);
    },
    [swReady, permission]
  );

  return { permission, swReady, requestPermission, notify };
}
