import { create } from 'zustand';

// Client-only UI state (docs/spec/frontend.md): which global overlays are open
type UiState = {
  createPostOpen: boolean;
  openCreatePost: () => void;
  closeCreatePost: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  createPostOpen: false,
  openCreatePost: () => set({ createPostOpen: true }),
  closeCreatePost: () => set({ createPostOpen: false }),
}));
