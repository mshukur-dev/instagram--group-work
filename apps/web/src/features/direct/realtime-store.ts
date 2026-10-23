import type { PresenceState } from '@instagram/shared';
import { create } from 'zustand';

// Short-lived realtime state that never comes from REST: who is online and who is typing.
// (Server data — conversations, messages — lives in the TanStack Query cache.)
type RealtimeState = {
  presence: Record<string, PresenceState>;
  /** conversationId → ids of the people typing there now */
  typing: Record<string, string[]>;
  /** The conversation open on screen (its new messages are read at once) */
  openConversationId: string | null;
  setPresence: (states: PresenceState[]) => void;
  setTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
  setOpenConversation: (id: string | null) => void;
};

export const useRealtimeStore = create<RealtimeState>((set) => ({
  presence: {},
  typing: {},
  openConversationId: null,
  setPresence: (states) =>
    set((state) => ({
      presence: {
        ...state.presence,
        ...Object.fromEntries(states.map((s) => [s.userId, s])),
      },
    })),
  setTyping: (conversationId, userId, isTyping) =>
    set((state) => {
      const others = (state.typing[conversationId] ?? []).filter((id) => id !== userId);
      return {
        typing: { ...state.typing, [conversationId]: isTyping ? [...others, userId] : others },
      };
    }),
  setOpenConversation: (id) => set({ openConversationId: id }),
}));

const NO_ONE: string[] = [];
export const useTypingIn = (conversationId: string) =>
  useRealtimeStore((state) => state.typing[conversationId] ?? NO_ONE);

export const usePresence = (userId: string | null | undefined) =>
  useRealtimeStore((state) => (userId ? state.presence[userId] : undefined));
