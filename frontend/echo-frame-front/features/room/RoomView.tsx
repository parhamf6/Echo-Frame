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
import { useLiveKit } from '@/lib/hooks/use-livekit';
import { useChatStore } from '@/lib/stores/chat-store';
import { RoomTabs } from './RoomTabs';
import { QuickControls } from './QuickControls';

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

interface ViewerRequest {
  id: string;
  type: 'pause' | 'rewind' | 'quick_message';
  guest_id: string;
  username: string;
  room_id: string;
  timestamp: string;
  seconds?: number;
  message?: string;
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
  const addMessage = useChatStore((s) => s.addMessage);
  const updateReaction = useChatStore((s) => s.updateReaction);
  const markTyping = useChatStore((s) => s.markTyping);
  const clearChat = useChatStore((s) => s.clear);
  const [userListVersion, setUserListVersion] = useState(0);
  
  // Video state from server
  const [videoState, setVideoState] = useState<VideoState>({});
  
  // Requests
  const [pendingRequests, setPendingRequests] = useState<ViewerRequest[]>([]);
  const [lastRequestTime, setLastRequestTime] = useState<number>(0);
  
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [playlist, setPlaylist] = useState<Video[]>([]);
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
  const canChat = guest?.permissions.can_chat ?? false;
  const canVoice = guest?.permissions.can_voice ?? false;

  // Parse master manifest
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
        const label = resolution ? `${resolution} (${bandwidth ? Math.round(bandwidth / 1000) + 'kbps' : ''})` : (bandwidth ? `${Math.round(bandwidth / 1000)}kbps` : uriLine);

