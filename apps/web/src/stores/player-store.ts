import { create } from 'zustand';

// Sound in Reels: one switch for all videos. On at first, as in Instagram; where the browser
// refuses to autoplay with sound (a page opened straight on Reels, no click yet) the player turns
// it off and the speaker button brings it back.
type PlayerState = {
  muted: boolean;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => void;
};

export const usePlayerStore = create<PlayerState>((set) => ({
  muted: false,
  setMuted: (muted) => set({ muted }),
  toggleMuted: () => set((state) => ({ muted: !state.muted })),
}));
