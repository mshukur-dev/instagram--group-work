// Response types of the REST API. Dates are ISO strings.
// Source of truth: docs/spec/api.md

import type {
  CallStatus,
  CallType,
  AdminActionType,
  Language,
  MediaType,
  MemberRole,
  MessagePermission,
  MessageType,
  NotificationType,
  PostType,
  SystemMessageAction,
  Theme,
  UserRole,
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
  /** Blue check next to the name (well-known accounts) */
  isVerified: boolean;
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
/** A "Suggested for you" person: who of the people I follow already follows them */
export type SuggestedUser = UserPreview & {
  /** The best-known of my followings who follows them, and how many more do; null if none */
  followedBy: { username: string; others: number } | null;
};

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
  /** ADMIN sees the "Admin" menu item and /admin (ADMIN-1) */
  role: UserRole;
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
  /** Where it was taken; opens the place's page */
  location: PostLocation | null;
  /**
   * Up to 3 people who liked the post, for "Liked by maria and 5 others": people the viewer
   * follows first, then the most recent likers. Never the viewer, never blocked users.
   */
  likedBy: UserPreview[];
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

export type PostLocation = { id: string; name: string };

/** A place's page header (posts are listed separately) */
export type Location = PostLocation & {
  address: string | null;
  lat: number;
  lng: number;
  postsCount: number;
};

/** A location search result, not saved yet (it is saved with the first post there) */
export type Place = {
  osmId: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
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
  /** VOICE: seconds and bar heights (0..100) */
  voice: { duration: number; waveform: number[] } | null;
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
  /** My own mute switches for this chat */
  muted: { messages: boolean; calls: boolean };
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

// ───────────── Live (LIVE-*) ─────────────

export type LiveStatus = 'LIVE' | 'ENDED';

export type LiveStream = {
  id: string;
  host: UserPreview;
  status: LiveStatus;
  startedAt: string;
  endedAt: string | null;
};

/** What the host and viewers get to connect to the LiveKit room */
export type LiveJoin = {
  live: LiveStream;
  /** LiveKit access token: the host may publish, viewers only watch and send chat / hearts */
  token: string;
  /** LiveKit server URL */
  url: string;
  isHost: boolean;
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
  /** Echoed back when requested: send it to Cloudinary unchanged */
  transformation?: string;
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

// ───────────── Admin (ADMIN-1…ADMIN-6) ─────────────

export type AdminCounts = {
  users: number;
  posts: number;
  reels: number;
  stories: number;
  messages: number;
};

export type AdminStats = {
  total: AdminCounts;
  /** Since local midnight of the server */
  today: AdminCounts;
  last7Days: AdminCounts;
  online: number;
  /** Who is online right now, up to 30 (the "Active now" row) */
  onlineUsers: AdminUserRef[];
  bannedUsers: number;
};

/** Plain user chip for admin tables (no story rings). */
export type AdminUserRef = {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
};

export type AdminUser = AdminUserRef & {
  email: string;
  role: UserRole;
  isOnline: boolean;
  lastSeenAt: string | null;
  postsCount: number;
  followersCount: number;
  bannedAt: string | null;
  banReason: string | null;
  createdAt: string;
};

export type AdminPost = {
  id: string;
  type: PostType;
  author: AdminUserRef;
  caption: string | null;
  /** First media: image URL, or the poster frame of a video */
  previewUrl: string;
  previewType: MediaType;
  mediaCount: number;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
};

export type AdminComment = {
  id: string;
  text: string;
  author: AdminUserRef;
  postId: string;
  postPreviewUrl: string | null;
  isReply: boolean;
  createdAt: string;
};

export type AdminAction = {
  id: string;
  type: AdminActionType;
  admin: AdminUserRef;
  targetUser: AdminUserRef | null;
  targetId: string | null;
  /** BAN_USER: { reason }; DELETE_POST: { caption, postType }; DELETE_COMMENT: { text } */
  details: Record<string, string | null> | null;
  createdAt: string;
};
