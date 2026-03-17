import { useEffect, useRef, useState } from "react";
import { firestore } from "@/lib/firebase";
import { collection, query, where, onSnapshot, updateDoc, doc } from "firebase/firestore";
import type { AppNotification } from "./use-notifications";

export interface IncomingCall {
  roomId: string;
  sessionId: number;
  callerName: string;
  mode: "video" | "audio";
}

function useRingTone(active: boolean, muted: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active || muted) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    let running = true;

    const ring = () => {
      if (!running) return;
      try {
        const ctx = new AudioContext();
        const gain = ctx.createGain();
        gain.gain.value = 0.2;
        gain.connect(ctx.destination);
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        o1.frequency.value = 440;
        o2.frequency.value = 480;
        o1.connect(gain);
        o2.connect(gain);
        o1.start();
        o2.start();
        o1.stop(ctx.currentTime + 0.8);
        o2.stop(ctx.currentTime + 0.8);
        setTimeout(() => ctx.close().catch(() => {}), 1000);
      } catch {}
      timerRef.current = setTimeout(ring, 3000);
    };

    ring();

    return () => {
      running = false;
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };
  }, [active, muted]);
}

type AddNotif = (n: Omit<AppNotification, "id" | "timestamp" | "read">) => void;

export function useIncomingCall(userId: string | undefined, addNotification?: AddNotif) {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [ringMuted, setRingMuted] = useState(false);
  const addNotifRef = useRef(addNotification);
  useEffect(() => { addNotifRef.current = addNotification; }, [addNotification]);

  useRingTone(!!incomingCall, ringMuted);

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(firestore, "calls"),
      where("calleeId", "==", userId),
      where("ended", "==", false),
    );

    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) {
        setIncomingCall(null);
        return;
      }

      const docSnap = snap.docs[0];
      const data = docSnap.data();

      // Already answered — don't show overlay
      if (data.answer) {
        setIncomingCall(null);
        return;
      }

      const roomId = docSnap.id;
      const sessionId = parseInt(roomId.replace("session-", ""), 10);

      const call: IncomingCall = {
        roomId,
        sessionId,
        callerName: data.callerName || "Someone",
        mode: data.mode || "video",
      };
      setIncomingCall(call);
      addNotifRef.current?.({
        type: "call",
        title: `Incoming ${call.mode} call`,
        body: `${call.callerName} is calling you`,
        sessionId: call.sessionId,
      });
    });

    return () => unsub();
  }, [userId]);

  const answerCall = (call: IncomingCall) => {
    // Navigate to session page with answer flag — SessionDetail will auto-answer
    window.location.href = `/sessions/${call.sessionId}?answer=${call.mode}`;
  };

  const declineCall = async () => {
    if (!incomingCall) return;
    try {
      await updateDoc(doc(firestore, "calls", incomingCall.roomId), { ended: true });
    } catch {}
    setIncomingCall(null);
  };

  const toggleRingMute = () => setRingMuted(m => !m);

  return { incomingCall, answerCall, declineCall, ringMuted, toggleRingMute };
}
