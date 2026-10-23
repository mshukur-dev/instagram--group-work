import { create } from 'zustand';

// Client-only UI state (docs/spec/frontend.md): which global overlays are open
type UiState = {
  createPostOpen: boolean;
  openCreatePost: () => void;
  closeCreatePost: () => void;
  notificationsOpen: boolean;
  toggleNotifications: () => void;
  closeNotifications: () => void;
  searchOpen: boolean;
  toggleSearch: () => void;
  closeSearch: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  createPostOpen: false,
  openCreatePost: () => set({ createPostOpen: true }),
  closeCreatePost: () => set({ createPostOpen: false }),
  notificationsOpen: false,
  // One side panel at a time: opening one closes the other
  toggleNotifications: () =>
    set((state) => ({ notificationsOpen: !state.notificationsOpen, searchOpen: false })),
  closeNotifications: () => set({ notificationsOpen: false }),
  searchOpen: false,
  toggleSearch: () => set((state) => ({ searchOpen: !state.searchOpen, notificationsOpen: false })),
  closeSearch: () => set({ searchOpen: false }),
}));
