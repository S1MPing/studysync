import { useState, useCallback } from "react";

export function useJitsiCall(sessionId: number, userName: string) {
  const [isInCall, setIsInCall] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const roomName = `StudySync-Session-${sessionId}`;
  
  // Jitsi Meet URL with config
  const jitsiUrl = `https://meet.jit.si/${roomName}#userInfo.displayName="${encodeURIComponent(userName)}"&config.startWithAudioMuted=false&config.startWithVideoMuted=false&config.prejoinPageEnabled=false`;

  const jitsiAudioUrl = `https://meet.jit.si/${roomName}#userInfo.displayName="${encodeURIComponent(userName)}"&config.startWithAudioMuted=false&config.startWithVideoMuted=true&config.prejoinPageEnabled=false`;

  const startVideoCall = useCallback(() => {
    setIsInCall(true);
    setMinimized(false);
  }, []);

  const startAudioCall = useCallback(() => {
    setIsInCall(true);
    setMinimized(false);
  }, []);

  const endCall = useCallback(() => {
    setIsInCall(false);
    setMinimized(false);
  }, []);

  const minimize = useCallback(() => setMinimized(true), []);
  const maximize = useCallback(() => setMinimized(false), []);

  return {
    isInCall,
    minimized,
    roomName,
    jitsiUrl,
    jitsiAudioUrl,
    startVideoCall,
    startAudioCall,
    endCall,
    minimize,
    maximize,
  };
}
