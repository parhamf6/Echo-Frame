// app/room/[roomId]/components/RoomView.tsx

'use client';

import { useEffect, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { videosApi } from '@/lib/api/video';
import { toast } from 'sonner';
import { Video } from '@/types/video';
import { useSocket } from '@/hooks/use-socket';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { useGuestStore } from '@/lib/stores/guest-store';
import SettingsModal from './SettingModal';

interface RoomViewProps {
  roomId: string;
}

interface ServerState {
  current_video_id?: string;
  current_timestamp?: number;
  is_playing?: boolean;
  last_updated?: string;
}

// Track all users' timestamps for comparison
interface UserTimestamp {
  guest_id: string;
  timestamp: number;
  is_playing: boolean;
  updated_at: number; // Date.now()
}

export default function RoomView({ roomId }: RoomViewProps) {
  const { guest } = useGuestStore();
  const [userListVersion, setUserListVersion] = useState(0);
  
  // Server state (authoritative)
  const [serverState, setServerState] = useState<ServerState>({});
  const [localTime, setLocalTime] = useState<number>(0);
  
  // Track all users' positions (including admin)
  const [userTimestamps, setUserTimestamps] = useState<Map<string, UserTimestamp>>(new Map());

  // UI state
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [playlist, setPlaylist] = useState<Video[]>([]);
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);

  // Refs
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<any>(null);
  const isServerActionRef = useRef(false);
  const broadcastIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const isModOrAdmin = guest?.role === 'admin' || guest?.role === 'moderator';
  const currentVideo = playlist.find((v) => v.id === serverState.current_video_id) || playlist[0];
  const hlsUrl = currentVideo?.hls_manifest_path || '';

  // Sync calculations
  const SYNC_THRESHOLD = 2.5; // Show sync if >2.5s out of sync
  const [syncDelta, setSyncDelta] = useState<number | null>(null);
  const [needsSync, setNeedsSync] = useState(false);

  // Find admin's current timestamp
  const getAdminTimestamp = (): number | null => {
    for (const [guestId, data] of userTimestamps.entries()) {
      // Check if this is an admin/moderator based on their timestamp updates
      // Admins will have the most recent updates
      if (data.updated_at && Date.now() - data.updated_at < 5000) {
        return data.timestamp;
      }
    }
    return null;
  };

  // Continuous sync check for viewers
  useEffect(() => {
    if (isModOrAdmin || !playerRef.current) return;

    const interval = setInterval(() => {
      try {
        const myTime = playerRef.current.currentTime();
        setLocalTime(myTime);
        
        const adminTime = getAdminTimestamp();
        
        if (adminTime !== null) {
          const delta = adminTime - myTime;
          setSyncDelta(delta);
          setNeedsSync(Math.abs(delta) > SYNC_THRESHOLD);
        } else {
          setSyncDelta(null);
          setNeedsSync(false);
        }
      } catch (e) {}
    }, 500);

    return () => clearInterval(interval);
  }, [isModOrAdmin, userTimestamps]);

  // Fetch playlist on mount
  useEffect(() => {
    if (playlist.length === 0 || playlistOpen) {
      setLoadingPlaylist(true);
      videosApi.getPlaylist()
        .then((res) => {
          setPlaylist(res.videos);
          if (!serverState.current_video_id && res.videos.length > 0) {
            setServerState((prev) => ({ ...prev, current_video_id: res.videos[0].id }));
          }
        })
        .catch(() => toast.error('Failed to load playlist'))
        .finally(() => setLoadingPlaylist(false));
    }
  }, [playlistOpen]);

  // Socket connection
  const socket = useSocket({
    roomId,
    guestId: guest?.id || '',
    onUserListUpdate: () => setUserListVersion((v) => v + 1),
    onVideoState: (state: ServerState) => {
      console.log('[Socket] onVideoState', state);
      setServerState(state);
    },
    onVideoSwitch: (videoId: string) => {
      console.log('[Socket] onVideoSwitch', videoId);
      setServerState((prev) => ({ ...prev, current_video_id: videoId }));
    },
    onVideoPlay: (data: any) => {
      console.log('[Socket] onVideoPlay', data);
      setServerState((prev) => ({
        ...prev,
        is_playing: true,
        current_timestamp: data.current_timestamp,
      }));
    },
    onVideoPause: (data: any) => {
      console.log('[Socket] onVideoPause', data);
      setServerState((prev) => ({
        ...prev,
        is_playing: false,
        current_timestamp: data.current_timestamp,
      }));
    },
    onVideoSeek: (data: any) => {
      console.log('[Socket] onVideoSeek', data);
      setServerState((prev) => ({
        ...prev,
        current_timestamp: data.current_timestamp,
      }));
    },
  });

  // Listen for user timestamp broadcasts
  useEffect(() => {
    if (!socket) return;

    const handleUserTimestamp = (data: { guest_id: string; timestamp: number; is_playing: boolean }) => {
      setUserTimestamps((prev) => {
        const updated = new Map(prev);
        updated.set(data.guest_id, {
          guest_id: data.guest_id,
          timestamp: data.timestamp,
          is_playing: data.is_playing,
          updated_at: Date.now(),
        });
        return updated;
      });
    };

    socket.on('user_timestamp', handleUserTimestamp);

    return () => {
      socket.off('user_timestamp', handleUserTimestamp);
    };
  }, [socket]);

  // Apply server state to player
  useEffect(() => {
    if (!playerRef.current || !serverState) return;

    const applyState = async () => {
      console.log('[ApplyState] Starting...', { 
        timestamp: serverState.current_timestamp, 
        isPlaying: serverState.is_playing 
      });
      
      isServerActionRef.current = true;

      try {
        // Apply timestamp if provided
        if (typeof serverState.current_timestamp === 'number') {
          const currentTime = playerRef.current.currentTime();
          const delta = Math.abs(currentTime - serverState.current_timestamp);
          
          console.log('[ApplyState] Timestamp delta:', delta);
          
          // Only seek if delta > 1 second (avoid jitter)
          if (delta > 1) {
            console.log('[ApplyState] Seeking to:', serverState.current_timestamp);
            playerRef.current.currentTime(serverState.current_timestamp);
          }
        }

        // Apply play/pause state
        if (typeof serverState.is_playing === 'boolean') {
          console.log('[ApplyState] Setting play state:', serverState.is_playing);
          if (serverState.is_playing) {
            const playPromise = playerRef.current.play();
            if (playPromise !== undefined) {
              await playPromise.catch((e) => {
                console.warn('[ApplyState] Play failed:', e);
              });
            }
          } else {
            playerRef.current.pause();
          }
        }
      } catch (e) {
        console.warn('[ApplyState] Failed to apply server state', e);
      } finally {
        setTimeout(() => {
          isServerActionRef.current = false;
          console.log('[ApplyState] Reset server action flag');
        }, 200);
      }
    };

    applyState();
  }, [serverState.current_timestamp, serverState.is_playing]);

  // Initialize/update Video.js player
  useEffect(() => {
    if (!videoContainerRef.current || !hlsUrl) return;

    // Destroy existing player if video changed
    if (playerRef.current && serverState.current_video_id !== currentVideo?.id) {
      try {
        playerRef.current.dispose();
        playerRef.current = null;
      } catch (e) {}
      if (videoElRef.current && videoContainerRef.current.contains(videoElRef.current)) {
        videoContainerRef.current.removeChild(videoElRef.current);
        videoElRef.current = null;
      }
    }

    // Create new player
    if (!playerRef.current) {
      const videoEl = document.createElement('video');
      videoEl.className = 'video-js vjs-big-play-centered';
      videoEl.setAttribute('playsinline', '');
      videoEl.setAttribute('controls', isModOrAdmin ? 'true' : 'false');

      videoContainerRef.current.appendChild(videoEl);
      videoElRef.current = videoEl;

      const player = videojs(videoEl, {
        controls: true,
        autoplay: false,
        preload: 'auto',
        fluid: true,
        controlBar: {
          playToggle: isModOrAdmin,
          progressControl: isModOrAdmin,
          remainingTimeDisplay: true,
          fullscreenToggle: true,
          volumePanel: true,
          pictureInPictureToggle: false,
        },
      });

      playerRef.current = player;

      // Add subtitles BEFORE loading source
      if (currentVideo?.subtitles?.length) {
        currentVideo.subtitles.forEach((subtitle, index) => {
          try {
            player.addRemoteTextTrack({
              kind: 'subtitles',
              src: subtitle.file_path,
              srclang: subtitle.language,
              label: subtitle.label,
              default: index === 0,
            }, false);
            console.log('[RoomView] Added subtitle track:', subtitle.label);
          } catch (err) {
            console.warn('[RoomView] Failed to add subtitle:', err);
          }
        });
      }

      // Load video source
      player.src({ src: hlsUrl, type: 'application/x-mpegURL' });
      player.load();

      // Event handlers (only for moderators/admins)
      if (isModOrAdmin) {
        let isPlayingBeforeSeek = false;
        
        const handlePlay = () => {
          if (isServerActionRef.current) {
            console.log('[Play Event] Skipped - server action');
            return;
          }
          const t = player.currentTime();
          console.log('[Play Event] Emitting video:play', t);
          socket?.emit?.('video:play', {
            room_id: roomId,
            guest_id: guest.id,
            current_timestamp: t,
          });
          setServerState((prev) => ({ ...prev, is_playing: true, current_timestamp: t }));
        };

        const handlePause = () => {
          if (isServerActionRef.current) {
            console.log('[Pause Event] Skipped - server action');
            return;
          }
          const t = player.currentTime();
          console.log('[Pause Event] Emitting video:pause', t);
          socket?.emit?.('video:pause', {
            room_id: roomId,
            guest_id: guest.id,
            current_timestamp: t,
          });
          setServerState((prev) => ({ ...prev, is_playing: false, current_timestamp: t }));
        };

        const handleSeeking = () => {
          isPlayingBeforeSeek = !player.paused();
        };

        const handleSeeked = () => {
          if (isServerActionRef.current) {
            console.log('[Seeked Event] Skipped - server action');
            return;
          }
          
          const t = player.currentTime();
          console.log('[Seeked Event] Emitting video:seek', t);
          socket?.emit?.('video:seek', {
            room_id: roomId,
            guest_id: guest.id,
            current_timestamp: t,
          });
          
          setServerState((prev) => ({ ...prev, current_timestamp: t }));
          
          // Resume playback if was playing before seek
          if (isPlayingBeforeSeek) {
            setTimeout(() => {
              isServerActionRef.current = true;
              player.play().catch(() => {});
              setTimeout(() => {
                isServerActionRef.current = false;
              }, 200);
            }, 100);
          }
        };

        player.on('play', handlePlay);
        player.on('pause', handlePause);
        player.on('seeking', handleSeeking);
        player.on('seeked', handleSeeked);
      } else {
        // Viewers: prevent seeking forward beyond admin timestamp
        player.on('seeking', () => {
          if (isServerActionRef.current) return;
          const t = player.currentTime();
          const adminTime = getAdminTimestamp();
          if (adminTime !== null && t > adminTime + 2) {
            player.currentTime(adminTime);
            toast.error('Cannot seek ahead of moderator');
          }
        });
      }

      player.on('timeupdate', () => {
        try {
          setLocalTime(player.currentTime());
        } catch (e) {}
      });

      console.log('[RoomView] Player created for video:', currentVideo?.id);
    }

    // Cleanup
    return () => {
      if (broadcastIntervalRef.current) {
        clearInterval(broadcastIntervalRef.current);
      }
      if (playerRef.current) {
        try {
          playerRef.current.dispose();
        } catch (e) {}
        playerRef.current = null;
      }
      if (videoElRef.current && videoContainerRef.current?.contains(videoElRef.current)) {
        try {
          videoContainerRef.current.removeChild(videoElRef.current);
        } catch (e) {}
        videoElRef.current = null;
      }
    };
  }, [hlsUrl, currentVideo?.id, isModOrAdmin]);

  // Broadcast current timestamp every 2 seconds (ALL users)
  useEffect(() => {
    if (!playerRef.current || !socket || !guest?.id) return;

    broadcastIntervalRef.current = setInterval(() => {
      try {
        const currentTime = playerRef.current.currentTime();
        const isPlaying = !playerRef.current.paused();

        // Broadcast to all users in room
        socket.emit('user:timestamp', {
          room_id: roomId,
          guest_id: guest.id,
          timestamp: currentTime,
          is_playing: isPlaying,
        });

        // Update local tracking
        setUserTimestamps((prev) => {
          const updated = new Map(prev);
          updated.set(guest.id, {
            guest_id: guest.id,
            timestamp: currentTime,
            is_playing: isPlaying,
            updated_at: Date.now(),
          });
          return updated;
        });
      } catch (e) {}
    }, 2000);

    return () => {
      if (broadcastIntervalRef.current) {
        clearInterval(broadcastIntervalRef.current);
      }
    };
  }, [socket, guest?.id, roomId]);

  // Handle video switch
  const handleSwitchVideo = (videoId: string) => {
    if (!isModOrAdmin) return;
    socket?.emit?.('video:switch', {
      room_id: roomId,
      guest_id: guest.id,
      video_id: videoId,
    });
    setPlaylistOpen(false);
    toast.success('Switched video');
  };

  // Sync now button - sync to admin's CURRENT timestamp
  const syncNow = () => {
    if (!playerRef.current) return;
    
    const adminTime = getAdminTimestamp();
    if (adminTime === null) {
      toast.error('No moderator timestamp available');
      return;
    }
    
    console.log('[SyncNow] Syncing to admin time:', adminTime);
    isServerActionRef.current = true;
    
    try {
      playerRef.current.currentTime(adminTime);
      
      if (serverState.is_playing) {
        playerRef.current.play().catch(() => {});
      } else {
        playerRef.current.pause();
      }
      
      setNeedsSync(false);
      toast.success('Synced!');
    } catch (e) {
      console.error('[SyncNow] Failed:', e);
      toast.error('Sync failed');
    } finally {
      setTimeout(() => {
        isServerActionRef.current = false;
      }, 200);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">Room: {roomId.slice(0, 8)}...</h1>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${
              guest?.role === 'admin'
                ? 'bg-red-100 text-red-800'
                : guest?.role === 'moderator'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-blue-100 text-blue-800'
            }`}
          >
            {guest?.role || 'Loading'}
          </span>

          {needsSync && !isModOrAdmin && syncDelta !== null && (
            <div className="flex items-center gap-2 ml-4 bg-orange-50 px-4 py-2 rounded-lg border border-orange-300">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-orange-700">
                  {syncDelta > 0 ? `${Math.abs(Math.round(syncDelta))}s behind` : `${Math.abs(Math.round(syncDelta))}s ahead`}
                </span>
                <span className="text-xs text-orange-600">moderator</span>
              </div>
              <Button size="sm" variant="default" onClick={syncNow} className="bg-orange-600 hover:bg-orange-700 text-white">
                Sync
              </Button>
            </div>
          )}

          {isModOrAdmin && (
            <Sheet open={playlistOpen} onOpenChange={setPlaylistOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  Playlist
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full max-w-md overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Video Playlist</SheetTitle>
                </SheetHeader>
                {loadingPlaylist ? (
                  <div className="p-8 text-center text-gray-500">Loading...</div>
                ) : (
                  <ul className="mt-4 divide-y">
                    {playlist.map((video) => (
                      <li key={video.id} className="flex items-center justify-between py-3">
                        <div className="flex-1">
                          <div className="font-semibold">{video.title}</div>
                          <div className="text-xs text-gray-500">
                            {Math.floor(video.duration_seconds / 60)}:{String(video.duration_seconds % 60).padStart(2, '0')}
                          </div>
                        </div>
                        {serverState.current_video_id === video.id ? (
                          <span className="text-green-600 font-bold text-sm">Playing</span>
                        ) : (
                          <Button size="sm" onClick={() => handleSwitchVideo(video.id)}>
                            Play
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </SheetContent>
            </Sheet>
          )}
        </div>
        <SettingsModal userListVersion={userListVersion} />
      </header>

      {/* Video Player */}
      <div className="flex-1 bg-black flex items-center justify-center">
        <div ref={videoContainerRef} className="w-full max-w-5xl aspect-video" />
      </div>

      {/* Chat Placeholder */}
      <div className="border-t bg-white p-4">
        {guest?.permissions.can_chat ? (
          <input
            type="text"
            placeholder="Type a message..."
            className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <p className="text-center text-gray-500">Chat disabled by moderator</p>
        )}
      </div>
    </div>
  );
}