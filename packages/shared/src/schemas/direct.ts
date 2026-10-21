import { z } from 'zod';
import { GROUP_MEMBERS_MAX, GROUP_TITLE_MAX, MESSAGE_MAX } from '../constants/limits';
import { idSchema } from './common';

export const createGroupSchema = z.object({
  title: z.string().trim().min(1).max(GROUP_TITLE_MAX).optional(),
  memberIds: z
    .array(idSchema)
    .min(2)
    .max(GROUP_MEMBERS_MAX - 1),
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const updateConversationSchema = z
  .object({
    title: z.string().trim().min(1).max(GROUP_TITLE_MAX),
    avatarUrl: z.url().nullable(),
  })
  .partial();
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;

export const addMembersSchema = z.object({
  userIds: z.array(idSchema).min(1).max(GROUP_MEMBERS_MAX),
});
export type AddMembersInput = z.infer<typeof addMembersSchema>;

export const sendMessageSchema = z
  .object({
    type: z.enum(['TEXT', 'MEDIA', 'POST_SHARE', 'STORY_REPLY']),
    text: z.string().trim().min(1).max(MESSAGE_MAX).optional(),
    mediaUrl: z.url().optional(),
    mediaType: z.enum(['IMAGE', 'VIDEO']).optional(),
    postId: idSchema.optional(),
    storyId: idSchema.optional(),
    replyToId: idSchema.optional(),
    /** Client-generated id to match the optimistic message with the saved one */
    clientId: z.string().max(64).optional(),
  })
  .superRefine((m, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (m.type === 'TEXT' && !m.text) fail('Text message requires text.');
    if (m.type === 'MEDIA' && (!m.mediaUrl || !m.mediaType)) fail('Media message requires media.');
    if (m.type === 'POST_SHARE' && !m.postId) fail('Post share requires postId.');
    if (m.type === 'STORY_REPLY' && (!m.storyId || !m.text))
      fail('Story reply requires storyId and text.');
  });
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const reactionSchema = z.object({
  emoji: z.string().min(1).max(16),
});
export type ReactionInput = z.infer<typeof reactionSchema>;

export const startCallSchema = z.object({
  type: z.enum(['AUDIO', 'VIDEO']),
});
export type StartCallInput = z.infer<typeof startCallSchema>;

// ───────────── Socket.IO client events (validated by the gateway) ─────────────

export const typingEventSchema = z.object({
  conversationId: idSchema,
  isTyping: z.boolean(),
});
export type TypingEventInput = z.infer<typeof typingEventSchema>;

export const presenceSubscribeSchema = z.object({
  userIds: z.array(idSchema).max(200),
});
export type PresenceSubscribeInput = z.infer<typeof presenceSubscribeSchema>;

export const presenceFocusSchema = z.object({
  focused: z.boolean(),
});
export type PresenceFocusInput = z.infer<typeof presenceFocusSchema>;
