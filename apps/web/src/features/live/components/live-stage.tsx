'use client';

import { LIVE_COMMENT_MAX, type LiveStream } from '@instagram/shared';
import {
  RoomAudioRenderer,
  StartAudio,
  VideoTrack,
  useDataChannel,
  useParticipants,
  useRoomContext,
  useTracks,
} from '@livekit/components-react';
import { type Participant, RoomEvent, Track } from 'livekit-client';
import { Eye, Heart, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { UserAvatar } from '@/components/user-avatar';
import { cn } from '@/lib/utils';

const CHAT_TOPIC = 'live-chat';
const HEART_TOPIC = 'live-heart';
// Comments kept on screen; older ones scroll away under the fade
const CHAT_KEEP = 30;

type ChatLine =
  | { id: string; kind: 'comment'; username: string; avatarUrl: string | null; text: string }
  | { id: string; kind: 'joined'; username: string; avatarUrl: string | null };

type FloatingHeart = { id: number; drift: number; palette: 'classic' | 'love' };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const avatarOf = (participant: Participant | undefined): string | null => {
  try {
    const meta = JSON.parse(participant?.metadata ?? '{}') as { avatarUrl?: string | null };
    return meta.avatarUrl ?? null;
  } catch {
    return null;
  }
};

type Props = {
  live: LiveStream;
  isHost: boolean;
  /** The top-right action: viewers close the live, the host ends it */
  onClose: () => void;
};

// LIVE-4 / LIVE-5: everything inside the LiveKit room. The host's camera fills a tall column;
// on top: who is live, the LIVE badge and how many watch; at the bottom: the comments as they
// come (a "joined" line for each new viewer), a field to comment and the heart, whose taps
// float up for everyone. Chat and hearts are LiveKit data messages, nothing goes through the API.
export function LiveStage({ live, isHost, onClose }: Props) {
  const t = useTranslations('live');
  const room = useRoomContext();
  const reduceMotion = useReducedMotion();
  const participants = useParticipants();
  const viewers = participants.filter((p) => p.identity !== live.host.id).length;
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);
  const [text, setText] = useState('');
  const heartId = useRef(0);

  const [camera] = useTracks([Track.Source.Camera], { onlySubscribed: false }).filter(
    (track) => track.participant.identity === live.host.id && track.publication?.track,
  );

  const addLine = (line: ChatLine) => setLines((prev) => [...prev.slice(-(CHAT_KEEP - 1)), line]);

  const floatHeart = () => {
    if (reduceMotion) return;
    const id = (heartId.current += 1);
    setHearts((prev) => [
      ...prev.slice(-24),
      {
        id,
        drift: Math.round((Math.random() - 0.5) * 70),
        palette: Math.random() < 0.5 ? 'classic' : 'love',
      },
    ]);
  };

  const chat = useDataChannel(CHAT_TOPIC, (message) => {
    const body = decoder.decode(message.payload).slice(0, LIVE_COMMENT_MAX).trim();
    if (!body || !message.from) return;
    addLine({
      id: crypto.randomUUID(),
      kind: 'comment',
      username: message.from.name ?? message.from.identity,
      avatarUrl: avatarOf(message.from),
      text: body,
    });
  });
  const heart = useDataChannel(HEART_TOPIC, floatHeart);

  // "maria joined" for every viewer who comes in while I watch
  useEffect(() => {
    const onJoin = (participant: Participant) => {
      if (participant.identity === live.host.id) return;
      addLine({
        id: crypto.randomUUID(),
        kind: 'joined',
        username: participant.name ?? participant.identity,
        avatarUrl: avatarOf(participant),
      });
    };
    room.on(RoomEvent.ParticipantConnected, onJoin);
    return () => {
      room.off(RoomEvent.ParticipantConnected, onJoin);
    };
  }, [room, live.host.id]);

  const sendComment = () => {
    const body = text.trim().slice(0, LIVE_COMMENT_MAX);
    if (!body) return;
    setText('');
    const me = room.localParticipant;
    addLine({
      id: crypto.randomUUID(),
      kind: 'comment',
      username: me.name ?? me.identity,
      avatarUrl: avatarOf(me),
      text: body,
    });
    void chat.send(encoder.encode(body), { reliable: true, topic: CHAT_TOPIC });
  };

  const sendHeart = () => {
    floatHeart();
    void heart.send(new Uint8Array(), { reliable: false, topic: HEART_TOPIC });
  };

  return (
    <>
      <RoomAudioRenderer />
      {/* If the browser held the sound back, one tap lets it play */}
      {!isHost && (
        <StartAudio
          label={t('tapForSound')}
          className="absolute top-16 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/55 px-4 py-2 text-sm font-semibold backdrop-blur-md"
        />
      )}

      {/* The camera, or the host's photo while their video comes up */}
      {camera ? (
        <VideoTrack
          trackRef={camera}
          className={cn('absolute inset-0 size-full object-cover', isHost && '-scale-x-100')}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-neutral-900">
          <span className="flex flex-col items-center gap-3 text-sm text-white/70">
            <UserAvatar src={live.host.avatarUrl} alt="" size={88} />
            {isHost ? t('cameraStarting') : t('waitingHost')}
          </span>
        </div>
      )}

      {/* Header: who is live, the badge and the audience */}
      <div className="absolute inset-x-0 top-0 bg-linear-to-b from-black/55 to-transparent px-3 pt-3 pb-10">
        <div className="flex items-center gap-2.5">
          <UserAvatar src={live.host.avatarUrl} alt="" size={34} />
          <span className="min-w-0 truncate text-sm font-semibold drop-shadow">
            {live.host.username}
          </span>
          <span className="rounded-md bg-live px-1.5 py-0.5 text-[11px] leading-4 font-bold tracking-wide">
            {t('badge')}
          </span>
          <span
            className="flex items-center gap-1 rounded-md bg-black/40 px-1.5 py-0.5 text-xs tabular-nums backdrop-blur-md"
            aria-label={t('viewers', { count: viewers })}
          >
            <Eye className="size-3.5" />
            {viewers}
          </span>
          <span className="flex-1" />
          {isHost ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-black/40 px-3.5 py-1.5 text-sm font-semibold backdrop-blur-md outline-none transition-colors hover:bg-black/60 focus-visible:ring-2 focus-visible:ring-white/70"
            >
              {t('end')}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              aria-label={t('close')}
              className="grid size-9 place-items-center rounded-full outline-none transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <X className="size-6 drop-shadow" />
            </button>
          )}
        </div>
      </div>

      {/* Hearts float up the right edge */}
      <div className="pointer-events-none absolute right-3 bottom-16 h-72 w-16">
        <AnimatePresence>
          {hearts.map((h) => (
            <motion.span
              key={h.id}
              className="absolute bottom-0 left-1/2 -ml-4 size-8"
              initial={{ y: 0, x: 0, scale: 0.4, opacity: 0 }}
              animate={{
                y: -260,
                x: [0, h.drift, h.drift * 0.4],
                scale: [0.4, 1.1, 0.9],
                opacity: [0, 1, 0],
              }}
              transition={{ duration: 2.2, ease: 'easeOut' }}
              onAnimationComplete={() => setHearts((prev) => prev.filter((x) => x.id !== h.id))}
            >
              <GradientHeart palette={h.palette} id={h.id} />
            </motion.span>
          ))}
        </AnimatePresence>
      </div>

      {/* Comments and the field */}
      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/65 via-black/30 to-transparent px-3 pt-24 pb-3">
        <ul
          aria-live="polite"
          className="mb-3 flex max-h-56 flex-col justify-end gap-2 overflow-hidden mask-t-from-70% pr-14"
        >
          <AnimatePresence initial={false}>
            {lines.map((line) => (
              <motion.li
                key={line.id}
                layout="position"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className="flex items-start gap-2 text-sm leading-5 drop-shadow-[0_1px_2px_rgb(0_0_0/0.6)]"
              >
                <UserAvatar src={line.avatarUrl} alt="" size={28} />
                {line.kind === 'comment' ? (
                  <span className="min-w-0 wrap-break-word">
                    <span className="block font-semibold">{line.username}</span>
                    {line.text}
                  </span>
                ) : (
                  <span className="self-center text-white/85">
                    <span className="font-semibold">{line.username}</span> {t('joined')}
                  </span>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            sendComment();
          }}
          className="flex items-center gap-2"
        >
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={LIVE_COMMENT_MAX}
            placeholder={t('commentPlaceholder')}
            aria-label={t('commentPlaceholder')}
            className="h-11 min-w-0 flex-1 rounded-full border border-white/30 bg-black/30 px-4 text-sm text-white outline-none backdrop-blur-xl transition-colors placeholder:text-white/75 focus:border-white/60 focus:bg-black/45"
          />
          <motion.button
            type="button"
            onClick={sendHeart}
            whileTap={{ scale: 0.82 }}
            aria-label={t('sendHeart')}
            className="grid size-11 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <Heart className="size-7 drop-shadow-[0_1px_3px_rgb(0_0_0/0.55)]" />
          </motion.button>
        </form>
      </div>
    </>
  );
}

const HEART_PATH =
  'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z';

/** The same two gradients as the double-tap heart on posts */
function GradientHeart({ palette, id }: { palette: 'classic' | 'love'; id: number }) {
  const gradientId = `live-heart-${id}`;
  const stops =
    palette === 'classic'
      ? ['var(--story-ring-1)', 'var(--story-ring-2)', 'var(--story-ring-3)', 'var(--story-ring-4)']
      : ['var(--like)', 'var(--story-ring-3)', 'var(--dm-from)'];
  return (
    <svg viewBox="0 0 24 24" className="size-full drop-shadow-[0_2px_6px_rgb(0_0_0/0.35)]">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
          {stops.map((color, i) => (
            <stop key={color} offset={`${(i / (stops.length - 1)) * 100}%`} stopColor={color} />
          ))}
        </linearGradient>
      </defs>
      <path
        d={HEART_PATH}
        fill={`url(#${gradientId})`}
        stroke={`url(#${gradientId})`}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
  );
}
