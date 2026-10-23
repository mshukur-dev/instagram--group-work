import type { Post } from '@instagram/shared';
import { create } from 'zustand';

// Which post the "Share" sheet is open for (client UI state; the post itself stays in the cache)
type State = { post: Post | null; open: (post: Post) => void; close: () => void };

export const useShareStore = create<State>((set) => ({
  post: null,
  open: (post) => set({ post }),
  close: () => set({ post: null }),
}));
