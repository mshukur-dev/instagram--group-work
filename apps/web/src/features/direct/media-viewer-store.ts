import { create } from 'zustand';
import type { ChatMessage } from './api';

/** The key a chat photo is known by on the page (stays the same while it is being sent) */
export const mediaKey = (message: ChatMessage) => message.localKey ?? message.id;

/** Where the photo was on the page, so the viewer can grow out of it and fly back into it */
export type ViewerOrigin = {
  left: number;
  top: number;
  width: number;
  height: number;
  radius: number;
  /** width / height of the picture itself */
  aspect: number;
};

type State = {
  messageId: string | null;
  origin: ViewerOrigin | null;
  show: (messageId: string, origin: ViewerOrigin | null) => void;
  go: (messageId: string) => void;
  hide: () => void;
};

// Which chat photo / video is open full screen (client UI state only; the media itself is
// read from the messages cache).
export const useMediaViewer = create<State>((set) => ({
  messageId: null,
  origin: null,
  show: (messageId, origin) => set({ messageId, origin }),
  go: (messageId) => set({ messageId }),
  hide: () => set({ messageId: null, origin: null }),
}));

/** The box of a thumbnail on screen, with the real proportions of what it shows. */
export function originOf(element: HTMLElement): ViewerOrigin {
  const rect = element.getBoundingClientRect();
  const media = element.matches('img, video') ? element : element.querySelector('img, video');
  let aspect = rect.width / Math.max(rect.height, 1);
  if (media instanceof HTMLImageElement && media.naturalWidth) {
    aspect = media.naturalWidth / media.naturalHeight;
  } else if (media instanceof HTMLVideoElement && media.videoWidth) {
    aspect = media.videoWidth / media.videoHeight;
  }
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    radius: parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0,
    aspect,
  };
}

export function openMediaViewer(messageId: string, element: HTMLElement) {
  useMediaViewer.getState().show(messageId, originOf(element));
}
