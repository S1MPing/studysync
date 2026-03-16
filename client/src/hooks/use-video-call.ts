import { useState, useRef, useCallback, useEffect } from "react";
import { firestore } from "@/lib/firebase";
import {
  collection, doc, setDoc, getDoc, onSnapshot, addDoc, updateDoc, deleteDoc, getDocs
} from "firebase/firestore";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

export type CallState = "idle" | "getting-media" | "waiting" | "connected" | "ended";
export type CallMode = "video" | "audio";
// Sub-states for richer UI feedback
export type CallPhase = "calling" | "ringing" | "e2e" | "live";

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
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

export function useVideoCall(sessionId: number) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [callPhase, setCallPhase] = useState<CallPhase>("calling");
  const [callDuration, setCallDuration] = useState(0);
  const [callMode, setCallMode] = useState<CallMode>("video");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const screenStreamRef = useRef<MediaStream | null>(null);

  // Ring tone plays for caller while waiting
  useRingTone(callState === "waiting");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream>(new MediaStream());
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const unsubsRef = useRef<(() => void)[]>([]);
  const isCallerRef = useRef(false);

  // Timers
  const ringingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noAnswerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const e2eTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const roomId = `session-${sessionId}`;

  const clearTimers = useCallback(() => {
    if (ringingTimerRef.current) { clearTimeout(ringingTimerRef.current); ringingTimerRef.current = null; }
    if (noAnswerTimerRef.current) { clearTimeout(noAnswerTimerRef.current); noAnswerTimerRef.current = null; }
    if (e2eTimerRef.current) { clearTimeout(e2eTimerRef.current); e2eTimerRef.current = null; }
    if (durationIntervalRef.current) { clearInterval(durationIntervalRef.current); durationIntervalRef.current = null; }
  }, []);

  const cleanup = useCallback(() => {
    clearTimers();
    unsubsRef.current.forEach(u => { try { u(); } catch {} });
    unsubsRef.current = [];

    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;

    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.oniceconnectionstatechange = null;
      try { pcRef.current.close(); } catch {}
      pcRef.current = null;
    }

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    remoteStreamRef.current = new MediaStream();
  }, [clearTimers]);

  // Called when ICE becomes connected
  const onCallConnected = useCallback(() => {
    setCallState("connected");
    setCallPhase("e2e");
    setCallDuration(0);
    // Show "End-to-end encrypted" for 5 seconds, then start timer
    e2eTimerRef.current = setTimeout(() => {
      setCallPhase("live");
      let elapsed = 0;
      durationIntervalRef.current = setInterval(() => {
        elapsed += 1;
        setCallDuration(elapsed);
      }, 1000);
    }, 5000);
  }, []);

  const endCallInternal = useCallback(() => {
    cleanup();
    setCallState("ended");
    setCallPhase("calling");
    setCallDuration(0);
    setIsMuted(false);
    setIsVideoOff(false);
    setMinimized(false);
    setTimeout(() => setCallState("idle"), 1500);
  }, [cleanup]);

  const startCall = useCallback(async (mode: CallMode = "video", calleeId?: string, callerName?: string) => {
    cleanup();
    setError(null);
    setCallMode(mode);
    setCallState("getting-media");
    setCallPhase("calling");
    setCallDuration(0);
    setMinimized(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mode === "video" ? { facingMode: "user" } : false,
      });
      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (e) => {
        e.streams[0].getTracks().forEach(track => {
          remoteStreamRef.current.addTrack(track);
        });
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStreamRef.current;
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStreamRef.current;
      };

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        if (state === "connected" || state === "completed") {
          onCallConnected();
        }
        if (state === "failed") {
          setError("Connection failed. Please try again.");
          endCallInternal();
        }
        if (state === "disconnected") {
          setTimeout(() => {
            if (pcRef.current?.iceConnectionState === "disconnected") {
              endCallInternal();
            }
          }, 5000);
        }
      };

      const callDoc = doc(firestore, "calls", roomId);
      const offerCandidates = collection(callDoc, "offerCandidates");
      const answerCandidates = collection(callDoc, "answerCandidates");

      let existing = await getDoc(callDoc);

      if (existing.exists() && existing.data()?.ended) {
        try { await deleteDoc(callDoc); } catch {}
        existing = await getDoc(callDoc);
      }
      if (existing.exists() && existing.data()?.offer && existing.data()?.answer) {
        try { await deleteDoc(callDoc); } catch {}
        existing = await getDoc(callDoc);
      }

      if (existing.exists() && existing.data()?.offer && !existing.data()?.answer) {
        // ANSWER existing call
        isCallerRef.current = false;

        pc.onicecandidate = (e) => {
          if (e.candidate) addDoc(answerCandidates, e.candidate.toJSON());
        };

        await pc.setRemoteDescription(new RTCSessionDescription(existing.data()!.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await updateDoc(callDoc, {
          answer: { type: answer.type, sdp: answer.sdp },
          ended: false,
        });

        const unsub = onSnapshot(offerCandidates, (snap) => {
          snap.docChanges().forEach((ch) => {
            if (ch.type === "added" && pc.remoteDescription) {
              pc.addIceCandidate(new RTCIceCandidate(ch.doc.data())).catch(() => {});
            }
          });
        });
        unsubsRef.current.push(unsub);

        setCallState("connected");
        onCallConnected();

      } else {
        // CREATE new call
        isCallerRef.current = true;

        try {
          if (existing.exists()) await deleteDoc(callDoc);
          const oldOffer = await getDocs(offerCandidates);
          for (const d of oldOffer.docs) await deleteDoc(d.ref);
          const oldAnswer = await getDocs(answerCandidates);
          for (const d of oldAnswer.docs) await deleteDoc(d.ref);
        } catch {}

        pc.onicecandidate = (e) => {
          if (e.candidate) addDoc(offerCandidates, e.candidate.toJSON());
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await setDoc(callDoc, {
          offer: { type: offer.type, sdp: offer.sdp },
          mode,
          ended: false,
          ...(calleeId ? { calleeId } : {}),
          ...(callerName ? { callerName } : {}),
        });

        setCallState("waiting");
        setCallPhase("calling");

        // "Calling..." → "Ringing..." after 10s (signal has propagated)
        ringingTimerRef.current = setTimeout(() => {
          setCallPhase("ringing");
        }, 10_000);

        // No answer after 50s → treat as unreachable
        noAnswerTimerRef.current = setTimeout(() => {
          if (pcRef.current && pcRef.current.iceConnectionState !== "connected" && pcRef.current.iceConnectionState !== "completed") {
            setError("No answer. The other person may be offline.");
            endCallInternal();
          }
        }, 50_000);

        // Listen for answer
        const unsubCall = onSnapshot(callDoc, (snap) => {
          const data = snap.data();
          if (data?.answer && pc.signalingState !== "closed" && !pc.currentRemoteDescription) {
            // Cancel the no-answer timeout — they picked up
            if (noAnswerTimerRef.current) { clearTimeout(noAnswerTimerRef.current); noAnswerTimerRef.current = null; }
            if (ringingTimerRef.current) { clearTimeout(ringingTimerRef.current); ringingTimerRef.current = null; }
            // Switch to ringing immediately when answer comes in
            setCallPhase("ringing");
            pc.setRemoteDescription(new RTCSessionDescription(data.answer)).catch(console.error);
          }
          if (data?.ended) {
            endCallInternal();
          }
        });
        unsubsRef.current.push(unsubCall);

        const unsubAC = onSnapshot(answerCandidates, (snap) => {
          snap.docChanges().forEach((ch) => {
            if (ch.type === "added" && pc.remoteDescription) {
              pc.addIceCandidate(new RTCIceCandidate(ch.doc.data())).catch(() => {});
            }
          });
        });
        unsubsRef.current.push(unsubAC);
      }

    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setError("Camera/microphone access denied. Allow access in your browser settings and try again.");
      } else if (err.name === "NotFoundError") {
        setError("No camera or microphone found.");
      } else {
        setError("Failed to start call: " + (err.message || "Unknown error"));
      }
      setCallState("idle");
      cleanup();
    }
  }, [roomId, cleanup, endCallInternal, onCallConnected]);

  const endCall = useCallback(async () => {
    try {
      const callDoc = doc(firestore, "calls", roomId);
      await updateDoc(callDoc, { ended: true }).catch(() => {});
    } catch {}

    endCallInternal();

    setTimeout(async () => {
      try {
        const callDoc = doc(firestore, "calls", roomId);
        const oc = collection(callDoc, "offerCandidates");
        const ac = collection(callDoc, "answerCandidates");
        const os = await getDocs(oc); for (const d of os.docs) await deleteDoc(d.ref);
        const as2 = await getDocs(ac); for (const d of as2.docs) await deleteDoc(d.ref);
        await deleteDoc(callDoc);
      } catch {}
    }, 2000);
  }, [roomId, endCallInternal]);

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsMuted(!track.enabled); }
  }, []);

  const toggleVideo = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsVideoOff(!track.enabled); }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;

    if (isScreenSharing) {
      // Stop screen share, restore camera
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      setIsScreenSharing(false);

      const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
      if (cameraTrack) {
        const sender = pc.getSenders().find(s => s.track?.kind === "video");
        if (sender) {
          try { await sender.replaceTrack(cameraTrack); } catch {}
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      }
    } else {
      try {
        const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: false });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        const sender = pc.getSenders().find(s => s.track?.kind === "video");
        if (sender) {
          await sender.replaceTrack(screenTrack);
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;

        setIsScreenSharing(true);

        // Auto-stop when user clicks browser's "Stop sharing"
        screenTrack.onended = () => {
          setIsScreenSharing(false);
          screenStreamRef.current = null;
          const cameraTrack2 = localStreamRef.current?.getVideoTracks()[0];
          if (cameraTrack2 && pc.connectionState !== "closed") {
            const s2 = pc.getSenders().find(s => s.track?.kind === "video");
            if (s2) s2.replaceTrack(cameraTrack2).catch(() => {});
          }
          if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
        };
      } catch (err: any) {
        if (err.name !== "NotAllowedError") setError("Screen share failed: " + err.message);
      }
    }
  }, [isScreenSharing]);

  useEffect(() => { return () => cleanup(); }, [cleanup]);

  return {
    callState, callPhase, callDuration, callMode,
    isMuted, isVideoOff, isScreenSharing, minimized, error,
    localVideoRef, remoteVideoRef, remoteAudioRef,
    startCall, endCall, toggleMute, toggleVideo, toggleScreenShare,
    setMinimized,
    formatDuration,
  };
}
