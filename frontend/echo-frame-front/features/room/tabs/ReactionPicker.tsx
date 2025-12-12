'use client';

import { useState } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { Button } from '@/components/ui/button';

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
}

export function ReactionPicker({ onSelect }: ReactionPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
        🙂
      </Button>
      {open && (
        <div className="absolute z-20">
          <Picker
            data={data}
            onEmojiSelect={(emoji: any) => {
              onSelect(emoji.native || emoji.shortcodes || '');
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

