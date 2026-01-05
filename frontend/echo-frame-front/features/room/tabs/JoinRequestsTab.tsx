'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { RefreshCw, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useParams } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { useRoomStore } from '@/lib/stores/room-store';

interface PendingRequest {
  id: string;
  username: string;
  created_at: string;
  room_id: string;
}

interface JoinRequestsTabProps {
  canModerate: boolean;
}

export default function JoinRequestsTab({ canModerate }: JoinRequestsTabProps) {
  // ✅ FIX: Use room store for real-time updates
  const { pendingRequests, requestsVersion, removePendingRequest, setPendingRequests } = useRoomStore();
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  
  const params = useParams();
  const roomId = params.roomId as string;

  // ✅ FIX: Listen to store updates (real-time from socket)
  useEffect(() => {
    if (canModerate && pendingRequests && pendingRequests.length >= 0) {
      console.log('[JoinRequestsTab] Store updated, syncing local state:', pendingRequests.length);
      setRequests(pendingRequests);
    }
  }, [requestsVersion, canModerate, pendingRequests]);

  // Poll for requests every 10 seconds as a fallback
  useEffect(() => {
    if (!canModerate) return;

    const pollInterval = setInterval(() => {
      fetchRequests(false);
    }, 10000);

    return () => clearInterval(pollInterval);
  }, [canModerate, roomId]);

  const fetchRequests = async (showLoadingSpinner = true) => {
    if (!canModerate) return;

    if (showLoadingSpinner) {
      setLoading(true);
    }

    try {
      const { data } = await apiClient.get('/api/v1/guests/pending', {
        params: { room_id: roomId },
      });
      
      console.log('[JoinRequestsTab] Fetched requests:', data.length);
      
      setRequests(data);
      
      // ✅ FIX: Update the store to keep in sync
      setPendingRequests(data);
      
      if (!initialLoadDone) {
        setInitialLoadDone(true);
      }
    } catch (error: any) {
      console.error('Failed to load requests:', error);
      
      // Only show error toast if it's not a 401 (unauthorized)
      if (error.response?.status !== 401) {
        toast.error('Failed to load requests');
      }
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (canModerate) {
      fetchRequests(true);
    }
  }, [roomId, canModerate]);

  const handleAccept = async (guestId: string, username: string) => {
    if (!canModerate) {
      toast.error('You do not have permission to accept requests');
      return;
    }

    setProcessingRequest(guestId);

    try {
      await apiClient.patch(`/api/v1/guests/${guestId}/accept`);
      
      // ✅ FIX: Remove from both local and store state
      setRequests((prev) => prev.filter((r) => r.id !== guestId));
      removePendingRequest(guestId);
      
      toast.success(`${username} has been accepted`);
    } catch (error: any) {
      console.error('Failed to accept user:', error);
      toast.error(
        error.response?.data?.detail || 'Failed to accept user'
      );
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleReject = async (guestId: string, username: string) => {
    if (!canModerate) {
      toast.error('You do not have permission to reject requests');
      return;
    }

    setProcessingRequest(guestId);

    try {
      await apiClient.patch(`/api/v1/guests/${guestId}/reject`);
      
      // ✅ FIX: Remove from both local and store state
      setRequests((prev) => prev.filter((r) => r.id !== guestId));
      removePendingRequest(guestId);
      
      toast.success(`${username} has been rejected`);
    } catch (error: any) {
      console.error('Failed to reject user:', error);
      toast.error(
        error.response?.data?.detail || 'Failed to reject user'
      );
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleRefresh = () => {
    fetchRequests(true);
    toast.info('Refreshing requests...');
  };

  // Show permission message for viewers
  if (!canModerate) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">
          Only moderators and admins can view and manage join requests
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 space-y-4 overflow-y-auto">
      {/* Refresh Button */}
      <Button
        onClick={handleRefresh}
        disabled={loading}
        variant="outline"
        className="w-full"
        size="sm"
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
        Refresh Requests
      </Button>

      {/* Loading State (Initial Load) */}
      {loading && !initialLoadDone && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty State */}
      {!loading && initialLoadDone && requests.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground text-sm">No pending requests</p>
          <p className="text-xs text-muted-foreground mt-2">
            New join requests will appear here in real-time
          </p>
        </div>
      )}

      {/* Requests List */}
      {initialLoadDone && requests.length > 0 && (
        <div className="space-y-2">
          {requests.map((req) => {
            const isProcessing = processingRequest === req.id;
            const timeAgo = formatDistanceToNow(new Date(req.created_at), {
              addSuffix: true,
            });

            return (
              <div
                key={req.id}
                className="flex flex-col border rounded-lg p-3 bg-background/50 hover:bg-background/80 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{req.username}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Requested {timeAgo}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 justify-between">
                  {/* Accept Button */}
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleAccept(req.id, req.username)}
                    disabled={isProcessing}
                    className="text-xs flex-1"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        Accept
                      </>
                    )}
                  </Button>

                  {/* Reject Button */}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleReject(req.id, req.username)}
                    disabled={isProcessing}
                    className="text-xs flex-1"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <X className="h-3 w-3 mr-1" />
                        Reject
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}