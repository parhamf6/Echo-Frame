// app/room/[roomId]/components/RoomView.tsx

'use client';

import { useEffect, useState } from 'react';
import { useSocket } from '@/hooks/use-socket';
import { useGuestStore } from '@/lib/stores/guest-store';
import SettingsModal from './SettingModal';

interface RoomViewProps {
  roomId: string;
}

export default function RoomView({ roomId }: RoomViewProps) {
  const { guest } = useGuestStore();
  const [userListVersion, setUserListVersion] = useState(0);

  // Connect to Socket.io
  useSocket({
    roomId,
    guestId: guest?.id || '',
    onUserListUpdate: () => {
      // Trigger user list refresh
      setUserListVersion((v) => v + 1);
    },
  });

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">Room: {roomId.slice(0, 8)}...</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Role:</span>
            <span className={`px-3 py-1 rounded text-sm font-semibold ${
              guest?.role === 'admin' 
                ? 'bg-red-100 text-red-800' 
                : guest?.role === 'moderator'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-blue-100 text-blue-800'
            }`}>
              {guest?.role?.toUpperCase() || 'LOADING'}
            </span>
          </div>
        </div>
        <SettingsModal userListVersion={userListVersion} />
      </header>

      {/* Video Player */}
      <div className="flex-1 bg-black">
        {/* Video player goes here */}
        <div className="flex items-center justify-center h-full text-white">
          Video Player Placeholder
        </div>
      </div>

      {/* Chat */}
      <div className="border-t p-4">
        {guest?.permissions.can_chat ? (
          <input
            type="text"
            placeholder="Type a message..."
            className="w-full border rounded px-3 py-2"
          />
        ) : (
          <p className="text-center text-muted-foreground">
            Chat disabled by moderator
          </p>
        )}
      </div>
    </div>
  );
}