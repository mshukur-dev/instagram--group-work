import { create } from 'zustand';

// Client-only UI state: which post is open in the modal. The modal opens straight from the click
// (no round trip to the server), and the address is changed with the browser's own history API,
// which Next.js keeps in sync with usePathname().
type PostModalState = {
  postId: string | null;
};

export const usePostModalStore = create<PostModalState>(() => ({ postId: null }));

/** Opens a post over the current page and puts /p/:id into the address bar. */
export function openPostModal(postId: string) {
  window.history.pushState(null, '', `/p/${postId}`);
  usePostModalStore.setState({ postId });
}

/** Removes the modal without any animation (the animation, if any, has played before). */
export function dismissPostModal() {
  usePostModalStore.setState({ postId: null });
}
