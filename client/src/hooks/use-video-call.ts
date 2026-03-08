import { useState, useRef, useCallback, useEffect } from "react";
import { firestore } from "@/lib/firebase";
import {
  collection, doc, setDoc, getDoc, onSnapshot, addDoc, updateDoc, deleteDoc, getDocs
} from "firebase/firestore";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 10,
};

export type CallState = "idle" | "requesting-media" | "connecting" | "in-call" | "ended";
export type CallMode = "video" | "audio";

export function useVideoCall(sessionId: number) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [callMode, setCallMode] = useState<CallMode>("video");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const unsubscribersRef = useRef<(() => void)[]>([]);

  const roomId = `session-${sessionId}`;

  // Attach stream to video element safely
  const attachStream = useCallback((videoEl: HTMLVideoElement | null, stream: MediaStream | null) => {
    if (videoEl && stream) {
      videoEl.srcObject = stream;
      videoEl.play().catch(() => {}); // autoplay may be blocked
    }
  }, []);

  const cleanup = useCallback(() => {
    // Unsubscribe firebase listeners
    unsubscribersRef.current.forEach(unsub => { try { unsub(); } catch {} });
    unsubscribersRef.current = [];

    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      localStreamRef.current = null;
    }

    // Close peer connection
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    // Clear video elements
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    remoteStreamRef.current = null;
  }, []);

  const startCall = useCallback(async (mode: CallMode = "video") => {
    try {
      setError(null);
      setCallMode(mode);
      setCallState("requesting-media");

      // Request media
      const constraints = {
        audio: true,
        video: mode === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } : false,
      };

      let localStream: MediaStream;
      try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (mediaErr: any) {
        console.error("Media error:", mediaErr);
        if (mediaErr.name === "NotAllowedError") {
          setError("Camera/microphone access denied. Please allow access in your browser settings.");
        } else if (mediaErr.name === "NotFoundError") {
          setError("No camera or microphone found on this device.");
        } else {
          setError("Could not access camera/microphone: " + mediaErr.message);
        }
        setCallState("idle");
        return;
      }

      localStreamRef.current = localStream;
      attachStream(localVideoRef.current, localStream);

      setCallState("connecting");

      // Create peer connection
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      // Create remote stream
      const remoteStream = new MediaStream();
      remoteStreamRef.current = remoteStream;
      attachStream(remoteVideoRef.current, remoteStream);

      // Add local tracks to peer connection
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });

      // Handle incoming remote tracks
      pc.ontrack = (event) => {
        console.log("Got remote track:", event.track.kind);
        event.streams[0].getTracks().forEach(track => {
          if (remoteStreamRef.current) {
            remoteStreamRef.current.addTrack(track);
          }
        });
        // Re-attach in case ref changed
        attachStream(remoteVideoRef.current, remoteStreamRef.current);
      };

      // Monitor connection state
      pc.oniceconnectionstatechange = () => {
        console.log("ICE state:", pc.iceConnectionState);
        if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
          setCallState("in-call");
        }
        if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
          console.log("Connection lost");
          setCallState("ended");
          setTimeout(() => { cleanup(); setCallState("idle"); }, 2000);
        }
      };

      // Firebase signaling
      const callDoc = doc(firestore, "calls", roomId);
      const offerCandidates = collection(callDoc, "offerCandidates");
      const answerCandidates = collection(callDoc, "answerCandidates");

      const callSnapshot = await getDoc(callDoc);

      if (callSnapshot.exists() && callSnapshot.data()?.offer && !callSnapshot.data()?.answer) {
        // ANSWER an existing call
        console.log("Answering existing call...");

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            addDoc(answerCandidates, event.candidate.toJSON());
          }
        };

        const callData = callSnapshot.data();
        await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await updateDoc(callDoc, {
          answer: { type: answer.type, sdp: answer.sdp },
        });

        // Listen for caller's ICE candidates
        const unsub = onSnapshot(offerCandidates, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const candidate = new RTCIceCandidate(change.doc.data());
              pc.addIceCandidate(candidate).catch(console.error);
            }
          });
        });
        unsubscribersRef.current.push(unsub);

      } else {
        // CREATE a new call (offer)
        console.log("Creating new call...");

        // Clean up any stale call data first
        try {
          const staleOffer = await getDocs(offerCandidates);
          staleOffer.forEach(d => deleteDoc(d.ref));
          const staleAnswer = await getDocs(answerCandidates);
          staleAnswer.forEach(d => deleteDoc(d.ref));
        } catch {}

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            addDoc(offerCandidates, event.candidate.toJSON());
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await setDoc(callDoc, {
          offer: { type: offer.type, sdp: offer.sdp },
          mode,
          createdAt: new Date().toISOString(),
        });

        // Listen for answer
        const unsubCall = onSnapshot(callDoc, (snapshot) => {
          const data = snapshot.data();
          if (data?.answer && !pc.currentRemoteDescription) {
            console.log("Got answer!");
            pc.setRemoteDescription(new RTCSessionDescription(data.answer)).catch(console.error);
          }
          // Detect if other side ended
          if (data?.ended) {
            setCallState("ended");
            setTimeout(() => { cleanup(); setCallState("idle"); }, 1500);
          }
        });
        unsubscribersRef.current.push(unsubCall);

        // Listen for answer ICE candidates
        const unsubAnswerCandidates = onSnapshot(answerCandidates, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const candidate = new RTCIceCandidate(change.doc.data());
              pc.addIceCandidate(candidate).catch(console.error);
            }
          });
        });
        unsubscribersRef.current.push(unsubAnswerCandidates);
      }

    } catch (err: any) {
      console.error("Call error:", err);
      setError("Failed to start call: " + err.message);
      setCallState("idle");
      cleanup();
    }
  }, [roomId, cleanup, attachStream]);

  const endCall = useCallback(async () => {
    // Signal to other user that call ended
    try {
      const callDoc = doc(firestore, "calls", roomId);
      await updateDoc(callDoc, { ended: true }).catch(() => {});
    } catch {}

    cleanup();
    setCallState("ended");
    setIsMuted(false);
    setIsVideoOff(false);

    // Clean up Firebase after a delay
    setTimeout(async () => {
      try {
        const callDoc = doc(firestore, "calls", roomId);
        const offerCandidates = collection(callDoc, "offerCandidates");
        const answerCandidates = collection(callDoc, "answerCandidates");

        const offerSnap = await getDocs(offerCandidates);
        for (const d of offerSnap.docs) await deleteDoc(d.ref);
        const answerSnap = await getDocs(answerCandidates);
        for (const d of answerSnap.docs) await deleteDoc(d.ref);
        await deleteDoc(callDoc);
      } catch {}
      setCallState("idle");
    }, 2000);
  }, [roomId, cleanup]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    callState,
    callMode,
    isMuted,
    isVideoOff,
    error,
    localVideoRef,
    remoteVideoRef,
    startCall,
    endCall,
    toggleMute,
    toggleVideo,
  };
}
