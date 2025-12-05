'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Calendar, Film, FileText, Globe, ExternalLink, Layers, Wifi, HardDrive, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Video, VideoMetadata } from '@/types/video';
import { videosApi } from '@/lib/api/video';

interface VideoMetadataModalProps {
  video: Video | null;
  isOpen: boolean;
  onClose: () => void;
}

export function VideoMetadataModal({ video, isOpen, onClose }: VideoMetadataModalProps) {
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  // Fetch metadata when modal opens
  useEffect(() => {
    if (isOpen && video) {
      fetchMetadata();
    }
  }, [isOpen, video]);


  const fetchMetadata = async () => {
    if (!video) return;
    setIsLoadingMetadata(true);
    try {
      // Get NGINX_URL from env (client-side safe)
      const nginxUrl = process.env.NEXT_PUBLIC_NGINX_URL || '';
      const metadataUrl = `${nginxUrl}/videos/${video.id}/metadata.json`;
      const res = await fetch(metadataUrl);
      if (!res.ok) {
        setMetadata(null);
        return;
      }
      const data = await res.json();
      setMetadata(data);
    } catch (error) {
      console.error('Failed to load metadata:', error);
      setMetadata(null);
    } finally {
      setIsLoadingMetadata(false);
    }
  };

  if (!video) return null;

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatBitrate = (kbps: number) => {
    if (kbps >= 1000) {
      return `${(kbps / 1000).toFixed(1)} Mbps`;
    }
    return `${kbps} kbps`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />

          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="bg-card border border-border rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            >
              <div className="relative h-48 bg-gradient-to-br from-accent/20 to-primary/20 overflow-hidden">
                {video.thumbnail_path ? (
                  <img
                    src={video.thumbnail_path}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Film className="w-16 h-16 text-muted-foreground/30" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-card/90 to-transparent" />
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-lg bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-12rem)]">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">{video.title}</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2 py-1 rounded-md bg-accent/10 text-accent text-xs font-medium">
                      #{video.playlist_order}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Clock className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Duration</p>
                      <p className="text-sm font-medium">{formatDuration(video.duration_seconds)}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Calendar className="w-5 h-5 text-secondary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Created</p>
                      <p className="text-sm font-medium">{formatDate(video.created_at)}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Film className="w-4 h-4 text-primary" />
                        <p className="text-xs font-medium text-muted-foreground">HLS Manifest</p>
                      </div>
                      <a
                        href={video.hls_manifest_path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Open
                      </a>
                    </div>
                    <p className="text-xs font-mono text-foreground break-all">{video.hls_manifest_path}</p>
                  </div>

                  {video.thumbnail_path && (
                    <div className="p-3 rounded-lg bg-muted/30 border border-border">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-secondary" />
                          <p className="text-xs font-medium text-muted-foreground">Thumbnail</p>
                        </div>
                        <a
                          href={video.thumbnail_path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View
                        </a>
                      </div>
                      <p className="text-xs font-mono text-foreground break-all">{video.thumbnail_path}</p>
                    </div>
                  )}
                </div>

                {/* Video Renditions */}
                {isLoadingMetadata ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : metadata && metadata.renditions && metadata.renditions.length > 0 ? (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Layers className="w-5 h-5 text-primary" />
                      <h3 className="text-sm font-semibold">Video Renditions ({metadata.renditions.length})</h3>
                    </div>
                    <div className="space-y-3">
                      {metadata.renditions.map((rendition, index) => (
                        <div
                          key={index}
                          className="p-4 rounded-lg bg-gradient-to-r from-primary/25 to-accent/25 border border-border"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-sm font-bold">
                                {rendition.quality}
                              </span>
                              <span className="text-xs text-muted-foreground">{rendition.resolution}</span>
                            </div>
                            <span className="px-2 py-1 rounded-md bg-accent/10 text-accent text-xs font-medium">
                              {rendition.mode}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="flex items-start gap-2">
                              <Wifi className="w-4 h-4 text-primary mt-0.5" />
                              <div>
                                <p className="text-xs text-muted-foreground">Video Bitrate</p>
                                <p className="text-sm font-medium">{formatBitrate(rendition.video_bitrate_kbps)}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-start gap-2">
                              <Wifi className="w-4 h-4 text-secondary mt-0.5" />
                              <div>
                                <p className="text-xs text-muted-foreground">Audio Bitrate</p>
                                <p className="text-sm font-medium">{formatBitrate(rendition.audio_bitrate_kbps)}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-start gap-2">
                              <HardDrive className="w-4 h-4 text-accent mt-0.5" />
                              <div>
                                <p className="text-xs text-muted-foreground">Segments</p>
                                <p className="text-sm font-medium">{rendition.segments}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-start gap-2">
                              <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
                              <div>
                                <p className="text-xs text-muted-foreground">Playlist</p>
                                <p className="text-xs font-mono">{rendition.playlist}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Subtitles */}
                {video.subtitles && video.subtitles.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Globe className="w-5 h-5 text-accent" />
                      <h3 className="text-sm font-semibold">Subtitles ({video.subtitles.length})</h3>
                    </div>
                    <div className="space-y-2">
                      {video.subtitles.map((subtitle) => (
                        <div
                          key={subtitle.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border"
                        >
                          <div className="flex items-center gap-3">
                            <span className="px-2 py-1 rounded bg-accent/20 text-accent text-xs font-mono">
                              {subtitle.language}
                            </span>
                            <span className="text-sm font-medium">{subtitle.label}</span>
                          </div>
                          <a
                            href={subtitle.file_path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}