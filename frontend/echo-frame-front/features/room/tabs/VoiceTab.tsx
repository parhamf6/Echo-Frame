// features/room/tabs/VoiceTab.tsx

'use client';

import { useMemo } from 'react';
// Remove hooks that require RoomContext
// import { useParticipants, useIsSpeaking, useLocalParticipant } from '@livekit/components-react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { motion } from 'framer-motion';
// Import Track from livekit-client
import { Track } from 'livekit-client';

interface VoiceTabProps {
  livekit: any;
  guest: any;
  audioLevel?: any;
}

export default function VoiceTab({ livekit, guest, audioLevel }: VoiceTabProps) {
  // Get the room to access all participants
  const room = livekit.room as any;
  const localParticipant = livekit.localParticipant;
  
  const canVoice = guest?.permissions?.can_voice || false;
  const isAdminOrMod = guest?.role === 'admin' || guest?.role === 'moderator';

  // Get all participants in the room (includes local and remote)
  const allParticipants = useMemo(() => {
    const participants = [];
    
    // Always add local participant first if available
    if (localParticipant) {
      participants.push(localParticipant);
    }
    
    // Add remote participants from room.participants
    if (room && room.participants) {
      try {
        const remoteList = Array.from((room.participants as any).values());
        participants.push(...remoteList);
      } catch (e) {
        console.warn('[VoiceTab] Error reading room.participants:', e);
      }
    }
    
    console.log('[VoiceTab] All participants:', participants.length, 'local:', !!localParticipant, 'remote:', room?.participants?.size || 0);
    return participants;
  }, [room, localParticipant]);

  // Filter participants who are connected (don't filter by track publication - show all connected participants)
  const audioParticipants = useMemo(() => {
    const filtered = (allParticipants as any[]).filter((p: any) => {
      // Show all connected participants, not just those with published mics
      // Remote participants might not have published their mic yet, but they're still in the room
      return true;
    });
    console.log('[VoiceTab] Showing all participants:', filtered.length, 'local:', !!allParticipants.find((p: any) => p.isLocal), 'remote:', filtered.length - (allParticipants.find((p: any) => p.isLocal) ? 1 : 0));
    return filtered;
  }, [allParticipants]);

  if (!livekit.isConnected) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <Volume2 className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            Connecting to voice chat...
          </p>
        </div>
      </div>
    );
  }

  if (!canVoice) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <VolumeX className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            You don't have permission to join voice chat
          </p>
          <p className="text-xs text-muted-foreground">
            Ask a moderator to enable voice permissions
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-sm">
          Voice Participants ({audioParticipants.length})
        </h3>
      </div>

      {/* Participants List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {audioParticipants.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              No one in voice chat yet
            </p>
          </div>
        ) : (
          (audioParticipants as any[]).map((participant: any) => (
            <VoiceParticipantItem
              key={participant.identity}
              participant={participant}
              isLocal={participant.identity === (localParticipant as any)?.identity}
              isAdminOrMod={isAdminOrMod}
              localIsSpeaking={participant.identity === (localParticipant as any)?.identity ? audioLevel?.isSpeaking : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface VoiceParticipantItemProps {
  participant: any;
  isLocal: boolean;
  isAdminOrMod: boolean;
  localIsSpeaking?: boolean;
}

function VoiceParticipantItem({ participant, isLocal, isAdminOrMod, localIsSpeaking }: VoiceParticipantItemProps) {
  // The participant object has a built-in isSpeaking property
  // If this is the local participant and we have a local analyser value, prefer that
  const isSpeaking = isLocal && localIsSpeaking !== undefined
    ? localIsSpeaking
    : participant.isSpeaking || false;
  
  const publication = participant.getTrackPublication(Track.Source.Microphone);
  const isMuted = !publication || publication.isMuted;
  const hasNotJoinedVoice = !publication; // Participant hasn't published mic yet

  // Parse metadata for username
  const metadata = participant.metadata ? JSON.parse(participant.metadata) : {};
  const username = metadata.username || participant.name || participant.identity || 'Unknown';
  const role = metadata.role || 'viewer';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        flex items-center justify-between p-3 rounded-lg
        border transition-all
        ${isSpeaking 
          ? 'border-green-500 bg-green-500/10' 
          : 'border-border bg-card'
        }
      `}
    >
      {/* Avatar & Info */}
      <div className="flex items-center space-x-3">
        {/* Avatar with speaking indicator */}
        <motion.div
          animate={{
            scale: isSpeaking ? [1, 1.1, 1] : 1,
          }}
          transition={{
            duration: 0.5,
            repeat: isSpeaking ? Infinity : 0,
          }}
          className={`
            relative w-10 h-10 rounded-full flex items-center justify-center
            font-semibold text-sm
            ${isSpeaking 
              ? 'bg-green-500 text-white ring-2 ring-green-500 ring-offset-2' 
              : 'bg-muted text-muted-foreground'
            }
          `}
        >
          {username.charAt(0).toUpperCase()}
          
          {/* Speaking wave animation */}
          {isSpeaking && (
            <div className="absolute -right-1 -bottom-1 flex space-x-0.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-0.5 bg-green-500 rounded-full"
                  animate={{
                    height: ['4px', '12px', '4px'],
                  }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    delay: i * 0.1,
                  }}
                />
              ))}
            </div>
          )}
        </motion.div>

        {/* Name & Role */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <p className="font-medium text-sm truncate">
              {username}
              {isLocal && <span className="text-xs text-muted-foreground ml-1">(You)</span>}
            </p>
          </div>
          <p className="text-xs text-muted-foreground capitalize">
            {role}
          </p>
        </div>
      </div>

      {/* Status Icons */}
      <div className="flex items-center space-x-2">
        {hasNotJoinedVoice ? (
          <span className="text-xs text-muted-foreground">Not in voice</span>
        ) : isMuted ? (
          <MicOff className="h-4 w-4 text-red-500" />
        ) : (
          <Mic className="h-4 w-4 text-green-500" />
        )}
      </div>
    </motion.div>
  );
}