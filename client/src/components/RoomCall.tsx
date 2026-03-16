import { useState, useRef, useEffect } from "react";
import { useRoomCall } from "@/hooks/use-room-call";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  PhoneOff, UserPlus, Users, Loader2, X,
} from "lucide-react";

interface InviteCandidate {
  id: string;
  firstName: string;
  lastName: string;
  profileImageUrl?: string | null;
}

interface RoomCallProps {
  roomId: number;
  roomName: string;
  userId: string;
  userName: string;
  onLeave: () => void;
}

// Single participant video tile
function VideoTile({
  stream,
  label,
  isLocal = false,
  videoRef,
}: {
  stream?: MediaStream | null;
  label: string;
  isLocal?: boolean;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
}) {
  const internalRef = useRef<HTMLVideoElement>(null);
  const ref = (videoRef as React.RefObject<HTMLVideoElement>) ?? internalRef;

  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream, ref]);

  const initials = label.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="relative bg-gray-900 rounded-xl overflow-hidden aspect-video flex items-center justify-center">
      {stream ? (
        <video
          ref={ref}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-14 h-14 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xl font-bold">
          {initials}
        </div>
      )}
      <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-md">
        {label}{isLocal && " (You)"}
      </div>
    </div>
  );
}

export function RoomCall({ roomId, roomName, userId, userName, onLeave }: RoomCallProps) {
  const { toast } = useToast();
  const {
    isInCall, isConnecting, isMuted, isVideoOff, isScreenSharing,
    participants, error, localVideoRef,
    joinCall, leaveCall, toggleMute, toggleVideo, toggleScreenShare, sendInvite,
  } = useRoomCall(roomId, userId);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteCandidates, setInviteCandidates] = useState<InviteCandidate[]>([]);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    joinCall("video");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (error) toast({ title: error, variant: "destructive" });
  }, [error, toast]);

  const handleLeave = () => {
    leaveCall();
    onLeave();
  };

  const openInvite = async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/invite-candidates`, { credentials: "include" });
      if (res.ok) setInviteCandidates(await res.json());
    } catch {}
    setShowInvite(true);
  };

  const handleInvite = (candidate: InviteCandidate) => {
    sendInvite(candidate.id, userName, roomName);
    setInvitedIds(prev => new Set(prev).add(candidate.id));
    toast({ title: `Invited ${candidate.firstName} ${candidate.lastName}` });
  };

  const participantEntries = Array.from(participants.entries());
  const totalTiles = 1 + participantEntries.length; // 1 for local

  // Grid layout based on participant count
  const gridCols = totalTiles === 1 ? "grid-cols-1" :
    totalTiles === 2 ? "grid-cols-2" :
    totalTiles <= 4 ? "grid-cols-2" :
    "grid-cols-3";

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-white font-semibold text-sm">{roomName}</span>
        </div>
        <div className="flex items-center gap-1 text-gray-400 text-xs">
          <Users className="w-3.5 h-3.5" />
          <span>{1 + participantEntries.length} participant{1 + participantEntries.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 overflow-auto p-4">
        {isConnecting ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
            <p className="text-gray-400 text-sm">Connecting to room...</p>
          </div>
        ) : (
          <div className={`grid ${gridCols} gap-3 max-w-5xl mx-auto`}>
            {/* Local tile */}
            <VideoTile
              stream={localVideoRef.current?.srcObject as MediaStream | undefined}
              label={userName}
              isLocal
              videoRef={localVideoRef}
            />
            {/* Remote tiles */}
            {participantEntries.map(([peerId, stream]) => (
              <VideoTile
                key={peerId}
                stream={stream}
                label={peerId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-900/80 border-t border-white/10 py-4 px-4">
        <div className="flex items-center justify-center gap-3 max-w-lg mx-auto">
          <button
            onClick={toggleMute}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isMuted ? "bg-red-500/20 text-red-400 border border-red-500/40" : "bg-white/10 text-white hover:bg-white/20"}`}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleVideo}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isVideoOff ? "bg-red-500/20 text-red-400 border border-red-500/40" : "bg-white/10 text-white hover:bg-white/20"}`}
            title={isVideoOff ? "Turn on camera" : "Turn off camera"}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleScreenShare}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isScreenSharing ? "bg-indigo-500/30 text-indigo-300 border border-indigo-500/40" : "bg-white/10 text-white hover:bg-white/20"}`}
            title={isScreenSharing ? "Stop sharing" : "Share screen"}
          >
            {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </button>

          <button
            onClick={openInvite}
            className="w-12 h-12 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all"
            title="Invite someone"
          >
            <UserPlus className="w-5 h-5" />
          </button>

          <button
            onClick={handleLeave}
            className="w-14 h-12 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all"
            title="Leave call"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10 p-4">
          <div className="bg-gray-900 rounded-2xl border border-white/10 w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Invite to Room</h3>
              <button onClick={() => setShowInvite(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {inviteCandidates.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">
                No accepted session contacts to invite.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {inviteCandidates.map(c => (
                  <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5">
                    <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden">
                      {c.profileImageUrl ? (
                        <img src={c.profileImageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        `${c.firstName[0]}${c.lastName[0]}`
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{c.firstName} {c.lastName}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={invitedIds.has(c.id) ? "outline" : "default"}
                      disabled={invitedIds.has(c.id)}
                      onClick={() => handleInvite(c)}
                      className="text-xs h-7 px-3 shrink-0"
                    >
                      {invitedIds.has(c.id) ? "Invited" : "Invite"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
