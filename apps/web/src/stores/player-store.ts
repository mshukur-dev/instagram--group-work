import { create } from 'zustand';

// Sound in Reels: one switch for all videos. Off at first, so the browser lets videos autoplay.
type PlayerState = {
  muted: boolean;
  toggleMuted: () => void;
};

export const usePlayerStore = create<PlayerState>((set) => ({
  muted: true,
  toggleMuted: () => set((state) => ({ muted: !state.muted })),
}));
