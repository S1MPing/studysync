import { useState, useRef, useCallback, useEffect } from "react";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

export interface RoomParticipant {
  userId: string;
  stream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
}

export function useRoomCall(roomId: number, userId: string) {
  const [isInCall, setIsInCall] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [participants, setParticipants] = useState<Map<string, MediaStream | null>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  const roomIdStr = String(roomId);

  const getWs = useCallback((): WebSocket => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return wsRef.current;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;
    return ws;
  }, []);

  const createPeerConnection = useCallback((peerId: string, ws: WebSocket): RTCPeerConnection => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcsRef.current.set(peerId, pc);

    // Add local tracks
    localStreamRef.current?.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current!);
    });

    // Handle remote tracks
    const remoteStream = new MediaStream();
    pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach(track => remoteStream.addTrack(track));
      setParticipants(prev => new Map(prev).set(peerId, remoteStream));
    };

    // ICE candidates
    pc.onicecandidate = (e) => {
      if (e.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "room-ice",
          roomId: roomIdStr,
          toUserId: peerId,
          fromUserId: userId,
          candidate: e.candidate.toJSON(),
        }));
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
        pcsRef.current.delete(peerId);
        setParticipants(prev => { const m = new Map(prev); m.delete(peerId); return m; });
      }
    };

    return pc;
  }, [roomIdStr, userId]);

  const joinCall = useCallback(async (mode: "video" | "audio" = "video") => {
    setIsConnecting(true);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mode === "video" ? { facingMode: "user" } : false,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const ws = getWs();

      const onOpen = () => {
        ws.send(JSON.stringify({ type: "join-user", userId }));
        ws.send(JSON.stringify({ type: "room-join", roomId: roomIdStr, userId }));
      };

      if (ws.readyState === WebSocket.OPEN) {
        onOpen();
      } else {
        ws.addEventListener("open", onOpen, { once: true });
      }

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === "room-peers") {
          // Existing peers — create offer for each
          for (const peerId of msg.peers) {
            if (peerId === userId) continue;
            const pc = createPeerConnection(peerId, ws);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            ws.send(JSON.stringify({
              type: "room-offer",
              roomId: roomIdStr,
              toUserId: peerId,
              fromUserId: userId,
              sdp: { type: offer.type, sdp: offer.sdp },
            }));
          }
          setIsInCall(true);
          setIsConnecting(false);
        }

        if (msg.type === "room-peer-joined") {
          const peerId = msg.userId;
          if (peerId === userId) return;
          // New peer joined — they will send us an offer, just add placeholder
          setParticipants(prev => new Map(prev).set(peerId, null));
        }

        if (msg.type === "room-peer-left") {
          const peerId = msg.userId;
          pcsRef.current.get(peerId)?.close();
          pcsRef.current.delete(peerId);
          setParticipants(prev => { const m = new Map(prev); m.delete(peerId); return m; });
        }

        if (msg.type === "room-offer") {
          const peerId = msg.fromUserId;
          let pc = pcsRef.current.get(peerId);
          if (!pc) pc = createPeerConnection(peerId, ws);
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({
            type: "room-answer",
            roomId: roomIdStr,
            toUserId: peerId,
            fromUserId: userId,
            sdp: { type: answer.type, sdp: answer.sdp },
          }));
        }

        if (msg.type === "room-answer") {
          const pc = pcsRef.current.get(msg.fromUserId);
          if (pc && !pc.currentRemoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          }
        }

        if (msg.type === "room-ice") {
          const pc = pcsRef.current.get(msg.fromUserId);
          if (pc && pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
          }
        }

        if (msg.type === "room-invite-notification") {
          // handled by parent
        }
      };

      // If no peers, we're alone in room — set as in call after brief wait
      setTimeout(() => {
        setIsInCall(prev => {
          if (!prev) {
            setIsConnecting(false);
            return true;
          }
          return prev;
        });
      }, 3000);

    } catch (err: any) {
      setIsConnecting(false);
      if (err.name === "NotAllowedError") setError("Camera/microphone access denied.");
      else if (err.name === "NotFoundError") setError("No camera or microphone found.");
      else setError("Failed to join call: " + (err.message || "Unknown error"));
    }
  }, [userId, roomIdStr, getWs, createPeerConnection]);

  const leaveCall = useCallback(() => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "room-leave", roomId: roomIdStr, userId }));
    }

    pcsRef.current.forEach(pc => pc.close());
    pcsRef.current.clear();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;

    setIsInCall(false);
    setIsConnecting(false);
    setParticipants(new Map());
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
  }, [roomIdStr, userId]);

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsMuted(!track.enabled); }
  }, []);

  const toggleVideo = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsVideoOff(!track.enabled); }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    const pcs = Array.from(pcsRef.current.values());
    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      setIsScreenSharing(false);
      const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
      if (cameraTrack) {
        for (const pc of pcs) {
          const sender = pc.getSenders().find(s => s.track?.kind === "video");
          if (sender) sender.replaceTrack(cameraTrack).catch(() => {});
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      }
    } else {
      try {
        const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: false });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];
        for (const pc of pcs) {
          const sender = pc.getSenders().find(s => s.track?.kind === "video");
          if (sender) sender.replaceTrack(screenTrack).catch(() => {});
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
        setIsScreenSharing(true);
        screenTrack.onended = () => {
          setIsScreenSharing(false);
          screenStreamRef.current = null;
          const cam = localStreamRef.current?.getVideoTracks()[0];
          if (cam) {
            for (const pc2 of Array.from(pcsRef.current.values())) {
              const s = pc2.getSenders().find(s2 => s2.track?.kind === "video");
              if (s) s.replaceTrack(cam).catch(() => {});
            }
            if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
          }
        };
      } catch (err: any) {
        if (err.name !== "NotAllowedError") setError("Screen share failed: " + err.message);
      }
    }
  }, [isScreenSharing]);

  const sendInvite = useCallback((toUserId: string, fromName: string, roomName: string) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "room-invite",
        toUserId,
        fromName,
        roomId: roomIdStr,
        roomName,
      }));
    }
  }, [roomIdStr]);

  useEffect(() => { return () => leaveCall(); }, [leaveCall]);

  return {
    isInCall, isConnecting, isMuted, isVideoOff, isScreenSharing,
    participants, error, localVideoRef,
    joinCall, leaveCall, toggleMute, toggleVideo, toggleScreenShare, sendInvite,
  };
}