        variants.push({ label, uri: resolved, resolution, bandwidth });
      }
    }

    return variants;
  };

  // Fetch playlist
  useEffect(() => {
    if (playlist.length === 0 || playlistOpen) {
      setLoadingPlaylist(true);
      videosApi.getPlaylist()
        .then((res) => {
          setPlaylist(res.videos);
        })
        .catch(() => toast.error('Failed to load playlist'))
        .finally(() => setLoadingPlaylist(false));
    }
  }, [playlistOpen]);

  // Handle viewer requests
  const handleViewerRequest = (request: ViewerRequest) => {
    if (!isAdminOrMod) return;
    
    // Add to pending requests
    setPendingRequests((prev) => {
      // Remove duplicates from same user
      const filtered = prev.filter(r => r.guest_id !== request.guest_id || r.type !== request.type);
      return [...filtered, request];
    });
    
    // Show toast notification
    if (request.type === 'pause') {
      toast(`${request.username} requested pause`, {
        action: {
          label: 'Pause Now',
          onClick: () => approveRequest(request.id)
        },
        duration: 10000
      });
    } else if (request.type === 'rewind') {
      toast(`${request.username} wants to go back ${request.seconds}s`, {
        action: {
          label: 'Rewind',
          onClick: () => approveRequest(request.id)
        },
        duration: 10000
      });
    } else if (request.type === 'quick_message') {
      toast(`${request.username}: ${request.message}`, {
        duration: 5000
      });
    }
  };

  // Socket connection
  const socket = useSocket({
    roomId,
    guestId: guest?.id || '',
    username: guest?.username || 'User',
    role: guest?.role || 'viewer',
    onUserListUpdate: () => setUserListVersion((v) => v + 1),
    onVideoState: (state: VideoState) => {
      console.log('[RoomView] Received video_state', state);
      setVideoState(state);
    },
    onVideoSwitch: (videoId: string) => {
      console.log('[RoomView] Video switched to', videoId);
    },
    onViewerRequest: handleViewerRequest,
    onRequestApproved: (data) => {
      setPendingRequests((prev) => prev.filter(r => r.id !== data.request_id));
    },
    onRequestDismissed: (data) => {
      setPendingRequests((prev) => prev.filter(r => r.id !== data.request_id));
    },
  });

  // Apply video state to player (Slave mode)
  useEffect(() => {
    if (!playerRef.current || !videoState || applyingStateRef.current) return;

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
  }, [videoState]);

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
          playToggle: isAdminOrMod, // Only admin/mod can use play button
          progressControl: isAdminOrMod, // Only admin/mod can seek
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

      // Fetch master manifest
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
            guest_id: guest.id,
            timestamp: t
          });
        };

        const handlePause = () => {
          if (applyingStateRef.current) return;
          const t = player.currentTime ? player.currentTime() : 0;
          socket?.emit?.('video:pause', {
            room_id: roomId,
            guest_id: guest.id,
            timestamp: t
          });
        };

        const handleSeeked = () => {
          if (applyingStateRef.current) return;
          const t = player.currentTime ? player.currentTime() : 0;
          socket?.emit?.('video:seek', {
            room_id: roomId,
            guest_id: guest.id,
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
  }, [hlsUrl, currentVideo?.id, isAdminOrMod]);

  // Handle video switch
  const handleSwitchVideo = (videoId: string) => {
    if (!isAdminOrMod) return;
    socket?.emit?.('video:switch', {
      room_id: roomId,
      guest_id: guest.id,
      video_id: videoId,
    });
    setPlaylistOpen(false);
    toast.success('Switched video');
  };

  // Viewer request handlers
  const requestPause = () => {
    const now = Date.now();
    if (now - lastRequestTime < 10000) {
      toast.error('Please wait before sending another request');
      return;
    }

    socket?.emit?.('request:pause', {
      room_id: roomId,
      guest_id: guest.id,
      username: guest.username || 'User'
    });
    setLastRequestTime(now);
  };

  const requestRewind = (seconds: number) => {
    const now = Date.now();
    if (now - lastRequestTime < 10000) {
      toast.error('Please wait before sending another request');
      return;
    }

    socket?.emit?.('request:rewind', {
      room_id: roomId,
      guest_id: guest.id,
      username: guest.username || 'User',
      seconds
    });
    setLastRequestTime(now);
  };

  const sendQuickMessage = (message: string) => {
    socket?.emit?.('request:message', {
      room_id: roomId,
      guest_id: guest.id,
      username: guest.username || 'User',
      message
    });
  };

  // Approve/dismiss requests
  const approveRequest = (requestId: string) => {
    socket?.emit?.('approve:request', {
      request_id: requestId,
      room_id: roomId,
      guest_id: guest.id
    });
  };

  const dismissRequest = (requestId: string) => {
    socket?.emit?.('dismiss:request', {
      request_id: requestId,
      room_id: roomId,
      guest_id: guest.id
    });
  };

  // Quick rewind buttons (for admin/mod)
  const quickRewind = (seconds: number) => {
    if (!playerRef.current) return;
    const currentTime = playerRef.current.currentTime();
    const newTime = Math.max(0, currentTime - seconds);
    playerRef.current.currentTime(newTime);
  };

  const quickForward = (seconds: number) => {
    if (!playerRef.current) return;
    const currentTime = playerRef.current.currentTime();
    const duration = playerRef.current.duration();
    const newTime = Math.min(duration, currentTime + seconds);
    playerRef.current.currentTime(newTime);
  };

  const {
    room: livekitRoom,
    isConnected: isLivekitConnected,
    sendMessage: sendLivekitMessage,
    sendReaction: sendLivekitReaction,
    sendTyping: sendLivekitTyping,
    disconnect: disconnectLivekit,
  } = useLiveKit({
    roomId,
    guestId: guest?.id || '',
    username: guest?.username || 'User',
    canVoice,
    onMessage: (payload) => {
      if (payload?.type === 'chat:message') {
        addMessage({
          id: payload.id,
          user_id: payload.user_id,
          username: payload.username,
          message: payload.message,
          timestamp: payload.timestamp,
          reply_to_id: payload.reply_to_id,
        });
      }
    },
    onReaction: (payload) => {
      if (payload?.type === 'chat:reaction') {
        updateReaction(payload.message_id, payload.emoji, payload.user_id, payload.action);
      }
    },
    onTyping: (payload) => {
      if (payload?.type === 'chat:typing') {
        markTyping(payload.user_id, payload.username || 'User');
      }
    },
  });

  useEffect(() => {
    return () => {
      clearChat();
      disconnectLivekit();
    };
  }, [clearChat, disconnectLivekit]);

  const handleSendMessage = async (text: string, replyToId?: string | null) => {
    await sendLivekitMessage(text, replyToId || undefined);
  };

  const handleReaction = async (messageId: string, emoji: string, action: 'add' | 'remove') => {
    await sendLivekitReaction(messageId, emoji, action);
  };

  const handleTyping = async () => {
    await sendLivekitTyping();
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-foreground">Room: {roomId.slice(0, 8)}...</h1>
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

          {isAdminOrMod && (
            <Sheet open={playlistOpen} onOpenChange={setPlaylistOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  Playlist
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full max-w-md overflow-y-auto bg-popover border-border">
                <SheetHeader>
                  <SheetTitle className="text-popover-foreground">Video Playlist</SheetTitle>
                </SheetHeader>
                {loadingPlaylist ? (
                  <div className="p-8 text-center text-muted-foreground">Loading...</div>
                ) : (
                  <ul className="mt-4 divide-y divide-border">
                    {playlist.map((video) => (
                      <li key={video.id} className="flex items-center justify-between py-3">
                        <div className="flex-1">
                          <div className="font-semibold text-popover-foreground">{video.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {Math.floor(video.duration_seconds / 60)}:{String(video.duration_seconds % 60).padStart(2, '0')}
                          </div>
                        </div>
                        {videoState.current_video_id === video.id ? (
                          <span 
                            className="text-sm font-bold"
                            style={{ color: 'oklch(0.68 0.22 145)' }}
                          >
                            Playing
                          </span>
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

      {/* Pending Requests Bar (Admin/Mod only) */}
      {isAdminOrMod && pendingRequests.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-yellow-900 dark:text-yellow-100">
              📬 Pending Requests ({pendingRequests.length})
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                pendingRequests.forEach(req => dismissRequest(req.id));
              }}
              className="text-xs"
            >
              Clear All
            </Button>
          </div>
          <div className="space-y-2">
            {pendingRequests.slice(0, 3).map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-2 text-sm"
              >
                <div className="flex-1">
                  <span className="font-medium">{request.username}:</span>{' '}
                  {request.type === 'pause' && 'Wants to pause'}
                  {request.type === 'rewind' && `Go back ${request.seconds}s`}
                  <span className="text-xs text-muted-foreground ml-2">
                    {Math.floor((Date.now() - new Date(request.timestamp).getTime()) / 1000)}s ago
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => approveRequest(request.id)}
                    className="bg-green-600 hover:bg-green-700 text-white text-xs"
                  >
                    {request.type === 'pause' ? 'Pause' : 'Rewind'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => dismissRequest(request.id)}
                    className="text-xs"
                  >
                    ✕
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Video Player */}
      <div className="flex-1 bg-black flex items-center justify-center relative">
        <div ref={videoContainerRef} className="w-full max-w-5xl aspect-video" />
        
        {/* Subtitle indicator */}
        {currentVideo?.subtitles && currentVideo.subtitles.length > 0 && (
          <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            <span>{currentVideo.subtitles.length} subtitle{currentVideo.subtitles.length > 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Quality selector */}
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
              className="bg-transparent text-white text-xs"
            >
              <option value="Auto">Auto</option>
              {qualities.map((q) => (
                <option key={q.uri} value={q.label}>{q.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Sync status indicator (Viewers) */}
        {!isAdminOrMod && (
          <div className="absolute bottom-4 right-4 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
            <span>Synced with moderator</span>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="border-t border-border bg-card p-4 space-y-4">
        {isAdminOrMod ? (
          <div className="flex items-center justify-center gap-3">
            <Button size="sm" variant="outline" onClick={() => quickRewind(10)} className="flex items-center gap-2">
              <span>⏪</span> 10s
            </Button>
            <Button size="sm" variant="outline" onClick={() => quickForward(10)} className="flex items-center gap-2">
              10s <span>⏩</span>
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button size="sm" variant="outline" onClick={requestPause} className="flex items-center gap-2">
              ⏸️ Request Pause
            </Button>
            <Button size="sm" variant="outline" onClick={() => requestRewind(10)} className="flex items-center gap-2">
              ⏪ Go Back 10s
            </Button>
            <Button size="sm" variant="outline" onClick={() => requestRewind(30)} className="flex items-center gap-2">
              ⏪ Go Back 30s
            </Button>
          </div>
        )}

        <RoomTabs
          roomId={roomId}
          canChat={canChat}
          currentUserId={guest?.id}
          livekitRoom={livekitRoom}
          onSendMessage={handleSendMessage}
          onReact={handleReaction}
          onTyping={handleTyping}
          onRequestPause={requestPause}
          onRequestRewind={requestRewind}
        />

        <QuickControls
          room={livekitRoom}
          onLeave={() => {
            disconnectLivekit();
            window.location.href = '/room';
          }}
        />
        {isLivekitConnected ? (
          <div className="text-xs text-muted-foreground text-right">LiveKit connected</div>
        ) : (
          <div className="text-xs text-muted-foreground text-right">Connecting to LiveKit...</div>
        )}
      </div>
    </div>
  );
}