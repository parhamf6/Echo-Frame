// app/room/[roomId]/components/SettingsModal/JoinRequestsTab.tsx
'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { RefreshCw, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useParams } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

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
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  
  const params = useParams();
  const roomId = params.roomId as string;

  const fetchRequests = async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) {
      setLoading(true);
    }

    try {
      const { data } = await apiClient.get('/api/v1/guests/pending', {
        params: { room_id: roomId },
      });
      setRequests(data);
      
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
      
      // Remove from local state
      setRequests((prev) => prev.filter((r) => r.id !== guestId));
      
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
      
      // Remove from local state
      setRequests((prev) => prev.filter((r) => r.id !== guestId));
      
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
    <div className="space-y-4">
      {/* Refresh Button */}
      <Button
        onClick={handleRefresh}
        disabled={loading}
        variant="outline"
        className="w-full"
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
          <p className="text-muted-foreground">No pending requests</p>
          <p className="text-sm text-muted-foreground mt-2">
            New join requests will appear here
          </p>
        </div>
      )}

      {/* Requests List */}
      {initialLoadDone && requests.length > 0 && (
        <div className="space-y-3 max-h-[50vh] overflow-y-auto">
          {requests.map((req) => {
            const isProcessing = processingRequest === req.id;
            const timeAgo = formatDistanceToNow(new Date(req.created_at), {
              addSuffix: true,
            });

            return (
              <div
                key={req.id}
                className="flex items-center justify-between border rounded-lg p-3 bg-card"
              >
                <div className="flex-1">
                  <p className="font-medium">{req.username}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Requested {timeAgo}
                  </p>
                </div>

                <div className="flex gap-2 ml-4">
                  {/* Accept Button */}
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleAccept(req.id, req.username)}
                    disabled={isProcessing}
                    className="text-xs"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-1" />
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
                    className="text-xs"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <X className="h-4 w-4 mr-1" />
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