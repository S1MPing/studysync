import { useState, useRef, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useSession, useScheduleSession, useUpdateSessionStatus, useDeleteSession } from "@/hooks/use-sessions";
import { useMessages, useRealtimeMessages, useSendMessage, useDeleteMessage } from "@/hooks/use-messages";
import { useVideoCall, type CallMode } from "@/hooks/use-video-call";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Send, Loader2, ArrowLeft, Video, VideoOff, Phone,
  Mic, MicOff, PhoneOff, CalendarPlus, Minimize2, Maximize2, X, Check, Paperclip, Edit3, Save, Lock, Signal, PhoneCall, Monitor, MonitorOff, FileDown, CheckCheck
} from "lucide-react";
import { format } from "date-fns";

export function SessionDetail() {
  const [, params] = useRoute("/sessions/:id");
  const sessionId = parseInt(params?.id || "0");
  const { user } = useAuth();

  const { data: session, isLoading: sessionLoading } = useSession(sessionId);
  const { data: messages = [] } = useMessages(sessionId);
  const sendMessage = useSendMessage();
  const { broadcastMessage, sendTyping, partnerTyping, partnerRead } = useRealtimeMessages(sessionId, user?.id || "");
  const deleteMessage = useDeleteMessage(sessionId);
  const scheduleSession = useScheduleSession();
  const updateStatus = useUpdateSessionStatus();
  const deleteSession = useDeleteSession();
  const call = useVideoCall(sessionId);
  const startCallRef = useRef(call.startCall);
  useEffect(() => { startCallRef.current = call.startCall; }, [call.startCall]);

  // Auto-answer when navigated from incoming call notification
  useEffect(() => {
    if (!sessionId) return;
    const params = new URLSearchParams(window.location.search);
    const answerMode = params.get("answer") as CallMode | null;
    if (answerMode === "video" || answerMode === "audio") {
      window.history.replaceState({}, "", `/sessions/${sessionId}`);
      setTimeout(() => startCallRef.current(answerMode), 600);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const [content, setContent] = useState("");
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("18:00");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateNotes = useMutation({
    mutationFn: async (notes: string) => {
      const res = await fetch(`/api/sessions/${sessionId}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) throw new Error("Failed to update notes");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Notes saved" });
      setEditingNotes(false);
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId] });
    },
    onError: () => toast({ title: "Failed to save notes", variant: "destructive" }),
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Mark session as read (for unread badge) when the user opens it
  useEffect(() => {
    if (sessionId) {
      try {
        const stored = JSON.parse(localStorage.getItem("ss_last_seen") || "{}");
        stored[sessionId] = new Date().toISOString();
        localStorage.setItem("ss_last_seen", JSON.stringify(stored));
      } catch {}
    }
  }, [sessionId]);

  if (sessionLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!session) return <div className="flex justify-center py-20 text-muted-foreground">Session not found</div>;

  const isTutor = session.tutorId === user?.id;
  const otherPerson = isTutor ? session.student : session.tutor;
  const isInCall = call.callState !== "idle" && call.callState !== "ended";
  const myName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Unknown";
  const handleStartCall = (mode: CallMode) => call.startCall(mode, otherPerson?.id, myName);

  const handleTyping = () => {
    sendTyping();
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {}, 3000);
  };

  const exportNotesPDF = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const notes = session.notes || "No notes for this session.";
    const title = session.course?.code || `Session #${sessionId}`;
    const date = session.date ? format(new Date(session.date), "MMMM dd, yyyy") : "Date TBD";
    const participant = otherPerson ? `${otherPerson.firstName} ${otherPerson.lastName}` : "Unknown";
    const msgLines = messages.map((m: any) => {
      const senderName = m.senderId === user?.id ? (user?.firstName || "Me") : (otherPerson?.firstName || "Other");
      const time = m.createdAt ? format(new Date(m.createdAt), "h:mm a") : "";
      if (m.type === "text") return `<p style="margin:4px 0"><b>${senderName}</b> <span style="color:#888;font-size:11px">${time}</span><br/>${m.content}</p>`;
      return `<p style="margin:4px 0"><b>${senderName}</b> <span style="color:#888;font-size:11px">${time}</span><br/>[${m.type} attachment]</p>`;
    }).join("<hr style='border:none;border-top:1px solid #eee;margin:4px 0'/>");
    w.document.write(`<!DOCTYPE html><html><head><title>${title} – Notes</title>
      <style>body{font-family:system-ui,sans-serif;max-width:700px;margin:40px auto;color:#1e293b}h1{font-size:20px;border-bottom:2px solid #6366f1;padding-bottom:8px}h2{font-size:14px;color:#6366f1;margin-top:20px}p{font-size:13px;line-height:1.6}.meta{color:#64748b;font-size:12px}</style>
      </head><body>
      <h1>StudySync – Session Notes</h1>
      <p class="meta"><b>Course:</b> ${title} &nbsp;|&nbsp; <b>Date:</b> ${date} &nbsp;|&nbsp; <b>${isTutor ? "Student" : "Tutor"}:</b> ${participant}</p>
      <h2>Session Notes</h2><p>${notes.replace(/\n/g, "<br/>")}</p>
      <h2>Chat Messages</h2>${msgLines || "<p>No messages.</p>"}
      <script>window.print();window.onafterprint=function(){window.close();}<\/script>
      </body></html>`);
    w.document.close();
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    sendMessage.mutate({ sessionId, content, type: "text" }, {
      onSuccess: (msg) => { broadcastMessage(msg); setContent(""); }
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const MAX_MB = 50;
    if (file.size > MAX_MB * 1024 * 1024) {
      alert(`File too large. Max ${MAX_MB}MB.`);
      return;
    }

    setUploadingFile(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        let type: "image" | "video" | "document" = "document";
        if (file.type.startsWith("image/")) type = "image";
        else if (file.type.startsWith("video/")) type = "video";

        sendMessage.mutate(
          { sessionId, type, fileUrl: base64, content: file.name },
          { onSuccess: (msg) => { broadcastMessage(msg); setUploadingFile(false); } }
        );
      };
      reader.onerror = () => { setUploadingFile(false); };
      reader.readAsDataURL(file);
    } catch {
      setUploadingFile(false);
    }
  };

  const handleSendVoice = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return;
    if (!recording) {
      // start
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        };
        mediaRecorder.onstop = async () => {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result as string;
            sendMessage.mutate(
              { sessionId, type: "voice", fileUrl: base64, content: "" },
              { onSuccess: (msg) => broadcastMessage(msg) }
            );
          };
          reader.readAsDataURL(blob);
          stream.getTracks().forEach(t => t.stop());
        };
        mediaRecorder.start();
        setRecording(true);
      } catch {
        // ignore for now
      }
    } else {
      // stop
      mediaRecorderRef.current?.stop();
      setRecording(false);
    }
  };

  // Status text + indicator based on call phase
  const callStatusInfo = (() => {
    if (call.callState === "getting-media") {
      return { text: call.callMode === "audio" ? "Accessing microphone..." : "Accessing camera...", color: "text-muted-foreground", pulse: false };
    }
    if (call.callState === "waiting") {
      if (call.callPhase === "calling") return { text: `Calling ${otherPerson?.firstName}...`, color: "text-amber-500", pulse: true };
      return { text: `Ringing...`, color: "text-primary", pulse: true };
    }
    if (call.callState === "connected") {
      if (call.callPhase === "e2e") return { text: "End-to-end encrypted", color: "text-green-500", pulse: false };
      return { text: call.formatDuration(call.callDuration), color: "text-green-500", pulse: false };
    }
    if (call.callState === "ended") return { text: "Call ended", color: "text-muted-foreground", pulse: false };
    return { text: "", color: "text-muted-foreground", pulse: false };
  })();

  // ─── FULL SCREEN CALL ───
  const renderFullCall = () => {
    if (!isInCall || call.minimized) return null;

    const isWaiting = call.callState === "waiting";
    const isConnected = call.callState === "connected";

    return (
      <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8 border border-white/10">
              <AvatarImage src={otherPerson?.profileImageUrl || ""} />
              <AvatarFallback className="bg-white/10 text-white text-xs">{otherPerson?.firstName?.[0]}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold text-white">{otherPerson?.firstName} {otherPerson?.lastName}</p>
              <div className="flex items-center gap-1.5">
                {isConnected && call.callPhase === "e2e" && <Lock className="w-2.5 h-2.5 text-green-400" />}
                {isConnected && call.callPhase === "live" && <Signal className="w-2.5 h-2.5 text-green-400" />}
                {isWaiting && call.callPhase === "ringing" && <PhoneCall className="w-2.5 h-2.5 text-primary animate-pulse" />}
                <p className={`text-[11px] font-medium ${callStatusInfo.color} ${callStatusInfo.pulse ? "animate-pulse" : ""}`}>
                  {callStatusInfo.text}
                </p>
              </div>
            </div>
          </div>
          <button onClick={() => call.setMinimized(true)} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 text-white">
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Error */}
        {call.error && (
          <div className="mx-4 mt-1 px-4 py-2 bg-destructive/20 border border-destructive/30 rounded-lg text-red-300 text-xs">
            {call.error}
          </div>
        )}

        {/* Video / Audio area */}
        <div className="flex-1 relative flex items-center justify-center bg-zinc-950">
          {call.callMode === "video" ? (
            <>
              <div className="w-full h-full flex items-center justify-center relative">
                <video ref={call.remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <audio ref={call.remoteAudioRef} autoPlay playsInline className="hidden" />

                {/* Overlay while not yet connected */}
                {!isConnected && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950">
                    {/* Pulsing rings */}
                    <div className="relative flex items-center justify-center mb-6">
                      {(isWaiting) && (
                        <>
                          <div className="absolute w-36 h-36 rounded-full border border-white/10 animate-ping" style={{ animationDuration: "2s" }} />
                          <div className="absolute w-28 h-28 rounded-full border border-white/15 animate-ping" style={{ animationDuration: "2s", animationDelay: "0.4s" }} />
                        </>
                      )}
                      <Avatar className="w-24 h-24 border-2 border-white/20 relative z-10">
                        <AvatarImage src={otherPerson?.profileImageUrl || ""} />
                        <AvatarFallback className="bg-white/10 text-white text-3xl">{otherPerson?.firstName?.[0]}</AvatarFallback>
                      </Avatar>
                    </div>
                    <p className="text-white text-lg font-semibold">{otherPerson?.firstName} {otherPerson?.lastName}</p>
                    <p className={`text-sm mt-1.5 font-medium ${callStatusInfo.color} ${callStatusInfo.pulse ? "animate-pulse" : ""}`}>
                      {callStatusInfo.text}
                    </p>
                  </div>
                )}

                {/* E2E encrypted banner */}
                {isConnected && call.callPhase === "e2e" && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm border border-green-500/30 rounded-full px-4 py-1.5 flex items-center gap-2 z-20">
                    <Lock className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-xs font-semibold text-green-400">End-to-end encrypted</span>
                  </div>
                )}
              </div>

              {/* Local PiP */}
              <div className="absolute bottom-24 right-4 w-28 md:w-36 aspect-video rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-zinc-900">
                <video ref={call.localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
                {call.isVideoOff && (
                  <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
                    <VideoOff className="w-5 h-5 text-white/40" />
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Audio only */
            <div className="flex flex-col items-center justify-center w-full h-full bg-zinc-950">
              <div className="relative flex items-center justify-center mb-6">
                {isWaiting && (
                  <>
                    <div className="absolute w-40 h-40 rounded-full border border-white/8 animate-ping" style={{ animationDuration: "2s" }} />
                    <div className="absolute w-32 h-32 rounded-full border border-white/12 animate-ping" style={{ animationDuration: "2s", animationDelay: "0.5s" }} />
                  </>
                )}
                {isConnected && (
                  <div className="absolute w-32 h-32 rounded-full bg-green-500/10 animate-pulse" />
                )}
                <Avatar className="w-28 h-28 border-2 border-white/20 relative z-10">
                  <AvatarImage src={otherPerson?.profileImageUrl || ""} />
                  <AvatarFallback className="bg-white/10 text-white text-4xl">{otherPerson?.firstName?.[0]}</AvatarFallback>
                </Avatar>
              </div>
              <p className="text-white text-xl font-bold">{otherPerson?.firstName} {otherPerson?.lastName}</p>
              <div className="flex items-center gap-1.5 mt-2">
                {isConnected && call.callPhase === "e2e" && <Lock className="w-3 h-3 text-green-400" />}
                <p className={`text-sm font-medium ${callStatusInfo.color} ${callStatusInfo.pulse ? "animate-pulse" : ""}`}>
                  {callStatusInfo.text}
                </p>
              </div>

              {/* E2E banner for audio */}
              {isConnected && call.callPhase === "e2e" && (
                <div className="mt-4 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5 flex items-center gap-2">
                  <Lock className="w-3 h-3 text-green-400" />
                  <span className="text-xs font-semibold text-green-400">End-to-end encrypted</span>
                </div>
              )}

              <video ref={call.remoteVideoRef} autoPlay playsInline className="hidden" />
              <audio ref={call.remoteAudioRef} autoPlay playsInline className="hidden" />
              <video ref={call.localVideoRef} autoPlay playsInline muted className="hidden" />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-5 py-6 bg-zinc-950 shrink-0">
          <div className="flex flex-col items-center gap-1">
            <button onClick={call.toggleMute}
              className={`w-13 h-13 w-[52px] h-[52px] rounded-full flex items-center justify-center transition-colors ${call.isMuted ? "bg-red-500/90 text-white" : "bg-white/15 text-white hover:bg-white/25"}`}>
              {call.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <span className="text-[9px] text-white/40">{call.isMuted ? "Unmute" : "Mute"}</span>
          </div>
          {call.callMode === "video" && (
            <div className="flex flex-col items-center gap-1">
              <button onClick={call.toggleVideo}
                className={`w-[52px] h-[52px] rounded-full flex items-center justify-center transition-colors ${call.isVideoOff ? "bg-red-500/90 text-white" : "bg-white/15 text-white hover:bg-white/25"}`}>
                {call.isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </button>
              <span className="text-[9px] text-white/40">{call.isVideoOff ? "Show" : "Camera"}</span>
            </div>
          )}
          {call.callMode === "video" && call.callState === "connected" && (
            <div className="flex flex-col items-center gap-1">
              <button onClick={call.toggleScreenShare}
                className={`w-[52px] h-[52px] rounded-full flex items-center justify-center transition-colors ${call.isScreenSharing ? "bg-primary text-white" : "bg-white/15 text-white hover:bg-white/25"}`}>
                {call.isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
              </button>
              <span className="text-[9px] text-white/40">{call.isScreenSharing ? "Stop" : "Share"}</span>
            </div>
          )}
          <div className="flex flex-col items-center gap-1">
            <button onClick={call.endCall}
              className="w-[64px] h-[64px] rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-xl shadow-red-900/40 transition-transform active:scale-95">
              <PhoneOff className="w-6 h-6" />
            </button>
            <span className="text-[9px] text-white/40">End</span>
          </div>
        </div>
      </div>
    );
  };

  // ─── MINI CALL ───
  const renderMiniCall = () => {
    if (!isInCall || !call.minimized) return null;
    return (
      <div className="fixed bottom-20 right-4 z-50 w-52 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-zinc-900">
        {call.callMode === "video" ? (
          <div className="aspect-video bg-zinc-950 relative">
            <video ref={call.remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <audio ref={call.remoteAudioRef} autoPlay playsInline className="hidden" />
            {call.callState === "waiting" && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={otherPerson?.profileImageUrl || ""} />
                  <AvatarFallback className="bg-white/10 text-white text-lg">{otherPerson?.firstName?.[0]}</AvatarFallback>
                </Avatar>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 flex items-center gap-2.5">
            <div className={`w-2 h-2 rounded-full shrink-0 ${call.callState === "connected" ? "bg-green-500" : "bg-amber-500 animate-pulse"}`} />
            <Avatar className="w-6 h-6 shrink-0">
              <AvatarImage src={otherPerson?.profileImageUrl || ""} />
              <AvatarFallback className="bg-white/10 text-white text-[9px]">{otherPerson?.firstName?.[0]}</AvatarFallback>
            </Avatar>
            <span className="text-xs font-medium text-white truncate">{otherPerson?.firstName}</span>
            <audio ref={call.remoteAudioRef} autoPlay playsInline className="hidden" />
          </div>
        )}
        <div className="flex items-center justify-between px-2.5 py-2 bg-zinc-800/80">
          <div className="flex items-center gap-1.5">
            {call.callState === "connected" && call.callPhase === "live" && (
              <Signal className="w-2.5 h-2.5 text-green-400" />
            )}
            <span className={`text-[10px] font-medium ${callStatusInfo.color} ${callStatusInfo.pulse ? "animate-pulse" : ""}`}>
              {callStatusInfo.text}
            </span>
          </div>
          <div className="flex gap-1">
            <button onClick={() => call.setMinimized(false)} className="w-6 h-6 rounded-md bg-white/10 text-white flex items-center justify-center hover:bg-white/20">
              <Maximize2 className="w-3 h-3" />
            </button>
            <button onClick={call.endCall} className="w-6 h-6 rounded-md bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/30">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── MAIN VIEW ───
  return (
    <>
      {renderFullCall()}
      {renderMiniCall()}

      <div className="h-[calc(100vh-8rem)] md:h-[calc(100vh-6rem)] flex flex-col md:flex-row gap-4 pb-16 md:pb-0">
        {/* Desktop sidebar */}
        <div className="hidden md:flex md:w-72 flex-col gap-4 shrink-0">
          <Link href="/sessions" className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center w-fit">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
          </Link>
          <div className="bg-card rounded-xl p-5 border border-border/60 shadow-soft flex-1 overflow-y-auto">
            <div className="text-center mb-5">
              <Avatar className="w-16 h-16 mx-auto border-2 border-background shadow-sm mb-3">
                <AvatarImage src={otherPerson?.profileImageUrl || ""} />
                <AvatarFallback className="bg-primary/8 text-primary text-xl font-bold">{otherPerson?.firstName?.[0]}</AvatarFallback>
              </Avatar>
              <h3 className="text-base font-bold">{otherPerson?.firstName} {otherPerson?.lastName}</h3>
              <p className="text-xs text-muted-foreground capitalize">{isTutor ? "Student" : "Tutor"}</p>
            </div>
            <div className="space-y-3">
              <div className="bg-muted/30 p-3 rounded-lg">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase mb-0.5">Course</p>
                <p className="font-semibold text-sm">{session.course?.code || "Session"}</p>
              </div>
              {session.date && session.startTime && (
                <div className="bg-primary/8 p-3 rounded-lg">
                  <p className="text-[10px] text-primary font-semibold uppercase mb-0.5">Scheduled</p>
                  <p className="font-semibold text-sm">{format(new Date(session.date), 'MMM dd, yyyy')}</p>
                  <p className="text-xs text-muted-foreground">{session.startTime} · {session.durationMinutes}min</p>
                </div>
              )}
              <div className="bg-muted/30 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase">Notes</p>
                  <div className="flex items-center gap-1.5">
                    <button onClick={exportNotesPDF} title="Export as PDF"
                      className="text-muted-foreground hover:text-foreground transition-colors">
                      <FileDown className="w-3 h-3" />
                    </button>
                    {!editingNotes ? (
                      <button onClick={() => { setNotesValue(session.notes || ""); setEditingNotes(true); }}
                        className="text-muted-foreground hover:text-foreground transition-colors">
                        <Edit3 className="w-3 h-3" />
                      </button>
                    ) : (
                      <div className="flex gap-1">
                        <button onClick={() => updateNotes.mutate(notesValue)} className="text-primary hover:text-primary/80" disabled={updateNotes.isPending}>
                          {updateNotes.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        </button>
                        <button onClick={() => setEditingNotes(false)} className="text-muted-foreground hover:text-foreground">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {editingNotes ? (
                  <Textarea className="text-xs resize-none min-h-[72px] rounded-md border-border/50 bg-background"
                    value={notesValue} onChange={e => setNotesValue(e.target.value)}
                    placeholder="Add shared notes for this session..." />
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    {session.notes ? `"${session.notes}"` : "No notes yet — click ✎ to add some."}
                  </p>
                )}
              </div>
            </div>
            {session.status === "pending" && isTutor && (
              <div className="mt-4 pt-4 border-t border-border/50 space-y-2">
                <p className="text-xs font-semibold">Request</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 rounded-md text-xs h-8"
                    disabled={updateStatus.isPending}
                    onClick={() => updateStatus.mutate({ id: sessionId, status: "accepted" })}
                  >
                    <Check className="w-3.5 h-3.5 mr-1" /> Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-md text-xs h-8 text-destructive border-destructive/20 hover:bg-destructive/10"
                    disabled={updateStatus.isPending}
                    onClick={() => updateStatus.mutate({ id: sessionId, status: "declined" })}
                  >
                    <X className="w-3.5 h-3.5 mr-1" /> Reject
                  </Button>
                </div>
              </div>
            )}
            {session.status === "accepted" && !session.date && (
              <div className="mt-4 pt-4 border-t border-border/50">
                {!showSchedule ? (
                  <Button onClick={() => setShowSchedule(true)} variant="outline" className="w-full rounded-lg gap-2 text-xs h-9" size="sm">
                    <CalendarPlus className="w-3.5 h-3.5" /> Propose a Time
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold">Schedule</p>
                    <Input type="date" className="h-8 rounded-md text-xs" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} />
                    <Input type="time" className="h-8 rounded-md text-xs" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} />
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 rounded-md text-xs h-8" disabled={!scheduleDate || scheduleSession.isPending}
                        onClick={() => scheduleSession.mutate({ id: sessionId, date: scheduleDate, startTime: scheduleTime }, { onSuccess: () => setShowSchedule(false) })}>
                        {scheduleSession.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-md text-xs h-8" onClick={() => setShowSchedule(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {(session.status === "accepted" || session.status === "scheduled") && (
              <div className="mt-4 pt-4 border-t border-border/50 space-y-2">
                <p className="text-xs font-semibold">Close</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full rounded-lg gap-2 text-xs h-9 text-destructive border-destructive/20 hover:bg-destructive/10"
                  disabled={updateStatus.isPending}
                  onClick={() => updateStatus.mutate({ id: sessionId, status: "cancelled" })}
                >
                  End / Cancel Session
                </Button>
                {isTutor && (
                  <Button
                    size="sm"
                    className="w-full rounded-lg gap-2 text-xs h-9"
                    disabled={updateStatus.isPending}
                    onClick={() => updateStatus.mutate({ id: sessionId, status: "completed" })}
                  >
                    Mark as Completed
                  </Button>
                )}
              </div>
            )}
            {["completed", "cancelled", "declined"].includes(session.status) && (
              <div className="mt-4 pt-4 border-t border-border/50 space-y-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full rounded-lg gap-2 text-xs h-9 text-destructive border-destructive/20 hover:bg-destructive/10"
                  disabled={deleteSession.isPending}
                  onClick={() => deleteSession.mutate(sessionId)}
                >
                  Delete Session
                </Button>
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-border/50 space-y-2">
              <Button onClick={() => handleStartCall("video")} className="w-full rounded-lg gap-2 text-xs h-9" size="sm" disabled={isInCall}>
                <Video className="w-3.5 h-3.5" /> Video Call
              </Button>
              <Button onClick={() => handleStartCall("audio")} variant="outline" className="w-full rounded-lg gap-2 text-xs h-9" size="sm" disabled={isInCall}>
                <Phone className="w-3.5 h-3.5" /> Audio Call
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile header */}
        <div className="flex md:hidden items-center justify-between px-1 py-2">
          <Link href="/sessions" className="text-xs text-muted-foreground flex items-center"><ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back</Link>
          <div className="flex items-center gap-2">
            <Avatar className="w-6 h-6 border border-border">
              <AvatarImage src={otherPerson?.profileImageUrl || ""} />
              <AvatarFallback className="bg-primary/8 text-primary text-[9px]">{otherPerson?.firstName?.[0]}</AvatarFallback>
            </Avatar>
            <span className="text-xs font-semibold">{otherPerson?.firstName}</span>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => handleStartCall("audio")} disabled={isInCall} className="w-7 h-7 rounded-md bg-muted flex items-center justify-center disabled:opacity-40">
              <Phone className="w-3.5 h-3.5 text-primary" />
            </button>
            <button onClick={() => handleStartCall("video")} disabled={isInCall} className="w-7 h-7 rounded-md bg-primary flex items-center justify-center disabled:opacity-40">
              <Video className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>

        {/* Chat */}
        <div className="flex-1 bg-card rounded-xl border border-border/60 shadow-soft flex flex-col overflow-hidden min-h-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/5">
            <div className="text-center py-2">
              <span className="text-[10px] bg-muted text-muted-foreground px-2.5 py-1 rounded-full font-medium">Session started</span>
            </div>
            {messages.map((msg: any) => {
              const isMe = msg.senderId === user?.id;
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-2 max-w-[75%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    {!isMe && (
                      <Avatar className="w-6 h-6 shrink-0 mt-auto border border-border">
                        <AvatarImage src={otherPerson?.profileImageUrl || ""} />
                        <AvatarFallback className="bg-primary/8 text-primary text-[9px]">{otherPerson?.firstName?.[0]}</AvatarFallback>
                      </Avatar>
                    )}
                    <div className={`rounded-xl px-3.5 py-2 relative ${isMe ? 'bg-primary text-white rounded-br-sm' : 'bg-card border border-border/50 rounded-bl-sm'}`}>
                      {msg.type === "voice" && msg.fileUrl ? (
                        <audio controls className="w-40">
                          <source src={msg.fileUrl} />
                        </audio>
                      ) : msg.type === "image" && msg.fileUrl ? (
                        <img src={msg.fileUrl} alt="Attachment" className="max-h-48 rounded-md" />
                      ) : msg.type === "video" && msg.fileUrl ? (
                        <video controls className="max-h-48 rounded-md">
                          <source src={msg.fileUrl} />
                        </video>
                      ) : msg.type === "document" && msg.fileUrl ? (
                        <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="underline text-sm">
                          {msg.content || "Download file"}
                        </a>
                      ) : (
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                      )}
                      {isMe && (
                        <button
                          type="button"
                          onClick={() => deleteMessage.mutate(msg.id)}
                          className="absolute -top-2 -right-2 text-[10px] bg-black/40 rounded-full px-1.5 py-0.5"
                        >
                          Delete
                        </button>
                      )}
                      <span className={`text-[9px] mt-0.5 block opacity-60 ${isMe ? 'text-right' : 'text-left'}`}>
                        {msg.createdAt ? format(new Date(msg.createdAt), 'h:mm a') : ''}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Typing indicator */}
          {partnerTyping && (
            <div className="px-4 py-1.5 bg-card border-t border-border/30 flex items-center gap-1.5">
              <div className="flex gap-0.5 items-end">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <span className="text-[11px] text-muted-foreground">{otherPerson?.firstName} is typing...</span>
            </div>
          )}
          {/* Read receipt */}
          {partnerRead && messages.length > 0 && (
            <div className="px-4 pb-1 flex justify-end">
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <CheckCheck className="w-3 h-3 text-primary" /> Seen
              </span>
            </div>
          )}
          <div className="p-3 bg-card border-t border-border/50 shrink-0">
            <form onSubmit={handleSend} className="flex items-center gap-2">
              {/* File attach */}
              <input ref={fileInputRef} type="file" className="hidden"
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                onChange={handleFileUpload} />
              <button type="button" onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                className="w-10 h-10 rounded-lg shrink-0 bg-muted/40 hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors">
                {uploadingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
              </button>
              <Input placeholder="Type a message..." className="flex-1 rounded-lg h-10 bg-muted/20 border-border/50 text-sm px-3.5"
                value={content} onChange={e => { setContent(e.target.value); handleTyping(); }} />
              <Button
                type="button"
                size="icon"
                className={`h-10 w-10 rounded-lg shrink-0 ${recording ? "bg-destructive text-white" : ""}`}
                onClick={handleSendVoice}
              >
                {recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              <Button type="submit" disabled={!content.trim() || sendMessage.isPending} size="icon" className="h-10 w-10 rounded-lg shrink-0">
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
