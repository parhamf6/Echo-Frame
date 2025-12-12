'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface QuickActionsTabProps {
  onRequestPause?: () => void;
  onRequestRewind?: (seconds: number) => void;
}

export function QuickActionsTab({ onRequestPause, onRequestRewind }: QuickActionsTabProps) {
  return (
    <Card className="p-3 space-y-2">
      <div className="text-sm font-semibold">Quick Actions</div>
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={onRequestPause}>
          Request Pause
        </Button>
        <Button size="sm" variant="outline" onClick={() => onRequestRewind?.(10)}>
          Rewind 10s
        </Button>
        <Button size="sm" variant="outline" onClick={() => onRequestRewind?.(30)}>
          Rewind 30s
        </Button>
      </div>
    </Card>
  );
}

