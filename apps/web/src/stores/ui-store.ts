import { create } from 'zustand';

// Client-only UI state (docs/spec/frontend.md): which global overlays are open
type UiState = {
  createPostOpen: boolean;
  openCreatePost: () => void;
  closeCreatePost: () => void;
  notificationsOpen: boolean;
  toggleNotifications: () => void;
  closeNotifications: () => void;
  /** Set by a refresh of the home feed: the server shuffles the feed by it; null = newest first */
  feedSeed: number | null;
  reshuffleFeed: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  createPostOpen: false,
  openCreatePost: () => set({ createPostOpen: true }),
  closeCreatePost: () => set({ createPostOpen: false }),
  notificationsOpen: false,
  toggleNotifications: () => set((state) => ({ notificationsOpen: !state.notificationsOpen })),
  closeNotifications: () => set({ notificationsOpen: false }),
  feedSeed: null,
  reshuffleFeed: () => set({ feedSeed: Math.floor(Math.random() * 2_000_000_000) }),
}));
