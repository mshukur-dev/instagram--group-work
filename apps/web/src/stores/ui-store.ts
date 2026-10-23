import { create } from 'zustand';

// Client-only UI state (docs/spec/frontend.md): which global overlays are open
type UiState = {
  createPostOpen: boolean;
  openCreatePost: () => void;
  closeCreatePost: () => void;
  notificationsOpen: boolean;
  toggleNotifications: () => void;
  closeNotifications: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  createPostOpen: false,
  openCreatePost: () => set({ createPostOpen: true }),
  closeCreatePost: () => set({ createPostOpen: false }),
  notificationsOpen: false,
  toggleNotifications: () => set((state) => ({ notificationsOpen: !state.notificationsOpen })),
  closeNotifications: () => set({ notificationsOpen: false }),
}));
