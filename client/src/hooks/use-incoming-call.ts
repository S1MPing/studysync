import { useEffect, useRef, useState } from "react";
import { firestore } from "@/lib/firebase";
import { collection, query, where, onSnapshot, updateDoc, doc } from "firebase/firestore";

export interface IncomingCall {
  roomId: string;
  sessionId: number;
  callerName: string;
  mode: "video" | "audio";
}

function useRingTone(active: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) {
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
  }, [active]);
}

export function useIncomingCall(userId: string | undefined) {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

  useRingTone(!!incomingCall);

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

      setIncomingCall({
        roomId,
        sessionId,
        callerName: data.callerName || "Someone",
        mode: data.mode || "video",
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

  return { incomingCall, answerCall, declineCall };
}
