'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';
import { MoreVertical, Shield, UserX, MessageSquare, Mic, Crown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface User {
  id: string;
  username: string;
  role: string;
  online: boolean;
  permissions: {
    can_chat: boolean;
    can_voice: boolean;
  };
}

interface UsersTabProps {
  roomId: string;
  guest: any;
}

export default function UsersTab({ roomId, guest }: UsersTabProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdminOrMod = guest?.role === 'admin' || guest?.role === 'moderator';
  const isAdmin = guest?.role === 'admin';

  // Fetch user list
  const fetchUsers = async () => {
    try {
      const { data } = await apiClient.get(`/api/v1/guests/list?room_id=${roomId}`);
      setUsers(data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error('Failed to load user list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    
    // Refresh every 10 seconds
    const interval = setInterval(fetchUsers, 10000);
    return () => clearInterval(interval);
  }, [roomId]);

  // Action handlers
  const togglePermission = async (userId: string, permission: 'can_chat' | 'can_voice', currentValue: boolean) => {
    try {
      await apiClient.patch(`/api/v1/guests/${userId}/permissions`, {
        [permission]: !currentValue,
      });
      
      toast.success(`Permission updated`);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update permission');
    }
  };

  const promoteUser = async (userId: string) => {
    try {
      await apiClient.patch(`/api/v1/guests/${userId}/promote`);
      toast.success('User promoted to moderator');
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to promote user');
    }
  };

  const demoteUser = async (userId: string) => {
    try {
      await apiClient.patch(`/api/v1/guests/${userId}/demote`);
      toast.success('User demoted to viewer');
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to demote user');
    }
  };

  const kickUser = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to kick ${username}?`)) {
      return;
    }

    try {
      await apiClient.delete(`/api/v1/guests/${userId}`);
      toast.success(`${username} has been kicked`);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to kick user');
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-sm">
          Users ({users.length})
        </h3>
      </div>

      {/* Users List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {users.map((user) => {
          const isCurrentUser = user.id === guest?.id;
          const canManage = isAdminOrMod && !isCurrentUser;
          const canPromote = isAdmin && user.role === 'viewer';
          const canDemote = isAdmin && user.role === 'moderator';

          return (
            <div
              key={user.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
            >
              {/* User Info */}
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                {/* Avatar */}
                <div className="relative">
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center
                      font-semibold text-sm
                      ${user.online 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted text-muted-foreground'
                      }
                    `}
                  >
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  
                  {/* Online indicator */}
                  <div
                    className={`
                      absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background
                      ${user.online ? 'bg-green-500' : 'bg-gray-400'}
                    `}
                  />
                </div>

                {/* Name & Role */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className="font-medium text-sm truncate">
                      {user.username}
                      {isCurrentUser && <span className="text-xs text-muted-foreground ml-1">(You)</span>}
                    </p>
                    
                    {/* Role badge */}
                    {user.role === 'admin' && (
                      <Crown className="h-3 w-3 text-yellow-500" />
                    )}
                    {user.role === 'moderator' && (
                      <Shield className="h-3 w-3 text-blue-500" />
                    )}
                  </div>
                  
                  {/* Permissions */}
                  <div className="flex items-center space-x-2 mt-0.5">
                    <span className={`text-xs ${user.permissions.can_chat ? 'text-green-600' : 'text-muted-foreground'}`}>
                      💬 {user.permissions.can_chat ? 'Chat' : 'No Chat'}
                    </span>
                    <span className={`text-xs ${user.permissions.can_voice ? 'text-green-600' : 'text-muted-foreground'}`}>
                      🎤 {user.permissions.can_voice ? 'Voice' : 'No Voice'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions Menu (Admin/Mod only) */}
              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {/* Toggle Chat */}
                    <DropdownMenuItem
                      onClick={() => togglePermission(user.id, 'can_chat', user.permissions.can_chat)}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      {user.permissions.can_chat ? 'Disable Chat' : 'Enable Chat'}
                    </DropdownMenuItem>

                    {/* Toggle Voice */}
                    <DropdownMenuItem
                      onClick={() => togglePermission(user.id, 'can_voice', user.permissions.can_voice)}
                    >
                      <Mic className="h-4 w-4 mr-2" />
                      {user.permissions.can_voice ? 'Disable Voice' : 'Enable Voice'}
                    </DropdownMenuItem>

                    {/* Promote/Demote (Admin only) */}
                    {canPromote && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => promoteUser(user.id)}>
                          <Shield className="h-4 w-4 mr-2" />
                          Promote to Moderator
                        </DropdownMenuItem>
                      </>
                    )}

                    {canDemote && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => demoteUser(user.id)}>
                          <Shield className="h-4 w-4 mr-2" />
                          Demote to Viewer
                        </DropdownMenuItem>
                      </>
                    )}

                    {/* Kick */}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => kickUser(user.id, user.username)}
                      className="text-red-600"
                    >
                      <UserX className="h-4 w-4 mr-2" />
                      Kick User
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}