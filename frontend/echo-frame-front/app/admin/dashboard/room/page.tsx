"use client"
import { RoomStatCard } from '@/features/admin/room/room-card';
import { useEffect } from 'react';
import { useRoomStore } from '@/lib/stores/room-store';

export default function RoomManagementPage() {
  const { fetchRoomStatus } = useRoomStore();

  useEffect(() => {
    fetchRoomStatus();
  }, [fetchRoomStatus]);

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Room Management</h1>
        <RoomStatCard />
      </div>
    </div>
  );
}