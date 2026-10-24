import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ServerEvent } from '@instagram/shared';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CommentsService } from '../comments/comments.service';
import { ConversationsService } from '../conversations/conversations.service';
import { FollowActionsService } from '../follows/follow-actions.service';
import { LikesService } from '../likes/likes.service';
import { MessagesService } from '../messages/messages.service';
import { RealtimeService } from '../realtime/realtime.service';
import { StoriesService } from '../stories/stories.service';
import { BOT_COMMENTS, BOT_OPENERS, type BotLang, pick, replyTo } from './demo-lines';

/** Demo accounts made by the seed (prisma/seed.ts) have emails on this domain */
export const BOT_EMAIL_DOMAIN = '@bot.instagram.test';

type Bot = { id: string; username: string; lang: BotLang };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const chance = (p: number) => Math.random() < p;
const between = (min: number, max: number) => min + Math.random() * (max - min);

// How often one person may be touched by bots, so a demo never turns into spam
const PER_PERSON_COOLDOWN_MS = 45_000;
const OPENER_COOLDOWN_MS = 20 * 60_000;

/**
 * Makes the site feel lived in (docs/spec/demo-bots.md). With DEMO_BOTS=true the seed's demo
 * accounts act on their own through the same services as real people, so notifications, live
 * updates and pushes fire as usual:
 * - people who are online get likes, comments, follows, story likes and now and then a message;
 * - messages to a demo account are read and answered ("typing…" first);
 * - in the background demo accounts like each other's posts and post new stories.
 */
