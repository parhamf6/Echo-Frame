// app/room/[roomId]/components/SettingsModal/index.tsx
'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import UsersListTab from './UsersListTab';
import JoinRequestsTab from './JoinRequestTab';
import { useGuestStore } from '@/lib/stores/guest-store';
import { useRoomStore } from '@/lib/stores/room-store';

interface SettingsModalProps {
  userListVersion: number;
}

export default function SettingsModal({ userListVersion }: SettingsModalProps) {
  const { guest } = useGuestStore();
  const { requestsVersion } = useRoomStore();
  const [open, setOpen] = useState(false);

  const canModerate = guest?.role === 'moderator' || guest?.role === 'admin';

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings className="h-5 w-5" />
        </Button>
      </SheetTrigger>

      <SheetContent side="bottom" className="h-[75vh]">
        <SheetHeader>
          <SheetTitle>Room Settings</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="users" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="requests">
              Requests
              {canModerate && <span className="ml-2 text-xs">(Mod)</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-4">
            <UsersListTab canModerate={canModerate} userListVersion={userListVersion} />
          </TabsContent>

          <TabsContent value="requests" className="mt-4" key={requestsVersion}>
            <JoinRequestsTab canModerate={canModerate} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}