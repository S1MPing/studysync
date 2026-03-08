import { useState, useRef, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useSession, useScheduleSession } from "@/hooks/use-sessions";
import { useMessages, useRealtimeMessages, useSendMessage } from "@/hooks/use-messages";
import { useVideoCall, type CallMode } from "@/hooks/use-video-call";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Send, Loader2, ArrowLeft, Video, VideoOff,
  Mic, MicOff, PhoneOff, Phone, CalendarPlus, Minimize2, Maximize2
} from "lucide-react";
import { format } from "date-fns";

export function SessionDetail() {
  const [, params] = useRoute("/sessions/:id");
  const sessionId = parseInt(params?.id || "0");
  const { user } = useAuth();

  const { data: session, isLoading: sessionLoading } = useSession(sessionId);
  const { data: messages = [] } = useMessages(sessionId);
  const sendMessage = useSendMessage();
  const { broadcastMessage } = useRealtimeMessages(sessionId, user?.id || "");
  const videoCall = useVideoCall(sessionId);
  const scheduleSession = useScheduleSession();

  const [content, setContent] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("18:00");
  const [minimized, setMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (sessionLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!session) return <div className="flex justify-center py-20 text-muted-foreground">Session not found</div>;

  const isTutor = session.tutorId === user?.id;
  const otherPerson = isTutor ? session.student : session.tutor;
  const isInCall = videoCall.callState !== "idle" && videoCall.callState !== "ended";

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    sendMessage.mutate({ sessionId, content, type: "text" }, {
      onSuccess: (newMessage) => { broadcastMessage(newMessage); setContent(""); }
    });
  };

  const handleStartCall = (mode: CallMode) => {
    setMinimized(false);
    videoCall.startCall(mode);
  };

  const handleEndCall = () => {
    videoCall.endCall();
    setMinimized(false);
  };

  const callStatusText = videoCall.callState === "requesting-media" ? "Accessing camera..." :
    videoCall.callState === "connecting" ? "Connecting..." :
    videoCall.callState === "in-call" ? "Connected" :
    videoCall.callState === "ended" ? "Call ended" : "";

  // ─── MINIMIZED FLOATING CALL (PiP) ───
  const renderMiniCall = () => {
    if (!isInCall || !minimized) return null;
    return (
      <div className="fixed bottom-20 right-4 z-50 w-48 rounded-xl overflow-hidden border border-border shadow-xl bg-card">
        {videoCall.callMode === "video" ? (
          <div className="aspect-video bg-muted relative">
            <video ref={videoCall.remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="absolute top-1 left-1 w-12 aspect-video rounded-md overflow-hidden border border-border/50">
              <video ref={videoCall.localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            </div>
          </div>
        ) : (
          <div className="p-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium truncate">{otherPerson?.firstName} — Audio</span>
            <audio ref={videoCall.remoteVideoRef as any} autoPlay />
          </div>
        )}
        <div className="flex items-center justify-between px-2 py-1.5 bg-muted/50">
          <span className="text-[9px] text-muted-foreground font-medium">{callStatusText}</span>
          <div className="flex gap-1">
            <button onClick={() => setMinimized(false)} className="w-6 h-6 rounded-md bg-card flex items-center justify-center hover:bg-muted">
              <Maximize2 className="w-3 h-3" />
            </button>
            <button onClick={handleEndCall} className="w-6 h-6 rounded-md bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20">
              <PhoneOff className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── FULL-SCREEN CALL ───
  const renderFullCall = () => {
    if (!isInCall || minimized) return null;
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card">
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8 border border-border">
              <AvatarImage src={otherPerson?.profileImageUrl || ""} />
              <AvatarFallback className="bg-primary/8 text-primary text-xs">{otherPerson?.firstName?.[0]}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold">{otherPerson?.firstName} {otherPerson?.lastName}</p>
              <p className="text-muted-foreground text-[10px]">{callStatusText}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{session.course?.code}</span>
            <button onClick={() => setMinimized(true)}
              className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
              <Minimize2 className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Error */}
        {videoCall.error && (
          <div className="mx-4 mt-2 px-4 py-2 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-xs">
            {videoCall.error}
          </div>
        )}

        {/* Call content */}
        <div className="flex-1 relative flex items-center justify-center p-4 bg-muted/20">
          {videoCall.callMode === "video" ? (
            <>
              {/* Remote video */}
              <div className="w-full h-full rounded-xl overflow-hidden bg-muted/30 flex items-center justify-center relative">
                <video ref={videoCall.remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                {(videoCall.callState === "connecting" || videoCall.callState === "requesting-media") && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/50">
                    <Avatar className="w-20 h-20 mb-4 border-2 border-border">
                      <AvatarImage src={otherPerson?.profileImageUrl || ""} />
                      <AvatarFallback className="bg-primary/8 text-primary text-2xl">{otherPerson?.firstName?.[0]}</AvatarFallback>
                    </Avatar>
                    <p className="text-muted-foreground text-sm">Waiting for {otherPerson?.firstName} to join...</p>
                    <Loader2 className="w-5 h-5 text-muted-foreground animate-spin mt-3" />
                  </div>
                )}
              </div>

              {/* Local video PiP */}
              <div className="absolute bottom-20 right-6 w-32 md:w-44 aspect-video rounded-xl overflow-hidden border-2 border-border shadow-xl bg-muted/30">
                <video ref={videoCall.localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
                {videoCall.isVideoOff && (
                  <div className="absolute inset-0 bg-muted flex items-center justify-center">
                    <VideoOff className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Audio call */
            <div className="flex flex-col items-center justify-center">
              <div className="w-28 h-28 rounded-full bg-muted/50 border-2 border-border flex items-center justify-center mb-6 relative">
                <Avatar className="w-24 h-24">
                  <AvatarImage src={otherPerson?.profileImageUrl || ""} />
                  <AvatarFallback className="bg-primary/8 text-primary text-3xl">{otherPerson?.firstName?.[0]}</AvatarFallback>
                </Avatar>
                {videoCall.callState === "in-call" && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-background" />
                )}
              </div>
              <p className="text-lg font-semibold">{otherPerson?.firstName} {otherPerson?.lastName}</p>
              <p className="text-muted-foreground text-sm mt-1">
                {videoCall.callState === "connecting" ? "Calling..." : videoCall.callState === "in-call" ? "Audio call" : ""}
              </p>
              <audio ref={videoCall.remoteVideoRef as any} autoPlay />
              <audio ref={videoCall.localVideoRef as any} autoPlay muted />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 py-5 border-t border-border/50 bg-card px-4">
          <button onClick={videoCall.toggleMute}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              videoCall.isMuted ? "bg-destructive text-white" : "bg-muted text-foreground hover:bg-muted/80"
            }`}>
            {videoCall.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {videoCall.callMode === "video" && (
            <button onClick={videoCall.toggleVideo}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                videoCall.isVideoOff ? "bg-destructive text-white" : "bg-muted text-foreground hover:bg-muted/80"
              }`}>
              {videoCall.isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>
          )}

          <button onClick={handleEndCall}
            className="w-14 h-14 rounded-full bg-destructive hover:bg-destructive/90 text-white flex items-center justify-center transition-colors shadow-lg">
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>
    );
  };

  // ─── NORMAL SESSION VIEW ───
  return (
    <>
      {renderFullCall()}
      {renderMiniCall()}

      <div className="h-[calc(100vh-8rem)] md:h-[calc(100vh-6rem)] flex flex-col md:flex-row gap-4 pb-16 md:pb-0">

        {/* Sidebar — desktop only */}
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
              {session.notes && (
                <div className="bg-muted/30 p-3 rounded-lg">
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase mb-0.5">Notes</p>
                  <p className="text-xs italic">"{session.notes}"</p>
                </div>
              )}
            </div>

            {/* Schedule */}
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

            {/* Call buttons */}
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
          <Link href="/sessions" className="text-xs text-muted-foreground flex items-center">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
          </Link>
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
                    <div className={`rounded-xl px-3.5 py-2 ${isMe ? 'bg-primary text-white rounded-br-sm' : 'bg-card border border-border/50 rounded-bl-sm'}`}>
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                      <span className={`text-[9px] mt-0.5 block opacity-60 ${isMe ? 'text-right' : 'text-left'}`}>
                        {msg.createdAt ? format(new Date(msg.createdAt), 'h:mm a') : ''}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-card border-t border-border/50 shrink-0">
            <form onSubmit={handleSend} className="flex items-center gap-2">
              <Input placeholder="Type a message..." className="flex-1 rounded-lg h-10 bg-muted/20 border-border/50 text-sm px-3.5"
                value={content} onChange={e => setContent(e.target.value)} />
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
