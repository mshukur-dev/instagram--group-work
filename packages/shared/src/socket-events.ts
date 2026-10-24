// Socket.IO event names and payloads. Source of truth: docs/spec/realtime.md
// Never use event names as string literals — import from here.

import type { CallStatus } from './constants/enums';
import type {
  CallSummary,
  ConversationPreview,
  Message,
  MessageReaction,
  Notification,
  UserPreview,
} from './types/api';

export const ServerEvent = {
  MESSAGE_NEW: 'message:new',
  MESSAGE_DELETED: 'message:deleted',
  MESSAGE_REACTION: 'message:reaction',
  CONVERSATION_UPDATED: 'conversation:updated',
  CONVERSATION_REMOVED: 'conversation:removed',
  CONVERSATION_READ: 'conversation:read',
  TYPING: 'typing',
  PRESENCE: 'presence',
  NOTIFICATION_NEW: 'notification:new',
  CALL_INCOMING: 'call:incoming',
  CALL_UPDATED: 'call:updated',
  CALL_ENDED: 'call:ended',
  /** Someone I follow went live / their live ended: refresh the LIVE rings */
  LIVE_STARTED: 'live:started',
  LIVE_ENDED: 'live:ended',
} as const;

export const ClientEvent = {
  TYPING: 'typing',
  PRESENCE_SUBSCRIBE: 'presence:subscribe',
  PRESENCE_FOCUS: 'presence:focus',
} as const;

export type PresenceState = {
  userId: string;
  isOnline: boolean;
  lastSeenAt: string | null;
};

export interface ServerToClientEvents {
  [ServerEvent.MESSAGE_NEW]: (message: Message) => void;
  [ServerEvent.MESSAGE_DELETED]: (data: { conversationId: string; messageId: string }) => void;
  [ServerEvent.MESSAGE_REACTION]: (data: {
    conversationId: string;
    messageId: string;
    reactions: MessageReaction[];
    /** Set when someone just reacted (not when a reaction was taken back): the message's author
     * gets a card "maria reacted ❤️ to your message" */
    added?: {
      emoji: string;
      actor: { id: string; username: string; avatarUrl: string | null };
      messageSenderId: string;
      messageText: string | null;
    };
  }) => void;
  [ServerEvent.CONVERSATION_UPDATED]: (conversation: ConversationPreview) => void;
  [ServerEvent.CONVERSATION_REMOVED]: (data: { conversationId: string }) => void;
  [ServerEvent.CONVERSATION_READ]: (data: {
    conversationId: string;
    userId: string;
    lastReadAt: string;
  }) => void;
  [ServerEvent.TYPING]: (data: {
    conversationId: string;
    userId: string;
    isTyping: boolean;
  }) => void;
  [ServerEvent.PRESENCE]: (data: PresenceState) => void;
  [ServerEvent.NOTIFICATION_NEW]: (notification: Notification) => void;
  [ServerEvent.CALL_INCOMING]: (data: {
    call: CallSummary & { conversationId: string };
    conversation: ConversationPreview;
    caller: UserPreview;
  }) => void;
  [ServerEvent.CALL_UPDATED]: (data: {
    callId: string;
    conversationId: string;
    status: CallStatus;
    participantIds: string[];
  }) => void;
  [ServerEvent.CALL_ENDED]: (data: { callId: string; conversationId: string }) => void;
  [ServerEvent.LIVE_STARTED]: (data: { liveId: string; hostId: string }) => void;
  [ServerEvent.LIVE_ENDED]: (data: { liveId: string; hostId: string }) => void;
}

export interface ClientToServerEvents {
  [ClientEvent.TYPING]: (data: { conversationId: string; isTyping: boolean }) => void;
  [ClientEvent.PRESENCE_SUBSCRIBE]: (
    data: { userIds: string[] },
    ack: (states: PresenceState[]) => void,
  ) => void;
  [ClientEvent.PRESENCE_FOCUS]: (data: { focused: boolean }) => void;
}
