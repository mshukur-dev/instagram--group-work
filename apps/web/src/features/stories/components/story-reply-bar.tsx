'use client';

import type { Story } from '@instagram/shared';
import { Heart, Send } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { useReplyToStory } from '@/features/direct/queries';
import { useLikeStory } from '../queries';
import { cn } from '@/lib/utils';

const QUICK = ['😂', '😮', '😍', '😢', '👏', '🔥', '🎉', '💯'];

// Where each small heart of the like burst flies (px from the button's center)
const HEARTS = [
  { x: -26, y: -46, s: 1.1, r: -20 },
  { x: -6, y: -62, s: 0.9, r: -6 },
  { x: 14, y: -54, s: 1.2, r: 12 },
  { x: 30, y: -34, s: 0.8, r: 24 },
  { x: -34, y: -22, s: 0.7, r: -30 },
];

type Props = {
  story: Story;
  /** While typing the story stands still */
  onActiveChange: (active: boolean) => void;
};

// STORY-6: the bottom of someone else's story. "Reply to …" sends a message to the 1:1 chat
// with them (with a picture of the story); focusing it pauses the story and slides in a row of
// quick reactions that go with one tap. The heart likes the story: the author is notified
// (a notification, not a message) and it fills red with a small burst of hearts.
export function StoryReplyBar({ story, onActiveChange }: Props) {
  const t = useTranslations('stories.reply');
  const reduceMotion = useReducedMotion();
  const reply = useReplyToStory();
  const like = useLikeStory();
  const liked = story.isLiked;
  const [burst, setBurst] = useState(0);

  const toggleLike = () => {
    if (!liked && !reduceMotion) setBurst((n) => n + 1);
    like.mutate({ id: story.id, liked: !liked }, { onError: () => toast.error(t('likeFailed')) });
  };
  const field = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [flying, setFlying] = useState<{ id: number; emoji: string } | null>(null);

  const setActive = (active: boolean) => {
    setFocused(active);
    onActiveChange(active);
  };

  const send = (value: string, emoji?: string) => {
    const body = value.trim();
    if (!body || reply.isPending) return;
    if (emoji && !reduceMotion) setFlying({ id: Date.now(), emoji });
    reply.mutate(
      { authorId: story.author.id, storyId: story.id, text: body },
      {
        onSuccess: () => toast.success(t('sent', { username: story.author.username })),
        onError: () => toast.error(t('failed')),
      },
    );
    setText('');
    field.current?.blur();
  };

  return (
    <div
      // Clicks here are not taps on the story
      onPointerDown={(event) => event.stopPropagation()}
      className="absolute inset-x-0 bottom-0 z-10 bg-linear-to-t from-black/55 via-black/20 to-transparent px-3 pt-16 pb-3 max-md:pb-[max(env(safe-area-inset-bottom),12px)]"
    >
      {/* Quick reactions, while the field is open */}
      <AnimatePresence>
        {focused && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 520, damping: 34 }}
            className="mb-3 grid grid-cols-8 gap-1"
          >
            {QUICK.map((emoji, i) => (
              <motion.button
                key={emoji}
                type="button"
                // keep the field focused until the tap lands
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => send(emoji, emoji)}
                aria-label={t('react', { emoji })}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 600, damping: 22, delay: i * 0.025 }}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.85 }}
                className="grid aspect-square place-items-center rounded-full text-[28px] outline-none focus-visible:ring-2 focus-visible:ring-white/60 max-md:text-2xl"
              >
                {emoji}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          send(text);
        }}
        className="flex items-center gap-2"
      >
        <input
          ref={field}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onFocus={() => setActive(true)}
          onBlur={() => setActive(false)}
          onKeyDown={(event) => {
            // Typing is not story navigation (arrows, Space) and Esc only leaves the field
            event.stopPropagation();
            if (event.key === 'Escape') field.current?.blur();
          }}
          placeholder={t('placeholder', { username: story.author.username })}
          aria-label={t('placeholder', { username: story.author.username })}
          maxLength={1000}
          className={cn(
            'h-11 min-w-0 flex-1 rounded-full border px-4 text-sm text-white shadow-[0_2px_12px_rgb(0_0_0/0.25)] outline-none backdrop-blur-xl backdrop-saturate-150 transition-colors placeholder:text-white/85',
            focused ? 'border-white/55 bg-black/55' : 'border-white/25 bg-black/35',
          )}
        />
        <AnimatePresence mode="popLayout" initial={false}>
          {text.trim() ? (
            <motion.button
              key="send"
              type="submit"
              disabled={reply.isPending}
              aria-label={t('send')}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              whileTap={{ scale: 0.88 }}
              className="grid size-11 shrink-0 place-items-center rounded-full text-white outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <Send className="size-6" />
            </motion.button>
          ) : (
            <motion.button
              key="heart"
              type="button"
              onClick={toggleLike}
              aria-label={t(liked ? 'unlike' : 'like')}
              aria-pressed={liked}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              whileTap={{ scale: 0.8 }}
              className="relative grid size-11 shrink-0 place-items-center rounded-full text-white outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <motion.span
                key={liked ? 'on' : 'off'}
                initial={reduceMotion ? false : { scale: liked ? 0.4 : 1.2 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 520, damping: 14 }}
                className="grid place-items-center"
              >
                <Heart
                  className={cn(
                    'size-7 drop-shadow-[0_1px_3px_rgb(0_0_0/0.55)] transition-colors',
                    liked && 'fill-destructive text-destructive',
                  )}
                />
              </motion.span>
              {/* A little fountain of hearts when it is liked */}
              <AnimatePresence>
                {burst > 0 && (
                  <motion.span
                    key={burst}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 0.2, delay: 0.7 }}
                    onAnimationComplete={() => setBurst(0)}
                  >
                    {HEARTS.map((h, i) => (
                      <motion.span
                        key={i}
                        className="absolute top-1/2 left-1/2 text-destructive"
                        initial={{ x: '-50%', y: '-50%', scale: 0.3, opacity: 1 }}
                        animate={{ x: h.x, y: h.y, scale: h.s, opacity: 0, rotate: h.r }}
                        transition={{ duration: 0.8, ease: [0.2, 0.7, 0.3, 1] }}
                      >
                        <Heart className="size-3.5 fill-current" />
                      </motion.span>
                    ))}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          )}
        </AnimatePresence>
      </form>

      {/* The chosen reaction flies up and fades, like it was sent into the story */}
      <AnimatePresence>
        {flying && (
          <motion.span
            key={flying.id}
            aria-hidden="true"
            initial={{ y: 0, scale: 0.6, opacity: 0 }}
            animate={{ y: -260, scale: [0.6, 1.8, 1.4], opacity: [0, 1, 0] }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            onAnimationComplete={() => setFlying(null)}
            className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 text-5xl"
          >
            {flying.emoji}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
