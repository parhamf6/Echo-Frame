'use client';

import { useEffect, useState, useRef } from 'react';
import { useGuestStore } from '@/lib/stores/guest-store';
import { useRoomStore } from '@/lib/stores/room-store';
import { useChatStore } from '@/lib/stores/chat-store';
import { useLiveKit } from '@/lib/hooks/use-livekit';
import useAudioLevel from '@/lib/hooks/use-audio-level';
import { useSocket } from '@/hooks/use-socket';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import RoomTabs from './RoomTabs';
import QuickControls from './QuickControls';
import { videosApi } from '@/lib/api/video';
import { Video } from '@/types/video';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

interface RoomViewProps {
  roomId: string;
}

interface VideoState {
  current_video_id?: string;
  is_playing?: boolean;
  current_timestamp?: number;
  last_updated?: string;
  controlled_by?: string;
}

const getVideoUrl = (path: string): string => {
  if (!path) return '';
  if (path.startsWith('http//')) path = path.replace(/^http:\/\//, 'http://');
  if (path.startsWith('https//')) path = path.replace(/^https:\/\//, 'https://');
  if (/^https?:\/\//i.test(path) || /^\/\//.test(path)) return path;
  const nginxUrl = (process.env.NEXT_PUBLIC_NGINX_URL || 'http://echoframe-nginx.com').replace(/\/$/, '');
  if (!path.startsWith('/')) path = `/${path}`;
  return `${nginxUrl}${path}`;
};

export default function RoomView({ roomId }: RoomViewProps) {
  const { guest } = useGuestStore();
  const {
    addPendingRequest,
    removePendingRequest,
    addViewerRequest,
    removeViewerRequest,
  } = useRoomStore();
  const { loadHistory, clearChat, historyError } = useChatStore();
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [videoState, setVideoState] = useState<VideoState>({});
  const [playlist, setPlaylist] = useState<Video[]>([]);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);
  const [qualities, setQualities] = useState<Array<{ label: string; uri: string; resolution?: string; bandwidth?: number }>>([]);
  const [selectedQuality, setSelectedQuality] = useState<string>('Auto');

  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<any>(null);
  const applyingStateRef = useRef(false);

  const isAdminOrMod = guest?.role === 'admin' || guest?.role === 'moderator';
  const currentVideo = playlist.find((v) => v.id === videoState.current_video_id) || playlist[0];
  const hlsUrl = currentVideo?.hls_manifest_path ? getVideoUrl(currentVideo.hls_manifest_path) : '';

  // Initialize LiveKit (handles chat messages automatically)
  const livekit = useLiveKit({
    roomId,
    guestId: guest?.id || '',
    username: guest?.username || '',
    enabled: !!guest?.id,
  });

  // Local audio analyser for speaking indicator
  const audioLevel = useAudioLevel();

  // Refresh LiveKit token when permissions change (e.g., when guest is accepted)
  useEffect(() => {
    if (guest?.permissions && livekit.isConnected && livekit.refreshToken) {
      console.log('[RoomView] Permissions changed, refreshing LiveKit token:', guest.permissions);
      livekit.refreshToken();
    }
  }, [guest?.permissions?.can_voice, guest?.permissions?.can_chat]);

  // Initialize Socket.io (for video controls, admin actions)
  const socket = useSocket({
    roomId,
    guestId: guest?.id || '',
    username: guest?.username,
    role: guest?.role,
    onUserListUpdate: () => {
      console.log('[RoomView] User list updated');
    },
    onVideoState: (state: VideoState) => {
      console.log('[RoomView] Received video_state', state);
      setVideoState(state);
    },
    onVideoSwitch: (videoId: string) => {
      console.log('[RoomView] Video switched to', videoId);
    },
    onViewerRequest: (request) => {
      console.log('[RoomView] Viewer request received in RoomView:', request);

      if (!isAdminOrMod) {
        return;
      }

      // Only track actionable playback requests, messages are handled via chat/toast
      if (request?.type === 'pause') {
        addViewerRequest(request);
        toast.info(`${request.username} requested a pause`, {
          duration: 5000,
        });
      } else if (request?.type === 'rewind') {
        addViewerRequest(request);
        const seconds = request.seconds ?? 10;
        toast.info(`${request.username} requested rewind (${seconds}s)`, {
          duration: 5000,
        });
      } else if (request?.type === 'quick_message') {
        // Quick messages are already pushed to chat by the backend; show a subtle toast
        if (request.message) {
          toast.message(`${request.username}: ${request.message}`, {
            duration: 4000,
          });
        }
      }
    },
    onRequestApproved: (data) => {
      console.log('[RoomView] Request approved:', data);
      if (data?.request_id) {
        removeViewerRequest(data.request_id);
      }
    },
    onRequestDismissed: (data) => {
      console.log('[RoomView] Request dismissed:', data);
      if (data?.request_id) {
        removeViewerRequest(data.request_id);
      }
    },
    onNewJoinRequest: (data) => {
      console.log('[RoomView] New join request received:', data);
      if (isAdminOrMod) {
        addPendingRequest({
          id: data.guest_id,
          username: data.username,
          created_at: new Date().toISOString(),
          room_id: roomId,
        });
        
        // Show toast notification
        toast.info(`${data.username} wants to join`, {
          duration: 5000,
        });
      }
    },
  });

  // Load chat history and playlist on mount (non-blocking)
  useEffect(() => {
    if (!guest?.id) return;

    console.log('[RoomView] Loading room data in background...');
    
    // Clear any existing chat data first
    clearChat();

    // Load history and playlist in parallel (don't block UI)
    const loadData = async () => {
      try {
        // Load both in parallel
        const [_, playlistRes] = await Promise.all([
          loadHistory(roomId).catch(err => {
            console.error('[RoomView] Failed to load chat history:', err);
            // Don't throw - chat history failure shouldn't block the room
            return null;
          }),
          videosApi.getPlaylist().catch(err => {
            console.error('[RoomView] Failed to load playlist:', err);
            throw err; // This is more critical
          }),
        ]);

        setPlaylist(playlistRes.videos);
        console.log('[RoomView] Room data loaded successfully');
        
      } catch (error) {
        console.error('[RoomView] Failed to load room data:', error);
        toast.error('Failed to load room data');
      } finally {
        // Always set initialized even if there were errors
        setIsInitialized(true);
      }
    };

    loadData();

    return () => {
      console.log('[RoomView] Cleaning up room');
      clearChat();
    };
  }, [guest?.id, roomId, loadHistory, clearChat]);

  // Show warning if chat history failed to load (but don't block)
  useEffect(() => {
    if (historyError && !historyError.includes('access')) {
      console.warn('[RoomView] Chat history error:', historyError);
      // Show a subtle toast, not blocking
      toast.warning('Chat history unavailable, but you can still send messages', {
        duration: 3000,
      });
    }
  }, [historyError]);

  // Parse HLS master manifest for quality selection
  const parseMasterManifest = (text: string, baseUrl: string) => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const variants: Array<{ label: string; uri: string; resolution?: string; bandwidth?: number }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('#EXT-X-STREAM-INF')) {
        const attrsPart = line.split(':')[1] || '';
        const attrs: Record<string, string> = {};
        attrsPart.split(',').forEach((pair) => {
          const [k, v] = pair.split('=');
          if (k && v) attrs[k.trim()] = v.trim();
        });

        const uriLine = lines[i + 1];
        if (!uriLine) continue;
        
        let resolved = uriLine;
        try {
          resolved = new URL(uriLine, baseUrl).toString();
        } catch (e) {}

        const bandwidth = attrs['BANDWIDTH'] ? Number(attrs['BANDWIDTH']) : undefined;
        const resolution = attrs['RESOLUTION'];
        const label = resolution 
          ? `${resolution} (${bandwidth ? Math.round(bandwidth / 1000) + 'kbps' : ''})` 
          : (bandwidth ? `${Math.round(bandwidth / 1000)}kbps` : uriLine);

        variants.push({ label, uri: resolved, resolution, bandwidth });
      }
    }

    return variants;
  };

  // Apply video state to player (Slave mode for viewers)
  useEffect(() => {
    if (!playerRef.current || !videoState || applyingStateRef.current || isAdminOrMod) return;

    const applyState = async () => {
      applyingStateRef.current = true;

      try {
        const currentTime = playerRef.current.currentTime();
        const targetTime = videoState.current_timestamp || 0;
        const timeDiff = Math.abs(currentTime - targetTime);

        // Seek if difference > 1 second
        if (timeDiff > 1) {
          console.log(`[Slave] Seeking from ${currentTime.toFixed(2)}s to ${targetTime.toFixed(2)}s`);
          playerRef.current.currentTime(targetTime);
        }

        // Match play state
        const isPlaying = !playerRef.current.paused();
        if (videoState.is_playing && !isPlaying) {
          console.log('[Slave] Playing video');
          await playerRef.current.play().catch((e: any) => console.warn('Play failed:', e));
        } else if (!videoState.is_playing && isPlaying) {
          console.log('[Slave] Pausing video');
          playerRef.current.pause();
        }
      } catch (e) {
        console.error('[Slave] Failed to apply state:', e);
      } finally {
        setTimeout(() => {
          applyingStateRef.current = false;
        }, 500);
      }
    };

    applyState();
  }, [videoState, isAdminOrMod]);

  // Initialize Video.js player
  useEffect(() => {
    if (!videoContainerRef.current || !hlsUrl) return;

    // Destroy existing player if video changed
    if (playerRef.current && videoState.current_video_id !== currentVideo?.id) {
      try {
        playerRef.current.dispose();
        playerRef.current = null;
      } catch (e) {}
      if (videoElRef.current && videoContainerRef.current.contains(videoElRef.current)) {
        videoContainerRef.current.removeChild(videoElRef.current);
        videoElRef.current = null;
      }
    }

    if (!playerRef.current) {
      const videoEl = document.createElement('video');
      videoEl.className = 'video-js vjs-big-play-centered';
      videoEl.setAttribute('playsinline', '');
      videoEl.setAttribute('crossorigin', 'anonymous');

      videoContainerRef.current.appendChild(videoEl);
      videoElRef.current = videoEl;

      const player = videojs(videoEl, {
        controls: true,
        autoplay: false,
        preload: 'auto',
        fluid: true,
        controlBar: {
          playToggle: isAdminOrMod,
          progressControl: isAdminOrMod,
          remainingTimeDisplay: true,
          fullscreenToggle: true,
          volumePanel: true,
          pictureInPictureToggle: false,
          subtitlesButton: true,
        },
      });

      playerRef.current = player;

      player.src({
        src: hlsUrl,
        type: 'application/x-mpegURL',
      });

      // Fetch master manifest for quality selection
      if (hlsUrl) {
        fetch(hlsUrl)
          .then((res) => res.text())
          .then((text) => {
            try {
              const variants = parseMasterManifest(text, hlsUrl);
              if (variants.length) {
                setQualities(variants);
              }
            } catch (e) {
              console.warn('[HLS] Failed to parse master manifest', e);
            }
          })
          .catch((e) => {
            console.warn('[HLS] Could not fetch master manifest', e);
          });
      }

      // Add subtitles
      if (currentVideo?.subtitles?.length) {
        player.ready(() => {
          try {
            const existing = player.remoteTextTracks ? Array.from(player.remoteTextTracks() as any) : [];
            existing.reverse().forEach((t: any) => {
              try { player.removeRemoteTextTrack(t); } catch (e) {}
            });

            currentVideo.subtitles.forEach((subtitle: any, index: number) => {
              const src = getVideoUrl(subtitle.file_path);
              const options = {
                kind: 'subtitles',
                src,
                srclang: subtitle.language || subtitle.lang || 'en',
                label: subtitle.label || subtitle.language || 'Subtitle',
                default: index === 0,
              } as any;

              player.addRemoteTextTrack(options, false);
            });

            const tracks = player.textTracks ? Array.from(player.textTracks() as any) as any[] : [];
            for (let i = 0; i < tracks.length; i++) {
              if (i === 0) {
                tracks[i].mode = 'showing';
              } else {
                tracks[i].mode = 'disabled';
              }
            }
          } catch (err) {
            console.error('[Subtitles] Failed to add tracks:', err);
          }
        });
      }
      
      player.load();

      // Admin/Mod event handlers
      if (isAdminOrMod) {
        const handlePlay = () => {
          if (applyingStateRef.current) return;
          const t = player.currentTime ? player.currentTime() : 0;
          socket?.emit?.('video:play', {
            room_id: roomId,
            guest_id: guest?.id,
            timestamp: t
          });
        };

        const handlePause = () => {
          if (applyingStateRef.current) return;
          const t = player.currentTime ? player.currentTime() : 0;
          socket?.emit?.('video:pause', {
            room_id: roomId,
            guest_id: guest?.id,
            timestamp: t
          });
        };

        const handleSeeked = () => {
          if (applyingStateRef.current) return;
          const t = player.currentTime ? player.currentTime() : 0;
          socket?.emit?.('video:seek', {
            room_id: roomId,
            guest_id: guest?.id,
            timestamp: t
          });
        };

        player.on('play', handlePlay);
        player.on('pause', handlePause);
        player.on('seeked', handleSeeked);
      } else {
        // Viewers: prevent manual control
        player.on('play', (e) => {
          if (!applyingStateRef.current) {
            e.preventDefault();
            player.pause();
            toast.error('Only moderators can control playback');
          }
        });

        player.on('pause', (e) => {
          if (!applyingStateRef.current && videoState.is_playing) {
            e.preventDefault();
            player.play();
          }
        });

        player.on('seeking', (e) => {
          if (!applyingStateRef.current) {
            e.preventDefault();
            player.currentTime(videoState.current_timestamp || 0);
            toast.error('Only moderators can seek');
          }
        });
      }

      console.log('[Player] Created for video:', currentVideo?.id);
    }

    return () => {
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
  }, [hlsUrl, currentVideo?.id, isAdminOrMod, roomId, guest?.id]);

  // Handle video switch (Admin/Mod only)
  const handleSwitchVideo = (videoId: string) => {
    if (!isAdminOrMod) return;
    socket?.emit?.('video:switch', {
      room_id: roomId,
      guest_id: guest?.id,
      video_id: videoId,
    });
    setPlaylistOpen(false);
    toast.success('Switched video');
  };

  // Fetch playlist when opening sheet
  useEffect(() => {
    if (playlistOpen && playlist.length === 0) {
      setLoadingPlaylist(true);
      videosApi.getPlaylist()
        .then((res) => setPlaylist(res.videos))
        .catch(() => toast.error('Failed to load playlist'))
        .finally(() => setLoadingPlaylist(false));
    }
  }, [playlistOpen]);

  // Show loading state
  if (!isInitialized || livekit.isConnecting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">
            {livekit.isConnecting ? 'Connecting to voice chat...' : 'Loading room...'}
          </p>
        </div>
      </div>
    );
  }

  // Show error toast if LiveKit failed (don't block UI)
  if (livekit.error) {
    console.error('[RoomView] LiveKit error:', livekit.error);
    toast.error(`Voice chat error: ${livekit.error}`, {
      duration: 5000,
    });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-semibold">Watch Party</h1>
            
            {/* Role Badge */}
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold uppercase`}
              style={{
                backgroundColor: guest?.role === 'admin'
                  ? 'oklch(0.68 0.26 25 / 0.15)'
                  : guest?.role === 'moderator'
                  ? 'oklch(0.75 0.15 85 / 0.15)'
                  : 'oklch(0.60 0.20 265 / 0.15)',
                color: guest?.role === 'admin'
                  ? 'oklch(0.68 0.26 25)'
                  : guest?.role === 'moderator'
                  ? 'oklch(0.55 0.15 85)'
                  : 'oklch(0.60 0.20 265)',
              }}
            >
              {guest?.role || 'Loading'}
            </span>

            {/* Playlist Button (Admin/Mod only) */}
            {isAdminOrMod && (
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
                    <div className="p-8 text-center text-muted-foreground">Loading...</div>
                  ) : (
                    <ul className="mt-4 divide-y divide-border">
                      {playlist.map((video) => (
                        <li key={video.id} className="flex items-center justify-between py-3">
                          <div className="flex-1">
                            <div className="font-semibold">{video.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {Math.floor(video.duration_seconds / 60)}:{String(video.duration_seconds % 60).padStart(2, '0')}
                            </div>
                          </div>
                          {videoState.current_video_id === video.id ? (
                            <span className="text-sm font-bold text-green-600">Playing</span>
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

          {/* Connection Status */}
          <div className="flex items-center space-x-4">
            {/* LiveKit Status */}
            <div className="flex items-center space-x-2">
              <div className={`h-2 w-2 rounded-full ${livekit.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-muted-foreground">
                {livekit.isConnected ? 'Voice Connected' : 'Voice Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 container mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Video Player (2/3 width on desktop) */}
        <div className="lg:col-span-2">
          <div className="bg-black rounded-lg overflow-hidden aspect-video relative">
            {/* Video Container */}
            <div ref={videoContainerRef} className="w-full h-full" />

            {/* Subtitle Indicator */}
            {currentVideo?.subtitles && currentVideo.subtitles.length > 0 && (
              <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                <span>{currentVideo.subtitles.length} subtitle{currentVideo.subtitles.length > 1 ? 's' : ''}</span>
              </div>
            )}

            {/* Quality Selector */}
            {qualities.length > 0 && (
              <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-2">
                <label className="text-xs mr-2">Quality</label>
                <select
                  value={selectedQuality}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedQuality(val);
                    try {
                      if (val === 'Auto') {
                        playerRef.current?.src({ src: hlsUrl, type: 'application/x-mpegURL' });
                      } else {
                        const q = qualities.find((q) => q.label === val);
                        if (q) {
                          const wasPlaying = !playerRef.current?.paused?.();
                          const currTime = playerRef.current?.currentTime ? playerRef.current.currentTime() : 0;
                          playerRef.current?.src({ src: q.uri, type: 'application/x-mpegURL' });
                          playerRef.current?.ready(() => {
                            try {
                              playerRef.current.currentTime(currTime);
                              if (wasPlaying) playerRef.current.play().catch(() => {});
                            } catch (e) {}
                          });
                        }
                      }
                    } catch (e) {
                      console.warn('[Quality] Switch failed', e);
                    }
                  }}
                  className="bg-transparent text-white text-xs border border-white/20 rounded px-2 py-1"
                >
                  <option value="Auto">Auto</option>
                  {qualities.map((q) => (
                    <option key={q.uri} value={q.label}>{q.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Sync Status (Viewers only) */}
            {!isAdminOrMod && (
              <div className="absolute bottom-4 right-4 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-2">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                <span>Synced</span>
              </div>
            )}
          </div>
        </div>

        {/* Tabs (1/3 width on desktop) */}
        <div className="lg:col-span-1">
          <RoomTabs
            roomId={roomId}
            livekit={livekit}
            guest={guest}
            audioLevel={audioLevel}
            socket={socket}
          />
        </div>
      </div>

      {/* Quick Controls (Fixed Bottom) */}
      <QuickControls
        roomId={roomId}
        livekit={livekit}
        audioLevel={audioLevel}
      />
    </div>
  );
}