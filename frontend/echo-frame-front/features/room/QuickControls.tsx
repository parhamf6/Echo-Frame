// QuickControls.tsx

'use client';

import { useState } from 'react';
import useAudioLevel from '@/lib/hooks/use-audio-level';
import { Mic, MicOff, Volume2, VolumeX, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
// Import Track from livekit-client for the deafen function
import { Track } from 'livekit-client'; 

interface QuickControlsProps {
  roomId: string;
  livekit: any;
  audioLevel?: any;
}

export default function QuickControls({ roomId, livekit, audioLevel: audioLevelProp }: QuickControlsProps) {
  const [isMuted, setIsMuted] = useState(true); // Start muted by default
  const [isDeafened, setIsDeafened] = useState(false);
  const audioLevel = audioLevelProp ?? useAudioLevel();

  const toggleMute = async () => {
    if (!livekit.room || !livekit.localParticipant) {
      toast.error('Not connected to voice chat');
      return;
    }

    try {
      // Determine the new mute state BEFORE changing it
      const newMutedState = !isMuted;
      
      // Use the high-level API to enable/disable the microphone
      // setMicrophoneEnabled(true) = unmute, setMicrophoneEnabled(false) = mute
      // If currently muted (isMuted=true), newMutedState=false, so we enable (pass true)
      // If currently unmuted (isMuted=false), newMutedState=true, so we disable (pass false)
      await livekit.localParticipant.setMicrophoneEnabled(!newMutedState);
      
      // Update the component state to reflect the change
      setIsMuted(newMutedState);
      toast.success(newMutedState ? 'Microphone muted' : 'Microphone unmuted');

        // Start/stop local audio analyser to show live speaking indicator
        try {
          if (newMutedState) {
            // We're about to mute, so stop the analyser
            console.log('[QuickControls] Stopping audio level analyzer');
            audioLevel.stop();
          } else {
            // We're about to unmute, so start the analyser
            console.log('[QuickControls] Starting audio level analyzer');
            await audioLevel.start();
            console.log('[QuickControls] Audio level analyzer started');
          }
        } catch (e) {
          // If the VAD analyzer fails (e.g., on Brave due to audio permissions), we can still use LiveKit's isSpeaking
          console.warn('[QuickControls] Audio level analyzer failed (this is OK on some browsers):', e);
          // Don't fail the whole unmute - LiveKit will still work
        }

        // Basic sanity check: ensure LiveKit has a microphone publication
        try {
          // Add a small delay to allow the track to be published
          if (!newMutedState) {
            // Only check if we just unmuted
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          const pub = livekit.localParticipant.getTrackPublication(Track.Source.Microphone);
          console.log('[QuickControls] Microphone publication check:', {
            hasPublication: !!pub,
            hasTr: !!pub?.track,
            isMuted: pub?.isMuted,
            trackState: pub?.track?.mediaStream ? 'active' : 'inactive',
          });
          
          if (!newMutedState && (!pub || !pub.track)) {
            // Only warn if we just unmuted and there's no track
            console.warn('[QuickControls] Microphone publication missing after unmute');
            toast.warning('Microphone enabled, but no audio track detected. Check browser permissions and that your mic is not used by another app.');
          }
        } catch (e) {
          console.warn('[QuickControls] Failed to validate microphone publication:', e);
        }
    } catch (error) {
      console.error('Failed to toggle mute:', error);
      toast.error('Failed to toggle microphone. Check browser permissions.');
    }
  };

  const toggleDeafen = () => {
    if (!livekit.room) {
      toast.error('Not connected to voice chat');
      return;
    }

    // Mute all remote audio tracks
    const participants = livekit.participants || [];
    
    participants.forEach((participant: any) => {
      // Iterate over the participant's track publications
      participant.trackPublications.forEach((publication: any) => {
        // Check if the publication is for an audio track and has a track object
        if (publication.kind === Track.Kind.Audio && publication.track) {
          // publication.track is the RemoteTrack object
          publication.track.setVolume(isDeafened ? 1 : 0);
        }
      });
    });

    setIsDeafened(!isDeafened);
    toast.success(isDeafened ? 'Audio enabled' : 'Audio muted');
  };

  const handleLeave = () => {
    if (confirm('Are you sure you want to leave the room?')) {
      livekit.disconnect();
      window.location.href = '/room';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 flex items-center space-x-2 bg-card border border-border rounded-lg p-2 shadow-lg">
      {/* Mute Self */}
      <Button
        onClick={toggleMute}
        variant={isMuted ? 'destructive' : 'default'}
        size="sm"
        className="flex items-center space-x-2"
      >
        {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        {/* Local speaking indicator */}
        <span className="ml-1 inline-flex items-center">
          <span className={`w-2 h-2 rounded-full ${audioLevel.isSpeaking ? 'bg-green-500 animate-pulse' : 'bg-muted'}`} />
        </span>
        <span className="hidden sm:inline">
          {isMuted ? 'Unmute' : 'Mute'}
        </span>
      </Button>

      {/* Deafen */}
      <Button
        onClick={toggleDeafen}
        variant={isDeafened ? 'destructive' : 'outline'}
        size="sm"
        className="flex items-center space-x-2"
      >
        {isDeafened ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        <span className="hidden sm:inline">
          {isDeafened ? 'Undeafen' : 'Deafen'}
        </span>
      </Button>

      {/* Leave */}
      <Button
        onClick={handleLeave}
        variant="outline"
        size="sm"
        className="flex items-center space-x-2 text-red-600 hover:bg-red-50"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Leave</span>
      </Button>
    </div>
  );
}