import type { CallSummary, CallType, ConversationPreview, UserPreview } from '@instagram/shared';
import { create } from 'zustand';

/** A call ringing for me (1:1) or just started in one of my groups */
export type IncomingCall = {
  call: CallSummary & { conversationId: string };
  conversation: ConversationPreview;
  caller: UserPreview;
};

/** The call I'm in (docs/spec/calls.md §9) */
export type CallSession = {
  callId: string;
  conversationId: string;
  type: CallType;
  isGroup: boolean;
  title: string;
  /** The chat's picture(s): the person, or the group photo / two members */
  avatarUrls: string[];
  /** The other person of a 1:1 call */
  peer: UserPreview | null;
  token: string;
  url: string;
  /** ringing: waiting for the other person; busy: they are in another call; ended: closing */
  phase: 'ringing' | 'active' | 'busy' | 'ended';
  answeredAt: number | null;
};

type State = {
  incoming: IncomingCall | null;
  /** Group calls started while I'm around: a banner each, until joined or dismissed */
  groupInvites: IncomingCall[];
  session: CallSession | null;
  setIncoming: (incoming: IncomingCall | null) => void;
  addGroupInvite: (invite: IncomingCall) => void;
  dropGroupInvite: (callId: string) => void;
  setSession: (session: CallSession | null) => void;
  patchSession: (patch: Partial<CallSession>) => void;
};

// Client state of calls only; chat data stays in the Query cache.
export const useCallStore = create<State>((set) => ({
  incoming: null,
  groupInvites: [],
  session: null,
  setIncoming: (incoming) => set({ incoming }),
  addGroupInvite: (invite) =>
    set((s) => ({
      groupInvites: [...s.groupInvites.filter((i) => i.call.id !== invite.call.id), invite],
    })),
  dropGroupInvite: (callId) =>
    set((s) => ({ groupInvites: s.groupInvites.filter((i) => i.call.id !== callId) })),
  setSession: (session) => set({ session }),
  patchSession: (patch) => set((s) => (s.session ? { session: { ...s.session, ...patch } } : s)),
}));
