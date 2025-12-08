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

interface UserTimestamp {
  guest_id: string;
  timestamp: number;
  is_playing: boolean;
  updated_at: number;
}

// Get full URL for video resources
const getVideoUrl = (path: string): string => {
  if (!path) return '';

  // Fix common malformed prefixes (some stored paths may have 'http//' instead of 'http://')
  if (path.startsWith('http//')) path = path.replace(/^http:\/\//, 'http://');
  if (path.startsWith('https//')) path = path.replace(/^https:\/\//, 'https://');

  // If already an absolute URL (http(s)://) or protocol-relative (//), return it as-is
  if (/^https?:\/\//i.test(path) || /^\/\//.test(path)) {
    return path;
  }

  // Otherwise treat as a relative path and prefix with configured NGINX URL
  const nginxUrl = (process.env.NEXT_PUBLIC_NGINX_URL || 'http://echoframe-nginx.com').replace(/\/$/, '');
  if (!path.startsWith('/')) path = `/${path}`;
  return `${nginxUrl}${path}`;
};

export default function RoomView({ roomId }: RoomViewProps) {
  const { guest } = useGuestStore();
  const [userListVersion, setUserListVersion] = useState(0);
  
  const [serverState, setServerState] = useState<ServerState>({});
  const [localTime, setLocalTime] = useState<number>(0);
  const [userTimestamps, setUserTimestamps] = useState<Map<string, UserTimestamp>>(new Map());

  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [playlist, setPlaylist] = useState<Video[]>([]);
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);
  const [qualities, setQualities] = useState<Array<{ label: string; uri: string; resolution?: string; bandwidth?: number }>>([]);
  const [selectedQuality, setSelectedQuality] = useState<string>('Auto');

  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<any>(null);
  const isServerActionRef = useRef(false);
  const broadcastIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const isModOrAdmin = guest?.role === 'admin' || guest?.role === 'moderator';
  const currentVideo = playlist.find((v) => v.id === serverState.current_video_id) || playlist[0];
  const hlsUrl = currentVideo?.hls_manifest_path ? getVideoUrl(currentVideo.hls_manifest_path) : '';

  // Parse master manifest to discover available qualities
  const parseMasterManifest = (text: string, baseUrl: string) => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const variants: Array<{ label: string; uri: string; resolution?: string; bandwidth?: number }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('#EXT-X-STREAM-INF')) {
        // parse attributes
        const attrsPart = line.split(':')[1] || '';
        const attrs: Record<string, string> = {};
        attrsPart.split(',').forEach((pair) => {
          const [k, v] = pair.split('=');
          if (k && v) attrs[k.trim()] = v.trim();
        });

        const uriLine = lines[i + 1];
        if (!uriLine) continue;
        // resolve relative URI against base
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

  const SYNC_THRESHOLD = 2.5;
  const [syncDelta, setSyncDelta] = useState<number | null>(null);
  const [needsSync, setNeedsSync] = useState(false);

  // Find the most authoritative timestamp (admin/mod who's most recently updated)
  const getAuthoritativeTimestamp = (): number | null => {
    if (isModOrAdmin) return null; // Mods don't need to sync

    let bestTimestamp: UserTimestamp | null = null;
    let mostRecent = 0;

    for (const [guestId, data] of userTimestamps.entries()) {
      if (guestId === guest?.id) continue; // Skip self
      
      // Only consider timestamps updated in last 5 seconds
      const age = Date.now() - data.updated_at;
      if (age > 5000) continue;

      if (data.updated_at > mostRecent) {
        mostRecent = data.updated_at;
        bestTimestamp = data;
      }
    }

    if (!bestTimestamp) return null;

    // Calculate current position if playing
    if (bestTimestamp.is_playing) {
      const elapsed = (Date.now() - bestTimestamp.updated_at) / 1000;
      return bestTimestamp.timestamp + elapsed;
    }

    return bestTimestamp.timestamp;
  };

  // Continuous sync monitoring for viewers
  useEffect(() => {
    if (isModOrAdmin || !playerRef.current) return;

    const checkSync = () => {
      try {
        const myTime = playerRef.current.currentTime();
        const authTime = getAuthoritativeTimestamp();
        
        if (authTime !== null) {
          const delta = authTime - myTime;
          setSyncDelta(delta);
          setNeedsSync(Math.abs(delta) > SYNC_THRESHOLD);
        } else {
          setSyncDelta(null);
          setNeedsSync(false);
        }
      } catch (e) {
        console.error('[SyncCheck] Error:', e);
      }
    };

    // Check immediately and then every 500ms
    checkSync();
    const interval = setInterval(checkSync, 500);

    return () => clearInterval(interval);
  }, [isModOrAdmin, userTimestamps, guest?.id]);

  // Fetch playlist
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
      isServerActionRef.current = true;

      try {
        if (typeof serverState.current_timestamp === 'number') {
          const currentTime = playerRef.current.currentTime();
          const delta = Math.abs(currentTime - serverState.current_timestamp);
          
          if (delta > 1) {
            playerRef.current.currentTime(serverState.current_timestamp);
          }
        }

        if (typeof serverState.is_playing === 'boolean') {
          if (serverState.is_playing) {
            const playPromise = playerRef.current.play();
            if (playPromise !== undefined) {
              await playPromise.catch((e: any) => console.warn('[ApplyState] Play failed:', e));
            }
          } else {
            playerRef.current.pause();
          }
        }
      } catch (e) {
        console.warn('[ApplyState] Failed', e);
      } finally {
        setTimeout(() => {
          isServerActionRef.current = false;
        }, 200);
      }
    };

    applyState();
  }, [serverState.current_timestamp, serverState.is_playing]);

  // Initialize Video.js player with subtitles
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

    if (!playerRef.current) {
      const videoEl = document.createElement('video');
      videoEl.className = 'video-js vjs-big-play-centered';
      videoEl.setAttribute('playsinline', '');
      videoEl.setAttribute('crossorigin', 'anonymous'); // Required for subtitles

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
          subtitlesButton: true,
        },
      });

      playerRef.current = player;

      // Set video source (initially Master playlist)
      player.src({
        src: hlsUrl,
        type: 'application/x-mpegURL',
      });

      // Fetch master manifest to discover variant playlists (qualities)
      if (hlsUrl) {
        fetch(hlsUrl)
          .then((res) => res.text())
          .then((text) => {
            try {
              const variants = parseMasterManifest(text, hlsUrl);
              if (variants.length) {
                setQualities(variants);
                // keep default selection as Auto (master)
              }
            } catch (e) {
              console.warn('[HLS] Failed to parse master manifest', e);
            }
          })
          .catch((e) => {
            console.warn('[HLS] Could not fetch master manifest', e);
          });
      }

      // Add subtitle tracks using Video.js API to ensure the control menu appears
      if (currentVideo?.subtitles?.length) {
        console.log('[Subtitles] Adding', currentVideo.subtitles.length, 'tracks via Video.js API');

        // Wait until player is ready
        player.ready(() => {
          try {
            // Remove existing remote text tracks to avoid duplicates on video switch
            const existing = player.remoteTextTracks ? Array.from(player.remoteTextTracks() as any) : [];
            if (existing.length) {
              // remove from the end so indexes remain valid
              existing.reverse().forEach((t: any) => {
                try { player.removeRemoteTextTrack(t); } catch (e) {}
              });
            }

            currentVideo.subtitles.forEach((subtitle: any, index: number) => {
              const src = getVideoUrl(subtitle.file_path);
              const options = {
                kind: 'subtitles',
                src,
                srclang: subtitle.language || subtitle.lang || 'en',
                label: subtitle.label || subtitle.language || 'Subtitle',
                default: index === 0,
              } as any;

              // Use addRemoteTextTrack so Video.js creates the menu entries
              const added = player.addRemoteTextTrack(options, false);
              console.log('[Subtitles] Added via API:', options.label, 'at', src, { added });
            });

            // Ensure first track showing if default
            const tracks = player.textTracks ? Array.from(player.textTracks() as any) as any[] : [];
            for (let i = 0; i < tracks.length; i++) {
              if (tracks[i].label === (currentVideo.subtitles[0]?.label)) {
                tracks[i].mode = 'showing';
              } else {
                tracks[i].mode = 'disabled';
              }
            }
          } catch (err) {
            console.error('[Subtitles] Failed to add tracks via Video.js API:', err);
          }
        });
      }
      
      player.load();
      
      // Verify subtitles loaded
      player.on('loadedmetadata', () => {
        console.log('[Player] Metadata loaded');
        const tracks = player.textTracks ? Array.from(player.textTracks() as any) as any[] : [];
        console.log('[Player] Text tracks:', tracks.length);

        for (let i = 0; i < tracks.length; i++) {
          console.log(`[Track ${i}]:`, {
            kind: tracks[i].kind,
            label: tracks[i].label,
            language: tracks[i].language,
            mode: tracks[i].mode,
          });
        }

        // Enable first subtitle track by default
        if (tracks.length > 0) {
          tracks[0].mode = 'showing';
        }
      });

      // Event handlers for moderators/admins
      if (isModOrAdmin) {
        let isPlayingBeforeSeek = false;
        
        const handlePlay = () => {
            if (isServerActionRef.current) return;
            const t = player.currentTime ? player.currentTime() : 0;
          socket?.emit?.('video:play', {
            room_id: roomId,
            guest_id: guest.id,
            current_timestamp: t,
          });
          setServerState((prev) => ({ ...prev, is_playing: true, current_timestamp: t }));
        };

        const handlePause = () => {
          if (isServerActionRef.current) return;
          const t = player.currentTime ? player.currentTime() : 0;
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
          if (isServerActionRef.current) return;
          
          const t = player.currentTime ? player.currentTime() : 0;
          socket?.emit?.('video:seek', {
            room_id: roomId,
            guest_id: guest.id,
            current_timestamp: t,
          });
          
          setServerState((prev) => ({ ...prev, current_timestamp: t }));
          
          if (isPlayingBeforeSeek) {
            setTimeout(() => {
              isServerActionRef.current = true;
              const playPromise = player.play ? player.play() : undefined;
              if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
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
        // Viewers: prevent seeking ahead
        player.on('seeking', () => {
          if (isServerActionRef.current) return;
          const t = Number(player.currentTime ? player.currentTime() : 0);
          const authTime = getAuthoritativeTimestamp();
          if (authTime !== null && t > authTime + 2) {
            player.currentTime(authTime);
            toast.error('Cannot seek ahead of moderator');
          }
        });
      }

      player.on('timeupdate', () => {
        try {
          setLocalTime(Number(player.currentTime ? player.currentTime() : 0));
        } catch (e) {}
      });

      console.log('[Player] Created for video:', currentVideo?.id);
    }

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

  // Broadcast timestamp every 2 seconds (all users)
  useEffect(() => {
    if (!playerRef.current || !socket || !guest?.id) return;

    const broadcast = () => {
      try {
        const currentTime = playerRef.current.currentTime();
        const isPlaying = !playerRef.current.paused();

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
      } catch (e) {
        console.error('[Broadcast] Error:', e);
      }
    };

    broadcast();
    broadcastIntervalRef.current = setInterval(broadcast, 2000);

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

  // Sync now
  const syncNow = () => {
    if (!playerRef.current) return;
    
    const authTime = getAuthoritativeTimestamp();
    if (authTime === null) {
      toast.error('No moderator timestamp available');
      return;
    }
    
    isServerActionRef.current = true;
    
    try {
      playerRef.current.currentTime(authTime);
      
      if (serverState.is_playing) {
        playerRef.current.play().catch(() => {});
      } else {
        playerRef.current.pause();
      }
      
      setNeedsSync(false);
      setSyncDelta(null);
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

          {/* Sync indicator for viewers */}
          {needsSync && !isModOrAdmin && syncDelta !== null && (
            <div 
              className="flex items-center gap-3 ml-4 px-4 py-2.5 rounded-lg border-2 shadow-md animate-pulse"
              style={{
                backgroundColor: 'oklch(0.98 0.08 35)',
                borderColor: 'oklch(0.65 0.25 35)',
              }}
            >
              <div className="flex flex-col">
                <span 
                  className="text-sm font-bold"
                  style={{ color: 'oklch(0.50 0.20 35)' }}
                >
                  {syncDelta > 0 
                    ? `${Math.abs(Math.round(syncDelta))}s behind` 
                    : `${Math.abs(Math.round(syncDelta))}s ahead`}
                </span>
                <span 
                  className="text-xs"
                  style={{ color: 'oklch(0.55 0.15 35)' }}
                >
                  moderator
                </span>
              </div>
              <Button 
                size="sm" 
                onClick={syncNow}
                style={{
                  backgroundColor: 'oklch(0.65 0.25 35)',
                  color: 'oklch(0.99 0 0)',
                }}
                className="hover:opacity-90 transition-opacity font-semibold"
              >
                Sync Now
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
                        {serverState.current_video_id === video.id ? (
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

        {/* Quality selector (auto or specific variant) */}
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
                    // switch back to master playlist
                    playerRef.current?.src({ src: hlsUrl, type: 'application/x-mpegURL' });
                  } else {
                    const q = qualities.find((q) => q.label === val);
                    if (q) {
                      const wasPlaying = !playerRef.current?.paused?.();
                      const currTime = playerRef.current?.currentTime ? playerRef.current.currentTime() : 0;
                      playerRef.current?.src({ src: q.uri, type: 'application/x-mpegURL' });
                      // try to seek to previous time and play if was playing
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
      </div>

      {/* Chat Placeholder */}
      <div className="border-t border-border bg-card p-4">
        {guest?.permissions.can_chat ? (
          <input
            type="text"
            placeholder="Type a message..."
            className="w-full border border-input bg-background text-foreground rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
          />
        ) : (
          <p className="text-center text-muted-foreground">Chat disabled by moderator</p>
        )}
      </div>
    </div>
  );
}