'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Film, Loader2 } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { toast } from 'sonner';

import { videosApi } from '@/lib/api/video';
import type { Video } from '@/types/video';
import { VideoCard } from '@/features/admin/dashboard/playlist/VideoCard';
import { VideoMetadataModal } from '@/features/admin/dashboard/playlist/VideoMetadataModal';
import { ConfirmDialog } from '@/features/admin/dashboard/playlist/ConfirmDialog';

export default function PlaylistPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [filteredVideos, setFilteredVideos] = useState<Video[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteVideo, setDeleteVideo] = useState<Video | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch playlist
  useEffect(() => {
    fetchPlaylist();
  }, []);

  // Filter videos based on search
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredVideos(videos);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredVideos(
        videos.filter((video) =>
          video.title.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, videos]);

  const fetchPlaylist = async () => {
    try {
      setIsLoading(true);
      const data = await videosApi.getPlaylist();
      setVideos(data.videos);
      setFilteredVideos(data.videos);
    } catch (error) {
      console.error('Failed to fetch playlist:', error);
      toast.error('Failed to load playlist');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = videos.findIndex((v) => v.id === active.id);
    const newIndex = videos.findIndex((v) => v.id === over.id);

    const newVideos = arrayMove(videos, oldIndex, newIndex);
    setVideos(newVideos);

    try {
      const videoIds = newVideos.map((v) => v.id);
      await videosApi.reorderPlaylist(videoIds);
      toast.success('Playlist reordered');
    } catch (error) {
      console.error('Failed to reorder playlist:', error);
      toast.error('Failed to save order');
      setVideos(videos); // Revert on error
    }
  };

  const handleDelete = async () => {
    if (!deleteVideo) return;

    try {
      setIsDeleting(true);
      await videosApi.deleteVideo(deleteVideo.id);
      setVideos((prev) => prev.filter((v) => v.id !== deleteVideo.id));
      toast.success('Video deleted');
    } catch (error) {
      console.error('Failed to delete video:', error);
      toast.error('Failed to delete video');
    } finally {
      setIsDeleting(false);
      setDeleteVideo(null);
    }
  };

  const handleViewDetails = (video: Video) => {
    setSelectedVideo(video);
    setIsModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading playlist...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Video Playlist</h1>
          <p className="text-muted-foreground mt-1">
            Manage and reorder your video collection
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search videos by title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
        />
      </div>

      {/* Videos Grid */}
      {filteredVideos.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="p-6 rounded-full bg-muted/50 mb-4">
            <Film className="w-12 h-12 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">
            {searchQuery ? 'No videos found' : 'No videos yet'}
          </h3>
          <p className="text-muted-foreground">
            {searchQuery
              ? 'Try a different search term'
              : 'Upload your first video to get started'}
          </p>
        </motion.div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredVideos.map((v) => v.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {filteredVideos.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    onDelete={(v) => setDeleteVideo(v)}
                    onViewDetails={handleViewDetails}
                  />
                ))}
              </AnimatePresence>
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Modals */}
      <VideoMetadataModal
        video={selectedVideo}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedVideo(null);
        }}
      />

      <ConfirmDialog
        isOpen={deleteVideo !== null}
        onClose={() => setDeleteVideo(null)}
        onConfirm={handleDelete}
        title="Delete Video"
        description={`Are you sure you want to delete "${deleteVideo?.title}"? This action cannot be undone.`}
        confirmText={isDeleting ? 'Deleting...' : 'Delete'}
        variant="danger"
      />
    </div>
  );
}