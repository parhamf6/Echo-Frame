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

// Helper: Clean and title-case the string
const formatTitle = (input: string): string => {
  // Keep only alphanumeric + spaces, collapse whitespace
  const cleaned = input
    .replace(/[^a-zA-Z0-9\s]/g, ' ')   // Replace non-alphanumeric with space
    .replace(/\s+/g, ' ')              // Collapse multiple spaces
    .trim();

  // Title case: uppercase first letter of each word
  return cleaned
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

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
    zIndex: isSortableDragging ? 10 : 'auto',
  };

const formatDuration = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return [
    hrs.toString().padStart(2, "0"),
    mins.toString().padStart(2, "0"),
    secs.toString().padStart(2, "0")
  ].join(":");
};


  const getGradient = (id: string) => {
    const hue1 = parseInt(id.slice(0, 2), 16) % 360;
    const hue2 = (hue1 + 60) % 360;
    return `linear-gradient(135deg, hsl(${hue1}, 70%, 45%), hsl(${hue2}, 70%, 45%))`;
  };

  const cleanTitle = formatTitle(video.title);

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`group relative bg-card border border-border rounded-xl overflow-hidden transition-all duration-300 will-change-transform ${
        isSortableDragging
          ? 'opacity-40 scale-[0.98]'
          : 'hover:shadow-md hover:border-accent/30'
      }`}
    >
      {/* Thumbnail — 16:9, no overlay */}
      <div className="relative pb-[56.25%] h-0 bg-muted overflow-hidden">
        {video.thumbnail_path ? (
          <img
            src={video.thumbnail_path}
            alt={cleanTitle}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: getGradient(video.id) }}
          />
        )}

        {/* Order Badge — top right */}
        <div className="absolute top-3 right-3 z-10 px-2 py-1 rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-sm text-foreground text-xs font-bold">
          #{video.playlist_order}
        </div>

        {/* Drag Handle — top left */}
        <div
          {...attributes}
          {...listeners}
          className="absolute top-3 left-3 z-10 p-1.5 rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>

      {/* Content area — clearly separated */}
      <div className="p-4 space-y-3 border-t border-border/30">
        <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-tight">
          {cleanTitle}
        </h3>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{formatDuration(video.duration_seconds)}</span>
          </div>

          {video.subtitles.length > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-accent/10 text-accent font-medium whitespace-nowrap">
              {video.subtitles.length} subtitle{video.subtitles.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onViewDetails(video)}
            className="flex-1 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
            aria-label={`View details for ${cleanTitle}`}
          >
            <Info className="w-4 h-4" />
            Details
          </button>
          <button
            onClick={() => onDelete(video)}
            className="px-3 py-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-destructive/50"
            aria-label={`Remove ${cleanTitle} from playlist`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}