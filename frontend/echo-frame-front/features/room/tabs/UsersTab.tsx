'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface UserItem {
  id: string;
  username: string;
  role: 'viewer' | 'moderator' | 'admin';
  online?: boolean;
}

interface UsersTabProps {
  roomId: string;
}

export function UsersTab({ roomId }: UsersTabProps) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await apiClient.get('/api/v1/guests/list', { params: { room_id: roomId } });
        setUsers(data || []);
      } catch (e) {
        console.error('Failed to load users', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [roomId]);

  if (loading) return <Card className="p-3 text-sm text-muted-foreground">Loading users...</Card>;

  return (
    <Card className="p-3 space-y-2">
      {users.map((u) => (
        <div key={u.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
          <div className="text-sm">{u.username}</div>
          <div className="flex items-center gap-2">
            <Badge variant={u.role === 'admin' ? 'destructive' : 'secondary'} className="text-xs capitalize">
              {u.role}
            </Badge>
            {!u.online && <span className="text-xs text-muted-foreground">offline</span>}
          </div>
        </div>
      ))}
      {users.length === 0 && <div className="text-sm text-muted-foreground">No users yet.</div>}
    </Card>
  );
}

