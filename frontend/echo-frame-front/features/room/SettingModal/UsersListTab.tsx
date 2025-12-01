// app/room/[roomId]/components/SettingsModal/UsersListTab.tsx
'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { UserCog, Crown, Ban, Loader2, RefreshCw, UserMinus } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useGuestStore } from '@/lib/stores/guest-store';

interface User {
  id: string;
  username: string;
  role: 'viewer' | 'moderator' | 'admin';
  permissions: {
    can_chat: boolean;
    can_voice: boolean;
  };
  kicked: boolean;
  online?: boolean;
  offline_since?: string | null;
}

interface UsersListTabProps {
  canModerate: boolean;
  userListVersion: number;
}

export default function UsersListTab({ canModerate, userListVersion }: UsersListTabProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingPermissions, setUpdatingPermissions] = useState<Record<string, boolean>>({});
  const [kickingUser, setKickingUser] = useState<string | null>(null);
  const [promotingUser, setPromotingUser] = useState<string | null>(null);
  const [demotingUser, setDemotingUser] = useState<string | null>(null);
  
  const params = useParams();
  const roomId = params.roomId as string;
  const { guest } = useGuestStore();
  const isAdminUser = guest?.role === 'admin';
  const canPromote = isAdminUser;

  const fetchUsers = async () => {
    try {
      console.log('Fetching users for room:', roomId);
      const { data } = await apiClient.get('/api/v1/guests/list', {
        params: { room_id: roomId },
      });
      console.log('Fetched users:', data);
      if (!Array.isArray(data)) {
        console.error('API returned non-array data:', data);
        setUsers([]);
      } else {
        // Sort online users first, then offline
        const sorted = [...data].sort((a, b) => {
          const aOnline = a.online ?? true;
          const bOnline = b.online ?? true;
          if (aOnline === bOnline) return 0;
          return aOnline ? -1 : 1;
        });
        setUsers(sorted);
      }
    } catch (error: any) {
      console.error('Failed to load users - Full error:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (roomId) {
      fetchUsers();
    }
  }, [userListVersion, roomId]);

  const handleTogglePermission = async (
    userId: string,
    permission: 'can_chat' | 'can_voice',
    value: boolean
  ) => {
    if (!canModerate) {
      toast.error('You do not have permission to change user permissions');
      return;
    }

    const permissionKey = `${userId}-${permission}`;
    setUpdatingPermissions((prev) => ({ ...prev, [permissionKey]: true }));

    try {
      // Send permission update as JSON body (second argument)
      await apiClient.patch(
        `/api/v1/guests/${userId}/permissions`,
        { [permission]: value }
      );

      // Update local state optimistically
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, permissions: { ...u.permissions, [permission]: value } }
            : u
        )
      );

      const permissionName = permission === 'can_chat' ? 'Chat' : 'Voice';
      toast.success(`${permissionName} ${value ? 'enabled' : 'disabled'}`);
    } catch (error: any) {
      toast.error(
        error.response?.data?.detail || 'Failed to update permission'
      );
      console.error('Failed to update permission:', error);
    } finally {
      setUpdatingPermissions((prev) => ({ ...prev, [permissionKey]: false }));
    }
  };

  const handlePromote = async (userId: string) => {
    if (!canPromote) {
      toast.error('Only admins can promote users to moderator');
      return;
    }

    setPromotingUser(userId);

    try {
      const { data } = await apiClient.patch(`/api/v1/guests/${userId}/promote`, null);

      // Update local state with role and permissions from response
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId 
            ? { 
                ...u, 
                role: data.role as 'moderator',
                permissions: data.permissions || {
                  can_chat: true,
                  can_voice: true
                }
              } 
            : u
        )
      );

      toast.success('User promoted to moderator');
    } catch (error: any) {
      toast.error(
        error.response?.data?.detail || 'Failed to promote user'
      );
      console.error('Failed to promote user:', error);
    } finally {
      setPromotingUser(null);
    }
  };

  const handleDemote = async (userId: string) => {
    if (!isAdminUser) {
      toast.error('Only admins can demote moderators');
      return;
    }

    setDemotingUser(userId);

    try {
      const { data } = await apiClient.patch(`/api/v1/guests/${userId}/demote`, null);

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                role: data.role as 'viewer',
                permissions: data.permissions || {
                  can_chat: false,
                  can_voice: false,
                },
              }
            : u
        )
      );

      toast.success('Moderator demoted to viewer');
    } catch (error: any) {
      toast.error(
        error.response?.data?.detail || 'Failed to demote moderator'
      );
      console.error('Failed to demote moderator:', error);
    } finally {
      setDemotingUser(null);
    }
  };

  const handleKick = async (userId: string, username: string, isModeratorTarget: boolean) => {
    if (!canModerate) {
      toast.error('You do not have permission to kick users');
      return;
    }

    if (isModeratorTarget && !isAdminUser) {
      toast.error('Only admins can kick moderators');
      return;
    }

    // Confirm before kicking
    if (!confirm(`Are you sure you want to kick ${username}?`)) {
      return;
    }

    setKickingUser(userId);

    try {
      await apiClient.delete(`/api/v1/guests/${userId}`);

      // Remove from local state
      setUsers((prev) => prev.filter((u) => u.id !== userId));

      toast.success(`${username} has been kicked from the room`);
    } catch (error: any) {
      toast.error(
        error.response?.data?.detail || 'Failed to kick user'
      );
      console.error('Failed to kick user:', error);
    } finally {
      setKickingUser(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">No users in the room</p>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => {
            setLoading(true);
            fetchUsers();
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[50vh] overflow-y-auto">
      {users.map((user) => {
        const isCurrentUser = user.id === guest?.id;
        const isAdminSelf = isCurrentUser && isAdminUser;
        const effectiveRole: User['role'] = isAdminSelf ? 'admin' : user.role;
        const isModerator = effectiveRole === 'moderator' || effectiveRole === 'admin';
        const isModeratorTarget = effectiveRole === 'moderator';
        const isOnline = user.online ?? true;

        return (
          <div
            key={user.id}
            className="flex items-start justify-between border-b pb-4 last:border-b-0"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={`font-medium ${!isOnline ? 'text-muted-foreground' : ''}`}>
                  {user.username}
                  {isCurrentUser && ' (You)'}
                </span>
                {effectiveRole === 'admin' && (
                  <Badge variant="destructive" className="text-xs">
                    <Crown className="h-3 w-3 mr-1" />
                    Admin
                  </Badge>
                )}
                {effectiveRole === 'moderator' && (
                  <Badge variant="secondary" className="text-xs">
                    <Crown className="h-3 w-3 mr-1" />
                    Moderator
                  </Badge>
                )}
                {!isOnline && (
                  <Badge variant="outline" className="text-xs opacity-70">
                    Offline
                  </Badge>
                )}
              </div>

              {/* Permission Toggles */}
              <div className="flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <Switch
                    checked={user.permissions.can_chat}
                    onCheckedChange={(val) =>
                      handleTogglePermission(user.id, 'can_chat', val)
                    }
                    disabled={
                      !canModerate ||
                      isModerator ||
                      !isOnline ||
                      updatingPermissions[`${user.id}-can_chat`]
                    }
                  />
                  <span className={!canModerate || isModerator ? 'text-muted-foreground' : ''}>
                    Chat
                  </span>
                  {updatingPermissions[`${user.id}-can_chat`] && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                </label>

                <label className="flex items-center gap-2">
                  <Switch
                    checked={user.permissions.can_voice}
                    onCheckedChange={(val) =>
                      handleTogglePermission(user.id, 'can_voice', val)
                    }
                    disabled={
                      !canModerate ||
                      isModerator ||
                      !isOnline ||
                      updatingPermissions[`${user.id}-can_voice`]
                    }
                  />
                  <span className={!canModerate || isModerator ? 'text-muted-foreground' : ''}>
                    Voice
                  </span>
                  {updatingPermissions[`${user.id}-can_voice`] && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 ml-4">
              {/* Promote Button (Admin Only) */}
              {!isModerator && canPromote && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handlePromote(user.id)}
                  disabled={promotingUser === user.id}
                  className="text-xs"
                >
                  {promotingUser === user.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <UserCog className="h-3 w-3 mr-1" />
                      Promote
                    </>
                  )}
                </Button>
              )}

              {/* Demote Button (Admin only, target moderator) */}
              {canPromote && isModeratorTarget && !isCurrentUser && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDemote(user.id)}
                  disabled={demotingUser === user.id}
                  className="text-xs"
                >
                  {demotingUser === user.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <UserMinus className="h-3 w-3 mr-1" />
                      Demote
                    </>
                  )}
                </Button>
              )}

              {/* Kick Button (Moderator+, can't kick moderators or self) */}
              {!isCurrentUser && (!isModerator || isAdminUser) && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleKick(user.id, user.username, isModeratorTarget)}
                  disabled={
                    !canModerate ||
                    kickingUser === user.id ||
                    (isModeratorTarget && !isAdminUser)
                  }
                  className="text-xs"
                >
                  {kickingUser === user.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Ban className="h-3 w-3 mr-1" />
                      Kick
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}