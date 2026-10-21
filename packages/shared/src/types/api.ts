// Response types of the REST API. Dates are ISO strings.
// Source of truth: docs/spec/api.md

import type {
  CallStatus,
  CallType,
  Language,
  MediaType,
  MemberRole,
  MessagePermission,
  MessageType,
  NotificationType,
  PostType,
  SystemMessageAction,
  Theme,
  ViewerFollowStatus,
} from '../constants/enums';

// ───────────── Common ─────────────

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
};

// ───────────── Users ─────────────

export type UserPreview = {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  hasActiveStory: boolean;
  hasUnseenStory: boolean;
};

/** UserPreview with the viewer's relationship, for lists with a Follow button. */
export type UserListItem = UserPreview & {
  followStatus: ViewerFollowStatus;
  isMe: boolean;
};

export type UserProfile = UserPreview & {
  bio: string | null;
  website: string | null;
  isPrivate: boolean;
  postsCount: number;
  followersCount: number;
  followingCount: number;
  isMe: boolean;
  followStatus: ViewerFollowStatus;
  followsMe: boolean;
  isBlocked: boolean;
  /** false = private account the viewer doesn't follow */
  canViewContent: boolean;
};

/** Current user, returned by /auth/login, /auth/register and /users/me. */
export type Me = UserPreview & {
  email: string;
  bio: string | null;
  website: string | null;
  isPrivate: boolean;
  postsCount: number;
  followersCount: number;
  followingCount: number;
  language: Language;
  theme: Theme;
  hasPassword: boolean;
  unreadNotificationsCount: number;
  unreadConversationsCount: number;
  pendingFollowRequestsCount: number;
};

// ───────────── Posts ─────────────

export type PostMedia = {
  id: string;
  type: MediaType;
  url: string;
  width: number;
  height: number;
  duration: number | null;
  thumbnailUrl: string | null;
};

export type Post = {
  id: string;
  type: PostType;
  author: UserPreview;
  caption: string | null;
  media: PostMedia[];
  taggedUsers: UserPreview[];
  likesCount: number;
  commentsCount: number;
  viewsCount: number;
  isLiked: boolean;
  isSaved: boolean;
  commentsDisabled: boolean;
  createdAt: string;
};

export type Comment = {
  id: string;
  postId: string;
  text: string;
  author: UserPreview;
  parentId: string | null;
  likesCount: number;
  repliesCount: number;
  isLiked: boolean;
  createdAt: string;
};

export type Hashtag = {
  name: string;
  postsCount: number;
};

export type LikesCount = { likesCount: number };

// ───────────── Stories ─────────────

export type Story = {
  id: string;
  author: UserPreview;
  mediaType: MediaType;
  url: string;
  thumbnailUrl: string | null;
  duration: number | null;
  isSeen: boolean;
  isLiked: boolean;
  /** Only present for the author */
  viewsCount?: number;
  createdAt: string;
  expiresAt: string;
};

export type StoryTray = {
  user: UserPreview;
  hasUnseen: boolean;
  latestAt: string;
};

export type StoryViewer = UserPreview & { liked: boolean; viewedAt: string };

export type Highlight = {
  id: string;
  title: string;
  coverUrl: string | null;
  storiesCount: number;
  createdAt: string;
};

// ───────────── Direct ─────────────

export type MessagePreview = {
  id: string;
  type: MessageType;
  senderId: string;
  senderUsername: string;
  text: string | null;
  isDeleted: boolean;
  createdAt: string;
};

export type CallSummary = {
  id: string;
  type: CallType;
  status: CallStatus;
  startedById: string;
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  participantsCount: number;
};

export type SystemMessageData = {
  action: SystemMessageAction;
  actor: UserPreview;
  targets: UserPreview[];
  title?: string;
};

export type MessageReaction = { emoji: string; userId: string };

export type Message = {
  id: string;
  conversationId: string;
  clientId: string | null;
  sender: UserPreview;
  type: MessageType;
  text: string | null;
  mediaUrl: string | null;
  mediaType: MediaType | null;
  post: Post | null;
  story: Story | null;
  call: CallSummary | null;
  replyTo: MessagePreview | null;
  reactions: MessageReaction[];
  systemData: SystemMessageData | null;
  isDeleted: boolean;
  createdAt: string;
};

export type ConversationMember = UserPreview & {
  role: MemberRole;
  lastReadAt: string;
};

export type ActiveCall = {
  id: string;
  type: CallType;
  status: CallStatus;
  participantIds: string[];
};

export type ConversationPreview = {
  id: string;
  isGroup: boolean;
  /** Group title, or the other user's username for 1:1 */
  title: string;
  avatarUrls: string[];
  lastMessage: MessagePreview | null;
  lastMessageAt: string;
  unreadCount: number;
  activeCall: ActiveCall | null;
  /** 1:1 only: the other user */
  otherUser: UserPreview | null;
};

export type Conversation = ConversationPreview & {
  members: ConversationMember[];
  myRole: MemberRole;
  createdAt: string;
};

// ───────────── Calls ─────────────

export type CallJoin = {
  call: CallSummary & { conversationId: string; roomName: string };
  /** LiveKit access token */
  token: string;
  /** LiveKit server URL */
  url: string;
};

// ───────────── Notifications ─────────────

export type Notification = {
  id: string;
  type: NotificationType;
  actor: UserPreview;
  post: { id: string; type: PostType; thumbnailUrl: string | null } | null;
  comment: { id: string; text: string } | null;
  storyId: string | null;
  actorFollowStatus: ViewerFollowStatus;
  isRead: boolean;
  createdAt: string;
};

export type Count = { count: number };

// ───────────── Media ─────────────

export type MediaSignature = {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
};

// ───────────── Settings ─────────────

export type Settings = {
  isPrivate: boolean;
  showActivityStatus: boolean;
  messagePermission: MessagePermission;
  theme: Theme;
  language: Language;
  hasPassword: boolean;
  notifications: {
    pushEnabled: boolean;
    likes: boolean;
    comments: boolean;
    follows: boolean;
    messages: boolean;
    calls: boolean;
    pausedUntil: string | null;
  };
};

export type SessionInfo = {
  id: string;
  browser: string;
  os: string;
  lastUsedAt: string;
  createdAt: string;
  isCurrent: boolean;
};

// ───────────── Push ─────────────

export type PushPayload = {
  type: 'MESSAGE' | 'CALL' | 'CALL_ENDED' | 'NOTIFICATION';
  title: string;
  body: string;
  icon: string | null;
  url: string;
  /** Same tag replaces the previous notification: "conversation:<id>", "call:<id>" */
  tag: string;
  callId?: string;
};