@Injectable()
export class DemoBotsService {
  private readonly logger = new Logger(DemoBotsService.name);
  private bots: Bot[] = [];
  private botIds = new Set<string>();
  private loadedAt = 0;
  private busy = false;
  private readonly lastTouched = new Map<string, number>();
  private readonly lastOpener = new Map<string, number>();
  private readonly answered = new Set<string>();

  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly likes: LikesService,
    private readonly comments: CommentsService,
    private readonly followActions: FollowActionsService,
    private readonly stories: StoriesService,
    private readonly messages: MessagesService,
    private readonly conversations: ConversationsService,
  ) {}

  private get enabled(): boolean {
    return this.config.get('DEMO_BOTS');
  }

  // ───────────── The cast ─────────────

  private async loadBots(): Promise<void> {
    if (Date.now() - this.loadedAt < 10 * 60_000 && this.bots.length) return;
    const rows = await this.prisma.user.findMany({
      where: { email: { endsWith: BOT_EMAIL_DOMAIN }, bannedAt: null },
      select: { id: true, username: true, language: true },
    });
    this.bots = rows.map((r) => ({
      id: r.id,
      username: r.username,
      lang: r.language === 'RU' ? 'ru' : 'en',
    }));
    this.botIds = new Set(this.bots.map((b) => b.id));
    this.loadedAt = Date.now();
  }

  private randomBot(): Bot | undefined {
    return this.bots[Math.floor(Math.random() * this.bots.length)];
  }

  /** Real people with the site open right now */
  private onlinePeople(): string[] {
    return this.realtime.onlineUserIds().filter((id) => !this.botIds.has(id));
  }

  // ───────────── Activity around people who are online ─────────────

  @Interval(9_000)
  async tick(): Promise<void> {
    if (!this.enabled || this.busy) return;
    this.busy = true;
    try {
      await this.loadBots();
      if (!this.bots.length) return;

      const now = Date.now();
      const people = this.onlinePeople().filter(
        (id) => now - (this.lastTouched.get(id) ?? 0) > PER_PERSON_COOLDOWN_MS,
      );
      if (people.length && chance(0.7)) {
        const personId = pick(people);
        this.lastTouched.set(personId, now);
        await this.touch(personId);
      }
      // The world goes on without anyone watching
      if (chance(0.6)) await this.backgroundLike();
      if (chance(0.12)) await this.freshStory();
    } catch (error) {
      this.logger.warn(`tick: ${(error as Error).message}`);
    } finally {
      this.busy = false;
    }
  }

  /** One thing a demo account does to a real person */
  private async touch(personId: string): Promise<void> {
    const roll = Math.random();
    if (roll < 0.45) return this.likeTheirPost(personId);
    if (roll < 0.62) return this.commentOnTheirPost(personId);
    if (roll < 0.76) return this.followThem(personId);
    if (roll < 0.9) return this.likeTheirStory(personId);
    return this.writeToThem(personId);
  }

  private async recentPostOf(personId: string): Promise<string | null> {
    const posts = await this.prisma.post.findMany({
      where: { authorId: personId },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { id: true },
    });
    return posts.length ? pick(posts).id : null;
  }

  /** A demo account that hasn't liked it yet */
  private async likeTheirPost(personId: string): Promise<void> {
    const postId = await this.recentPostOf(personId);
    if (!postId) return this.followThem(personId);
    const already = new Set(
      (await this.prisma.like.findMany({ where: { postId }, select: { userId: true } })).map(
        (l) => l.userId,
      ),
    );
    const bot = this.bots.find((b) => !already.has(b.id) && chance(0.05)) ?? this.randomBot();
    if (!bot || already.has(bot.id)) return;
    await this.likes.likePost(bot.id, postId).catch(() => undefined);
  }

  private async commentOnTheirPost(personId: string): Promise<void> {
    const postId = await this.recentPostOf(personId);
    const bot = this.randomBot();
    if (!postId || !bot) return;
    await this.comments
      .create(bot.id, postId, { text: pick(BOT_COMMENTS[bot.lang]) })
      .catch(() => undefined);
  }

  private async followThem(personId: string): Promise<void> {
    const person = await this.prisma.user.findUnique({
      where: { id: personId },
      select: { username: true },
    });
    if (!person) return;
    const followers = new Set(
      (
        await this.prisma.follow.findMany({
          where: { followingId: personId },
          select: { followerId: true },
        })
      ).map((f) => f.followerId),
    );
    const candidates = this.bots.filter((b) => !followers.has(b.id));
    if (!candidates.length) return;
    await this.followActions.follow(pick(candidates).id, person.username).catch(() => undefined);
  }

  private async likeTheirStory(personId: string): Promise<void> {
    const story = await this.prisma.story.findFirst({
      where: { authorId: personId, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    const bot = this.randomBot();
    if (!story || !bot) return this.likeTheirPost(personId);
    await this.stories.view(bot.id, story.id).catch(() => undefined);
    await this.stories.like(bot.id, story.id).catch(() => undefined);
  }

  /** Now and then someone writes first (not more than once in 20 minutes per person) */
  private async writeToThem(personId: string): Promise<void> {
    if (Date.now() - (this.lastOpener.get(personId) ?? 0) < OPENER_COOLDOWN_MS) {
      return this.likeTheirPost(personId);
    }
    const bot = this.randomBot();
    if (!bot) return;
    this.lastOpener.set(personId, Date.now());
    try {
      const conversationId = await this.conversations.findOrCreateDirect(bot.id, personId);
      await this.typeThenSend(bot.id, conversationId, pick(BOT_OPENERS[bot.lang]));
    } catch {
      // they may not accept messages from strangers; fine
    }
  }

  // ───────────── Background life ─────────────

  private async backgroundLike(): Promise<void> {
    const bot = this.randomBot();
    if (!bot) return;
    const since = new Date(Date.now() - 3 * 24 * 3600_000);
    const count = await this.prisma.post.count({ where: { createdAt: { gte: since } } });
    if (!count) return;
    const [post] = await this.prisma.post.findMany({
      where: { createdAt: { gte: since }, author: { isPrivate: false } },
      skip: Math.floor(Math.random() * count),
      take: 1,
      select: { id: true, authorId: true },
    });
    if (!post || post.authorId === bot.id) return;
    await this.likes.likePost(bot.id, post.id).catch(() => undefined);
  }

  /** A demo account posts a story again (one of its older pictures), so the tray stays fresh */
  private async freshStory(): Promise<void> {
    const bot = this.randomBot();
    if (!bot) return;
    const active = await this.prisma.story.count({
      where: { authorId: bot.id, expiresAt: { gt: new Date() } },
    });
    if (active >= 3) return;
    const old = await this.prisma.story.findMany({
      where: { authorId: bot.id },
      take: 12,
      select: { mediaType: true, url: true, publicId: true, thumbnailUrl: true, duration: true },
    });
    if (!old.length) return;
    const s = pick(old);
    await this.stories
      .create(bot.id, {
        type: s.mediaType,
        url: s.url,
        publicId: s.publicId,
        width: 1080,
        height: 1920,
        duration: s.duration ? Math.min(s.duration, 15) : null,
        thumbnailUrl: s.thumbnailUrl,
      })
      .catch(() => undefined);
  }

  // ───────────── Answering messages ─────────────

  /** Messages to a demo account get read and answered within seconds */
  @Interval(3_000)
  async answer(): Promise<void> {
    if (!this.enabled) return;
    await this.loadBots().catch(() => undefined);
    if (!this.bots.length) return;
    const recent = await this.prisma.conversation.findMany({
      where: { lastMessageAt: { gte: new Date(Date.now() - 2 * 60_000) } },
      select: {
        id: true,
        isGroup: true,
        members: { where: { leftAt: null }, select: { userId: true } },
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, senderId: true, type: true, text: true },
        },
      },
    });
    for (const c of recent) {
      const last = c.messages[0];
      if (!last || this.botIds.has(last.senderId) || this.answered.has(last.id)) continue;
      const botMembers = c.members.map((m) => m.userId).filter((id) => this.botIds.has(id));
      if (!botMembers.length || last.type === 'SYSTEM' || last.type === 'CALL') continue;
      // In a group not every message needs an answer
      if (c.isGroup && !chance(0.4)) {
        this.answered.add(last.id);
        continue;
      }
      this.answered.add(last.id);
      const botId = pick(botMembers);
      const text =
        last.type === 'TEXT'
          ? replyTo(last.text)
          : replyTo(last.type === 'POST_SHARE' ? 'haha 😂' : '❤');
      void this.readAndReply(botId, c.id, last.id, text);
    }
    if (this.answered.size > 5000) this.answered.clear();
  }

  private async readAndReply(
    botId: string,
    conversationId: string,
    messageId: string,
    text: string,
  ): Promise<void> {
    try {
      await sleep(between(800, 2500));
      await this.conversations.markRead(botId, conversationId);
      // Like people do, sometimes a reaction first
      if (chance(0.35)) {
        await this.messages
          .setReaction(botId, messageId, pick(['❤️', '😂', '👍', '🔥', '😮']))
          .catch(() => undefined);
        await sleep(between(400, 1200));
      }
      await this.typeThenSend(botId, conversationId, text);
    } catch (error) {
      this.logger.warn(`reply: ${(error as Error).message}`);
    }
  }

  /** "typing…" for a moment that fits the length, then the message */
  private async typeThenSend(botId: string, conversationId: string, text: string): Promise<void> {
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId, leftAt: null },
      select: { userId: true },
    });
    const others = members.map((m) => m.userId).filter((id) => id !== botId);
    this.realtime.emitToUsers(others, ServerEvent.TYPING, {
      conversationId,
      userId: botId,
      isTyping: true,
    });
    await sleep(Math.min(6000, 900 + text.length * 70));
    this.realtime.emitToUsers(others, ServerEvent.TYPING, {
      conversationId,
      userId: botId,
      isTyping: false,
    });
    await this.messages.send(botId, conversationId, { type: 'TEXT', text });
  }
}
