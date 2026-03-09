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

export function useVideoCall(sessionId: number) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [callMode, setCallMode] = useState<CallMode>("video");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream>(new MediaStream());
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const unsubsRef = useRef<(() => void)[]>([]);
  const isCallerRef = useRef(false);

  const roomId = `session-${sessionId}`;

  const cleanup = useCallback(() => {
    unsubsRef.current.forEach(u => { try { u(); } catch {} });
    unsubsRef.current = [];

    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;

    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.oniceconnectionstatechange = null;
      try { pcRef.current.close(); } catch {}
      pcRef.current = null;
    }

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    remoteStreamRef.current = new MediaStream();
  }, []);

  const startCall = useCallback(async (mode: CallMode = "video") => {
    cleanup();
    setError(null);
    setCallMode(mode);
    setCallState("getting-media");
    setMinimized(false);

    try {
      // Get camera/mic
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mode === "video" ? { facingMode: "user" } : false,
      });
      localStreamRef.current = stream;

      // Show local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Create peer connection
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      // Add tracks
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // Handle remote tracks
      pc.ontrack = (e) => {
        e.streams[0].getTracks().forEach(track => {
          remoteStreamRef.current.addTrack(track);
        });
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current;
        }
      };

      // Monitor connection
      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        console.log("ICE:", state);
        if (state === "connected" || state === "completed") {
          setCallState("connected");
        }
        if (state === "failed") {
          setError("Connection failed. Please try again.");
          endCallInternal();
        }
        if (state === "disconnected") {
          // Give it a moment — might reconnect
          setTimeout(() => {
            if (pcRef.current?.iceConnectionState === "disconnected") {
              endCallInternal();
            }
          }, 5000);
        }
      };

      // Firebase signaling
      const callDoc = doc(firestore, "calls", roomId);
      const offerCandidates = collection(callDoc, "offerCandidates");
      const answerCandidates = collection(callDoc, "answerCandidates");

      // Check if a call already exists
      const existing = await getDoc(callDoc);

      if (existing.exists() && existing.data()?.offer && !existing.data()?.answer) {
        // ANSWER existing call
        isCallerRef.current = false;
        console.log("Answering call...");

        pc.onicecandidate = (e) => {
          if (e.candidate) addDoc(answerCandidates, e.candidate.toJSON());
        };

        await pc.setRemoteDescription(new RTCSessionDescription(existing.data()!.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await updateDoc(callDoc, { answer: { type: answer.type, sdp: answer.sdp } });

        // Listen for offer candidates
        const unsub = onSnapshot(offerCandidates, (snap) => {
          snap.docChanges().forEach((ch) => {
            if (ch.type === "added" && pc.remoteDescription) {
              pc.addIceCandidate(new RTCIceCandidate(ch.doc.data())).catch(() => {});
            }
          });
        });
        unsubsRef.current.push(unsub);

        setCallState("connected");

      } else {
        // CREATE new call
        isCallerRef.current = true;
        console.log("Creating call...");

        // Clean stale data
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
        await setDoc(callDoc, { offer: { type: offer.type, sdp: offer.sdp }, mode });

        setCallState("waiting");

        // Listen for answer
        const unsubCall = onSnapshot(callDoc, (snap) => {
          const data = snap.data();
          if (data?.answer && pc.signalingState !== "closed" && !pc.currentRemoteDescription) {
            console.log("Got answer!");
            pc.setRemoteDescription(new RTCSessionDescription(data.answer)).catch(console.error);
          }
          if (data?.ended) {
            endCallInternal();
          }
        });
        unsubsRef.current.push(unsubCall);

        // Listen for answer candidates
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
      console.error("Call error:", err);
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
  }, [roomId, cleanup]);

  const endCallInternal = useCallback(() => {
    cleanup();
    setCallState("ended");
    setIsMuted(false);
    setIsVideoOff(false);
    setMinimized(false);
    setTimeout(() => setCallState("idle"), 1500);
  }, [cleanup]);

  const endCall = useCallback(async () => {
    // Signal other user
    try {
      const callDoc = doc(firestore, "calls", roomId);
      await updateDoc(callDoc, { ended: true }).catch(() => {});
    } catch {}

    endCallInternal();

    // Cleanup Firebase after delay
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

  useEffect(() => { return () => cleanup(); }, [cleanup]);

  return {
    callState, callMode, isMuted, isVideoOff, minimized, error,
    localVideoRef, remoteVideoRef,
    startCall, endCall, toggleMute, toggleVideo,
    setMinimized,
  };
}
