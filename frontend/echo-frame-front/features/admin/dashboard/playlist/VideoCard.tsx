'use client';

import { motion } from 'framer-motion';
import { Clock, GripVertical, Trash2, Info } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Video } from '@/types/video';

interface VideoCardProps {
  video: Video;
  onDelete: (video: Video) => void;
  onViewDetails: (video: Video) => void;
  isDragging?: boolean;
}

export function VideoCard({ video, onDelete, onViewDetails, isDragging }: VideoCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: video.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Generate gradient from video ID for consistent fallback colors
  const getGradient = (id: string) => {
    const hue1 = parseInt(id.slice(0, 2), 16) % 360;
    const hue2 = (hue1 + 60) % 360;
    return `linear-gradient(135deg, hsl(${hue1}, 70%, 50%), hsl(${hue2}, 70%, 50%))`;
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`group relative bg-card border border-border rounded-xl overflow-hidden transition-all duration-200 ${
        isSortableDragging ? 'opacity-50 scale-95' : 'hover:shadow-lg hover:border-accent/50'
      }`}
    >
      {/* Drag Handle Overlay */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 z-10 p-1.5 rounded-lg bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>

      {/* Order Badge */}
      <div className="absolute top-2 right-2 z-10 px-2 py-1 rounded-lg bg-accent/90 backdrop-blur-sm text-accent-foreground text-xs font-bold">
        #{video.playlist_order}
      </div>

      {/* Thumbnail */}
      <div className="relative h-48 overflow-hidden bg-muted">
        {video.thumbnail_path ? (
          <img
            src={video.thumbnail_path}
            alt={video.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: getGradient(video.id) }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card/90 to-transparent" />
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
            {video.title}
          </h3>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatDuration(video.duration_seconds)}</span>
          </div>
          {video.subtitles.length > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-accent/10 text-accent font-medium">
              {video.subtitles.length} subtitle{video.subtitles.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => onViewDetails(video)}
            className="flex-1 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Info className="w-4 h-4" />
            Details
          </button>
          <button
            onClick={() => onDelete(video)}
            className="px-3 py-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}